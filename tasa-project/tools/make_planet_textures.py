"""Procedural textures for the TASA 3D planet and its moons.

Writes WebP maps to assets/3d/textures/ (see docs/04-3d-scroll-plan.md):
  planet-color.webp      4096x2048  sRGB albedo (oceans, biomes, ice)
  planet-normal.webp     4096x2048  tangent-space normal map from the height field
  planet-roughness.webp  2048x1024  glTF metallicRoughness layout (G = roughness)
  planet-clouds.webp     4096x2048  RGBA, white with alpha coverage
  moon-color.webp        1024x512   cratered regolith albedo
  moon-normal.webp       1024x512   crater relief

Every field is sampled on the unit sphere (3D noise), so the equirectangular maps have no
seam at the date line and no pinching at the poles.

    python tools/make_planet_textures.py            # full size
    python tools/make_planet_textures.py --preview  # quarter size, fast
"""
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', '3d', 'textures')
SEED = 7

# ---------------------------------------------------------------- noise -------
_rng = np.random.default_rng(SEED)
PERM = np.tile(_rng.permutation(256), 2).astype(np.int32)
GRAD = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
                 [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], np.float32)


def perlin(x, y, z):
    """Classic 3D gradient noise, roughly in [-1, 1]."""
    xf, yf, zf = np.floor(x), np.floor(y), np.floor(z)
    xi, yi, zi = xf.astype(np.int32) & 255, yf.astype(np.int32) & 255, zf.astype(np.int32) & 255
    x, y, z = x - xf, y - yf, z - zf
    u, v, w = (t * t * t * (t * (t * 6 - 15) + 10) for t in (x, y, z))

    def g(h, dx, dy, dz):
        gr = GRAD[h % 12]
        return gr[..., 0] * dx + gr[..., 1] * dy + gr[..., 2] * dz

    a, b = PERM[xi] + yi, PERM[xi + 1] + yi
    aa, ab, ba, bb = PERM[a] + zi, PERM[a + 1] + zi, PERM[b] + zi, PERM[b + 1] + zi
    x1 = g(PERM[aa], x, y, z) + u * (g(PERM[ba], x - 1, y, z) - g(PERM[aa], x, y, z))
    x2 = g(PERM[ab], x, y - 1, z) + u * (g(PERM[bb], x - 1, y - 1, z) - g(PERM[ab], x, y - 1, z))
    y1 = x1 + v * (x2 - x1)
    x3 = g(PERM[aa + 1], x, y, z - 1) + u * (g(PERM[ba + 1], x - 1, y, z - 1) - g(PERM[aa + 1], x, y, z - 1))
    x4 = g(PERM[ab + 1], x, y - 1, z - 1) + u * (g(PERM[bb + 1], x - 1, y - 1, z - 1) - g(PERM[ab + 1], x, y - 1, z - 1))
    y2 = x3 + v * (x4 - x3)
    return y1 + w * (y2 - y1)


def fbm(p, octaves, freq=1.0, gain=0.5, lac=2.03, off=0.0):
    x, y, z = p
    s, a, tot = 0.0, 1.0, 0.0
    for i in range(octaves):
        s = s + a * perlin(x * freq + off + i * 17.1, y * freq + off * 0.7 + i * 9.3, z * freq - off + i * 4.7)
        tot += a
        a *= gain
        freq *= lac
    return s / tot


def ridged(p, octaves, freq):
    """Sharp crests (mountain ranges): 1 - |noise|, squared, with octave weighting."""
    x, y, z = p
    s, a, tot, wgt = 0.0, 1.0, 0.0, 1.0
    for i in range(octaves):
        n = 1.0 - np.abs(perlin(x * freq + i * 31.7, y * freq + i * 5.9, z * freq + i * 12.3))
        n = n * n * wgt
        wgt = np.clip(n * 1.6, 0, 1)
        s = s + a * n
        tot += a
        a *= 0.5
        freq *= 2.1
    return s / tot


def sphere_points(w, h, r0, r1):
    v = (np.arange(r0, r1, dtype=np.float32) + 0.5) / h
    u = (np.arange(w, dtype=np.float32) + 0.5) / w
    lon = (u - 0.5) * 2 * np.pi
    lat = (0.5 - v) * np.pi
    lon, lat = np.meshgrid(lon, lat)
    cl = np.cos(lat)
    return np.stack([cl * np.cos(lon), np.sin(lat), cl * np.sin(lon)]), lat


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------ planet fields --
def planet_rows(args):
    w, h, r0, r1 = args
    p, lat = sphere_points(w, h, r0, r1)
    # Domain warp: bends the continents into natural, irregular shapes.
    q = p + 0.42 * np.stack([fbm(p, 4, 1.4, off=o) for o in (1.3, 7.9, 13.1)])
    cont = fbm(q, 8, 1.15)
    mount = ridged(q, 6, 2.6)
    detail = fbm(p, 5, 18.0, off=3.3)
    moist = fbm(p + 0.25 * q, 5, 2.2, off=21.0)
    icen = fbm(p, 4, 5.0, off=40.0)
    # clouds: stretched along longitude into bands, then swirled
    cp = np.stack([p[0], p[1] * 2.4, p[2]])
    cq = cp + 0.55 * np.stack([fbm(cp, 3, 1.8, off=o) for o in (51.0, 57.0, 63.0)])
    cloud = fbm(cq, 7, 2.3, gain=0.55, off=70.0)
    wisp = fbm(cq, 4, 9.0, off=90.0)
    return [a.astype(np.float32) for a in (cont, mount, detail, moist, icen, cloud, wisp, lat)]


def compute_fields(w, h, procs=os.cpu_count() or 4):
    step = max(8, h // (procs * 4))
    jobs = [(w, h, r, min(h, r + step)) for r in range(0, h, step)]
    with Pool(procs) as pool:
        parts = pool.map(planet_rows, jobs)
    return [np.concatenate([part[i] for part in parts]) for i in range(8)]


def mix(a, b, t):
    t = t[..., None]
    return a * (1 - t) + b * t


def C(*rgb):
    return np.array(rgb, np.float32) / 255.0


def build_planet(w, h):
    cont, mount, detail, moist, icen, cloud, wisp, lat = compute_fields(w, h)
    alat = np.degrees(np.abs(lat))

    # Height: continents + mountain ranges that only rise inland + fine detail.
    sea = np.quantile(cont, 0.62)                       # ~38% land
    inland = smoothstep(sea, sea + 0.12, cont)
    height = cont + 0.22 * inland * (mount - 0.35) + 0.035 * detail
    sea = np.quantile(height, 0.62)
    land = height > sea
    hmax = height.max()
    e = np.clip((height - sea) / (hmax - sea), 0, 1)        # 0 coast .. 1 highest peak
    d = np.clip((sea - height) / (sea - height.min()), 0, 1)  # 0 coast .. 1 deepest

    # Ocean: turquoise shelves fading to deep blue.
    ocean = mix(C(38, 120, 130), C(14, 66, 104), smoothstep(0.0, 0.10, d))
    ocean = mix(ocean, C(8, 33, 68), smoothstep(0.08, 0.45, d))
    ocean = mix(ocean, C(5, 20, 46), smoothstep(0.45, 1.0, d))

    # Land biomes from moisture, latitude (dry subtropics, cold poles) and elevation.
    arid = np.exp(-((alat - 24.0) / 11.0) ** 2)
    m = np.clip(0.5 + 0.9 * moist - 0.42 * arid + 0.12 * (1 - alat / 90.0), 0, 1)
    cold = smoothstep(48.0, 66.0, alat + 6.0 * detail)
    veg = mix(C(196, 160, 104), C(170, 132, 84), smoothstep(-0.2, 0.3, detail))      # desert
    veg = mix(veg, C(118, 122, 66), smoothstep(0.28, 0.45, m))                       # steppe
    veg = mix(veg, C(58, 96, 42), smoothstep(0.45, 0.62, m))                         # grass/forest
    veg = mix(veg, C(30, 66, 34), smoothstep(0.62, 0.85, m))                         # dense forest
    veg = mix(veg, C(112, 108, 86), cold)                                            # tundra
    landc = mix(veg, C(108, 94, 76), smoothstep(0.22, 0.42, e))                      # highland rock
    landc = mix(landc, C(140, 132, 122), smoothstep(0.42, 0.62, e))                  # bare peaks
    beach = smoothstep(0.018, 0.0, e) * (1 - cold) * smoothstep(0.55, 0.2, m)
    landc = mix(landc, C(206, 190, 148), beach)
    snow = smoothstep(0.74, 0.88, e + 0.32 * cold + 0.06 * detail)
    landc = mix(landc, C(236, 240, 244), snow)
    # Crests catch light, valleys stay darker: a little baked relief.
    landc = landc * (0.86 + 0.24 * np.clip(mount, 0, 1))[..., None]

    color = np.where(land[..., None], landc, ocean)
    # Polar caps (small, ragged) and sea ice.
    cap = smoothstep(77.0, 79.5, alat + 9.0 * icen)
    color = mix(color, C(226, 234, 240), cap)
    color *= (0.95 + 0.1 * detail)[..., None]

    # Roughness (glTF: G channel). Water is glossy so the sun leaves a glint.
    rough = np.where(land, 0.82 - 0.2 * snow, 0.42 + 0.12 * d)
    rough = np.where(cap > 0.5, 0.55, rough)

    # Normal map from land height (sea is flat). Gradients are per metre of surface, so
    # longitude steps are scaled by cos(latitude).
    hn = np.where(land, height, sea) + 0.02 * cap * icen
    dlon = 2 * np.pi / w
    dlat = np.pi / h
    gx = (np.roll(hn, -1, 1) - np.roll(hn, 1, 1)) / (2 * dlon * np.maximum(np.cos(lat), 0.05))
    hp = np.pad(hn, ((1, 1), (0, 0)), mode='edge')
    gy = (hp[:-2] - hp[2:]) / (2 * dlat)                 # northward
    k = 0.75
    nrm = np.stack([-k * gx, -k * gy, np.ones_like(hn)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)

    # Clouds: banded, swirled, eroded at the edges; thinner over the dry subtropics.
    band = 0.10 * np.cos(np.radians(alat) * 3.2) - 0.08 * arid
    cov = cloud + band + 0.18 * (wisp - 0.0)
    alpha = smoothstep(-0.02, 0.34, cov) * (0.7 + 0.3 * smoothstep(-0.3, 0.4, wisp))
    alpha = np.clip(alpha * 0.92, 0, 1)

    return color, rough, nrm, alpha


# ------------------------------------------------------------------ moons ----
def build_moon(w, h):
    p, lat = sphere_points(w, h, 0, h)
    rng = np.random.default_rng(SEED + 1)
    base = fbm(p, 6, 3.0, off=5.0)
    maria = smoothstep(0.05, 0.25, fbm(p, 4, 1.2, off=9.0))
    height = 0.04 * fbm(p, 5, 10.0, off=2.0)
    rim_light = np.zeros_like(base)
    # Crater sizes follow a power law: many small, a few large.
    n = 420
    cdir = rng.normal(size=(n, 3)).astype(np.float32)
    cdir /= np.linalg.norm(cdir, axis=1, keepdims=True)
    radii = (0.018 * (1 - rng.random(n)) ** -0.55).clip(0.018, 0.16).astype(np.float32)
    for c, r in zip(cdir, radii):
        ang = np.arccos(np.clip(np.tensordot(c, p, 1), -1, 1)) / r
        near = ang < 1.6
        if not near.any():
            continue
        a = ang[near]
        bowl = np.where(a < 1, -(1 - a * a), 0.0)
        rim = 0.3 * np.exp(-((a - 1.0) / 0.18) ** 2)
        height[near] += r * (bowl + rim)
        rim_light[near] += rim - 0.25 * np.where(a < 1, 1 - a, 0)
    albedo = 0.55 + 0.10 * base - 0.13 * maria + 0.07 * np.clip(rim_light, -0.5, 1)
    color = np.clip(albedo, 0, 1)[..., None] * C(208, 204, 198)[None, None]
    dlon, dlat = 2 * np.pi / w, np.pi / h
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * dlon * np.maximum(np.cos(lat), 0.05))
    hp = np.pad(height, ((1, 1), (0, 0)), mode='edge')
    gy = (hp[:-2] - hp[2:]) / (2 * dlat)
    k = 1.1
    nrm = np.stack([-k * gx, -k * gy, np.ones_like(height)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    return color, nrm


# ------------------------------------------------------------------ output ---
def to8(a):
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


def save(img, name, **kw):
    path = os.path.join(OUT, name)
    img.save(path, 'WEBP', method=6, **kw)
    print(f'  {name:24s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB')


def main():
    preview = '--preview' in sys.argv
    W, H = (1024, 512) if preview else (4096, 2048)
    os.makedirs(OUT, exist_ok=True)
    print(f'planet {W}x{H} ...')
    color, rough, nrm, alpha = build_planet(W, H)
    save(Image.fromarray(to8(color)), 'planet-color.webp', quality=92)
    save(Image.fromarray(to8(nrm * 0.5 + 0.5)), 'planet-normal.webp', quality=94)
    r = to8(rough)
    mr = np.stack([np.full_like(r, 255), r, np.zeros_like(r)], -1)
    save(Image.fromarray(mr).resize((W // 2, H // 2), Image.LANCZOS), 'planet-roughness.webp', quality=90)
    a = to8(alpha)
    save(Image.fromarray(np.dstack([np.full((H, W, 3), 255, np.uint8), a]), 'RGBA'), 'planet-clouds.webp', quality=90)
    mw, mh = (512, 256) if preview else (1024, 512)
    print(f'moon {mw}x{mh} ...')
    mc, mn = build_moon(mw, mh)
    save(Image.fromarray(to8(mc)), 'moon-color.webp', quality=92)
    save(Image.fromarray(to8(mn * 0.5 + 0.5)), 'moon-normal.webp', quality=94)


if __name__ == '__main__':
    main()

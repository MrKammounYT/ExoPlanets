import numpy as np
from PIL import Image
import sys, os

out = sys.argv[1]
os.makedirs(out, exist_ok=True)


def lattice(n, seed):
    return np.random.default_rng(seed).random((n, n, n)).astype(np.float32)


LAT = lattice(32, 11)


def sm(t):
    return t * t * (3 - 2 * t)


def vnoise(x, y, z):
    n = LAT.shape[0]
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    zi = np.floor(z).astype(np.int64)
    xf, yf, zf = sm(x - xi), sm(y - yi), sm(z - zi)
    x0, x1 = xi % n, (xi + 1) % n
    y0, y1 = yi % n, (yi + 1) % n
    z0, z1 = zi % n, (zi + 1) % n
    c = lambda a, b, d: LAT[a, b, d]
    c00 = c(x0, y0, z0) * (1 - xf) + c(x1, y0, z0) * xf
    c10 = c(x0, y1, z0) * (1 - xf) + c(x1, y1, z0) * xf
    c01 = c(x0, y0, z1) * (1 - xf) + c(x1, y0, z1) * xf
    c11 = c(x0, y1, z1) * (1 - xf) + c(x1, y1, z1) * xf
    c0 = c00 * (1 - yf) + c10 * yf
    c1 = c01 * (1 - yf) + c11 * yf
    return c0 * (1 - zf) + c1 * zf


def fbm(x, y, z, octaves=6):
    s = 0.0
    a = 0.5
    f = 1.0
    tot = 0.0
    for i in range(octaves):
        s = s + a * vnoise(x * f + i * 13.7, y * f + i * 7.3, z * f + i * 3.1)
        tot += a
        a *= 0.5
        f *= 2.03
    return s / tot


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def norm(v):
    v = np.array(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def rot(sx, sy, sz, ay, ax):
    cy, sy_ = np.cos(ay), np.sin(ay)
    x = sx * cy + sz * sy_
    z = -sx * sy_ + sz * cy
    y = sy
    cx, sx_ = np.cos(ax), np.sin(ax)
    y2 = y * cx - z * sx_
    z2 = y * sx_ + z * cx
    return x, y2, z2


def render_planet(N=1000, R=380, seed_off=0.0):
    px = np.arange(N, dtype=np.float64) + 0.5
    X, Y = np.meshgrid(px, px)
    cx = cy = N / 2
    x = (X - cx) / R
    y = -(Y - cy) / R
    r2 = x * x + y * y
    r = np.sqrt(r2)
    rpx = r * R
    pa = np.clip((R - rpx) / 1.5 + 0.5, 0, 1)
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    nx, ny = x, y
    sx, sy, sz = rot(nx, ny, nz, 0.9, 0.35)

    e = fbm(sx * 1.7 + 5, sy * 1.7, sz * 1.7 + seed_off, 6)
    land = smoothstep(0.50, 0.545, e)
    moist = fbm(sx * 2.6 + 90, sy * 2.6, sz * 2.6, 4)
    ice = smoothstep(0.80, 0.92, np.abs(sy) + 0.16 * (e - 0.5))

    ocean_deep = np.array([0.025, 0.065, 0.11])
    ocean_shal = np.array([0.07, 0.17, 0.22])
    t = smoothstep(0.38, 0.52, e)[..., None]
    ocean = ocean_deep * (1 - t) + ocean_shal * t

    low = np.array([0.12, 0.22, 0.12])
    high = np.array([0.30, 0.30, 0.22])
    dry = np.array([0.36, 0.33, 0.25])
    th = smoothstep(0.54, 0.66, e)[..., None]
    land_c = low * (1 - th) + high * th
    dm = smoothstep(0.28, 0.48, moist)[..., None]
    land_c = land_c * dm + dry * (1 - dm) * 0.9 + land_c * (1 - dm) * 0.1
    surf = ocean * (1 - land[..., None]) + land_c * land[..., None]
    surf = surf * (1 - ice[..., None]) + np.array([0.86, 0.90, 0.93]) * ice[..., None]

    cl = fbm(sx * 4.6 + 40, sy * 3.2 + 7, sz * 4.6, 6)
    cloud = smoothstep(0.50, 0.70, cl) * 0.8
    cloud_c = np.array([0.92, 0.95, 0.98])

    L = norm([-0.62, 0.50, 0.60])
    ndl = nx * L[0] + ny * L[1] + nz * L[2]
    diffuse = np.clip(ndl, 0, 1) ** 0.85
    shade = 0.022 + 1.2 * diffuse

    base = surf * (1 - cloud[..., None]) + cloud_c * cloud[..., None]
    col = base * shade[..., None]

    H = norm(L + np.array([0, 0, 1]))
    nh = np.clip(nx * H[0] + ny * H[1] + nz * H[2], 0, 1)
    spec = (nh ** 70) * 0.55 * (1 - land) * (1 - cloud) * (ndl > 0)
    col = col + spec[..., None] * np.array([0.7, 0.85, 1.0])

    fres = (1 - nz) ** 2.6
    litf = smoothstep(-0.35, 0.8, ndl)
    atmo = np.array([0.42, 0.62, 0.95])
    col = col + (fres * (0.10 + 0.9 * litf))[..., None] * atmo * 0.9
    rim = (1 - nz) ** 5 * 1.7 * np.clip(ndl + 0.35, 0, 1)
    col = col + rim[..., None] * np.array([0.72, 0.86, 1.0])

    # outer halo
    d = np.clip((rpx - R) / R, 0, None)
    L2 = norm([L[0], L[1], 0.0])[:2]
    rn = np.where(r > 0, r, 1)
    dirdot = (x / rn) * L2[0] + (y / rn) * L2[1]
    lf = np.clip(0.18 + 0.82 * dirdot, 0, 1) ** 1.5
    halo = np.exp(-d * 11) * 0.5 * lf
    halo = halo * (d < 0.5)
    halo_c = np.array([0.45, 0.66, 0.98])

    A = pa + (1 - pa) * halo
    num = pa[..., None] * np.clip(col, 0, 1) + ((1 - pa) * halo)[..., None] * halo_c
    rgb = np.where(A[..., None] > 1e-4, num / np.maximum(A[..., None], 1e-4), 0)

    # limb bloom
    bx = cx + L2[0] * R * 0.98
    by = cy - L2[1] * R * 0.98
    g = np.exp(-(((X - bx) ** 2 + (Y - by) ** 2) / (2 * 70.0 ** 2))) * 0.35
    A2 = np.clip(A + g * (1 - A), 0, 1)
    rgb = (rgb * A[..., None] + np.array([0.85, 0.93, 1.0]) * (g * (1 - A))[..., None]) / np.maximum(A2[..., None], 1e-4)
    A = A2

    out_img = np.dstack([np.clip(rgb, 0, 1), A])
    return Image.fromarray((out_img * 255).astype(np.uint8), "RGBA")


def render_moon(N=320, R=120):
    px = np.arange(N, dtype=np.float64) + 0.5
    X, Y = np.meshgrid(px, px)
    c = N / 2
    x = (X - c) / R
    y = -(Y - c) / R
    r2 = x * x + y * y
    r = np.sqrt(r2)
    pa = np.clip((R - r * R) / 1.5 + 0.5, 0, 1)
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    sx, sy, sz = rot(x, y, nz, 2.1, 0.2)
    e = fbm(sx * 3.0 + 3, sy * 3.0, sz * 3.0, 6)
    ridged = 1 - np.abs(fbm(sx * 5.5, sy * 5.5 + 9, sz * 5.5, 4) * 2 - 1)
    albedo = 0.30 + 0.42 * e + 0.10 * ridged
    L = norm([-0.7, 0.35, 0.62])
    ndl = x * L[0] + y * L[1] + nz * L[2]
    shade = 0.015 + 1.25 * np.clip(ndl, 0, 1) ** 0.9
    v = np.clip(albedo * shade, 0, 1)
    col = np.dstack([v * 0.96, v * 0.98, v * 1.02])
    img = np.dstack([np.clip(col, 0, 1), pa])
    return Image.fromarray((img * 255).astype(np.uint8), "RGBA")


def render_stars(W=1600, H=1200, seed=5):
    rng = np.random.default_rng(seed)
    a = np.zeros((H, W, 3), dtype=np.float32)
    n_small = 900
    for _ in range(n_small):
        xx, yy = rng.integers(0, W), rng.integers(0, H)
        b = rng.random() ** 3 * 0.75 + 0.10
        tint = rng.choice([0, 1, 2], p=[0.7, 0.2, 0.1])
        c = [(1, 1, 1), (0.75, 0.85, 1.0), (1.0, 0.92, 0.8)][tint]
        a[yy, xx] += np.array(c) * b
    for _ in range(26):
        xx, yy = rng.integers(0, W), rng.integers(0, H)
        b = 0.7 + rng.random() * 0.3
        a[yy, xx] += b
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a[(yy + dy) % H, (xx + dx) % W] += b * 0.35
    k = np.array([1, 4, 6, 4, 1], dtype=np.float32) / 16
    blur = np.zeros_like(a)
    for i, w in enumerate(k):
        blur += w * np.roll(a, i - 2, axis=1)
    b2 = np.zeros_like(a)
    for i, w in enumerate(k):
        b2 += w * np.roll(blur, i - 2, axis=0)
    soft = np.clip(a * 0.75 + b2 * 2.2, 0, 1)
    alpha = np.clip(soft.max(axis=2), 0, 1)
    rgb = np.where(alpha[..., None] > 0, soft / np.maximum(alpha[..., None], 1e-4), 0)
    img = np.dstack([np.clip(rgb, 0, 1), alpha])
    return Image.fromarray((img * 255).astype(np.uint8), "RGBA")


render_planet().save(os.path.join(out, "tasa-planet.png"), optimize=True)
render_moon().save(os.path.join(out, "tasa-moon.png"), optimize=True)
render_stars().save(os.path.join(out, "tasa-stars.png"), optimize=True)
print("done")

// 3D hero planet. Follows docs/04-3d-scroll-plan.md.
// Loads assets/3d/tasa-scene.glb (planet, clouds, moons) and adds the atmosphere,
// which is not in the GLB, as a Fresnel shader. Light and radii come from scene-params.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from '../../assets/3d/tasa-scene.glb?url';
import params from '../../assets/3d/scene-params.json';
// Higher-quality maps from tools/make_planet_textures.py. They replace the maps baked into the
// GLB at load time (the GLB itself is untouched); if one fails to load, the GLB's map stays.
import planetColorUrl from '../../assets/3d/textures/planet-color.webp?url';
import planetNormalUrl from '../../assets/3d/textures/planet-normal.webp?url';
import planetRoughUrl from '../../assets/3d/textures/planet-roughness.webp?url';
import cloudsUrl from '../../assets/3d/textures/planet-clouds.webp?url';
import moonColorUrl from '../../assets/3d/textures/moon-color.webp?url';
import moonNormalUrl from '../../assets/3d/textures/moon-normal.webp?url';

const TEXTURES = {
  planetColor: [planetColorUrl, true],
  planetNormal: [planetNormalUrl, false],
  planetRough: [planetRoughUrl, false],
  clouds: [cloudsUrl, true],
  moonColor: [moonColorUrl, true],
  moonNormal: [moonNormalUrl, false]
};

async function loadTextures(maxAniso) {
  const loader = new THREE.TextureLoader();
  const entries = await Promise.all(Object.entries(TEXTURES).map(async ([key, [url, srgb]]) => {
    try {
      const t = await loader.loadAsync(url);
      t.flipY = false; // glTF UV convention, same as the GLB's own textures
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = maxAniso;
      t.wrapS = THREE.RepeatWrapping; // longitude wraps around the sphere
      return [key, t];
    } catch (err) {
      console.warn(`Planet texture ${key} failed to load; keeping the GLB map.`, err);
      return [key, null];
    }
  }));
  return Object.fromEntries(entries);
}

function swapMap(material, slot, texture) {
  if (!texture) return;
  if (material[slot]) material[slot].dispose();
  material[slot] = texture;
  material.needsUpdate = true;
}

const ATMO_COLOR = new THREE.Color('#6fa3f5');
const SPIN = (Math.PI * 2) / 90; // one revolution per 90 s
const CLOUD_SPIN = SPIN * 1.25;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Halo outside the limb (drawn on the back faces of a larger sphere).
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLight;
  uniform float uStrength;
  uniform float uEdge;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    // Back faces: d is 0 at the halo's outer edge and about -0.36 where it meets the planet's limb.
    float d = -dot(vNormalView, vec3(0.0, 0.0, 1.0));
    float rim = pow(clamp(d / uEdge, 0.0, 1.0), 2.2);
    float lit = smoothstep(-0.35, 0.65, dot(vNormalWorld, uLight));
    float a = rim * mix(0.12, 1.0, lit) * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// Thin haze over the lit disc, strongest at the limb (front faces, just above the clouds).
const hazeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLight;
  uniform float uStrength;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    float fres = pow(1.0 - clamp(dot(vNormalView, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
    float lit = smoothstep(-0.2, 0.8, dot(vNormalWorld, uLight));
    float a = fres * lit * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function atmosphereMaterial(fragmentShader, side, strength, light) {
  return new THREE.ShaderMaterial({
    vertexShader: atmoVertex,
    fragmentShader,
    uniforms: {
      uColor: { value: ATMO_COLOR.clone() },
      uLight: { value: light.clone() },
      uStrength: { value: strength },
      uEdge: { value: Math.sqrt(1 - 1 / (params.atmosphere_radius ** 2)) }
    },
    side,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function canUseWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Mounts the planet into `host` (a fixed, full-viewport layer). Resolves once the model and
 * textures are ready, rejects if loading fails (the caller keeps the static image).
 */
export async function mountPlanet(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'planet-canvas';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100); // fixed; the planet group moves
  camera.position.set(0, 0, params.camera_distance);

  const lightDir = new THREE.Vector3(...params.light_toward_sun_threejs).normalize();
  const sun = new THREE.DirectionalLight(0xffffff, 3.2);
  sun.position.copy(lightDir).multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8aa4c8, 0.06));

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const [gltf, tex] = await Promise.all([new GLTFLoader().loadAsync(glbUrl), loadTextures(maxAniso)]);
  const root = gltf.scene;

  const planet = root.getObjectByName('TASA_Planet');
  const clouds = root.getObjectByName('TASA_Clouds');
  const moonBig = root.getObjectByName('TASA_Moon');
  const moonSmall = root.getObjectByName('TASA_Moon_Small');
  if (!planet || !clouds) throw new Error('tasa-scene.glb is missing TASA_Planet or TASA_Clouds');

  planet.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    m.side = THREE.FrontSide;
    swapMap(m, 'map', tex.planetColor);
    swapMap(m, 'normalMap', tex.planetNormal);
    // glTF packs roughness (G) and metalness (B) in one texture; three reads both slots from it.
    if (tex.planetRough) { m.roughnessMap = tex.planetRough; m.metalnessMap = tex.planetRough; m.needsUpdate = true; }
    m.normalScale.set(1, m.normalScale.y < 0 ? -1 : 1); // strength is baked into the map
    for (const key of ['map', 'normalMap', 'roughnessMap']) if (m[key]) m[key].anisotropy = maxAniso;
  });
  clouds.traverse((o) => {
    if (!o.isMesh) return;
    o.material.side = THREE.FrontSide;
    o.material.depthWrite = false;
    swapMap(o.material, 'map', tex.clouds);
    o.renderOrder = 1;
  });
  // Moons: the GLB gives them a flat grey; give them a cratered surface. Brightness is in the
  // texture, so the GLB's grey tint is replaced by a light multiplier.
  for (const [moon, shade] of [[moonBig, 1], [moonSmall, 0.85]]) {
    moon?.traverse((o) => {
      if (!o.isMesh || !tex.moonColor) return;
      const m = o.material;
      m.map = tex.moonColor;
      if (tex.moonNormal) { m.normalMap = tex.moonNormal; m.normalScale.set(1, 1); }
      m.color.setScalar(shade);
      m.needsUpdate = true;
    });
  }

  // Planet group: everything that moves together with scroll.
  const world = new THREE.Group();
  world.add(root);
  scene.add(world);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(params.atmosphere_radius, 96, 96),
    atmosphereMaterial(haloFragment, THREE.BackSide, 2.2, lightDir)
  );
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(params.clouds_radius + 0.004, 96, 96),
    atmosphereMaterial(hazeFragment, THREE.FrontSide, 1.1, lightDir)
  );
  halo.renderOrder = 2;
  haze.renderOrder = 2;
  world.add(halo, haze);

  // Moons orbit on time, not scroll. Start from the positions authored in Blender.
  const moons = [moonBig, moonSmall].filter(Boolean).map((m, i) => {
    const p = m.position.clone();
    return { mesh: m, radius: i === 0 ? 1.32 : 1.22, y: p.y * 0.55, angle: Math.atan2(p.z, p.x), speed: i === 0 ? 0.035 : -0.05 };
  });

  // Everything the scroll timeline (scroll.js) animates. Positions are viewport pixels.
  const state = {
    x: window.innerWidth * 0.66,
    y: window.innerHeight * 0.5,
    r: 180, // planet radius in px
    opacity: 1,
    moons: 1, // moon scale, 0 hides them
    turn: 0, // extra planet rotation added by scroll, radians
    graze: 0, // 0 = sun from scene-params, 1 = low sun from the side (relief stands out)
    spinBoost: 1,
    tint: 0 // 0..1 toward tintColor (verdict tint)
  };
  const tintColor = new THREE.Color(ATMO_COLOR);
  const baseLight = lightDir.clone();
  // Low sun from the right: the planet sits on the left in the 'What counts' section,
  // so the terminator crosses its visible half and the relief stands out.
  const grazeLight = new THREE.Vector3(0.85, 0.35, -0.3).normalize();
  const curLight = new THREE.Vector3();
  const curColor = new THREE.Color();

  // The canvas covers the viewport; the camera never moves, the planet group does.
  let W = 1;
  let H = 1;
  function resize() {
    W = host.clientWidth || window.innerWidth;
    H = host.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  function applyState() {
    const unitsPerPx = (2 * params.camera_distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / H;
    world.position.set((state.x - W / 2) * unitsPerPx, -(state.y - H / 2) * unitsPerPx, 0);
    world.scale.setScalar(Math.max(state.r * unitsPerPx, 1e-4));
    root.rotation.y = state.turn;
    for (const m of moons) m.mesh.scale.setScalar(Math.max(state.moons, 1e-4));
    curLight.copy(baseLight).lerp(grazeLight, state.graze).normalize();
    sun.position.copy(curLight).multiplyScalar(10);
    curColor.copy(ATMO_COLOR).lerp(tintColor, state.tint * 0.85);
    for (const mat of [halo.material, haze.material]) {
      mat.uniforms.uLight.value.copy(curLight);
      mat.uniforms.uColor.value.copy(curColor);
    }
    const op = String(Math.round(state.opacity * 1000) / 1000);
    if (host.style.opacity !== op) host.style.opacity = op;
  }

  // Render loop, paused while the tab is hidden.
  let raf = 0;
  let last = performance.now();
  let running = false;
  document.addEventListener('visibilitychange', schedule);

  function frame() {
    raf = 0;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    planet.rotation.y += SPIN * state.spinBoost * dt;
    clouds.rotation.y += CLOUD_SPIN * state.spinBoost * dt;
    for (const m of moons) {
      m.angle += m.speed * dt;
      m.mesh.position.set(Math.cos(m.angle) * m.radius, m.y, Math.sin(m.angle) * m.radius);
      m.mesh.rotation.y += 0.05 * dt;
    }
    applyState();
    renderer.render(scene, camera);
    schedule();
  }
  function schedule() {
    const shouldRun = !document.hidden;
    if (shouldRun && !running) last = performance.now(); // resume without a time jump
    running = shouldRun;
    if (shouldRun && !raf) raf = requestAnimationFrame(frame);
  }

  host.append(canvas);
  // Upload textures before the first visible frame so the planet never appears untextured.
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);

  return {
    state,
    /** Set the verdict tint colour (CSS colour) used when state.tint > 0. */
    setTint(css) { tintColor.set(css); },
    /** Draw one frame now and start the loop. Call after state is positioned. */
    start() { applyState(); renderer.render(scene, camera); schedule(); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? [].concat(o.material) : [];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      canvas.remove();
    }
  };
}

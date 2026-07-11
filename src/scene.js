// Grafik-Grundgerüst: Renderer (WebGPU mit WebGL2-Fallback), Szene, Kamera,
// Beleuchtung (mit Echtzeit-Schatten), physikalisch inspirierter Himmel und
// HDR-Post-Processing (ACES-Tonemapping + Bloom).
import * as THREE from "three";
import {
  positionLocal, positionWorld, positionView, cameraPosition, color, mix, select,
  uniform, pass, float, smoothstep, hash, step, fog, saturation, renderOutput, screenUV,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";

export const scene = new THREE.Scene();
const FOG_DAY = new THREE.Color(0xc6d3e2);
const FOG_NIGHT = new THREE.Color(0x0b101c);
const FOG_BASE_DENSITY = 0.00021;

// ---- Höhennebel mit Sonnenstreuung (ersetzt den uniformen FogExp2) ----
// Der Dunst sammelt sich in den Tälern und lichtet sich mit der Höhe; in
// Sonnenrichtung glüht er warm auf (aerial perspective). Dichte und Farbe
// steuert updateSky(); das Wetter (weather.js) verstärkt uFogDensity.
export const uFogDensity = uniform(FOG_BASE_DENSITY);
const uFogColor = uniform(new THREE.Color(0xc6d3e2));
const uFogWarm = uniform(0); // Dämmerungs-Glut in Sonnenrichtung

export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 1, 16000);

// WebGPURenderer fällt automatisch auf WebGL2 zurück, wenn der Browser kein
// WebGPU kann. Vor dem ersten Rendern muss renderer.init() awaited werden
// (siehe main.js).
export const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Filmisches Tonemapping: HDR-Licht (Sonne, Feuer, Tracer) rollt weich ab,
// statt hart zu clippen — deutlich realistischere Lichtstimmung.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---- Beleuchtung: Sonne wandert im Tag-Nacht-Zyklus ----
// SUN_DIR wird pro Frame mutiert; alle Shader referenzieren denselben Vektor
// über uniform(SUN_DIR). uNight (0 Tag … 1 Nacht) steuert Fensterlichter,
// Fackeln usw. in anderen Modulen.
export const SUN_DIR = new THREE.Vector3(-0.5, 1.0, 0.35).normalize();
export const uNight = uniform(0);
const uSunElev = uniform(1);
const DAY_LEN = 480; // Sekunden pro voller Tag

const sun = new THREE.DirectionalLight(0xffeed2, 3.0);
sun.position.copy(SUN_DIR).multiplyScalar(3000);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -700;
sun.shadow.camera.right = 700;
sun.shadow.camera.top = 700;
sun.shadow.camera.bottom = -700;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 7000;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 2.5;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x55702f, 0.7);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambient);

// ---- Himmel: atmosphärische Kuppel (TSL) ----
// Rayleigh-artiger Verlauf (Zenit-Blau → heller Horizontdunst), warmes
// Vorwärts-Streulicht um die tiefstehende Sonne, Mie-Halo und eine
// HDR-Sonnenscheibe (>1), die das Bloom zum Aufstrahlen bringt.
const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
{
  const dir = positionLocal.normalize();
  const y = dir.y;
  const upness = y.max(0.0);

  // Tagesfaktor aus der Sonnenhöhe; nachts kippen alle Farben ins Dunkelblau.
  const dayF = smoothstep(-0.06, 0.16, uSunElev);
  const zenith = mix(color(0x050a16), color(0x1f52a2), dayF);
  const horizon = mix(color(0x0d1626), color(0xcfdcec), dayF);
  const groundHaze = mix(color(0x05070c), color(0x97a48f), dayF);

  const above = mix(horizon, zenith, upness.pow(0.45));
  const below = mix(horizon, groundHaze, y.negate().max(0.0).pow(0.6));
  const base = select(y.greaterThan(0.0), above, below);

  const mu = dir.dot(uniform(SUN_DIR));
  const muPos = mu.max(0.0);
  // Warmes Streulicht: stark in Sonnenrichtung, konzentriert am Horizont;
  // in der Dämmerung deutlich kräftiger (Abendrot).
  const dusk = smoothstep(0.45, 0.02, uSunElev).mul(dayF);
  const warm = muPos.pow(6.0).mul(float(1.0).sub(upness).pow(3.0)).mul(dusk.mul(1.6).add(0.55));
  // Weicher Dunst-Halo direkt um die Sonne.
  const halo = muPos.pow(32.0).mul(0.3);
  // Scharfe, HDR-helle Sonnenscheibe (~1° Durchmesser), unter dem Horizont aus.
  const sunVis = smoothstep(-0.1, 0.02, uSunElev);
  const disc = smoothstep(0.99950, 0.99983, mu).mul(22.0).mul(sunVis);

  // Sterne: Hash-Raster über die Blickrichtung, nur nachts sichtbar.
  // Innerhalb jeder Rasterzelle leuchtet nur ein weicher Punkt im Zentrum.
  const grid = dir.mul(90.0);
  const cell = grid.floor();
  const starH = hash(cell.x.add(cell.y.mul(57.0)).add(cell.z.mul(113.0)));
  const dot = smoothstep(0.24, 0.05, grid.fract().sub(0.5).length());
  const stars = step(0.998, starH).mul(dot)
    .mul(float(1.0).sub(dayF)).mul(upness.add(0.15).min(1.0)).mul(1.3);

  skyMat.colorNode = base
    .add(color(0xffd9a0).mul(warm.add(halo)).mul(sunVis))
    .add(color(0xfff3dc).mul(disc))
    .add(color(0xdfe8ff).mul(stars));
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), skyMat);
sky.frustumCulled = false;
scene.add(sky);

// Höhennebel aktivieren (nutzt die oben deklarierten Uniforms + SUN_DIR)
{
  const dist = positionView.z.negate();
  const hgt = positionWorld.y.max(0.0).mul(-0.0022).exp(); // 1 im Tal … →0 in der Höhe
  const density = uFogDensity.mul(hgt.mul(0.8).add(0.2));
  const factor = dist.mul(density).pow(2.0).negate().exp().oneMinus();
  const vdir = positionWorld.sub(cameraPosition).normalize();
  const sunAmt = vdir.dot(uniform(SUN_DIR)).max(0.0).pow(5.0).mul(uFogWarm);
  scene.fogNode = fog(mix(uFogColor, color(0xffc890), sunAmt), factor);
}

// ---- Umgebungsreflexionen (IBL): der Himmel wird in eine Cubemap gerendert,
// die alle PBR-Materialien (Gold, Metall, Wasser, Lack) spiegeln. Wird nur
// aktualisiert, wenn die Sonne merklich gewandert ist (s. updateSky).
const envRT = new THREE.CubeRenderTarget(128, {
  generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
});
const envCam = new THREE.CubeCamera(1, 5000, envRT);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat));
scene.environment = envRT.texture;
scene.environmentIntensity = 0.5;
let lastEnvElev = 99;

// ---- Post-Processing: HDR-Bloom ----
// Lässt helle Bereiche (Sonnenkern, Feuer, Tracer, glühende Augen) aufstrahlen.
// Schwelle 1.0 → nur HDR-helle (>1) Bereiche bluten, nicht der normale Himmel.
export const postFx = new THREE.RenderPipeline(renderer);
{
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode("output");
  const bloomPass = bloom(sceneColor);
  bloomPass.threshold.value = 1.0;
  bloomPass.strength.value = 0.45;
  bloomPass.radius.value = 0.4;

  // HDR-Komposition → Tonemapping/sRGB → leichte Sättigung → Vignette → FXAA
  let comp = renderOutput(sceneColor.add(bloomPass));
  comp = saturation(comp, 1.12);
  const d = screenUV.sub(0.5).length().mul(2.0);
  comp = comp.mul(float(1.0).sub(smoothstep(0.85, 1.65, d).mul(0.32)));
  postFx.outputColorTransform = false; // renderOutput wird oben manuell angewendet
  postFx.outputNode = fxaa(comp);
}

const SUN_DAY = new THREE.Color(0xffeed2);
const SUN_DUSK = new THREE.Color(0xff9040);

/**
 * Jedes Frame: Sonne über den Tag-Nacht-Zyklus bewegen, Licht/Nebel/Himmel
 * nachführen und das Schatten-Frustum an die Kamera koppeln.
 * @param {number} time  Spielzeit in Sekunden
 */
export function updateSky(time = 0) {
  // Sonnenbahn: startet am Vormittag, ein voller Tag dauert DAY_LEN Sekunden.
  const a = (time / DAY_LEN) * Math.PI * 2 + 0.85;
  const elev = Math.sin(a);
  SUN_DIR.set(Math.cos(a) * 0.85, Math.max(elev, -0.35), 0.35).normalize();
  uSunElev.value = elev;

  const dayF = THREE.MathUtils.smoothstep(elev, -0.02, 0.18);
  uNight.value = 1 - THREE.MathUtils.smoothstep(elev, -0.08, 0.1);

  // Licht: Sonne dimmt und färbt sich zur Dämmerung, nachts Restlicht.
  sun.intensity = 3.0 * dayF;
  sun.color.lerpColors(SUN_DUSK, SUN_DAY, THREE.MathUtils.smoothstep(elev, 0.05, 0.4));
  // Etwas zurückgenommen, weil die Environment-Map zusätzlich Licht beiträgt
  hemi.intensity = 0.1 + 0.46 * dayF;
  ambient.intensity = 0.04 + 0.05 * dayF;

  // Nebel: Farbe folgt dem Himmel; in der Dämmerung ziehen Schwaden auf und
  // der Dunst glüht in Sonnenrichtung warm.
  uFogColor.value.lerpColors(FOG_NIGHT, FOG_DAY, dayF);
  const lowSun = THREE.MathUtils.smoothstep(elev, 0.0, 0.06) * (1 - THREE.MathUtils.smoothstep(elev, 0.06, 0.3));
  uFogDensity.value = FOG_BASE_DENSITY * (1 + lowSun * 1.1);
  uFogWarm.value = (0.2 + lowSun * 1.3) * dayF;

  // Umgebungsreflexionen nachführen, wenn die Sonne merklich gewandert ist
  scene.environmentIntensity = 0.12 + 0.42 * dayF;
  if (Math.abs(elev - lastEnvElev) > 0.03) {
    lastEnvElev = elev;
    envCam.update(renderer, envScene);
  }

  sky.position.copy(camera.position);
  // Die Schattenkamera folgt dem Spieler, damit die 1400-m-Schattenbox
  // immer den sichtbaren Nahbereich abdeckt.
  sun.target.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(SUN_DIR, 3000);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

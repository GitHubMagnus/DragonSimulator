// Grafik-Grundgerüst: Renderer (WebGPU mit WebGL2-Fallback), Szene, Kamera,
// Beleuchtung und Himmel.
import * as THREE from "three";
import { positionLocal, color, mix, select, max } from "three/tsl";

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcdd8e6, 0.00021);

export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 1, 16000);

// WebGPURenderer fällt automatisch auf WebGL2 zurück, wenn der Browser kein
// WebGPU kann. Vor dem ersten Rendern muss renderer.init() awaited werden
// (siehe main.js).
export const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---- Beleuchtung: warme Mittagssonne + Himmelslicht ----
const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
sun.position.set(-0.5, 1.0, 0.35).multiplyScalar(2000);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x55702f, 0.85));
scene.add(new THREE.AmbientLight(0xffffff, 0.18));

// ---- Himmel: Gradient-Kuppel (TSL-Node-Material) ----
// Farbverlauf nach Blickrichtung: oben → Horizont → unten.
const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
{
  const dir = positionLocal.normalize();
  const y = dir.y;
  const top = color(0x2f6fb5);
  const horizon = color(0xcdd8e6);
  const bottom = color(0xa9b59a);
  const above = mix(horizon, top, max(y, 0).pow(0.5));
  const below = mix(horizon, bottom, max(y.negate(), 0).pow(0.7));
  skyMat.colorNode = select(y.greaterThan(0), above, below);
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 32, 16), skyMat);
sky.frustumCulled = false;
scene.add(sky);

const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(420, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false })
);
scene.add(sunDisc);

/** Himmel und Sonnenscheibe an die Kamera koppeln (jedes Frame). */
export function updateSky() {
  sky.position.copy(camera.position);
  sunDisc.position.copy(camera.position).add(sun.position.clone().normalize().multiplyScalar(11000));
  sunDisc.lookAt(camera.position);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

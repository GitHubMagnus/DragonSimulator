// Grafik-Grundgerüst: Renderer, Szene, Kamera, Beleuchtung und Himmel.
import * as THREE from "three";

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcdd8e6, 0.00021);

export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 1, 16000);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
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

// ---- Himmel: Gradient-Kuppel ----
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(12000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fb5) },
      horizon: { value: new THREE.Color(0xcdd8e6) },
      bottom: { value: new THREE.Color(0xa9b59a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      void main() {
        float y = vDir.y;
        vec3 c = (y > 0.0) ? mix(horizon, top, pow(y, 0.5))
                           : mix(horizon, bottom, pow(-y, 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
);
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

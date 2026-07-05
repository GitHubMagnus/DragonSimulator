// Kaminrauch über Stadt- und Dorfhäusern: ein einziges instanziertes
// Billboard-Mesh, dessen Aufstieg/Wachstum/Ausblenden komplett im Shader
// läuft (Phase aus time + Instanz-Seed) — null CPU-Kosten pro Frame.
import * as THREE from "three";
import {
  uv, vec3, color, float, smoothstep, time, instancedBufferAttribute,
  positionGeometry, cameraWorldMatrix, triNoise3D,
} from "three/tsl";

const RISE = 55;   // Steighöhe
const SPEED = 0.09; // Zyklen pro Sekunde

export class ChimneySmoke {
  /** @param {Array<{x:number,y:number,z:number}>} spots  Schornstein-Positionen */
  constructor(scene, spots) {
    const n = spots.length;
    if (!n) return;

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(quad.getIndex());
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    spots.forEach((s, i) => {
      pos.set([s.x, s.y, s.z], i * 3);
      seed[i] = (i * 0.6180339887) % 1; // goldener Schnitt → gleichmäßige Phasen
    });
    const aPos = new THREE.InstancedBufferAttribute(pos, 3);
    const aSeed = new THREE.InstancedBufferAttribute(seed, 1);
    geo.setAttribute("iPos", aPos);
    geo.setAttribute("iSeed", aSeed);
    geo.instanceCount = n;

    const mat = new THREE.MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const iPos = instancedBufferAttribute(aPos);
    const iSeed = instancedBufferAttribute(aSeed);
    // Phase 0…1: aufsteigen, wachsen, ausblenden — dann von vorn
    const p = time.mul(SPEED).add(iSeed).fract();
    const scale = p.mul(11.0).add(2.5);
    const right = cameraWorldMatrix.element(0).xyz;
    const up = cameraWorldMatrix.element(1).xyz;
    mat.positionNode = iPos
      .add(vec3(0, p.mul(RISE), 0))
      .add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(scale))
      .add(vec3(p.mul(6.0), 0, p.mul(4.0))); // leichte Winddrift

    const r = uv().sub(0.5).length().mul(2.0);
    const nse = triNoise3D(vec3(uv().mul(2.0), iSeed.mul(9.0)), 0.15, time);
    const disk = float(1.0).sub(smoothstep(0.2, 1.0, r));
    const fade = smoothstep(0.0, 0.12, p).mul(float(1.0).sub(smoothstep(0.55, 1.0, p)));
    mat.opacityNode = disk.mul(nse.mul(0.7).add(0.3)).mul(fade).mul(0.38);
    mat.colorNode = color(0xb9b4ac);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}

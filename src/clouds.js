// Wolkenschicht als EIN instanzierter Draw-Call: jeder Puff ist eine
// Quad-Instanz, die im Vertex-Shader zur Kamera gedreht wird; das fraktale
// Noise-Muster kommt pro Instanz aus einem Seed (kein UV-Trick mehr nötig).
// Jeder Puff hat eine feste Weltposition, driftet langsam und wird hinter
// dem Dunst um den Spieler herum „umgeschlagen".
import * as THREE from "three";
import {
  uv, vec3, color, mix, float, time, smoothstep, triNoise3D,
  instancedBufferAttribute, positionGeometry, cameraWorldMatrix,
} from "three/tsl";

const PUFFS = 64;
const SPAN = 9000;       // Umschlagbereich um den Spieler
const HALF = SPAN / 2;
const mod = (a, n) => ((a % n) + n) % n;

export class Clouds {
  constructor(scene) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(quad.getIndex());
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));

    this._pos = new Float32Array(PUFFS * 3);
    const scale = new Float32Array(PUFFS * 2);
    const seed = new Float32Array(PUFFS);
    this._puffs = [];
    for (let i = 0; i < PUFFS; i++) {
      this._puffs.push({
        wx: Math.random() * SPAN,
        wz: Math.random() * SPAN,
        y: 650 + Math.random() * 700,
        driftX: (Math.random() - 0.5) * 9,
        driftZ: (Math.random() - 0.5) * 7,
      });
      scale.set([240 + Math.random() * 280, 110 + Math.random() * 120], i * 2);
      seed[i] = Math.random() * 40;
    }
    this._aPos = new THREE.InstancedBufferAttribute(this._pos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iPos", this._aPos);
    geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(scale, 2));
    geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geo.instanceCount = PUFFS;

    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const iPos = instancedBufferAttribute(this._aPos);
    const iScale = instancedBufferAttribute(geo.getAttribute("iScale"));
    const iSeed = instancedBufferAttribute(geo.getAttribute("iSeed"));

    // Billboard: Quad entlang der Kamera-Achsen aufspannen
    const right = cameraWorldMatrix.element(0).xyz;
    const up = cameraWorldMatrix.element(1).xyz;
    mat.positionNode = iPos
      .add(right.mul(positionGeometry.x.mul(iScale.x)))
      .add(up.mul(positionGeometry.y.mul(iScale.y)));

    // Weicher Kern, fransige Noise-Ränder; Seed macht jeden Puff einzigartig
    const p = uv().sub(0.5);
    const r = p.length().mul(2.0);
    const n1 = triNoise3D(vec3(uv().mul(2.6).add(iSeed), 0.0), 0.02, time);
    const n2 = triNoise3D(vec3(uv().mul(6.5).add(iSeed.mul(1.7)), 4.7), 0.03, time);
    const dens = n1.mul(0.75).add(n2.mul(0.35));
    const disk = float(1.0).sub(smoothstep(0.25, 1.0, r));
    mat.opacityNode = smoothstep(0.08, 0.6, disk.mul(dens.add(0.35)).saturate()).mul(0.92);
    // unten bläulicher Schatten, oben sonniges Weiß
    mat.colorNode = mix(color(0x93a3ba), color(0xffffff).mul(1.12), uv().y.add(n1.mul(0.35)).saturate());

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = 4;
    scene.add(this._mesh);
  }

  update(dt, playerX, playerZ) {
    for (let i = 0; i < PUFFS; i++) {
      const u = this._puffs[i];
      u.wx += u.driftX * dt;
      u.wz += u.driftZ * dt;
      this._pos[i * 3] = playerX + mod(u.wx - playerX + HALF, SPAN) - HALF;
      this._pos[i * 3 + 1] = u.y;
      this._pos[i * 3 + 2] = playerZ + mod(u.wz - playerZ + HALF, SPAN) - HALF;
    }
    this._aPos.needsUpdate = true;
  }
}

// Vogelschwärme in Weltkoordinaten: jeder Schwarm hat eine feste Weltposition
// und fliegt mit eigener (geringer) Geschwindigkeit. Der Spieler zieht an ihnen
// vorbei. Weit entfernte Schwärme werden um den Spieler herum „umgeschlagen",
// damit immer Vögel am Himmel sind. Die Flügel schlagen (CPU-Animation).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { positionLocal, instanceIndex, hash as tslHash, time, vec3 } from "three/tsl";
import { PORT } from "./world.js";

const FLOCKS = 9;
const PER_FLOCK = 9;
const SPAN = 5000;       // Umschlagbereich um den Spieler
const HALF = SPAN / 2;
const ALT_MIN = 220;
const ALT_MAX = 640;
const mod = (a, n) => ((a % n) + n) % n;

/**
 * Vogelschwärme als EIN InstancedMesh (statt 243 Einzelmeshes): Körper und
 * Flügel sind eine Geometrie, der Flügelschlag biegt die Flügel im
 * Vertex-Shader (Amplitude wächst nach außen, Phase/Frequenz pro Instanz).
 * Die CPU schreibt nur 81 Instanz-Matrizen pro Frame.
 */
export class Birds {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    const geo = mergeGeometries([
      new THREE.BoxGeometry(2.4, 1.8, 8),
      new THREE.BoxGeometry(15, 0.5, 5).translate(-8.7, 0, 0),
      new THREE.BoxGeometry(15, 0.5, 5).translate(8.7, 0, 0),
    ]);
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x26262e, flatShading: true, roughness: 1 });
    const idF = instanceIndex.toFloat();
    const freq = tslHash(idF.add(3.0)).mul(5.0).add(7.0);
    const phase = tslHash(idF).mul(6.2832);
    const wing = positionLocal.x.abs().sub(1.2).max(0.0); // nur die Flügel biegen
    mat.positionNode = positionLocal.add(vec3(0, time.mul(freq).add(phase).sin().mul(wing).mul(0.55), 0));

    const total = FLOCKS * PER_FLOCK;
    this._mesh = new THREE.InstancedMesh(geo, mat, total);
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._mesh.frustumCulled = false;
    this.root.add(this._mesh);
    this._dummy = new THREE.Object3D();

    this._flocks = [];
    let slot = 0;
    for (let i = 0; i < FLOCKS; i++) {
      const birds = [];
      for (let k = 0; k < PER_FLOCK; k++) {
        const side = k % 2 === 0 ? 1 : -1;
        const rank = Math.floor(k / 2) + 1;
        birds.push({
          slot: slot++,
          ox: side * rank * (16 + Math.random() * 10),
          oz: rank * (14 + Math.random() * 10),
          oy: (Math.random() - 0.5) * 24,
          scale: 0.6 + Math.random() * 0.7,
        });
      }
      this._flocks.push({
        wx: Math.random() * SPAN,
        wz: Math.random() * SPAN,
        y: ALT_MIN + Math.random() * (ALT_MAX - ALT_MIN),
        dir: Math.random() * Math.PI * 2,
        spd: 30 + Math.random() * 36,
        birds,
      });
    }
  }

  update(dt, t, playerX, playerZ) {
    const d = this._dummy;
    for (const f of this._flocks) {
      f.wx += Math.cos(f.dir) * f.spd * dt;
      f.wz += Math.sin(f.dir) * f.spd * dt;
      const cx = playerX + mod(f.wx - playerX + HALF, SPAN) - HALF;
      const cz = playerZ + mod(f.wz - playerZ + HALF, SPAN) - HALF;

      const cos = Math.cos(-f.dir), sin = Math.sin(-f.dir);
      for (const b of f.birds) {
        const rx = b.ox * cos - b.oz * sin;
        const rz = b.ox * sin + b.oz * cos;
        d.position.set(cx + rx, f.y + b.oy, cz + rz);
        d.rotation.set(0, -f.dir, 0);
        d.scale.setScalar(b.scale);
        d.updateMatrix();
        this._mesh.setMatrixAt(b.slot, d.matrix);
      }
    }
    this._mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Möwen: kreisen dauerhaft über dem Fischerdorf und dem Pier. */
export class Gulls {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.85 });
    const wingGeo = new THREE.BoxGeometry(7, 0.3, 2.2);
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.9, 3.6);

    this._gulls = [];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const wl = new THREE.Group();
      const wr = new THREE.Group();
      const ml = new THREE.Mesh(wingGeo, mat); ml.position.x = -3.5; wl.add(ml);
      const mr = new THREE.Mesh(wingGeo, mat); mr.position.x = 3.5; wr.add(mr);
      b.add(wl, wr, new THREE.Mesh(bodyGeo, mat));
      b.userData = {
        wl, wr,
        r: 55 + Math.random() * 110,
        h: 28 + Math.random() * 45,
        spd: (0.25 + Math.random() * 0.2) * (i % 2 ? 1 : -1),
        phase: Math.random() * 6.28,
        flap: 6 + Math.random() * 4,
      };
      this.root.add(b);
      this._gulls.push(b);
    }
  }

  update(dt, t) {
    for (const g of this._gulls) {
      const u = g.userData;
      const a = t * u.spd + u.phase;
      g.position.set(
        PORT.x + Math.cos(a) * u.r,
        PORT.groundH + u.h + Math.sin(t * 0.9 + u.phase) * 4,
        PORT.z + 140 + Math.sin(a) * u.r
      );
      g.rotation.y = -a - (u.spd > 0 ? Math.PI / 2 : -Math.PI / 2);
      const fl = Math.sin(t * u.flap + u.phase) * 0.45;
      u.wl.rotation.z = -fl;
      u.wr.rotation.z = fl;
    }
  }
}

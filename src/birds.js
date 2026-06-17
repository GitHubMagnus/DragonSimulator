// Vogelschwärme in Weltkoordinaten: jeder Schwarm hat eine feste Weltposition
// und fliegt mit eigener (geringer) Geschwindigkeit. Der Spieler zieht an ihnen
// vorbei. Weit entfernte Schwärme werden um den Spieler herum „umgeschlagen",
// damit immer Vögel am Himmel sind. Die Flügel schlagen (CPU-Animation).
import * as THREE from "three";

const FLOCKS = 9;
const PER_FLOCK = 9;
const SPAN = 5000;       // Umschlagbereich um den Spieler
const HALF = SPAN / 2;
const ALT_MIN = 220;
const ALT_MAX = 640;
const mod = (a, n) => ((a % n) + n) % n;

export class Birds {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    const mat = new THREE.MeshStandardMaterial({ color: 0x26262e, flatShading: true, roughness: 1 });
    const wingGeo = new THREE.BoxGeometry(15, 0.6, 5);
    const bodyGeo = new THREE.BoxGeometry(2.4, 1.8, 8);

    const makeBird = () => {
      const b = new THREE.Group();
      const wl = new THREE.Group();
      const wr = new THREE.Group();
      const ml = new THREE.Mesh(wingGeo, mat); ml.position.x = -7.5; wl.add(ml);
      const mr = new THREE.Mesh(wingGeo, mat); mr.position.x = 7.5; wr.add(mr);
      b.add(wl, wr, new THREE.Mesh(bodyGeo, mat));
      b.scale.setScalar(0.6 + Math.random() * 0.7);
      b.userData = { wl, wr, ox: 0, oz: 0, oy: 0, flap: 7 + Math.random() * 5, phase: Math.random() * 6.28 };
      return b;
    };

    this._flocks = [];
    for (let i = 0; i < FLOCKS; i++) {
      const birds = [];
      for (let k = 0; k < PER_FLOCK; k++) {
        const b = makeBird();
        const side = k % 2 === 0 ? 1 : -1;
        const rank = Math.floor(k / 2) + 1;
        b.userData.ox = side * rank * (16 + Math.random() * 10);
        b.userData.oz = rank * (14 + Math.random() * 10);
        b.userData.oy = (Math.random() - 0.5) * 24;
        birds.push(b);
        this.root.add(b);
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
    for (const f of this._flocks) {
      f.wx += Math.cos(f.dir) * f.spd * dt;
      f.wz += Math.sin(f.dir) * f.spd * dt;
      const cx = playerX + mod(f.wx - playerX + HALF, SPAN) - HALF;
      const cz = playerZ + mod(f.wz - playerZ + HALF, SPAN) - HALF;

      const cos = Math.cos(-f.dir), sin = Math.sin(-f.dir);
      for (const b of f.birds) {
        const u = b.userData;
        const rx = u.ox * cos - u.oz * sin;
        const rz = u.ox * sin + u.oz * cos;
        b.position.set(cx + rx, f.y + u.oy, cz + rz);
        b.rotation.y = -f.dir;
        const fl = Math.sin(t * u.flap + u.phase) * 0.6;
        u.wl.rotation.z = -fl;
        u.wr.rotation.z = fl;
      }
    }
  }
}

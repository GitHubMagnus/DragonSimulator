// Wolkenschicht in Weltkoordinaten: jede Wolke hat eine feste Weltposition und
// driftet nur langsam selbst. Fliegt der Spieler, zieht er an den Wolken vorbei.
// Weit entfernte Wolken werden (unsichtbar hinter dem Dunst) um den Spieler
// herum „umgeschlagen", damit der Himmel immer bevölkert bleibt.
import * as THREE from "three";

const CLOUD_COUNT = 26;
const SPAN = 9000;       // Umschlagbereich um den Spieler
const HALF = SPAN / 2;
const mod = (a, n) => ((a % n) + n) % n;

export class Clouds {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, flatShading: true,
    });
    const puffGeo = new THREE.IcosahedronGeometry(40, 0);

    this._clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const c = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(puffGeo, mat);
        m.position.set((Math.random() - 0.5) * 130, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 90);
        m.scale.set(1 + Math.random(), 0.6 + Math.random() * 0.4, 1 + Math.random());
        c.add(m);
      }
      c.userData = {
        wx: Math.random() * SPAN,
        wz: Math.random() * SPAN,
        y: 650 + Math.random() * 700,
        driftX: (Math.random() - 0.5) * 9,
        driftZ: (Math.random() - 0.5) * 7,
      };
      this._clouds.push(c);
      this.root.add(c);
    }
  }

  update(dt, playerX, playerZ) {
    for (const c of this._clouds) {
      const u = c.userData;
      u.wx += u.driftX * dt;
      u.wz += u.driftZ * dt;
      const x = playerX + mod(u.wx - playerX + HALF, SPAN) - HALF;
      const z = playerZ + mod(u.wz - playerZ + HALF, SPAN) - HALF;
      c.position.set(x, u.y, z);
    }
  }
}

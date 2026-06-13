// Wolkenschicht, die dem Spieler folgt und langsam driftet.
import * as THREE from "three";

const CLOUD_COUNT = 14;
const SPAN = 6000; // Wickelbereich der Drift

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
        ox: (Math.random() - 0.5) * 5000,
        oz: (Math.random() - 0.5) * 5000,
        y: 650 + Math.random() * 700,
        drift: 6 + Math.random() * 10,
      };
      this._clouds.push(c);
      this.root.add(c);
    }
  }

  update(dt, playerX, playerZ) {
    this.root.position.set(playerX, 0, playerZ);
    for (const c of this._clouds) {
      c.userData.ox += c.userData.drift * dt;
      const lx = ((c.userData.ox + SPAN / 2) % SPAN) - SPAN / 2;
      c.position.set(lx, c.userData.y, c.userData.oz);
    }
  }
}

// Flugzeug-Bordwaffen: echte, diskrete Leuchtspur-Geschosse. Im Feuertakt wird
// je eine Patrone an der Mündung erzeugt, die als eigenes Projektil schnell nach
// vorn fliegt (schneller als das Flugzeug), in Flugrichtung ausgerichtet und
// additiv leuchtend. Dazu ein kurzer Mündungsblitz + Mündungslicht. Reines
// CPU-System (Weltkoordinaten) — funktioniert auch im WebGL2-Fallback.
import * as THREE from "three";

const MAX = 96;          // Pool-Größe
const COOLDOWN = 0.05;   // s zwischen Schüssen (Feuerrate)
const REL_SPEED = 900;   // Geschosstempo zusätzlich zum Flugzeugtempo
const LIFE = 1.1;        // Lebensdauer (s) → Reichweite ~1000 Einheiten
const SPREAD = 0.012;
const FWD = new THREE.Vector3(0, 0, 1);

export class Bullets {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    // Leuchtspur: schmaler, langgestreckter, additiv glühender Körper.
    const geo = new THREE.CylinderGeometry(0.9, 0.6, 16, 6);
    geo.rotateX(Math.PI / 2); // Achse entlang +Z (Flugrichtung)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe06a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });

    this._bullets = [];
    for (let i = 0; i < MAX; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.root.add(m);
      this._bullets.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }
    this._next = 0;
    this._cool = 0;

    // Mündungsblitz + Mündungslicht
    this._flash = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    this._flash.visible = false;
    this.root.add(this._flash);
    this._flashT = 0;
    this._light = new THREE.PointLight(0xffd070, 0, 220);
    scene.add(this._light);

    this._muzzle = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  update(dt, flier, forward, emitting, flierSpeed = 0) {
    this._muzzle.copy(flier.fireMuzzle).applyQuaternion(flier.quaternion).add(flier.position);

    this._cool -= dt;
    if (emitting && this._cool <= 0) {
      this._spawn(forward, flierSpeed);
      this._cool = COOLDOWN;
      this._flash.visible = true;
      this._flash.position.copy(this._muzzle);
      this._flash.scale.setScalar(0.8 + Math.random() * 0.7);
      this._flashT = 0.04;
      this._light.intensity = 4.5;
      this._light.position.copy(this._muzzle);
    }

    this._flashT -= dt;
    if (this._flashT <= 0) this._flash.visible = false;
    this._light.intensity *= 0.8;

    for (const b of this._bullets) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.life <= 0) b.mesh.visible = false;
    }
  }

  _spawn(forward, flierSpeed) {
    const b = this._bullets[this._next];
    this._next = (this._next + 1) % MAX;

    this._dir.copy(forward);
    this._dir.x += (Math.random() - 0.5) * SPREAD;
    this._dir.y += (Math.random() - 0.5) * SPREAD;
    this._dir.z += (Math.random() - 0.5) * SPREAD;
    this._dir.normalize();

    b.vel.copy(this._dir).multiplyScalar(flierSpeed + REL_SPEED);
    b.life = LIFE;
    b.mesh.position.copy(this._muzzle);
    b.mesh.quaternion.setFromUnitVectors(FWD, this._dir);
    b.mesh.visible = true;
  }

  reset() {
    for (const b of this._bullets) { b.life = 0; b.mesh.visible = false; }
    this._cool = 0;
    this._flashT = 0;
    this._flash.visible = false;
    this._light.intensity = 0;
  }
}

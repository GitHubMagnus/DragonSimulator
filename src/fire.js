// Feueratem des Drachen: einzelne Feuerbälle, die wachsen, ausglühen und
// verlöschen, plus ein gemeinsamer Lichtschein.
import * as THREE from "three";

const MUZZLE = new THREE.Vector3(0, 7, -26); // Mündung relativ zum Drachen
const LIFETIME = 1.1;

export class FireBreath {
  constructor(scene) {
    this._scene = scene;
    this._balls = [];
    this._geo = new THREE.SphereGeometry(2.4, 10, 8);
    this._light = new THREE.PointLight(0xff7b1a, 0, 260);
    scene.add(this._light);
  }

  /** Einen Feuerball aus dem Maul des Drachen abschießen. */
  shoot(dragon, forward, speed) {
    const mesh = new THREE.Mesh(
      this._geo,
      new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, fog: false })
    );
    mesh.position.copy(MUZZLE).applyQuaternion(dragon.quaternion).add(dragon.position);

    const spread = new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0)
      .applyQuaternion(dragon.quaternion);
    const vel = forward.clone().add(spread).normalize().multiplyScalar(speed + 320);

    this._scene.add(mesh);
    this._balls.push({ mesh, vel, life: LIFETIME });
  }

  update(dt, dragon) {
    let glowing = false;
    for (let i = this._balls.length - 1; i >= 0; i--) {
      const b = this._balls[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);

      const t = b.life / LIFETIME;
      b.mesh.scale.setScalar(1 + (1 - t) * 3.2);
      b.mesh.material.opacity = Math.max(0, t);
      b.mesh.material.color.setHSL(0.08 * t, 1, 0.55 * t + 0.1);

      if (b.life <= 0) {
        this._scene.remove(b.mesh);
        b.mesh.material.dispose();
        this._balls.splice(i, 1);
      } else if (t > 0.7) {
        glowing = true;
      }
    }

    if (glowing) {
      this._light.intensity = 3.5;
      this._light.position.copy(MUZZLE).applyQuaternion(dragon.quaternion).add(dragon.position);
    } else {
      this._light.intensity *= 0.85;
    }
  }

  /** Alle Feuerbälle entfernen (z. B. beim Neustart). */
  reset() {
    this._balls.forEach((b) => {
      this._scene.remove(b.mesh);
      b.mesh.material.dispose();
    });
    this._balls.length = 0;
    this._light.intensity = 0;
  }
}

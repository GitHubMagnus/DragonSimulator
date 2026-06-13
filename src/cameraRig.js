// Kameraführung: Menü-Vorschau (kreisend), Verfolger- und Cockpit-Ansicht.
import * as THREE from "three";

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0 = Verfolger, 1 = Cockpit
    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();
  }

  toggle() {
    this.mode = (this.mode + 1) % 2;
  }

  update(dt, dragon, forward, started, t) {
    if (!started) {
      // Menü-Vorschau: langsam um den Drachen kreisen
      const a = t * 0.35;
      this.camera.position.set(
        dragon.position.x + Math.sin(a) * 78,
        dragon.position.y + 16,
        dragon.position.z + Math.cos(a) * 78
      );
      this.camera.lookAt(dragon.position.x, dragon.position.y + 2, dragon.position.z);
      return;
    }

    if (this.mode === 0) {
      this._offset.set(0, 11, 50).applyQuaternion(dragon.quaternion);
      this._desired.copy(dragon.position).add(this._offset);
      this.camera.position.lerp(this._desired, Math.min(1, dt * 4));
      this._target.copy(dragon.position).addScaledVector(forward, 34);
    } else {
      this._offset.set(0, 5, -8).applyQuaternion(dragon.quaternion);
      this.camera.position.copy(dragon.position).add(this._offset);
      this._target.copy(dragon.position).addScaledVector(forward, 80);
    }
    this.camera.lookAt(this._target);
  }
}

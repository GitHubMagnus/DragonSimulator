// Kameraführung: Menü-Vorschau (kreisend), Verfolger- und Cockpit-Ansicht.
// Mit gedrückter linker Maustaste lässt sich die Kamera frei um das
// Fluggerät drehen (auch nach hinten schauen); beim Loslassen schwenkt sie
// weich in die Verfolgeransicht zurück.
import * as THREE from "three";
import { renderer } from "./scene.js";

const TWO_PI = Math.PI * 2;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0 = Verfolger, 1 = Cockpit
    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._desired = new THREE.Vector3();

    // Maus-Orbit um das Fluggerät
    this._orbitYaw = 0;
    this._orbitPitch = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._orbitQ = new THREE.Quaternion();
    this._orbitEuler = new THREE.Euler(0, 0, 0, "YXZ");

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetische Events */ }
    });
    addEventListener("pointermove", (e) => {
      if (!this._dragging) return;
      this._orbitYaw -= (e.clientX - this._lastX) * 0.006;
      this._orbitPitch += (e.clientY - this._lastY) * 0.005;
      this._orbitPitch = Math.max(-1.25, Math.min(1.25, this._orbitPitch));
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    addEventListener("pointerup", () => {
      this._dragging = false;
      // Yaw auf [-π, π] normalisieren, damit die Rückkehr den kurzen Weg nimmt
      this._orbitYaw = ((this._orbitYaw + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
    });
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

    // Orbit-Winkel weich zurückfahren, sobald die Maus losgelassen wurde
    if (!this._dragging) {
      const k = Math.min(1, dt * 5);
      this._orbitYaw -= this._orbitYaw * k;
      this._orbitPitch -= this._orbitPitch * k;
    }
    const orbiting = this._dragging ||
      Math.abs(this._orbitYaw) > 0.01 || Math.abs(this._orbitPitch) > 0.01;
    this._orbitEuler.set(this._orbitPitch, this._orbitYaw, 0);
    this._orbitQ.setFromEuler(this._orbitEuler);

    if (this.mode === 0) {
      this._offset.set(0, 11, 50);
      if (orbiting) this._offset.applyQuaternion(this._orbitQ); // um das Objekt drehen
      this._offset.applyQuaternion(dragon.quaternion);
      this._desired.copy(dragon.position).add(this._offset);
      this.camera.position.lerp(this._desired, Math.min(1, dt * (this._dragging ? 10 : 4)));
      if (orbiting) {
        // Beim Umschauen das Fluggerät selbst im Blick behalten
        this._target.copy(dragon.position);
        this._target.y += 4;
      } else {
        this._target.copy(dragon.position).addScaledVector(forward, 34);
      }
    } else {
      this._offset.set(0, 5, -8).applyQuaternion(dragon.quaternion);
      this.camera.position.copy(dragon.position).add(this._offset);
      // Cockpit: Blickrichtung mit der Maus schwenken
      this._target.set(0, 0, -80);
      if (orbiting) this._target.applyQuaternion(this._orbitQ);
      this._target.applyQuaternion(dragon.quaternion).add(dragon.position);
    }
    this.camera.lookAt(this._target);
  }
}

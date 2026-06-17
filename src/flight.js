// Arcade-Flugphysik: steuert Lage und Position des Drachen aus den
// Eingaben, simuliert Schub, Auftrieb und Schwerkraft und erkennt Crashs.
import * as THREE from "three";
import { FLIGHT } from "./config.js";
import { heightAt } from "./noise.js";

export class FlightModel {
  constructor(flier) {
    this._flier = flier;
    this.forward = new THREE.Vector3(0, 0, -1);
    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this.firing = false; // ob gerade gefeuert wird (vom Feuer-System gelesen)
    this.onCrash = null;
    this.reset();
  }

  /** Aktives Fluggerät wechseln (Menü-Auswahl). */
  setFlier(flier) {
    this._flier = flier;
  }

  reset() {
    this._flier.position.set(0, FLIGHT.SPAWN_ALT, 0);
    this._flier.quaternion.identity();
    this.throttle = FLIGHT.START_THROTTLE;
    this.speed = FLIGHT.MAX_SPEED * FLIGHT.START_THROTTLE;
    this.crashed = false;
    this.firing = false;
    this.forward.set(0, 0, -1);
  }

  update(dt, input) {
    if (this.crashed) { this.firing = false; return; }
    const dragon = this._flier;

    // Schub
    if (input.isDown("ArrowUp")) this.throttle = Math.min(1, this.throttle + 0.5 * dt);
    if (input.isDown("ArrowDown")) this.throttle = Math.max(0, this.throttle - 0.5 * dt);

    // Lage: Pitch/Yaw/Roll als lokale Drehung
    const { pitch, yaw, roll } = input.axes();
    this._euler.set(
      pitch * FLIGHT.PITCH_RATE * dt,
      yaw * FLIGHT.YAW_RATE * dt,
      roll * FLIGHT.ROLL_RATE * dt,
      "XYZ"
    );
    this._q.setFromEuler(this._euler);
    dragon.quaternion.multiply(this._q);

    // Geschwindigkeit dem Sollwert annähern
    const target = FLIGHT.MIN_SPEED + (FLIGHT.MAX_SPEED - FLIGHT.MIN_SPEED) * this.throttle;
    this.speed += (target - this.speed) * Math.min(1, dt * 0.85);

    // Vorwärtsbewegung
    this.forward.set(0, 0, -1).applyQuaternion(dragon.quaternion);
    dragon.position.addScaledVector(this.forward, this.speed * dt);

    // Auftrieb gegen Schwerkraft (sinkt bei zu wenig Tempo)
    const lift = THREE.MathUtils.clamp(this.speed / (FLIGHT.MAX_SPEED * 0.55), 0, 1);
    dragon.position.y -= FLIGHT.GRAVITY * (1 - lift) * dt;

    // Feuer/Beschuss (nur wenn das Fluggerät es kann) — das Partikelsystem
    // liest dieses Flag und emittiert an der Mündung.
    this.firing = dragon.fireEnabled && input.isDown("Space");

    // Bodenkollision
    const ground = heightAt(dragon.position.x, dragon.position.z);
    if (dragon.position.y <= ground + 6) {
      dragon.position.y = ground + 6;
      this.crashed = true;
      this.onCrash?.();
    }
  }
}

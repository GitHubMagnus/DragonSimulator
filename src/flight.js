// Arcade-Flugphysik: steuert Lage und Position des Drachen aus den
// Eingaben, simuliert Schub, Auftrieb und Schwerkraft und erkennt Crashs.
import * as THREE from "three";
import { FLIGHT } from "./config.js";
import { heightAt } from "./noise.js";

const FIRE_COOLDOWN = 0.06;

export class FlightModel {
  constructor(dragon) {
    this._dragon = dragon;
    this.forward = new THREE.Vector3(0, 0, -1);
    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._fireTimer = 0;
    this.onCrash = null;
    this.reset();
  }

  reset() {
    this._dragon.position.set(0, FLIGHT.SPAWN_ALT, 0);
    this._dragon.quaternion.identity();
    this.throttle = FLIGHT.START_THROTTLE;
    this.speed = FLIGHT.MAX_SPEED * FLIGHT.START_THROTTLE;
    this.crashed = false;
    this._fireTimer = 0;
    this.forward.set(0, 0, -1);
  }

  update(dt, input, fire) {
    if (this.crashed) return;
    const dragon = this._dragon;

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

    // Feueratem
    this._fireTimer -= dt;
    if (input.isDown("Space") && this._fireTimer <= 0) {
      fire.shoot(dragon, this.forward, this.speed);
      this._fireTimer = FIRE_COOLDOWN;
    }

    // Bodenkollision
    const ground = heightAt(dragon.position.x, dragon.position.z);
    if (dragon.position.y <= ground + 6) {
      dragon.position.y = ground + 6;
      this.crashed = true;
      this.onCrash?.();
    }
  }
}

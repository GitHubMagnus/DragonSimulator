// Gemeinsame Basis aller spielbaren Fluggeräte (Drache, Flugzeug, Ikarus).
// Stellt die einheitliche Schnittstelle bereit, die Flugphysik, Kamera, Feuer
// und HUD erwarten: ein `group`-Wurzelobjekt, position/quaternion-Zugriff,
// eine Farbwahl und eine pro Frame aufgerufene Animation.
import * as THREE from "three";

export class Flier {
  constructor() {
    this.group = new THREE.Group();

    // Feuer/Beschuss nach vorn: ob möglich und woher (lokaler Mündungspunkt).
    this.fireEnabled = false;
    this.fireMuzzle = new THREE.Vector3(0, 0, -10);
  }

  get position() { return this.group.position; }
  get quaternion() { return this.group.quaternion; }

  /** Vom Menü gewählte Farbe anwenden. Von Unterklassen überschrieben. */
  setColor(_hex) {}

  /**
   * Animation eines Frames.
   * @param {number} t         Spielzeit in Sekunden
   * @param {number} throttle  Schub 0..1 (treibt Flügelschlag bzw. Propeller)
   */
  update(_t, _throttle) {}
}

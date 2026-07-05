// Spielbares UFO: klassische fliegende Untertasse — geschwungener Lathe-Rumpf
// (färbbar), Glaskuppel mit kleinem Alien-Piloten, rotierender Außenring mit
// abwechselnd cyan/amber leuchtenden Positionslichtern, pulsierender
// Antriebsring an der Unterseite, drei Landekufen-Wülste und Sensorantenne.
// Schwebt mit leichtem Taumeln. Feuert Energiegeschosse nach vorn.
import * as THREE from "three";
import { Flier } from "./flier.js";

export class Ufo extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMode = "lasers"; // grüne Energie-Laser (eigene Bullets-Instanz)
    this.fireMuzzle.set(0, -1.5, -16);
    // Zwei Randgeschütze feuern abwechselnd — auch von hinten gut sichtbar
    this.fireMuzzles = [
      new THREE.Vector3(-13.5, 0.4, -6),
      new THREE.Vector3(13.5, 0.4, -6),
    ];

    this._hullMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.85, roughness: 0.3 });
    this._darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 });
    this._glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fe8e0, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3,
    });
    this._cyanMat = new THREE.MeshStandardMaterial({ color: 0x30c8c0, emissive: 0x40f0e8, emissiveIntensity: 2.2 });
    this._amberMat = new THREE.MeshStandardMaterial({ color: 0xc89030, emissive: 0xffb040, emissiveIntensity: 2.2 });
    this._driveMat = new THREE.MeshStandardMaterial({ color: 0x207068, emissive: 0x30e8d8, emissiveIntensity: 1.8 });
    this._alienMat = new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.7 });
    this._eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.2 });

    this._hull = new THREE.Group(); // taumelt beim Schweben
    this.group.add(this._hull);
    this._build();

    this.group.scale.setScalar(1.5);
    scene.add(this.group);
  }

  _build() {
    const h = this._hull;

    // Untertassen-Rumpf als Rotationskörper
    const profile = [
      [0.4, -2.6], [4.0, -2.5], [8.0, -1.6], [12.0, -0.6], [14.5, 0.4],
      [12.0, 1.6], [8.0, 2.6], [4.5, 3.1], [2.2, 3.3],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    h.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), this._hullMat));

    // Felgenring an der Kante + Rillen unten
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.7, 8, 28), this._darkMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    h.add(rim);
    for (const [rr, ry] of [[6.5, -2.1], [9.5, -1.4]]) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.32, 6, 24), this._darkMat);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = ry;
      h.add(groove);
    }

    // Glaskuppel mit Alien-Pilot (grüner Kopf, große schwarze Augen)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), this._glassMat);
    dome.position.y = 3.0;
    h.add(dome);
    const alien = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 10), this._alienMat);
    alien.scale.set(0.85, 1.15, 0.9);
    alien.position.y = 4.3;
    h.add(alien);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), this._eyeMat);
      eye.scale.set(1, 1.4, 0.55);
      eye.position.set(s * 0.72, 4.7, -1.35);
      eye.rotation.y = s * 0.35;
      h.add(eye);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 1.4, 8), this._alienMat);
    neck.position.y = 3.1;
    h.add(neck);

    // Rotierender Lichterring (cyan/amber im Wechsel)
    this._ring = new THREE.Group();
    this._ring.position.y = 0.4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), i % 2 ? this._cyanMat : this._amberMat);
      light.position.set(Math.cos(a) * 13.2, 0, Math.sin(a) * 13.2);
      this._ring.add(light);
    }
    h.add(this._ring);

    // Antriebsring + Nabe an der Unterseite (pulsiert)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 1.8, 14), this._darkMat);
    hub.position.y = -3.2;
    h.add(hub);
    this._drive = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.55, 8, 20), this._driveMat);
    this._drive.rotation.x = Math.PI / 2;
    this._drive.position.y = -3.0;
    h.add(this._drive);

    // Drei Landekufen-Wülste
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const pod = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), this._hullMat);
      pod.scale.set(1, 0.6, 1);
      pod.position.set(Math.cos(a) * 8.2, -2.5, Math.sin(a) * 8.2);
      h.add(pod);
    }

    // Sensorantenne mit rotem Blinklicht
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6), this._darkMat);
    mast.position.y = 8.6;
    h.add(mast);
    this._beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xa03030, emissive: 0xff4040, emissiveIntensity: 2 }));
    this._beacon.position.y = 10.1;
    h.add(this._beacon);
  }

  /** Hüllenfarbe wählen. */
  setColor(hex) {
    this._hullMat.color.setHex(hex);
  }

  /** Animation: Ring rotiert mit dem Schub, Untertasse taumelt leicht,
   *  Antrieb pulsiert, Positionslicht blinkt. */
  update(t, throttle) {
    this._ring.rotation.y = t * (1.2 + throttle * 3.5);
    this._hull.rotation.z = Math.sin(t * 1.4) * 0.05;
    this._hull.rotation.x = Math.cos(t * 1.1) * 0.05;
    this._hull.position.y = Math.sin(t * 2.3) * 0.35;
    this._drive.material.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.7 + throttle;
    this._beacon.material.emissiveIntensity = Math.sin(t * 6) > 0.2 ? 2.4 : 0.3;
  }
}

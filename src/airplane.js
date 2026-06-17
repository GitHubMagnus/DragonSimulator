// Spielbares Flugzeug: ein einmotoriger Propellerjäger aus Primitiven mit
// Rumpf, Motorhaube, drehendem Propeller samt Spinner, gläserner Kanzel,
// tragflächen mit V-Stellung, Höhen- und Seitenleitwerk, Auspuffstutzen und
// Hoheitsabzeichen. Lackierung (Rumpf/Flächen) ist im Menü wählbar.
import * as THREE from "three";
import { Flier } from "./flier.js";

export class Airplane extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMode = "shots";
    this.fireMuzzle.set(0, 0, -30); // vor dem Spinner (Bordwaffen)

    this._bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d6b3a, flatShading: true, roughness: 0.55, metalness: 0.1 });
    this._accentMat = new THREE.MeshStandardMaterial({ color: 0x223a22, flatShading: true, roughness: 0.6 });
    this._metalMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, flatShading: true, metalness: 0.7, roughness: 0.4 });
    this._propMat = new THREE.MeshStandardMaterial({ color: 0x26262b, flatShading: true, roughness: 0.5 });
    this._glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd0e6, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 });

    this._buildFuselage();
    this._buildCanopy();
    this._buildWings();
    this._buildTail();
    this._buildEngineDetails();
    this._buildPropeller();

    this.group.scale.setScalar(1.5);
    scene.add(this.group);
  }

  _buildFuselage() {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.0, 30, 16), this._bodyMat);
    body.rotation.x = Math.PI / 2;
    this.group.add(body);

    // Rückenkiel (leichte Wölbung hinter der Kanzel)
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 16, 12), this._bodyMat);
    spine.rotation.x = Math.PI / 2;
    spine.position.set(0, 1.8, 7);
    spine.scale.set(1, 0.7, 1);
    this.group.add(spine);

    // Motorhaube vorn
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.3, 5, 18), this._accentMat);
    cowl.rotation.x = Math.PI / 2;
    cowl.position.z = -16.5;
    this.group.add(cowl);

    // Heck verjüngt
    const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3.0, 14, 14), this._bodyMat);
    taper.rotation.x = -Math.PI / 2; // schmales Ende nach hinten (+Z)
    taper.position.z = 22;
    this.group.add(taper);
  }

  _buildCanopy() {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 12), this._glassMat);
    glass.scale.set(1.0, 0.85, 2.4);
    glass.position.set(0, 2.4, 0);
    this.group.add(glass);

    // Windschutzrahmen + Kopfstütze
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 6, 12), this._accentMat);
    frame.rotation.y = Math.PI / 2;
    frame.position.set(0, 2.2, -4.6);
    this.group.add(frame);
    const rest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.2), this._accentMat);
    rest.position.set(0, 2.4, 4.2);
    this.group.add(rest);
  }

  _buildWings() {
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 0.7, 7), this._bodyMat);
      wing.position.set(s * 14, -0.5, 1);
      wing.rotation.z = -s * 0.05; // V-Stellung: Spitzen leicht hoch
      wing.rotation.y = s * 0.04;  // leichte Pfeilung
      this.group.add(wing);

      // abgerundete Flügelspitze
      const tip = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), this._bodyMat);
      tip.scale.set(1.2, 0.4, 3.4);
      tip.position.set(s * 26, -0.5, 1);
      this.group.add(tip);

      // Querruder-Linie (Hinterkante)
      const aileron = new THREE.Mesh(new THREE.BoxGeometry(10, 0.75, 1.4), this._accentMat);
      aileron.position.set(s * 19, -0.5, 4.2);
      this.group.add(aileron);

      // Hoheitsabzeichen (Scheibe oben)
      const roundel = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 16), this._accentMat);
      roundel.position.set(s * 13, 0, 0);
      this.group.add(roundel);

      // Flächenwurzel-Verkleidung
      const root = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 8), this._bodyMat);
      root.position.set(s * 2.5, -0.6, 1);
      this.group.add(root);
    }
  }

  _buildTail() {
    // Höhenleitwerk
    for (const s of [-1, 1]) {
      const stab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 3.5), this._bodyMat);
      stab.position.set(s * 4.5, 0.6, 24);
      this.group.add(stab);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), this._bodyMat);
      tip.scale.set(1, 0.4, 2.2);
      tip.position.set(s * 8.3, 0.6, 24);
      this.group.add(tip);
    }
    // Seitenleitwerk (Finne) — flacher, leicht gepfeilter Keil
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(5.5, 0);
    finShape.lineTo(6.5, 6);
    finShape.lineTo(3.5, 6.6);
    finShape.lineTo(0, 0);
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.5, bevelEnabled: false }), this._bodyMat);
    fin.rotation.y = Math.PI / 2; // in die YZ-Ebene drehen
    fin.position.set(0.25, 1.4, 21);
    this.group.add(fin);
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.5, 1.2), this._accentMat);
    rudder.position.set(0, 4, 27);
    this.group.add(rudder);
  }

  _buildEngineDetails() {
    // Auspuffstutzen an den Haubenseiten
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.8, 6), this._metalMat);
        stub.rotation.x = Math.PI / 2;
        stub.position.set(s * 3.1, 0.6, -13.5 + i * 1.6);
        this.group.add(stub);
      }
    }
  }

  _buildPropeller() {
    this._prop = new THREE.Group();
    this._prop.position.z = -19.3;

    const spinner = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4, 18), this._metalMat);
    spinner.rotation.x = -Math.PI / 2; // Spitze nach vorn (-Z)
    spinner.position.z = -1.6;
    this._prop.add(spinner);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.4, 12), this._metalMat);
    hub.rotation.x = Math.PI / 2;
    this._prop.add(hub);

    for (let k = 0; k < 3; k++) {
      const holder = new THREE.Group();
      holder.rotation.z = (k * 2 * Math.PI) / 3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 15, 0.45), this._propMat);
      blade.position.y = 7.6;
      blade.rotation.y = 0.4; // Blattanstellung
      holder.add(blade);
      this._prop.add(holder);
    }

    this.group.add(this._prop);
  }

  /** Lackierung (Rumpf, Flächen, Leitwerk) setzen; Akzente dunkler. */
  setColor(hex) {
    const base = new THREE.Color(hex);
    this._bodyMat.color.copy(base);
    this._accentMat.color.copy(base).multiplyScalar(0.5);
  }

  /** Animation: Propeller dreht, Drehzahl steigt mit dem Schub. */
  update(t, throttle) {
    this._prop.rotation.z = t * (25 + throttle * 85);
  }
}

// Spielbares Flugzeug: einmotoriger Propellerjäger im Warbird-Stil, komplett
// aus geformten Profilen — spindelförmiger Lathe-Rumpf, gepfeilte Trapez-
// flügel mit Randbogen und V-Stellung (extrudierte Profile mit Kantenfase),
// Rückenkamm mit gerahmter Kanzel, gerundetes Leitwerk, Motorhaube mit
// Auspuffstutzen und MG-Läufen sowie drehender Propeller samt Spinner und
// Unschärfescheibe. Lackierung (Rumpf/Flächen) ist im Menü wählbar.
import * as THREE from "three";
import { Flier } from "./flier.js";

/** Trapezförmige Tragfläche mit Pfeilung und gerundeter Spitze (liegt in der
 *  XZ-Ebene, Spannweite entlang +X, Vorderkante bei -Z). */
function wingGeometry(span, rootChord, tipChord, sweep, thickness) {
  const rc = rootChord / 2, tc = tipChord / 2;
  const s = new THREE.Shape();
  s.moveTo(0, -rc);
  s.lineTo(span * 0.7, -rc + sweep * 0.7);
  s.quadraticCurveTo(span, -rc + sweep, span, sweep - tc * 0.2);
  s.quadraticCurveTo(span, sweep + tc, span * 0.78, sweep + tc);
  s.lineTo(0, rc);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.5,
    bevelSize: thickness * 0.8, bevelSegments: 2, steps: 1,
  });
  g.rotateX(Math.PI / 2);
  g.translate(0, thickness / 2, 0);
  return g;
}

export class Airplane extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMode = "shots";
    this.fireMuzzle.set(0, 0, -30); // vor dem Spinner (Bordwaffen)

    // Glatte, halbglänzende Lackierung; Metallteile spiegeln.
    this._bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d6b3a, roughness: 0.38, metalness: 0.18 });
    this._accentMat = new THREE.MeshStandardMaterial({ color: 0x223a22, roughness: 0.5, metalness: 0.15 });
    this._metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, metalness: 0.9, roughness: 0.28 });
    this._propMat = new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.5 });
    this._glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd0e6, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.35 });
    this._ivoryMat = new THREE.MeshStandardMaterial({ color: 0xe4ded0, roughness: 0.45, metalness: 0.1 });

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
    // Spindelförmiger Rumpf als Rotationskörper (Nase → Heck).
    const profile = [
      [0.9, -20.4], [2.95, -19.4], [3.5, -16.5], [3.62, -11.0], [3.5, -5.0],
      [3.15, 1.0], [2.6, 7.0], [1.95, 13.0], [1.3, 18.0], [0.7, 22.0], [0.26, 24.4],
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const fus = new THREE.LatheGeometry(profile, 28);
    fus.rotateX(Math.PI / 2); // Drehachse auf +Z legen (Nase bei -Z)
    this.group.add(new THREE.Mesh(fus, this._bodyMat));

    // Heckabschluss
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 10), this._bodyMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.z = 24.8;
    this.group.add(cap);

    // Rückenkamm (Razorback) von der Kanzel zum Leitwerk
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 10, 4, 12), this._bodyMat);
    spine.rotation.x = Math.PI / 2;
    spine.scale.set(0.85, 0.75, 1);
    spine.position.set(0, 2.0, 8);
    this.group.add(spine);

    // Kühlerschacht unter dem Rumpf
    const scoop = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 4.5, 4, 10), this._accentMat);
    scoop.rotation.x = Math.PI / 2;
    scoop.scale.set(1.5, 0.85, 1);
    scoop.position.set(0, -3.4, 1.5);
    this.group.add(scoop);
  }

  _buildCanopy() {
    // Tropfenförmige Glaskanzel mit Windschutz- und Mittelrahmen
    const glass = new THREE.Mesh(new THREE.SphereGeometry(2.15, 16, 12), this._glassMat);
    glass.scale.set(0.95, 0.8, 2.3);
    glass.position.set(0, 2.9, -1.5);
    this.group.add(glass);

    const front = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.25, 0.3), this._accentMat);
    front.position.set(0, 3.4, -5.4);
    front.rotation.x = 0.5;
    this.group.add(front);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 4.6), this._accentMat);
    mid.position.set(0, 3.6, -1.4);
    this.group.add(mid);

    // Kopfstütze/Panzerplatte hinter dem Piloten
    const rest = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.6), this._accentMat);
    rest.position.set(0, 2.9, 1.6);
    this.group.add(rest);
  }

  _buildWings() {
    const wingGeo = wingGeometry(22, 9.6, 4.6, 2.2, 0.55);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, this._bodyMat);
      wing.position.set(s * 1.6, -1.2, 0.5);
      wing.scale.x = s;               // linke Fläche spiegeln
      wing.rotation.z = s * 0.09;     // V-Stellung: Spitzen leicht hoch
      this.group.add(wing);

      // Querruder (Hinterkante außen) — als Kind der Fläche, folgt der V-Stellung
      const aileron = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 1.6), this._accentMat);
      aileron.position.set(16, 0, 3.3);
      wing.add(aileron);

      // Hoheitsabzeichen: dunkler Ring mit hellem Kern
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.14, 20), this._accentMat);
      ring.position.set(13, 0.35, 0.8);
      wing.add(ring);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16), this._ivoryMat);
      dot.position.set(13, 0.36, 0.8);
      wing.add(dot);

      // MG-Läufe in der Flächenvorderkante
      for (const gx of [7.5, 9.3]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 6), this._propMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(gx, 0, -4.6);
        wing.add(barrel);
      }

      // Positionslicht an der Flügelspitze (links rot, rechts grün)
      const lightMat = new THREE.MeshStandardMaterial({
        color: s < 0 ? 0xaa2222 : 0x22aa44,
        emissive: s < 0 ? 0xff3333 : 0x33ff66, emissiveIntensity: 1.6,
      });
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lightMat);
      tip.position.set(21.8, 0.1, 1.1);
      wing.add(tip);

      // Flächenwurzel-Verkleidung (Übergang Rumpf → Fläche)
      const fillet = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), this._bodyMat);
      fillet.scale.set(1.6, 0.55, 3.2);
      fillet.position.set(s * 3.0, -1.4, 0.8);
      this.group.add(fillet);
    }
  }

  _buildTail() {
    // Höhenleitwerk: kleine Trapezflächen mit Randbogen
    const stabGeo = wingGeometry(8.2, 4.6, 2.4, 1.1, 0.4);
    for (const s of [-1, 1]) {
      const stab = new THREE.Mesh(stabGeo, this._bodyMat);
      stab.position.set(s * 0.7, 0.9, 21.5);
      stab.scale.x = s;
      this.group.add(stab);
      const elevator = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.36, 1.1), this._accentMat);
      elevator.position.set(3.6, 0, 2.5);
      stab.add(elevator);
    }

    // Seitenleitwerk: gerundete Finne (Profil in der ZY-Ebene, dünn extrudiert)
    const f = new THREE.Shape();
    f.moveTo(16.5, 0);
    f.lineTo(25.6, 0.2);
    f.quadraticCurveTo(26.6, 3.6, 25.0, 6.2);
    f.quadraticCurveTo(23.2, 8.1, 21.0, 7.0);
    f.quadraticCurveTo(18.5, 5.4, 16.5, 0);
    f.closePath();
    const finGeo = new THREE.ExtrudeGeometry(f, {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.3, bevelSegments: 2,
    });
    finGeo.rotateY(-Math.PI / 2); // Profil-x → Welt-z
    const fin = new THREE.Mesh(finGeo, this._bodyMat);
    fin.position.set(0.45, 0.6, 0);
    this.group.add(fin);

    // Seitenruder-Linie + Flossen-Abzeichen
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 1.1), this._accentMat);
    rudder.position.set(0, 3.4, 25.2);
    rudder.rotation.x = 0.12;
    this.group.add(rudder);
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.2, 1.3), this._ivoryMat);
    flash.position.set(0, 3.2, 21.6);
    this.group.add(flash);

    // Spornrad
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), this._metalMat);
    strut.position.set(0, -1.6, 21.5);
    this.group.add(strut);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.28, 8, 12), this._propMat);
    wheel.position.set(0, -2.5, 21.5);
    wheel.rotation.y = Math.PI / 2;
    this.group.add(wheel);
  }

  _buildEngineDetails() {
    // Haubenring vorn
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.35, 10, 24), this._accentMat);
    ring.position.z = -19.6;
    this.group.add(ring);

    // Auspuffstutzen an den Haubenseiten
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.7, 6), this._metalMat);
        stub.rotation.x = Math.PI / 2;
        stub.rotation.z = s * 0.5;
        stub.position.set(s * 3.35, 0.4, -14.5 + i * 1.7);
        this.group.add(stub);
      }
    }

    // MG-Läufe über dem Motor
    for (const s of [-1, 1]) {
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 3.2, 6), this._propMat);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(s * 1.15, 2.75, -17.6);
      this.group.add(gun);
    }

    // Antennenmast
    const mast = new THREE.Mesh(new THREE.ConeGeometry(0.18, 2.2, 6), this._accentMat);
    mast.position.set(0, 3.6, 4.6);
    mast.rotation.x = -0.15;
    this.group.add(mast);
  }

  _buildPropeller() {
    this._prop = new THREE.Group();
    this._prop.position.z = -20.2;

    const spinner = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.2, 20), this._metalMat);
    spinner.rotation.x = -Math.PI / 2; // Spitze nach vorn (-Z)
    spinner.position.z = -1.7;
    this._prop.add(spinner);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.4, 14), this._metalMat);
    hub.rotation.x = Math.PI / 2;
    this._prop.add(hub);

    // Drei geschränkte, zur Spitze verjüngte Blätter mit gelben Spitzen
    const bladeGeo = new THREE.CylinderGeometry(0.55, 1.05, 14.4, 10);
    bladeGeo.scale(1, 1, 0.24); // flaches Blattprofil
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xd8b23a, roughness: 0.5 });
    for (let k = 0; k < 3; k++) {
      const holder = new THREE.Group();
      holder.rotation.z = (k * 2 * Math.PI) / 3;
      const blade = new THREE.Mesh(bladeGeo, this._propMat);
      blade.position.y = 7.4;
      blade.rotation.y = 0.38; // Blattanstellung
      holder.add(blade);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 6), tipMat);
      tip.scale.set(1, 1.4, 0.4);
      tip.position.y = 14.4;
      tip.rotation.y = 0.38;
      holder.add(tip);
      this._prop.add(holder);
    }

    // Bewegungsunschärfe des drehenden Propellers: halbtransparente Scheibe,
    // die mit steigender Drehzahl sichtbarer wird.
    this._blur = new THREE.Mesh(
      new THREE.CircleGeometry(15.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0x2a2a30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    this._blur.position.z = -20.2;
    this.group.add(this._blur);

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
    this._blur.material.opacity = 0.05 + throttle * 0.2;
  }
}

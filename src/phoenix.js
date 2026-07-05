// Spielbarer Phönix: glühender Feuervogel — Körper und Deckfedern in der
// gewählten Flammenfarbe, Schwungfedern mit emissiv glühenden Spitzen (Bloom!),
// Kopfkamm, goldener Schnabel und vier lange, wellenförmig nachschwingende
// Schweiffedern. Die Flügel schlagen zweigliedrig (Arm + Hand, phasenversetzt);
// gespiegelte linke Schwinge braucht das umgekehrte rotation.z-Vorzeichen.
// Speit Flammen (nutzt das Drachenfeuer-System).
import * as THREE from "three";
import { uniform, positionLocal, color, float } from "three/tsl";
import { Flier } from "./flier.js";

const lerp = (a, b, f) => a + (b - a) * f;

export class Phoenix extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMode = "flame";
    this.fireMuzzle.set(0, 1.5, -14);

    // Glutfarbe als Uniform: setColor() färbt Körper UND das Feder-Glühen um.
    this._uGlow = uniform(new THREE.Color(0xff8a20));
    this._bodyMat = new THREE.MeshStandardMaterial({ color: 0xd2641b, roughness: 0.6 });
    this._darkMat = new THREE.MeshStandardMaterial({ color: 0x8a3a10, roughness: 0.7 });
    this._goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b03a, metalness: 0.55, roughness: 0.35 });
    this._eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1005, emissive: 0xffd040, emissiveIntensity: 2.5 });

    // Schwungfeder-Material: zur Spitze hin emissiv glühend (positionLocal.x
    // wächst entlang der Feder; Divisor ≈ typische Federlänge).
    this._featherMat = new THREE.MeshStandardNodeMaterial({ color: 0xc25012, side: THREE.DoubleSide, roughness: 0.7 });
    this._featherMat.emissiveNode = this._uGlow.mul(positionLocal.x.div(16.0).clamp(0.0, 1.0).pow(2.0)).mul(1.8);
    this._covertMat = new THREE.MeshStandardNodeMaterial({ color: 0x9a3a10, side: THREE.DoubleSide, roughness: 0.75 });
    this._covertMat.emissiveNode = this._uGlow.mul(positionLocal.x.div(9.0).clamp(0.0, 1.0).pow(2.0)).mul(float(0.7));

    this._buildBody();
    this._wingL = this._buildWing(-1);
    this._wingR = this._buildWing(1);
    this._buildTail();

    this.group.scale.setScalar(1.5);
    scene.add(this.group);
  }

  /** Blattförmige Feder (zeigt nach +X, liegt in XZ). */
  _feather(len, w, mat) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(len * 0.25, w * 0.6, len * 0.55, w * 0.5);
    s.quadraticCurveTo(len * 0.95, w * 0.36, len, 0);
    s.quadraticCurveTo(len * 0.95, -w * 0.36, len * 0.55, -w * 0.5);
    s.quadraticCurveTo(len * 0.25, -w * 0.6, 0, 0);
    const geo = new THREE.ShapeGeometry(s, 6);
    geo.rotateX(Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  }

  _row(parent, o) {
    for (let i = 0; i < o.n; i++) {
      const f = o.n > 1 ? i / (o.n - 1) : 0;
      const feather = this._feather(lerp(o.len0, o.len1, f), o.w, o.mat);
      feather.position.set(lerp(o.x0, o.x1, f), o.y + i * 0.02, lerp(o.z0, o.z1, f));
      feather.rotation.y = lerp(o.ang0, o.ang1, f);
      feather.rotation.x = o.lift;
      parent.add(feather);
    }
  }

  _buildBody() {
    const g = this.group;

    // Rumpf + Brust
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 7, 6, 12), this._bodyMat);
    torso.rotation.x = Math.PI / 2 + 0.12;
    torso.position.set(0, 0, -1);
    g.add(torso);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(3.3, 12, 10), this._darkMat);
    chest.scale.set(1, 1, 1.25);
    chest.position.set(0, -0.9, -5);
    g.add(chest);

    // Hals + Kopf mit Kamm, Goldschnabel und Glutaugen
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 6, 9), this._bodyMat);
    neck.rotation.x = Math.PI / 2.4;
    neck.position.set(0, 1.2, -8.3);
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), this._bodyMat);
    head.position.set(0, 2.4, -11.4);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.4, 6), this._goldMat);
    beak.rotation.x = -Math.PI / 2 - 0.15;
    beak.position.set(0, 2, -14);
    g.add(beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this._eyeMat);
      eye.position.set(s * 1.15, 2.9, -12.2);
      g.add(eye);
    }
    // Kopfkamm: drei glühende Federn nach hinten-oben
    this._crest = [];
    for (let i = 0; i < 3; i++) {
      const cf = this._feather(6 + i * 1.6, 0.9, this._featherMat);
      cf.position.set(0, 3.6 + i * 0.35, -10.8 + i * 0.5);
      cf.rotation.z = Math.PI / 2 - 0.25;      // Feder zeigt nach oben
      cf.rotation.y = -0.9 - i * 0.25;         // und fächert nach hinten
      g.add(cf);
      this._crest.push(cf);
    }

    // Krallen angelegt
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2.6, 4, 8), this._darkMat);
      leg.rotation.x = Math.PI / 2 - 0.4;
      leg.position.set(s * 1.6, -2.6, 3);
      g.add(leg);
    }
  }

  _buildWing(side) {
    const wing = new THREE.Group();
    wing.position.set(side * 2.6, 0.6, -3.5);

    const inner = new THREE.Group();
    wing.add(inner);
    // Flügelarm + zwei Federlagen
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 12, 4, 8), this._darkMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(6.5, 0.3, -1.5);
    inner.add(arm);
    this._row(inner, { n: 7, x0: 1, x1: 11, z0: 2.5, z1: 1.2, ang0: -1.2, ang1: -0.85, len0: 8, len1: 10, w: 1.3, lift: 0.1, y: 0.1, mat: this._featherMat });
    this._row(inner, { n: 6, x0: 1, x1: 10.5, z0: -0.8, z1: -1.1, ang0: -1.15, ang1: -0.9, len0: 4.5, len1: 5.5, w: 1.0, lift: 0.18, y: 0.3, mat: this._covertMat });

    // Handteil mit langen, geschlitzten Schwungfedern
    const outer = new THREE.Group();
    outer.position.set(12, 0, -1);
    wing.add(outer);
    wing.userData.outer = outer;
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 8.5, 4, 8), this._darkMat);
    hand.rotation.z = Math.PI / 2;
    hand.rotation.y = -0.18;
    hand.position.set(4.4, 0, -1.8);
    outer.add(hand);
    this._row(outer, { n: 6, x0: 1, x1: 8.5, z0: 0.4, z1: -1.2, ang0: -1.0, ang1: -0.18, len0: 11, len1: 16, w: 1.25, lift: 0.05, y: 0, mat: this._featherMat });
    this._row(outer, { n: 5, x0: 0.8, x1: 7, z0: -0.9, z1: -1.6, ang0: -1.0, ang1: -0.45, len0: 5, len1: 6, w: 0.95, lift: 0.14, y: 0.22, mat: this._covertMat });

    if (side < 0) wing.scale.x = -1;
    this.group.add(wing);
    return wing;
  }

  _buildTail() {
    // Vier lange Schweiffedern, die wellenförmig nachschwingen
    this._tail = [];
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1;
      const rank = Math.floor(i / 2);
      const tf = this._feather(20 + rank * 7, 1.5, this._featherMat);
      tf.position.set(s * (0.8 + rank * 0.9), 0.3 - rank * 0.4, 4.5);
      // Feder zeigt nach hinten (+z): um 90° drehen
      tf.rotation.y = Math.PI / 2 + s * (0.12 + rank * 0.1);
      this.group.add(tf);
      this._tail.push(tf);
    }
  }

  /** Flammenfarbe wählen: Körper, Federn und Glut werden umgefärbt. */
  setColor(hex) {
    const base = new THREE.Color(hex);
    this._bodyMat.color.copy(base);
    this._darkMat.color.copy(base).multiplyScalar(0.55);
    this._featherMat.color.copy(base).multiplyScalar(0.85);
    this._covertMat.color.copy(base).multiplyScalar(0.6);
    // Glut: hellere, wärmere Variante der Grundfarbe
    this._uGlow.value.copy(base).lerp(new THREE.Color(0xffffff), 0.35);
  }

  /** Animation: kraftvoller Flügelschlag mit nachlaufender Hand, wogende
   *  Schweiffedern, nickender Kamm. */
  update(t, throttle) {
    const spd = 3.5 + throttle * 6;
    const amp = 0.22 + throttle * 0.5;
    const flap = Math.sin(t * spd) * amp;
    const outerFlap = 0.1 + Math.sin(t * spd - 0.6) * amp * 0.7;
    this._wingR.rotation.z = 0.1 + flap;
    this._wingL.rotation.z = -(0.1 + flap);       // gespiegelte Schwinge!
    this._wingR.userData.outer.rotation.z = outerFlap;
    this._wingL.userData.outer.rotation.z = outerFlap;

    for (let i = 0; i < this._tail.length; i++) {
      const tf = this._tail[i];
      tf.rotation.z = Math.sin(t * 2.6 + i * 0.9) * 0.18;
      tf.rotation.x = 0.08 + Math.sin(t * 3.1 + i * 1.3) * 0.1;
    }
    for (let i = 0; i < this._crest.length; i++) {
      this._crest[i].rotation.y = -0.9 - i * 0.25 + Math.sin(t * 4 + i) * 0.08;
    }
  }
}

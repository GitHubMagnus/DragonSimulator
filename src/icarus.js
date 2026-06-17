// Spielbarer Ikarus: eine fliegende Menschenfigur in Bauchlage mit großen,
// mehrreihig gefiederten Schwingen (Deck-, Arm- und Handschwingen) auf einem
// Wachs-/Armgerüst, Tunika, Haar und nachschwingenden Beinen. Tunika und
// Federsaum sind im Menü färbbar. Kann kein Feuer speien.
import * as THREE from "three";
import { Flier } from "./flier.js";

export class Icarus extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = false;

    this._skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a07a, flatShading: true, roughness: 0.85 });
    this._hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, flatShading: true, roughness: 0.8 });
    this._waxMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, flatShading: true, roughness: 0.6 });
    this._quillMat = new THREE.MeshStandardMaterial({ color: 0xcfc4ad, flatShading: true, roughness: 0.7 });
    this._clothMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, flatShading: true, roughness: 0.85 });
    this._featherMain = new THREE.MeshStandardMaterial({ color: 0xf2efe6, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 });
    this._featherTint = new THREE.MeshStandardMaterial({ color: 0xcdd6e0, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 });
    this._featherCovert = new THREE.MeshStandardMaterial({ color: 0x9fb0c4, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 });

    this._buildBody();
    this._buildArms();
    this._buildLegs();
    this._wingL = this._buildWing(-1);
    this._wingR = this._buildWing(1);

    this.group.scale.setScalar(1.5);
    scene.add(this.group);
  }

  _buildBody() {
    // Kopf, Haar, Nase
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), this._skinMat);
    head.position.set(0, 1.4, -9);
    this.group.add(head);

    this._hair = new THREE.Group();
    this._hair.position.set(0, 1.4, -9);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(2.35, 14, 12), this._hairMat);
    hair.scale.set(1.02, 1.0, 1.08);
    hair.position.set(0, 0.5, 0.8);
    this._hair.add(hair);
    // Locken nach hinten
    for (const s of [-1, 0, 1]) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), this._hairMat);
      curl.position.set(s * 1.1, 1.0, 2.1);
      this._hair.add(curl);
    }
    this.group.add(this._hair);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 6), this._skinMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 1.1, -11);
    this.group.add(nose);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 2, 8), this._skinMat);
    neck.rotation.x = Math.PI / 2.2;
    neck.position.set(0, 0.9, -7);
    this.group.add(neck);

    // Oberkörper
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.9, 5, 6, 12), this._skinMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.3, -3.5);
    this.group.add(torso);

    for (const s of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), this._skinMat);
      shoulder.position.set(s * 2.3, 0.6, -5.6);
      this.group.add(shoulder);
    }

    // Tunika über Hüfte/Bauch + diagonale Schärpe
    const tunic = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 6.5, 12), this._clothMat);
    tunic.rotation.x = Math.PI / 2;
    tunic.position.set(0, 0.1, 0.6);
    this.group.add(tunic);
    const hips = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), this._clothMat);
    hips.scale.set(1.1, 0.9, 1.1);
    hips.position.set(0, -0.2, 3.2);
    this.group.add(hips);
    const sash = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 0.4), this._clothMat);
    sash.position.set(0, 0.7, -3.2);
    sash.rotation.z = 0.5;
    this.group.add(sash);
  }

  _buildArms() {
    for (const s of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 4, 7), this._skinMat);
      upper.rotation.z = Math.PI / 2;
      upper.rotation.y = -s * 0.15;
      upper.position.set(s * 4.2, 0.5, -5.3);
      this.group.add(upper);

      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3.6, 7), this._skinMat);
      fore.rotation.z = Math.PI / 2;
      fore.rotation.y = -s * 0.25;
      fore.position.set(s * 7.6, 0.3, -5.0);
      this.group.add(fore);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), this._skinMat);
      hand.scale.set(1, 0.6, 1.2);
      hand.position.set(s * 9.5, 0.2, -4.8);
      this.group.add(hand);
    }
  }

  _buildLegs() {
    this._legL = this._buildLeg(-1);
    this._legR = this._buildLeg(1);
  }

  _buildLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 1.1, -0.2, 3);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 4.2, 7), this._skinMat);
    thigh.rotation.x = -Math.PI / 2;
    thigh.position.set(0, 0, 2.1);
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 4.2, 7), this._skinMat);
    shin.rotation.x = -Math.PI / 2;
    shin.position.set(side * 0.2, -0.1, 6.2);
    leg.add(shin);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.2), this._skinMat);
    foot.position.set(side * 0.2, -0.3, 8.6);
    leg.add(foot);

    this.group.add(leg);
    return leg;
  }

  /** Eine flache, blattförmige Feder (in der XZ-Ebene, zeigt nach +X). */
  _feather(len, width, mat) {
    const g = new THREE.Group();
    const v = new Float32Array([
      0, 0, 0,
      len * 0.3, 0, width,
      len, 0, 0,
      len * 0.3, 0, -width,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat));

    const quill = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.16), this._quillMat);
    quill.position.set(len / 2, 0.03, 0);
    g.add(quill);
    return g;
  }

  /** Eine Federreihe als erhabenes Detail auf der Fläche verteilen, nach hinten fächernd. */
  _addFeatherRow(wing, o) {
    for (let i = 0; i < o.n; i++) {
      const f = o.n > 1 ? i / (o.n - 1) : 0;
      const feather = this._feather(o.len0 + (o.len1 - o.len0) * f, o.w, o.mat);
      feather.position.set(o.x0 + (o.x1 - o.x0) * f, o.y ?? 0, o.z0 + (o.z1 - o.z0) * f);
      feather.rotation.y = o.ang0 + (o.ang1 - o.ang0) * f; // negativ = fächert nach hinten (+Z)
      feather.rotation.z = o.lift;
      wing.add(feather);
    }
  }

  _buildWing(side) {
    const wing = new THREE.Group();
    wing.position.set(side * 2.2, 0.7, -4.6);
    wing.rotation.y = -0.12; // Schwinge leicht nach hinten gepfeilt

    // Tragende, gefüllte Federfläche als Grundform (große, weit gefächerte
    // Schwinge in der XZ-Ebene). Aus einer 2D-Kontur erzeugt und flach gelegt —
    // so liest sich der Flügel von jedem Winkel als breite Schwinge.
    const s = new THREE.Shape();
    s.moveTo(0, -3);
    s.lineTo(10, -5);
    s.lineTo(21, -4);
    s.lineTo(31, 1);    // weit ausladende Spitze
    s.lineTo(29, 13);
    s.lineTo(18, 19);   // tiefe Hinterkante (Handschwingen)
    s.lineTo(8, 15);
    s.lineTo(2, 7);
    s.closePath();
    const membrane = new THREE.Mesh(new THREE.ShapeGeometry(s), this._featherMain);
    membrane.rotation.x = Math.PI / 2; // 2D-Kontur in die XZ-Ebene kippen (+y → +z)
    wing.add(membrane);

    // Schlanker Flügelarm entlang der Vorderkante + Wachsband an der Wurzel
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 30, 7), this._waxMat);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = 0.12;
    arm.position.set(15, 0.3, -2.6);
    wing.add(arm);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 4, 8), this._waxMat);
    wax.rotation.z = Math.PI / 2;
    wax.position.set(3, 0.2, -1.2);
    wing.add(wax);

    // Drei erhabene Federreihen auf der Fläche: Deck-, Arm- und Handschwingen
    this._addFeatherRow(wing, { n: 8,  x0: 3,  x1: 14, z0: 1,   z1: 4,  ang0: -0.45, ang1: -0.9,  len0: 5,  len1: 7,  w: 0.9, lift: 0.16, y: 0.2,  mat: this._featherCovert });
    this._addFeatherRow(wing, { n: 10, x0: 4,  x1: 20, z0: 2,   z1: 8,  ang0: -0.5,  ang1: -1.05, len0: 8,  len1: 12, w: 1.2, lift: 0.1,  y: 0.45, mat: this._featherTint });
    this._addFeatherRow(wing, { n: 13, x0: 10, x1: 30, z0: 1.5, z1: 7,  ang0: -0.2,  ang1: -1.15, len0: 11, len1: 18, w: 1.5, lift: 0.06, y: 0.7,  mat: this._featherMain });

    if (side < 0) wing.scale.x = -1; // linke Schwinge spiegeln
    this.group.add(wing);
    return wing;
  }

  /** Tunika und Federsaum einfärben; Hauptschwingen bleiben hell mit zartem Ton. */
  setColor(hex) {
    const base = new THREE.Color(hex);
    const white = new THREE.Color(0xf4f1ea);
    this._clothMat.color.copy(base);
    this._featherCovert.color.copy(base);
    this._featherTint.color.copy(base).lerp(white, 0.45);
    this._featherMain.color.copy(white).lerp(base, 0.22);
  }

  /** Animation: kraftvoller Flügelschlag, gegenläufig schwingende Beine, Haarflattern. */
  update(t, throttle) {
    const spd = 3 + throttle * 5;
    const amp = 0.3 + throttle * 0.4;
    const flap = 0.5 + Math.sin(t * spd) * amp; // deutliche V-Stellung + Schlag
    this._wingL.rotation.z = flap;
    this._wingR.rotation.z = flap;

    const kick = Math.sin(t * spd) * 0.12;
    this._legL.rotation.x = kick;
    this._legR.rotation.x = -kick;
    this._hair.rotation.x = Math.sin(t * 6) * 0.05;
  }
}

// Spielbarer Ikarus: Gleiter in gestreckter Bauchlage mit großen, vogel-
// artigen Schwingen. Jede Schwinge ist zweigliedrig (Arm- und Handteil mit
// eigenem Gelenk) und aus gestaffelten Federlagen aufgebaut: kurze Deck-
// federn an der Vorderkante, Sekundärfedern als Hinterkante und lange,
// geschlitzte Handschwingen an der Spitze (wie bei einem Adler im Segelflug).
// Die Arme greifen die Wachs-Holme und schwingen mit. Bei wenig Schlag
// gleitet er mit ruhig gewölbten Flügeln, bei viel Schlag schlägt er tief
// durch — die Flügelspitze läuft dabei phasenversetzt nach. Tunika und
// Federsaum sind im Menü färbbar. Kann kein Feuer speien.
import * as THREE from "three";
import { Flier } from "./flier.js";

const UP = new THREE.Vector3(0, 1, 0);
const lerp = (a, b, f) => a + (b - a) * f;

export class Icarus extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = false;

    this._skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a07a, roughness: 0.8 });
    this._hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.75 });
    this._waxMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
    this._quillMat = new THREE.MeshStandardMaterial({ color: 0xcfc4ad, roughness: 0.7 });
    this._goldMat = new THREE.MeshStandardMaterial({ color: 0xa8883a, roughness: 0.4, metalness: 0.5 });
    this._clothMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.85, side: THREE.DoubleSide });
    this._featherMain = new THREE.MeshStandardMaterial({ color: 0xf2efe6, side: THREE.DoubleSide, roughness: 0.8 });
    this._featherTint = new THREE.MeshStandardMaterial({ color: 0xcdd6e0, side: THREE.DoubleSide, roughness: 0.8 });
    this._featherCovert = new THREE.MeshStandardMaterial({ color: 0x9fb0c4, side: THREE.DoubleSide, roughness: 0.8 });

    this._buildBody();
    this._buildLegs();
    this._wingL = this._buildWing(-1);
    this._wingR = this._buildWing(1);

    this.group.scale.setScalar(1.5);
    scene.add(this.group);
  }

  /** Kapsel-Gliedmaße zwischen zwei Punkten (für Arme und Beine). */
  _limb(ax, ay, az, bx, by, bz, r, mat) {
    const a = new THREE.Vector3(ax, ay, az);
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    return m;
  }

  // ---- Körper: gestreckte Gleitpose ----
  _buildBody() {
    // Kopf mit Gesicht, Haar und Goldband
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.05, 16, 14), this._skinMat);
    head.position.set(0, 1.9, -9.6);
    this.group.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6), this._skinMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 1.55, -11.5);
    this.group.add(nose);

    this._hair = new THREE.Group();
    this._hair.position.set(0, 1.9, -9.6);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), this._hairMat);
    cap.scale.set(1.0, 0.95, 1.05);
    cap.position.set(0, 0.5, 0.55);
    this._hair.add(cap);
    for (const [cx, cy, cz] of [[-1.2, 0.9, 1.9], [0, 1.0, 2.2], [1.2, 0.9, 1.9], [0, 0.1, 2.5]]) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), this._hairMat);
      curl.position.set(cx, cy, cz);
      this._hair.add(curl);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.14, 8, 20), this._goldMat);
    band.rotation.x = Math.PI / 2 - 0.35; // schräg über die Stirn
    band.position.y = 0.75;
    this._hair.add(band);
    this.group.add(this._hair);

    // Hals + Rumpf (Brust liegt vorn-oben, Becken hinten)
    this.group.add(this._limb(0, 1.3, -8.2, 0, 0.8, -6.4, 0.85, this._skinMat));
    this.group.add(this._limb(0, 0.75, -5.8, 0, 0.1, -0.5, 1.9, this._skinMat));
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), this._skinMat);
      shoulder.position.set(s * 2.1, 0.75, -5.4);
      this.group.add(shoulder);
    }

    // Tunika: Wickel um Rumpf/Hüfte + wehender Rocksaum
    this.group.add(this._limb(0, 0.55, -3.4, 0, -0.15, 2.4, 2.05, this._clothMat));
    const hips = new THREE.Mesh(new THREE.SphereGeometry(1.95, 12, 10), this._clothMat);
    hips.scale.set(1.1, 0.85, 1.15);
    hips.position.set(0, -0.25, 2.4);
    this.group.add(hips);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.0, 3.2, 14, 1, true), this._clothMat);
    skirt.rotation.x = Math.PI / 2; // weites Ende nach hinten
    skirt.position.set(0, -0.35, 4.4);
    this.group.add(skirt);

    // Flatternde Stoffbahnen hinter dem Saum (animiert)
    this._cloth = [];
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.6), this._clothMat);
      strip.position.set(s * 0.9, -0.5, 6.2);
      strip.rotation.x = Math.PI / 2 - 0.35;
      this.group.add(strip);
      this._cloth.push(strip);
    }

    // Wachs-Harnisch auf dem Rücken (Flügelaufhängung) + Kreuzgurte
    const wax = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), this._waxMat);
    wax.scale.set(1.9, 0.7, 1.6);
    wax.position.set(0, 2.0, -4.4);
    this.group.add(wax);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 4.6), this._goldMat);
      strap.position.set(s * 1.2, 1.55, -2.4);
      strap.rotation.y = s * 0.45;
      strap.rotation.x = 0.12;
      this.group.add(strap);
    }
  }

  // ---- Beine: geschlossen nach hinten gestreckt, Zehen gespitzt ----
  _buildLegs() {
    this._legL = this._buildLeg(-1);
    this._legR = this._buildLeg(1);
  }

  _buildLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 1.05, -0.4, 3.0);

    leg.add(this._limb(0, 0, 0, side * 0.15, -0.35, 4.2, 0.95, this._skinMat));            // Oberschenkel
    leg.add(this._limb(side * 0.15, -0.35, 4.2, side * 0.1, -0.55, 8.4, 0.6, this._skinMat)); // Unterschenkel
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 2.0), this._skinMat);
    foot.position.set(side * 0.1, -0.5, 9.6);
    foot.rotation.x = -0.5; // gespitzter Fuß (Gleitpose)
    leg.add(foot);

    this.group.add(leg);
    return leg;
  }

  // ---- Federn ----
  /** Blattförmige Feder mit gerundeter Spitze (liegt in XZ, zeigt nach +X). */
  _feather(len, w, mat) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(len * 0.25, w * 0.62, len * 0.55, w * 0.52);
    s.quadraticCurveTo(len * 0.95, w * 0.38, len, 0);
    s.quadraticCurveTo(len * 0.95, -w * 0.38, len * 0.55, -w * 0.52);
    s.quadraticCurveTo(len * 0.25, -w * 0.62, 0, 0);
    const geo = new THREE.ShapeGeometry(s, 6);
    geo.rotateX(Math.PI / 2);

    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const quill = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.12, 0.16), this._quillMat);
    quill.position.set(len * 0.42, 0.05, 0);
    g.add(quill);
    return g;
  }

  /** Eine Federreihe verteilen: Position, Fächerung, Länge und Wölbung
   *  werden von Reihenanfang zu -ende interpoliert. */
  _row(parent, o) {
    for (let i = 0; i < o.n; i++) {
      const f = o.n > 1 ? i / (o.n - 1) : 0;
      const jitter = Math.sin((i + 1) * 12.9898 + o.z0 * 3.7) * 0.035;
      const feather = this._feather(lerp(o.len0, o.len1, f), o.w, o.mat);
      feather.position.set(lerp(o.x0, o.x1, f), o.y + i * 0.02, lerp(o.z0, o.z1, f));
      feather.rotation.y = lerp(o.ang0, o.ang1, f) + jitter;   // Fächerung nach hinten
      feather.rotation.x = o.lift;                              // Wölbung der Lage
      feather.rotation.z = lerp(o.droop0 ?? 0, o.droop1 ?? 0, f); // Spitzen hängen leicht
      parent.add(feather);
    }
  }

  // ---- Schwinge: Armteil + Handteil mit eigenem Gelenk ----
  _buildWing(side) {
    const wing = new THREE.Group();
    wing.position.set(side * 2.4, 1.9, -4.4);
    wing.userData.sgn = side;

    // --- Armteil (Schulter → Handgelenk) ---
    const inner = new THREE.Group();
    wing.add(inner);

    // Tragende Federhaut als Grundfläche
    const skinS = new THREE.Shape();
    skinS.moveTo(0, -3.4);
    skinS.quadraticCurveTo(8, -4.6, 15.5, -4.0);  // Vorderkante
    skinS.lineTo(15.5, 2.0);
    skinS.quadraticCurveTo(8, 7.0, 1.5, 8.6);     // Hinterkante
    skinS.lineTo(0, 8.8);
    skinS.closePath();
    const skinGeo = new THREE.ShapeGeometry(skinS, 8);
    skinGeo.rotateX(Math.PI / 2);
    const skin = new THREE.Mesh(skinGeo, this._featherTint);
    skin.position.y = 0.05;
    skin.rotation.x = 0.06;
    inner.add(skin);

    // Sekundärfedern bilden die Hinterkante, Deckfedern die Vorderkante
    this._row(inner, { n: 9, x0: 1, x1: 14, z0: 3.5, z1: 1.5, ang0: -1.25, ang1: -0.9, len0: 10, len1: 11.5, w: 1.35, lift: 0.1, y: 0.15, droop0: -0.02, droop1: -0.06, mat: this._featherTint });
    this._row(inner, { n: 8, x0: 1, x1: 13.5, z0: -1.2, z1: -1.6, ang0: -1.2, ang1: -0.95, len0: 5.5, len1: 6.5, w: 1.0, lift: 0.18, y: 0.35, mat: this._featherCovert });

    // Wachs-Holm entlang der Vorderkante + Wachsklumpen an den Aufhängungen
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 15.2, 8), this._waxMat);
    spar.rotation.z = Math.PI / 2;
    spar.position.set(7.5, 0.1, -3.5);
    inner.add(spar);
    for (const [wx, wz] of [[1.6, -3.2], [14.4, -3.6]]) {
      const lump = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), this._waxMat);
      lump.scale.set(1.2, 0.8, 1.2);
      lump.position.set(wx, 0.15, wz);
      inner.add(lump);
    }

    // Arm greift den Holm: Ober-/Unterarm + Hand (schwingt mit dem Flügel)
    inner.add(this._limb(0.6, -1.2, -1.2, 6.2, -0.9, -2.8, 0.72, this._skinMat));
    inner.add(this._limb(6.2, -0.9, -2.8, 12.6, -0.5, -3.1, 0.58, this._skinMat));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), this._skinMat);
    hand.scale.set(1.1, 0.7, 1.3);
    hand.position.set(13.3, -0.3, -3.3);
    inner.add(hand);

    // --- Handteil (Handgelenk → Spitze), eigenes Gelenk für Nachschwingen ---
    const outer = new THREE.Group();
    outer.position.set(15, 0, -0.6);
    wing.add(outer);
    wing.userData.outer = outer;

    const outS = new THREE.Shape();
    outS.moveTo(0, -3.4);
    outS.quadraticCurveTo(6, -3.2, 11, -1.6);     // Vorderkante zur Spitze
    outS.quadraticCurveTo(11.8, 0, 10.5, 1.2);
    outS.quadraticCurveTo(5, 3.2, 0, 2.4);        // Hinterkante
    outS.closePath();
    const outGeo = new THREE.ShapeGeometry(outS, 8);
    outGeo.rotateX(Math.PI / 2);
    const outSkin = new THREE.Mesh(outGeo, this._featherTint);
    outSkin.position.y = 0.05;
    outer.add(outSkin);

    // Geschlitzte Handschwingen: innen weit nach hinten gefächert, außen
    // fast gerade — die Spitzen stehen einzeln wie Finger.
    this._row(outer, { n: 7, x0: 1.5, x1: 10.5, z0: 0.5, z1: -1.4, ang0: -1.0, ang1: -0.15, len0: 13, len1: 19, w: 1.35, lift: 0.05, y: 0, droop0: -0.04, droop1: -0.14, mat: this._featherMain });
    this._row(outer, { n: 6, x0: 1, x1: 9, z0: -0.8, z1: -1.6, ang0: -1.05, ang1: -0.5, len0: 6, len1: 7.5, w: 1.0, lift: 0.14, y: 0.25, mat: this._featherTint });
    // Daumenfittich (Alula) an der Vorderkante
    this._row(outer, { n: 2, x0: 0.3, x1: 1.2, z0: -2.6, z1: -2.4, ang0: -0.35, ang1: -0.25, len0: 4, len1: 4.6, w: 0.8, lift: 0.1, y: 0.3, mat: this._featherCovert });

    // Hand-Holm
    const outSpar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 10.8, 8), this._waxMat);
    outSpar.rotation.z = Math.PI / 2;
    outSpar.rotation.y = -0.16;
    outSpar.position.set(5.2, 0.05, -2.5);
    outer.add(outSpar);

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

  /**
   * Animation: bei wenig Schlag ruhiges Gleiten mit sanft gewölbten Flügeln,
   * bei viel Schlag tiefe Schläge; die Handschwingen laufen phasenversetzt
   * nach. Beine scheren gegenläufig mit, Haar und Tunika flattern.
   * Hinweis: der linke Flügel ist gespiegelt (scale.x=-1) — seine eigene
   * rotation.z braucht deshalb das umgekehrte Vorzeichen, die Kinder
   * (Handteil) übernehmen den Wert unverändert.
   */
  update(t, throttle) {
    const spd = 2.4 + throttle * 4.6;
    const amp = 0.1 + throttle * 0.48;
    const flap = Math.sin(t * spd) * amp;
    const base = 0.18 - amp * 0.12; // Gleit-V-Stellung, sinkt bei kräftigem Schlag
    const outerFlap = 0.08 + Math.sin(t * spd - 0.7) * amp * 0.6;
    const twist = Math.sin(t * spd + 0.5) * amp * 0.1;

    this._wingR.rotation.z = base + flap;
    this._wingL.rotation.z = -(base + flap);
    this._wingR.rotation.x = twist;
    this._wingL.rotation.x = twist;
    this._wingR.userData.outer.rotation.z = outerFlap;
    this._wingL.userData.outer.rotation.z = outerFlap;

    const kick = Math.sin(t * spd) * 0.05 * (0.3 + throttle);
    this._legL.rotation.x = kick;
    this._legR.rotation.x = -kick;

    this._hair.rotation.x = Math.sin(t * 6.5) * 0.04;
    for (let i = 0; i < this._cloth.length; i++) {
      this._cloth[i].rotation.x = Math.PI / 2 - 0.35 + Math.sin(t * 7.5 + i * 1.9) * 0.16;
    }
  }
}

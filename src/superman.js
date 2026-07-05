// Spielbarer Superman: fliegende Heldenfigur in klassischer Pose — rechte
// Faust voraus, linker Arm angelegt, Beine gestreckt. Detailliert modelliert:
// muskulöser Anzug (färbbar), rote Stiefel/Shorts, Goldgürtel, Brust-Emblem,
// schwarzes Haar mit Locke und ein großer roter Umhang, der per Vertex-Shader
// im Fahrtwind flattert. Feuert Hitzeblick (Leuchtspur-Modus) aus den Augen.
import * as THREE from "three";
import { uv, time, vec3, positionLocal } from "three/tsl";
import { Flier } from "./flier.js";

const UP = new THREE.Vector3(0, 1, 0);

export class Superman extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMode = "beams"; // Hitzeblick: zwei rote Dauerstrahlen (heatvision.js)
    this.fireMuzzle.set(0, 1.2, -9.5);

    this._suitMat = new THREE.MeshStandardMaterial({ color: 0x2b4fa8, roughness: 0.55 });
    this._redMat = new THREE.MeshStandardMaterial({ color: 0xb02525, roughness: 0.6 });
    this._skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a07a, roughness: 0.75 });
    this._hairMat = new THREE.MeshStandardMaterial({ color: 0x191a20, roughness: 0.35 });
    this._goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b03a, metalness: 0.6, roughness: 0.35 });
    // Umhang flattert: Welle wächst zum freien Ende (uv.y = 0 unten)
    this._capeMat = new THREE.MeshStandardNodeMaterial({ color: 0xb02525, side: THREE.DoubleSide, roughness: 0.7 });
    this._capeMat.positionNode = positionLocal.add(vec3(
      0, 0,
      time.mul(9.0).add(positionLocal.x.mul(0.8)).add(positionLocal.y.mul(0.6)).sin()
        .mul(uv().y.oneMinus()).mul(1.1)
    ));

    this._body = new THREE.Group(); // für sanftes Rollen im Flug
    this.group.add(this._body);
    this._build();

    this.group.scale.setScalar(1.7);
    scene.add(this.group);
  }

  /** Kapsel-Gliedmaße zwischen zwei Punkten. */
  _limb(ax, ay, az, bx, by, bz, r, mat) {
    const a = new THREE.Vector3(ax, ay, az);
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    this._body.add(m);
    return m;
  }

  _build() {
    const b = this._body;

    // Kopf: Gesicht, markantes Kinn, Haar mit Stirnlocke
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 12), this._skinMat);
    head.position.set(0, 1.3, -8);
    b.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.4), this._skinMat);
    jaw.position.set(0, 0.5, -8.9);
    b.add(jaw);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.78, 14, 12), this._hairMat);
    hair.scale.set(1, 0.92, 1);
    hair.position.set(0, 1.65, -7.6);
    b.add(hair);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 6, 10, Math.PI * 1.2), this._hairMat);
    curl.position.set(0.35, 2.2, -9.25);
    curl.rotation.set(0.4, 0.5, 2.6);
    b.add(curl);

    // Muskulöser Rumpf (Brust breit, Taille schmal) in Bauchlage
    this._limb(0, 0.6, -6.2, 0, 0.1, -2.2, 2.1, this._suitMat);   // Brustkorb
    this._limb(0, 0.1, -2.6, 0, -0.1, 0.6, 1.5, this._suitMat);   // Taille
    for (const s of [-1, 1]) {                                     // Brustplatten
      const pec = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), this._suitMat);
      pec.scale.set(1.1, 0.7, 0.9);
      pec.position.set(s * 1.15, -1.1, -5.4);
      b.add(pec);
    }

    // Brust-Emblem: goldene Raute (liegt auf der Brust, von unten sichtbar)
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(1.25, 4), this._goldMat);
    emblem.position.set(0, -2.35, -5.2);
    emblem.rotation.set(Math.PI / 2 + 0.12, 0, 0);
    b.add(emblem);
    const emblemIn = new THREE.Mesh(new THREE.CircleGeometry(0.85, 4), this._redMat);
    emblemIn.position.set(0, -2.4, -5.2);
    emblemIn.rotation.set(Math.PI / 2 + 0.12, 0, 0);
    b.add(emblemIn);

    // Gürtel + Shorts
    const belt = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.3, 8, 14), this._goldMat);
    belt.rotation.x = Math.PI / 2 - 0.1;
    belt.position.set(0, -0.05, 0.9);
    b.add(belt);
    this._limb(0, -0.1, 0.9, 0, -0.2, 2.6, 1.45, this._redMat);

    // Schultern + Arme: rechte Faust voraus, linker Arm am Körper
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), this._suitMat);
      sh.position.set(s * 2.15, 0.5, -5.9);
      b.add(sh);
    }
    this._limb(2.15, 0.5, -6.2, 2.5, 0.7, -9.6, 0.85, this._suitMat);   // rechter Oberarm
    this._limb(2.5, 0.7, -9.6, 2.3, 0.9, -13.2, 0.72, this._suitMat);   // rechter Unterarm
    const fist = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), this._skinMat);
    fist.scale.set(0.9, 0.8, 1.15);
    fist.position.set(2.3, 0.95, -14.2);
    b.add(fist);
    this._limb(-2.15, 0.5, -5.6, -2.6, 0.3, -2.4, 0.85, this._suitMat); // linker Oberarm
    this._limb(-2.6, 0.3, -2.4, -2.4, 0.1, 0.8, 0.72, this._suitMat);   // linker Unterarm
    const fistL = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), this._skinMat);
    fistL.position.set(-2.4, 0.1, 1.6);
    b.add(fistL);

    // Beine gestreckt, rote Stiefel mit Goldkante
    for (const s of [-1, 1]) {
      this._limb(s * 0.85, -0.2, 2.6, s * 1.0, 0, 6.6, 0.95, this._suitMat);
      this._limb(s * 1.0, 0, 6.6, s * 0.95, 0.15, 9.6, 0.7, this._suitMat);
      this._limb(s * 0.95, 0.15, 9.6, s * 0.95, 0.2, 12.2, 0.62, this._redMat); // Stiefel
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 6, 10), this._goldMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.set(s * 0.95, 0.16, 9.5);
      b.add(trim);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), this._redMat);
      toe.scale.set(1, 0.7, 1.4);
      toe.position.set(s * 0.95, 0.1, 13);
      b.add(toe);
    }

    // Umhang: an den Schultern befestigt, weht nach hinten-oben
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 13, 6, 10), this._capeMat);
    cape.position.set(0, 1.6, 0.8);
    cape.rotation.x = Math.PI / 2 - 0.28; // liegt flach nach hinten, leicht angehoben
    b.add(cape);
  }

  /** Anzugfarbe wählen (Umhang/Stiefel bleiben rot, Gürtel gold). */
  setColor(hex) {
    this._suitMat.color.setHex(hex);
  }

  /** Animation: sanftes Rollen und Wogen im Flug (der Umhang weht im Shader). */
  update(t, throttle) {
    this._body.rotation.z = Math.sin(t * 1.3) * 0.06;
    this._body.rotation.x = Math.sin(t * 1.7) * 0.03;
    this._body.position.y = Math.sin(t * 2.1) * 0.15;
  }
}

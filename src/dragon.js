// Der spielbare Drache: detailreiches Modell aus Primitiven mit Schuppenkörper,
// gegliederten Flügeln (Knochen + Fingerstreben + Membran), Rückenkamm, gehörntem
// Kopf mit Zähnen und glühenden Augen sowie wedelndem Schwanz. Bewegung/Physik
// liegt in flight.js, die Animation (Flügelschlag/Wedeln) in update().
import * as THREE from "three";
import { Flier } from "./flier.js";

export class Dragon extends Flier {
  constructor(scene) {
    super();

    this.fireEnabled = true;
    this.fireMuzzle.set(0, 7, -26);

    // Materialien (von setColor() eingefärbt)
    this._scaleMat = new THREE.MeshStandardMaterial({ color: 0x7d1f24, flatShading: true, roughness: 0.7 });
    this._bellyMat = new THREE.MeshStandardMaterial({ color: 0xc8973f, flatShading: true });
    this._membraneMat = new THREE.MeshStandardMaterial({ color: 0x4a1518, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
    this._ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3a1014, flatShading: true, roughness: 0.6 });
    this._hornMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc2, flatShading: true, roughness: 0.5 });
    this._eyeMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xffb000, emissiveIntensity: 1.4 });

    this._buildBody();
    this._buildSpine();
    this._buildHead();
    this._buildTail();
    this._buildLegs();
    this._wingL = this._buildWing(1);
    this._wingR = this._buildWing(-1);

    this.group.scale.setScalar(1.15);
    scene.add(this.group);
  }

  _buildBody() {
    const torso = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 11), this._scaleMat);
    torso.scale.set(1.1, 1.05, 2.7);
    this.group.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 10), this._scaleMat);
    chest.scale.set(1.15, 1.1, 1.4);
    chest.position.set(0, 0.4, -8);
    this.group.add(chest);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(5.4, 12, 8), this._bellyMat);
    belly.scale.set(1.0, 0.7, 2.5);
    belly.position.y = -1.6;
    this.group.add(belly);

    // Bauchschuppen-Rillen als flache Ringe
    for (let i = -1; i <= 2; i++) {
      const seg = new THREE.Mesh(new THREE.TorusGeometry(3.6 - Math.abs(i) * 0.3, 0.35, 4, 10, Math.PI), this._bellyMat);
      seg.rotation.set(Math.PI / 2, 0, 0);
      seg.position.set(0, -2.4, i * 4.2 + 1);
      this.group.add(seg);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 14, 9), this._scaleMat);
    neck.position.set(0, 3, -13);
    neck.rotation.x = Math.PI / 2.6;
    this.group.add(neck);
  }

  /** Rückenkamm: Reihe kleiner Kammplatten von Hals bis Schwanzansatz. */
  _buildSpine() {
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const plate = new THREE.Mesh(new THREE.ConeGeometry(0.9 + (1 - f) * 0.9, 2.4 + (1 - f) * 2.4, 4), this._ridgeMat);
      plate.position.set(0, 5.2 - f * 1.5, -6 + i * 2.6);
      plate.rotation.x = -0.15;
      this.group.add(plate);
    }
  }

  _buildHead() {
    const head = new THREE.Group();
    head.position.set(0, 6.5, -21);

    head.add(new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 7), this._scaleMat));

    const snout = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3, 6), this._scaleMat);
    snout.position.set(0, -0.6, -5.5);
    head.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 5.5), this._scaleMat);
    jaw.position.set(0, -2, -5);
    head.add(jaw);

    // Zähne: kleine Kegel an Ober- und Unterkiefer
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.2, 4), this._hornMat);
        tooth.position.set(s * 1.4, -1.5, -3.5 - i * 1.4);
        tooth.rotation.x = Math.PI;
        head.add(tooth);
      }
    }

    // Nüstern
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), this._ridgeMat);
      nostril.position.set(s * 1, 0.3, -8.2);
      head.add(nostril);
    }

    // Hörner (geschwungen über zwei Segmente) und Wangenstacheln
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 6), this._hornMat);
      horn.position.set(s * 1.7, 3.2, 2);
      horn.rotation.set(-0.7, 0, s * 0.25);
      head.add(horn);
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.5, 6), this._hornMat);
      hornTip.position.set(s * 2.7, 5.6, 3.6);
      hornTip.rotation.set(-1.1, 0, s * 0.4);
      head.add(hornTip);

      const cheek = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 5), this._ridgeMat);
      cheek.position.set(s * 2.6, -0.4, 1.5);
      cheek.rotation.set(0.2, 0, s * 1.2);
      head.add(cheek);

      // Brauenwulst + glühendes Auge
      const brow = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 2.4), this._scaleMat);
      brow.position.set(s * 1.9, 1.5, -2);
      brow.rotation.z = s * 0.2;
      head.add(brow);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 10), this._eyeMat);
      eye.position.set(s * 2.2, 1, -2.5);
      head.add(eye);
    }

    this.group.add(head);
    this._head = head;
  }

  _buildTail() {
    const tail = new THREE.Group();
    this.group.add(tail);
    this._tailSegs = [];
    let parent = tail;
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.z = i === 0 ? 14 : 6;
      const r = 4.4 - i * 0.55;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, 7, 8), this._scaleMat);
      m.rotation.x = Math.PI / 2;
      m.position.z = 3.5;
      seg.add(m);
      // Kammzacke je Segment
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.6 + (1 - i / 7) * 0.8, 2.4, 4), this._ridgeMat);
      spike.position.set(0, r * 0.7, 3.5);
      seg.add(spike);
      parent.add(seg);
      parent = seg;
      this._tailSegs.push(seg);
    }
    // Schwanzklinge (zwei Flügel + Mittelgrat)
    const spade = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 4), this._scaleMat);
    spade.rotation.x = -Math.PI / 2;
    spade.position.z = 8;
    parent.add(spade);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 4), this._membraneMat);
      fin.rotation.set(-Math.PI / 2, 0, s * 0.9);
      fin.position.set(s * 2.2, 0, 7);
      parent.add(fin);
    }
  }

  _buildLegs() {
    for (const s of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.3, 7, 6), this._scaleMat);
      thigh.position.set(s * 4.2, -4.5, 4);
      thigh.rotation.x = 0.5;
      this.group.add(thigh);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 4.5, 6), this._scaleMat);
      shin.position.set(s * 4.6, -8, 6);
      shin.rotation.x = -0.3;
      this.group.add(shin);

      // Krallenfuß: drei Zehen mit Klauen
      for (let toe = -1; toe <= 1; toe++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 4), this._hornMat);
        claw.position.set(s * 4.6 + toe * 0.9, -10, 8 + Math.abs(toe) * -0.4);
        claw.rotation.x = 1.9;
        this.group.add(claw);
      }
    }
  }

  _buildWing(side) {
    const g = new THREE.Group();
    g.position.set(side * 3.5, 1.5, -1);

    // Membran: Dreiecksgeflecht in der XZ-Ebene (Spannweite entlang x)
    const v = new Float32Array([
      0, 0, -6,
      0, 0, 9,
      side * 26, 0, -14,
      side * 46, 0, -1,
      side * 28, 0, 13,
    ]);
    const idx = side > 0
      ? [0, 1, 4, 0, 4, 3, 0, 3, 2]
      : [0, 4, 1, 0, 3, 4, 0, 2, 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, this._membraneMat));

    // Hauptknochen (Vorderkante)
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 50, 5), this._scaleMat);
    bone.rotation.z = Math.PI / 2;
    bone.rotation.y = side * 0.28;
    bone.position.set(side * 23, 0, -6);
    g.add(bone);

    // Fingerstreben, die die Membran aufspannen (zu den hinteren Spitzen)
    const fingerTargets = [
      [side * 26, -14], [side * 38, -7], [side * 46, -1], [side * 28, 13],
    ];
    for (const [tx, tz] of fingerTargets) {
      const len = Math.hypot(tx, tz + 6);
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, len, 4), this._scaleMat);
      finger.position.set(tx / 2, 0, (tz - 6) / 2);
      finger.rotation.z = Math.PI / 2;
      finger.rotation.y = Math.atan2(tz + 6, tx);
      g.add(finger);
    }

    // Daumenklaue an der Flügelvorderkante
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 5), this._hornMat);
    claw.position.set(side * 24, 1.5, -13);
    claw.rotation.set(-0.6, 0, side * 0.8);
    g.add(claw);

    this.group.add(g);
    return g;
  }

  /** Körperfarbe setzen (Membran/Kamm dunkler, Bauch warm getönt). */
  setColor(hex) {
    const base = new THREE.Color(hex);
    this._scaleMat.color.copy(base);
    this._membraneMat.color.copy(base).multiplyScalar(0.5);
    this._ridgeMat.color.copy(base).multiplyScalar(0.38);
    this._bellyMat.color.copy(base).lerp(new THREE.Color(0xffe0a0), 0.62);
  }

  /** Animation: Flügelschlag (abhängig vom Schub) und Schwanzwedeln. */
  update(t, throttle) {
    const flapSpeed = 4 + throttle * 7;
    const amp = 0.28 + throttle * 0.45;
    const flap = Math.sin(t * flapSpeed) * amp;
    this._wingL.rotation.z = -0.12 + flap;
    this._wingR.rotation.z = 0.12 - flap;

    const wag = Math.sin(t * 2.2) * 0.12;
    for (let i = 0; i < this._tailSegs.length; i++) {
      this._tailSegs[i].rotation.y = wag * (0.5 + i * 0.12);
    }
    this._head.rotation.x = Math.sin(t * flapSpeed) * 0.05;
  }
}

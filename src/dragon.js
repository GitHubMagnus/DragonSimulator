// Der spielbare Drache: Modell aus Primitiven, Farbwahl und Animation
// (Flügelschlag, Schwanzwedeln). Bewegung/Physik liegt in flight.js.
import * as THREE from "three";

export class Dragon {
  constructor(scene) {
    this.group = new THREE.Group();

    // Materialien (werden von setColor() eingefärbt)
    this._scaleMat = new THREE.MeshStandardMaterial({ color: 0x7d1f24, flatShading: true, roughness: 0.7 });
    this._bellyMat = new THREE.MeshStandardMaterial({ color: 0xc8973f, flatShading: true });
    this._membraneMat = new THREE.MeshStandardMaterial({ color: 0x4a1518, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc2, flatShading: true });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xffb000, emissiveIntensity: 1.4 });

    this._buildBody();
    this._buildHead(hornMat, eyeMat);
    this._buildTail();
    this._buildLegs();
    this._wingL = this._buildWing(1);
    this._wingR = this._buildWing(-1);

    this.group.scale.setScalar(1.15);
    scene.add(this.group);
  }

  get position() { return this.group.position; }
  get quaternion() { return this.group.quaternion; }

  _buildBody() {
    const torso = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10), this._scaleMat);
    torso.scale.set(1.1, 1.05, 2.7);
    this.group.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(5.4, 12, 8), this._bellyMat);
    belly.scale.set(1.0, 0.7, 2.5);
    belly.position.y = -1.6;
    this.group.add(belly);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 14, 8), this._scaleMat);
    neck.position.set(0, 3, -13);
    neck.rotation.x = Math.PI / 2.6;
    this.group.add(neck);
  }

  _buildHead(hornMat, eyeMat) {
    const head = new THREE.Group();
    head.position.set(0, 6.5, -21);

    head.add(new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 7), this._scaleMat));
    const snout = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3, 6), this._scaleMat);
    snout.position.set(0, -0.6, -5.5);
    head.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 5.5), this._scaleMat);
    jaw.position.set(0, -2, -5);
    head.add(jaw);

    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(1, 7, 6), hornMat);
      horn.position.set(s * 1.6, 3, 2.2);
      horn.rotation.set(-0.6, 0, s * 0.25);
      head.add(horn);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), eyeMat);
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
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      seg.position.z = i === 0 ? 14 : 6;
      const r = 4.4 - i * 0.65;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, 7, 7), this._scaleMat);
      m.rotation.x = Math.PI / 2;
      m.position.z = 3.5;
      seg.add(m);
      parent.add(seg);
      parent = seg;
      this._tailSegs.push(seg);
    }
    const spade = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 4), this._scaleMat);
    spade.rotation.x = -Math.PI / 2;
    spade.position.z = 7;
    parent.add(spade);
  }

  _buildLegs() {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 7, 6), this._scaleMat);
      leg.position.set(s * 4, -4.5, 4);
      leg.rotation.x = 0.5;
      this.group.add(leg);
    }
  }

  _buildWing(side) {
    const g = new THREE.Group();
    g.position.set(side * 3.5, 1.5, -1);

    // Membran: flaches Dreiecksgeflecht in der XZ-Ebene (Spannweite entlang x)
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

    // Flügelknochen (Vorderkante)
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 50, 5), this._scaleMat);
    bone.rotation.z = Math.PI / 2;
    bone.rotation.y = side * 0.28;
    bone.position.set(side * 23, 0, -6);
    g.add(bone);

    this.group.add(g);
    return g;
  }

  /** Körperfarbe setzen (Membran dunkler, Bauch warm getönt). */
  setColor(hex) {
    const base = new THREE.Color(hex);
    this._scaleMat.color.copy(base);
    this._membraneMat.color.copy(base).multiplyScalar(0.5);
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

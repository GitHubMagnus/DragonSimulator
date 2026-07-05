// Verkehr: Ochsenkarren pendeln auf den Straßen, zwei Handelsschiffe segeln
// einen Rundkurs vor der Ostküste, ein Fischerboot fährt vom Hafen aufs Meer
// und zurück. Alles einfache Pfad-Läufer mit Blickrichtung entlang des Wegs.
import * as THREE from "three";
import { heightAt } from "./noise.js";
import { ROADS, PORT, SHIP_ROUTE } from "./world.js";

const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.9 });
const oxMat = new THREE.MeshStandardMaterial({ color: 0x7a5c40, roughness: 0.9 });
const sailMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, side: THREE.DoubleSide, roughness: 0.85 });
const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.8 });

/** Bogenlängen-Läufer über eine Polylinie (Ping-Pong). */
class PathWalker {
  constructor(pts, speed, offset = 0) {
    this._pts = pts;
    this._len = [0];
    for (let i = 1; i < pts.length; i++) {
      this._len.push(this._len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    this.total = this._len[this._len.length - 1];
    this._speed = speed;
    this._d = offset * this.total;
    this._dir = 1;
  }

  /** Weiterlaufen; liefert { x, z, ang } (ang = Fahrtrichtung). */
  step(dt, out) {
    this._d += this._speed * this._dir * dt;
    if (this._d > this.total) { this._d = this.total; this._dir = -1; }
    if (this._d < 0) { this._d = 0; this._dir = 1; }
    let i = 1;
    while (i < this._len.length - 1 && this._len[i] < this._d) i++;
    const t = (this._d - this._len[i - 1]) / Math.max(this._len[i] - this._len[i - 1], 1e-6);
    const [ax, az] = this._pts[i - 1], [bx, bz] = this._pts[i];
    out.x = ax + (bx - ax) * t;
    out.z = az + (bz - az) * t;
    out.ang = Math.atan2((bz - az) * this._dir, (bx - ax) * this._dir);
    return out;
  }
}

/** Ochsenkarren: Wagen mit Plane, zwei drehende Räder, Ochse davor. */
function buildCart() {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 4), woodMat);
  bed.position.y = 2.6;
  g.add(bed);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5.4, 8, 1, false, 0, Math.PI), sailMat);
  canopy.rotation.z = Math.PI / 2;
  canopy.position.set(0.6, 3.6, 0);
  g.add(canopy);
  const wheels = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 8), darkWoodMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(0.6, 1.5, s * 2.3);
    g.add(w);
    wheels.push(w);
  }
  const ox = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 2), oxMat);
  ox.position.set(-6.5, 2.2, 0);
  g.add(ox);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.3), oxMat);
  head.position.set(-9, 2.6, 0);
  g.add(head);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 0.4), woodMat);
  yoke.position.set(-4, 2.6, 0);
  g.add(yoke);
  g.userData.wheels = wheels;
  return g;
}

/** Handelsschiff: Rumpf, zwei Masten mit geblähten Segeln, Wimpel. */
function buildShip() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 38), hullMat);
  hull.position.y = 1;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(5.4, 12, 4), hullMat);
  bow.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  bow.position.set(0, 1.4, -24);
  g.add(bow);
  const stern = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 6), hullMat);
  stern.position.set(0, 5, 15);
  g.add(stern);
  for (const [mz, sh] of [[-8, 26], [7, 30]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, sh, 6), woodMat);
    mast.position.set(0, sh / 2 + 3, mz);
    g.add(mast);
    const sail = new THREE.Mesh(new THREE.SphereGeometry(sh * 0.32, 8, 8, 0, Math.PI), sailMat);
    sail.scale.set(1.3, 1, 0.5);
    sail.rotation.y = Math.PI;
    sail.position.set(0, sh * 0.62, mz - 1);
    g.add(sail);
  }
  return g;
}

export class Traffic {
  constructor(scene) {
    this._movers = [];

    // Karren auf drei Straßen (Burgstraße Nr. 2 ist zu steil/kurz → auslassen)
    for (const [road, speed, off] of [[0, 9, 0.15], [0, 9, 0.65], [1, 8, 0.4], [3, 8.5, 0.3]]) {
      const cart = buildCart();
      scene.add(cart);
      this._movers.push({
        obj: cart, walker: new PathWalker(ROADS[road], speed, off),
        type: "cart", p: { x: 0, z: 0, ang: 0 },
      });
    }

    // Handelsschiffe auf Rundkurs
    for (const phase of [0, Math.PI]) {
      const ship = buildShip();
      scene.add(ship);
      this._movers.push({ obj: ship, type: "ship", phase, p: null });
    }

    // Fischerboot: Hafen ↔ offenes Meer
    const boat = new THREE.Group();
    const bh = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 13), hullMat);
    bh.position.y = 0.6;
    boat.add(bh);
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 6), woodMat);
    bm.position.y = 7;
    boat.add(bm);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), sailMat);
    bs.position.set(1.2, 8, 0);
    bs.rotation.y = Math.PI / 2 + 0.3;
    boat.add(bs);
    scene.add(boat);
    this._movers.push({
      obj: boat, type: "boat", p: { x: 0, z: 0, ang: 0 },
      walker: new PathWalker([[PORT.x + 30, PORT.z + 260], [PORT.x + 260, PORT.z + 900], [PORT.x + 700, PORT.z + 1600]], 14, 0.2),
    });
  }

  update(dt, t) {
    for (const m of this._movers) {
      if (m.type === "ship") {
        const a = t * (18 / SHIP_ROUTE.r) + m.phase; // ~18 Einheiten/s Fahrt
        m.obj.position.set(
          SHIP_ROUTE.x + Math.cos(a) * SHIP_ROUTE.r,
          Math.sin(t * 0.8 + m.phase) * 0.9 - 0.5,
          SHIP_ROUTE.z + Math.sin(a) * SHIP_ROUTE.r
        );
        m.obj.rotation.y = -a - Math.PI / 2 + Math.PI; // Bug (−z) in Fahrtrichtung
        m.obj.rotation.z = Math.sin(t * 0.7 + m.phase) * 0.045; // Rollen im Seegang
        continue;
      }
      m.walker.step(dt, m.p);
      if (m.type === "cart") {
        m.obj.position.set(m.p.x, heightAt(m.p.x, m.p.z), m.p.z);
        m.obj.rotation.y = -m.p.ang + Math.PI; // Ochse (−x lokal) voraus
        for (const w of m.obj.userData.wheels) w.rotation.y += dt * 2.2;
      } else {
        m.obj.position.set(m.p.x, Math.sin(t * 1.1) * 0.5 - 0.3, m.p.z);
        m.obj.rotation.y = -m.p.ang + Math.PI / 2; // Bug (−z lokal) voraus
      }
    }
  }
}

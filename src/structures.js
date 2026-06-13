// Mittelalterliche Bauwerke: Dörfer (Fachwerkhäuser) und epische Burgen.
// Pro Bauwerk werden alle Teile per Geometrie-Merging zu wenigen Meshes
// zusammengefasst, damit die Anzahl der Draw-Calls niedrig bleibt.
// Bauwerke werden deterministisch pro Rasterzelle erzeugt und inkrementell
// um den Spieler herum ein- und ausgeblendet.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD, STRUCT_CELL } from "./config.js";
import { hash, heightAt } from "./noise.js";

// ---- Materialien ----
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, flatShading: true, roughness: 1 });
const spireMat = new THREE.MeshStandardMaterial({ color: 0x39496b, flatShading: true });
const flagMat = new THREE.MeshStandardMaterial({ color: 0xb0282a, side: THREE.DoubleSide, flatShading: true });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, flatShading: true });
const plasterMat = new THREE.MeshStandardMaterial({ color: 0xd8c39a, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a3a2c, flatShading: true });

// ---- Geometrie-Vorlagen (werden geklont und transformiert) ----
const houseWallGeo = new THREE.BoxGeometry(16, 12, 14);
const houseRoofGeo = new THREE.ConeGeometry(13.5, 11, 4);
const houseDoorGeo = new THREE.BoxGeometry(3.6, 6, 0.9);
const chimneyGeo = new THREE.BoxGeometry(2.6, 8, 2.6);

const keepGeo = new THREE.CylinderGeometry(24, 27, 96, 16);
const watchGeo = new THREE.CylinderGeometry(12, 13, 64, 12);
const towerGeo = new THREE.CylinderGeometry(13, 15, 112, 14);
const gateTowerGeo = new THREE.CylinderGeometry(10, 11, 70, 12);
const spireGeo = new THREE.ConeGeometry(17, 48, 14);
const watchSpireGeo = new THREE.ConeGeometry(15, 42, 12);
const wallGeo = new THREE.BoxGeometry(150, 42, 11);
const merlonGeo = new THREE.BoxGeometry(5, 9, 5);
const gateGeo = new THREE.BoxGeometry(22, 30, 13);
const poleGeo = new THREE.CylinderGeometry(0.7, 0.7, 18, 6);
const flagGeo = new THREE.PlaneGeometry(13, 8);

// ---- Geometrie-Helfer ----
const _o = new THREE.Object3D();

/** Geklonte, transformierte Vorlage in eine Sammelliste schieben. */
function part(list, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _o.position.set(x, y, z);
  _o.rotation.set(rx, ry, rz);
  _o.scale.set(sx, sy, sz);
  _o.updateMatrix();
  const g = geo.clone();
  g.applyMatrix4(_o.matrix);
  list.push(g);
}

/** Eine Liste gesammelter Geometrien zu einem einzigen Mesh zusammenführen. */
function meshFrom(list, mat) {
  return list.length ? new THREE.Mesh(mergeGeometries(list), mat) : null;
}

/** Offset (ox, oz) um den Winkel rot (Y-Achse) drehen. */
function rotOff(rot, ox, oz) {
  return [ox * Math.cos(rot) + oz * Math.sin(rot), -ox * Math.sin(rot) + oz * Math.cos(rot)];
}

/** Prüft, ob der Untergrund flach genug ist; liefert auch die Höhe. */
function flatEnough(x, z, rad, maxDelta) {
  const h0 = heightAt(x, z);
  let mn = h0, mx = h0;
  for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
    const h = heightAt(x + dx, z + dz);
    if (h < mn) mn = h;
    if (h > mx) mx = h;
  }
  return { ok: mx - mn < maxDelta, h: h0 };
}

// ---- Bauwerk-Bauer ----

/** Dorf aus mehreren Häusern (zu wenigen Meshes zusammengeführt). */
function buildVillage(houses) {
  const plaster = [], roof = [], wood = [], stone = [];
  for (const h of houses) {
    part(plaster, houseWallGeo, h.x, h.y + 6, h.z, 0, h.rot, 0);
    part(roof, houseRoofGeo, h.x, h.y + 17.5, h.z, 0, h.rot + Math.PI / 4, 0);
    const [dx, dz] = rotOff(h.rot, 0, 7.4);
    part(wood, houseDoorGeo, h.x + dx, h.y + 3, h.z + dz, 0, h.rot, 0);
    const [cx, cz] = rotOff(h.rot, 5, 0);
    part(stone, chimneyGeo, h.x + cx, h.y + 18, h.z + cz, 0, h.rot, 0);
  }
  const g = new THREE.Group();
  for (const m of [meshFrom(plaster, plasterMat), meshFrom(roof, roofMat),
                   meshFrom(wood, woodMat), meshFrom(stone, stoneMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/** Epische Burg: Bergfried, Wachturm, vier Ecktürme, Ringmauer, Torhaus, Fahnen. */
function buildCastle() {
  const stone = [], spire = [], wood = [], flag = [];
  const off = 70;

  const ring = (list, cx, cz, radius, y, count) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      part(list, merlonGeo, cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius, 0, a, 0);
    }
  };
  const wallMerlons = (cx, cz, axis, length, y, count) => {
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1) - 0.5) * length;
      part(stone, merlonGeo, axis === "x" ? cx + t : cx, y, axis === "z" ? cz + t : cz);
    }
  };
  const flagAt = (x, baseY, z) => {
    part(wood, poleGeo, x, baseY + 9, z);
    part(flag, flagGeo, x + 6.5, baseY + 14, z);
  };

  // Bergfried mit zentralem Wachturm
  part(stone, keepGeo, 0, 48, 0);
  ring(stone, 0, 0, 25, 96, 18);
  part(stone, watchGeo, 0, 128, 0);
  ring(stone, 0, 0, 13, 160, 12);
  part(spire, watchSpireGeo, 0, 181, 0);
  flagAt(0, 202, 0);

  // Vier mächtige Ecktürme
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * off, z = sz * off;
    part(stone, towerGeo, x, 56, z);
    part(spire, spireGeo, x, 136, z);
    ring(stone, x, z, 14, 112, 12);
    flagAt(x, 112, z);
  }

  // Ringmauern mit Zinnen
  part(stone, wallGeo, 0, 21, off);
  part(stone, wallGeo, 0, 21, -off);
  part(stone, wallGeo, off, 21, 0, 0, Math.PI / 2, 0);
  part(stone, wallGeo, -off, 21, 0, 0, Math.PI / 2, 0);
  wallMerlons(0, off, "x", 132, 43, 16);
  wallMerlons(0, -off, "x", 132, 43, 16);
  wallMerlons(off, 0, "z", 132, 43, 16);
  wallMerlons(-off, 0, "z", 132, 43, 16);

  // Torhaus
  part(stone, gateTowerGeo, 22, 35, off);
  part(stone, gateTowerGeo, -22, 35, off);
  part(spire, spireGeo, 22, 78, off, 0, 0, 0, 0.7);
  part(spire, spireGeo, -22, 78, off, 0, 0, 0, 0.7);
  flagAt(22, 70, off);
  flagAt(-22, 70, off);
  part(wood, gateGeo, 0, 15, off + 2);

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(spire, spireMat),
                   meshFrom(wood, woodMat), meshFrom(flag, flagMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/** Deterministischer Inhalt einer Rasterzelle: Burg, Dorf oder nichts. */
function buildCell(cx, cz) {
  const r = hash(cx * 7 + 3, cz * 13 + 5);
  const jx = (hash(cx, cz) - 0.5) * STRUCT_CELL * 0.45;
  const jz = (hash(cz, cx) - 0.5) * STRUCT_CELL * 0.45;
  const wx = cx * STRUCT_CELL + STRUCT_CELL / 2 + jx;
  const wz = cz * STRUCT_CELL + STRUCT_CELL / 2 + jz;

  if (r < 0.08) {
    const f = flatEnough(wx, wz, 58, 95);
    if (!f.ok || f.h < 12 || f.h > 420) return null;
    const c = buildCastle();
    c.position.set(wx, f.h - 5, wz);
    c.rotation.y = r * 60;
    return c;
  }

  if (r < 0.33) {
    const count = 5 + Math.floor(hash(cx + 1, cz + 2) * 8);
    const houses = [];
    for (let i = 0; i < count; i++) {
      const a = hash(cx + i * 3, cz + i * 7) * 6.28;
      const rad = 18 + hash(cx + i, cz + i) * 110;
      const hx = wx + Math.cos(a) * rad, hz = wz + Math.sin(a) * rad;
      const f = flatEnough(hx, hz, 12, 28);
      if (!f.ok || f.h < 2 || f.h > 270) continue;
      houses.push({ x: hx, y: f.h, z: hz, rot: a });
    }
    return houses.length ? buildVillage(houses) : null;
  }

  return null;
}

/**
 * Verwaltet die sichtbaren Bauwerke: erzeugt neu eintretende Zellen und
 * entfernt verlassene — inkrementell, sodass pro Nachziehen nur Randzellen
 * neu gebaut werden.
 */
export class Structures {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this._cells = new Map();
  }

  /** Alle aktiven Bauwerke entfernen (z. B. beim Neustart). */
  clear() {
    this._cells.forEach((g) => g && this.root.remove(g));
    this._cells.clear();
  }

  /** Sichtbare Zellen rund um den Weltmittelpunkt aktualisieren. */
  update(centerX, centerZ) {
    const half = WORLD / 2;
    const minX = Math.floor((centerX - half) / STRUCT_CELL);
    const maxX = Math.floor((centerX + half) / STRUCT_CELL);
    const minZ = Math.floor((centerZ - half) / STRUCT_CELL);
    const maxZ = Math.floor((centerZ + half) / STRUCT_CELL);

    const needed = new Set();
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = cx + "," + cz;
        needed.add(key);
        if (!this._cells.has(key)) {
          const g = buildCell(cx, cz);
          if (g) this.root.add(g);
          this._cells.set(key, g || null);
        }
      }
    }
    for (const [key, g] of this._cells) {
      if (!needed.has(key)) {
        if (g) this.root.remove(g);
        this._cells.delete(key);
      }
    }
  }
}

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
const mossMat = new THREE.MeshStandardMaterial({ color: 0x6f7560, flatShading: true, roughness: 1 });
const clothMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, flatShading: true, side: THREE.DoubleSide });
// Dorf-Materialien nutzen Vertex-Farben → jedes Haus kann eigene Töne haben.
const villagePlasterMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const villageRoofMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
const PCOLORS = [0xd8c39a, 0xcaa878, 0xe2d4b2, 0xc8baa6, 0xdcb892].map((h) => new THREE.Color(h));
const RCOLORS = [0x7a3a2c, 0x8a5630, 0x6c6c66, 0x9a7a3a, 0x5e4636].map((h) => new THREE.Color(h));

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

// Windmühle
const millBodyGeo = new THREE.CylinderGeometry(9, 13, 42, 10);
const millCapGeo = new THREE.ConeGeometry(11, 13, 10);
const sailArmGeo = new THREE.BoxGeometry(2.2, 36, 1.6);
const sailBladeGeo = new THREE.BoxGeometry(7, 14, 0.5);
// Kapelle
const naveGeo = new THREE.BoxGeometry(20, 16, 34);
const ridgeGeo = new THREE.BoxGeometry(15.5, 15.5, 37); // 45° gedreht = Satteldach
const steepleGeo = new THREE.BoxGeometry(10, 30, 10);
const steepleSpireGeo = new THREE.ConeGeometry(8, 18, 4);
const crossVGeo = new THREE.BoxGeometry(1, 6, 1);
const crossHGeo = new THREE.BoxGeometry(4.5, 1, 1);
const chapelDoorGeo = new THREE.BoxGeometry(4, 7, 1);
// Ruine
const ruinTowerGeo = new THREE.CylinderGeometry(11, 13, 26, 10);
const rubbleGeo = new THREE.BoxGeometry(5, 4, 6);
// Steinkreis
const megalithGeo = new THREE.BoxGeometry(4.5, 15, 3);
const lintelGeo = new THREE.BoxGeometry(12, 3, 3.5);
// Monumentale Zitadelle (ragt ~770 Einheiten in den Himmel)
const citPlatformGeo = new THREE.CylinderGeometry(300, 345, 44, 28);
const citBaseGeo = new THREE.CylinderGeometry(70, 82, 200, 20);
const citMidGeo = new THREE.CylinderGeometry(52, 64, 180, 18);
const citTopGeo = new THREE.CylinderGeometry(38, 48, 150, 16);
const citSpireGeo = new THREE.ConeGeometry(58, 200, 18);
const citTowerGeo = new THREE.CylinderGeometry(26, 34, 360, 16);
const citTowerSpireGeo = new THREE.ConeGeometry(36, 120, 16);
const citWallGeo = new THREE.BoxGeometry(220, 120, 28);
const bigPoleGeo = new THREE.CylinderGeometry(1.8, 1.8, 50, 6);
const bigFlagGeo = new THREE.PlaneGeometry(34, 20);

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

/** Eine Geometrie einfärben (Vertex-Farbe) — für gemischte Dorf-Töne. */
function tintGeo(geo, c) {
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
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

/** Dorf aus mehreren Häusern; jedes Haus mit zufälligen Wand-/Dachtönen. */
function buildVillage(houses) {
  const plaster = [], roof = [], wood = [], stone = [];
  for (const h of houses) {
    const seed = Math.abs(Math.round(h.x * 0.7) + Math.round(h.z * 1.3) * 31);
    const pc = PCOLORS[seed % PCOLORS.length];
    const rc = RCOLORS[(seed * 7 + 2) % RCOLORS.length];
    const scale = 0.82 + ((seed % 5) * 0.09); // leicht unterschiedliche Größen

    _o.position.set(h.x, h.y + 6 * scale, h.z); _o.rotation.set(0, h.rot, 0); _o.scale.set(scale, scale, scale); _o.updateMatrix();
    let g = houseWallGeo.clone(); g.applyMatrix4(_o.matrix); tintGeo(g, pc); plaster.push(g);
    _o.position.set(h.x, h.y + 17.5 * scale, h.z); _o.rotation.set(0, h.rot + Math.PI / 4, 0); _o.updateMatrix();
    g = houseRoofGeo.clone(); g.applyMatrix4(_o.matrix); tintGeo(g, rc); roof.push(g);

    const [dx, dz] = rotOff(h.rot, 0, 7.4 * scale);
    part(wood, houseDoorGeo, h.x + dx, h.y + 3 * scale, h.z + dz, 0, h.rot, 0, scale);
    const [cx, cz] = rotOff(h.rot, 5 * scale, 0);
    part(stone, chimneyGeo, h.x + cx, h.y + 18 * scale, h.z + cz, 0, h.rot, 0, scale);
  }
  const g = new THREE.Group();
  for (const m of [meshFrom(plaster, villagePlasterMat), meshFrom(roof, villageRoofMat),
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

/** Windmühle: Turm, Kegeldach, gekreuzte Flügel mit Segeltüchern. */
function buildWindmill() {
  const body = [], roof = [], wood = [], cloth = [];
  part(body, millBodyGeo, 0, 21, 0);
  part(roof, millCapGeo, 0, 48, 0);
  part(wood, chapelDoorGeo, 0, 4, 12.5);
  // Flügelkreuz (X) vorn
  part(wood, sailArmGeo, 0, 33, 14, 0, 0, Math.PI / 4);
  part(wood, sailArmGeo, 0, 33, 14, 0, 0, -Math.PI / 4);
  for (const [bx, by] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    part(cloth, sailBladeGeo, bx * 11, 33 + by * 11, 14.4, 0, 0, Math.atan2(by, bx));
  }
  const g = new THREE.Group();
  for (const m of [meshFrom(body, plasterMat), meshFrom(roof, roofMat),
                   meshFrom(wood, woodMat), meshFrom(cloth, clothMat)]) if (m) g.add(m);
  return g;
}

/** Kapelle: Schiff mit Satteldach, Glockenturm mit Turmspitze und Kreuz. */
function buildChapel() {
  const stone = [], roof = [], wood = [], spire = [];
  part(stone, naveGeo, 0, 8, 0);
  part(roof, ridgeGeo, 0, 18, 0, 0, 0, Math.PI / 4);
  part(stone, steepleGeo, 0, 15, -20);
  part(spire, steepleSpireGeo, 0, 39, -20, 0, Math.PI / 4, 0);
  part(stone, crossVGeo, 0, 51, -20);
  part(stone, crossHGeo, 0, 51.5, -20);
  part(wood, chapelDoorGeo, 0, 4, 17.5);
  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(roof, roofMat),
                   meshFrom(wood, woodMat), meshFrom(spire, spireMat)]) if (m) g.add(m);
  return g;
}

/** Verfallener Turm: gezackter Rand und herumliegender Schutt. */
function buildRuin() {
  const stone = [];
  part(stone, ruinTowerGeo, 0, 13, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const hh = 2 + (i % 3) * 4;
    part(stone, merlonGeo, Math.cos(a) * 11.5, 26 + hh * 0.5, Math.sin(a) * 11.5, 0, a, 0, 1, hh / 9, 1);
  }
  for (let i = 0; i < 6; i++) {
    const a = hash(i + 1, i + 2) * 6.28;
    const rad = 16 + hash(i, i + 3) * 14;
    part(stone, rubbleGeo, Math.cos(a) * rad, 2, Math.sin(a) * rad, hash(i, i) * 0.5, a, 0);
  }
  const g = new THREE.Group();
  const m = meshFrom(stone, mossMat);
  if (m) g.add(m);
  return g;
}

/** Steinkreis: Ring aus Megalithen mit ein paar Decksteinen. */
function buildHenge() {
  const stone = [];
  const n = 9, R = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    part(stone, megalithGeo, Math.cos(a) * R, 7.5, Math.sin(a) * R, 0, a, (hash(i, i + 5) - 0.5) * 0.18);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / n) * Math.PI * 2;
    part(stone, lintelGeo, Math.cos(a) * R, 16, Math.sin(a) * R, 0, a, 0);
  }
  const g = new THREE.Group();
  const m = meshFrom(stone, mossMat);
  if (m) g.add(m);
  return g;
}

/** Zinnenkranz aus skalierten Merlonen. */
function merlonRing(list, cx, cz, radius, y, count, s) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    part(list, merlonGeo, cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius, 0, a, 0, s);
  }
}

/** Monumentale Zitadelle: gewaltiger Stufenturm mit Spitze, sechs Riesentürme,
 *  massive Ringmauern und große Banner — eine Landmarke zum Umfliegen. */
function buildCitadel() {
  const stone = [], spire = [], wood = [], flag = [];
  const flagAt = (x, baseY, z) => {
    part(wood, bigPoleGeo, x, baseY + 25, z);
    part(flag, bigFlagGeo, x + 17, baseY + 40, z);
  };

  // Plattform + verjüngter Zentralturm
  part(stone, citPlatformGeo, 0, 22, 0);
  part(stone, citBaseGeo, 0, 144, 0);
  merlonRing(stone, 0, 0, 74, 244, 20, 4);
  part(stone, citMidGeo, 0, 334, 0);
  merlonRing(stone, 0, 0, 56, 424, 16, 3.4);
  part(stone, citTopGeo, 0, 499, 0);
  merlonRing(stone, 0, 0, 42, 574, 14, 3);
  part(spire, citSpireGeo, 0, 674, 0);
  flagAt(0, 560, 0);

  // Sechs Riesentürme im Ring + Verbindungsmauern
  const R = 232, n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    part(stone, citTowerGeo, x, 224, z);
    merlonRing(stone, x, z, 30, 404, 12, 3);
    part(spire, citTowerSpireGeo, x, 464, z);
    flagAt(x, 470, z);

    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    const wr = R * Math.cos(Math.PI / n);
    part(stone, citWallGeo, Math.cos(a2) * wr, 80, Math.sin(a2) * wr, 0, a2 + Math.PI / 2, 0);
  }

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(spire, spireMat),
                   meshFrom(wood, woodMat), meshFrom(flag, flagMat)]) if (m) g.add(m);
  return g;
}

/** Deterministischer Inhalt einer Rasterzelle: Zitadelle, Burg, Dorf, Kleinbau oder nichts. */
function buildCell(cx, cz) {
  const r = hash(cx * 7 + 3, cz * 13 + 5);
  const jx = (hash(cx, cz) - 0.5) * STRUCT_CELL * 0.45;
  const jz = (hash(cz, cx) - 0.5) * STRUCT_CELL * 0.45;
  const wx = cx * STRUCT_CELL + STRUCT_CELL / 2 + jx;
  const wz = cz * STRUCT_CELL + STRUCT_CELL / 2 + jz;

  // Kleinbau mit Flachheits-/Höhenprüfung platzieren.
  const small = (builder, rad, maxDelta, minH, maxH) => {
    const f = flatEnough(wx, wz, rad, maxDelta);
    if (!f.ok || f.h < minH || f.h > maxH) return null;
    const g = builder();
    g.position.set(wx, f.h - 2, wz);
    g.rotation.y = hash(cx + 2, cz + 9) * 6.28;
    return g;
  };

  if (r < 0.03) {
    const f = flatEnough(wx, wz, 120, 150);
    if (!f.ok || f.h < 8 || f.h > 280) return null;
    const c = buildCitadel();
    c.position.set(wx, f.h - 8, wz);
    c.rotation.y = hash(cx + 4, cz + 1) * 6.28;
    return c;
  }
  if (r < 0.09) {
    const f = flatEnough(wx, wz, 58, 95);
    if (!f.ok || f.h < 12 || f.h > 420) return null;
    const c = buildCastle();
    c.position.set(wx, f.h - 5, wz);
    c.rotation.y = r * 60;
    return c;
  }
  if (r < 0.130) return small(buildChapel, 26, 60, 8, 360);
  if (r < 0.190) return small(buildWindmill, 18, 50, 6, 300);
  if (r < 0.240) return small(buildRuin, 24, 95, 10, 430);
  if (r < 0.290) return small(buildHenge, 30, 70, 8, 360);

  if (r < 0.52) {
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

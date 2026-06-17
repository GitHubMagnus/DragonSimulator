// Endloses Low-Poly-Terrain. Das Mesh wird um den Spieler herum versetzt und
// seine Höhen/Farben werden neu berechnet (siehe rebuild()). Die Einfärbung ist
// biom- und hangabhängig: Sandstrände, Wiesen mit Flecken, felsige Steilhänge
// und Klippen sowie Schnee nur auf flacheren Höhenlagen.
import * as THREE from "three";
import { WORLD, SEG, STEP } from "./config.js";
import { heightAt, valueNoise, climateAt, moistureAt } from "./noise.js";

const C_SAND = new THREE.Color(0xcfbd8e);
const C_DUST = new THREE.Color(0xc9b076);   // arider Boden
const C_ROCK = new THREE.Color(0x756d61);
const C_ROCK_HI = new THREE.Color(0x9a8f80);
const C_SNOW = new THREE.Color(0xfbfdff);

// Wiesentöne je nach Klima (kalt → gemäßigt → trocken) und Feuchte.
const G_ARID = new THREE.Color(0xb1a456);   // trockene Steppe (gelblich)
const G_DRY = new THREE.Color(0x8f9a4c);    // halbtrockene Wiese
const G_TEMP = new THREE.Color(0x5f9248);   // saftiges Grün
const G_TEMP2 = new THREE.Color(0x3c6b30);  // dunkles Grün
const G_TAIGA = new THREE.Color(0x32563f);  // kühles Nadelwaldgrün
const G_TUNDRA = new THREE.Color(0x6f7a66); // graugrüne Tundra

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Boden-Grundfarbe der Region (Wiese) nach Klima/Feuchte. */
function biomeGrass(out, climate, moisture, nFine) {
  // kalt (0) → gemäßigt (0.5) → trocken/heiß (1)
  out.copy(G_TUNDRA).lerp(G_TAIGA, sstep(climate, 0.05, 0.2));
  out.lerp(G_TEMP, sstep(climate, 0.2, 0.42));
  out.lerp(G_DRY, sstep(climate, 0.62, 0.8));
  out.lerp(G_ARID, sstep(climate, 0.82, 0.98));
  // Feuchte/feine Tönung: nass → dunkler/satter, trocken → fahler
  out.lerp(G_TEMP2, sstep(moisture, 0.55, 0.95) * 0.5 * nFine);
  out.lerp(C_DUST, sstep(moisture, 0.0, 0.35) * 0.4);
}

/** Biom-/Hangfarbe für einen Geländepunkt in `out` schreiben. */
function colorAt(out, h, slope, x, z) {
  if (h < 3.2) { out.copy(C_SAND); return; }

  const climate = climateAt(x, z);
  const moisture = moistureAt(x, z);
  const nFine = valueNoise(x * 0.03, z * 0.03);
  const rock = clamp01((slope - 0.5) / 0.7); // 0 flach … 1 steil

  biomeGrass(out, climate, moisture, nFine);
  // mit der Höhe zur Hochlandfärbung
  out.lerp(C_ROCK, sstep(h, 210, 360));
  // Schneegrenze sinkt in kalten Regionen
  const snowBase = 300 + climate * 220; // kalt ~300, heiß ~520
  out.lerp(C_SNOW, sstep(h, snowBase, snowBase + 110) * (1 - rock));
  // Steilhänge/Klippen werden felsig (oben heller)
  out.lerp(h > 360 ? C_ROCK_HI : C_ROCK, rock * 0.85);
}

export class Terrain {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    this._pos = geo.attributes.position;
    this._count = this._pos.count;
    this._segp = SEG + 1;
    // Lokale x/z merken — sie ändern sich beim Nachziehen nicht.
    this._localX = new Float32Array(this._count);
    this._localZ = new Float32Array(this._count);
    for (let i = 0; i < this._count; i++) {
      this._localX[i] = this._pos.getX(i);
      this._localZ[i] = this._pos.getZ(i);
    }
    this._h = new Float32Array(this._count);
    this._color = new THREE.BufferAttribute(new Float32Array(this._count * 3), 3);
    geo.setAttribute("color", this._color);

    this._geo = geo;
    this._tmp = new THREE.Color();
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })
    );
    scene.add(this.mesh);
  }

  /** Höhen und Farben für einen neuen Weltmittelpunkt neu berechnen. */
  rebuild(centerX, centerZ) {
    const H = this._h;
    const segp = this._segp;

    // Pass 1: Höhen
    for (let i = 0; i < this._count; i++) {
      const h = heightAt(this._localX[i] + centerX, this._localZ[i] + centerZ);
      H[i] = h;
      this._pos.setY(i, h);
    }

    // Pass 2: hangabhängige Biom-Farben (Hang aus den Nachbarhöhen im Gitter)
    const c = this._tmp;
    for (let row = 0; row <= SEG; row++) {
      for (let col = 0; col <= SEG; col++) {
        const i = row * segp + col;
        const hl = H[row * segp + Math.max(col - 1, 0)];
        const hr = H[row * segp + Math.min(col + 1, SEG)];
        const hu = H[Math.max(row - 1, 0) * segp + col];
        const hd = H[Math.min(row + 1, SEG) * segp + col];
        const slope = Math.hypot(hr - hl, hd - hu) / (2 * STEP);
        colorAt(c, H[i], slope, this._localX[i] + centerX, this._localZ[i] + centerZ);
        this._color.setXYZ(i, c.r, c.g, c.b);
      }
    }

    this._pos.needsUpdate = true;
    this._color.needsUpdate = true;
    this._geo.computeVertexNormals();
    this.mesh.position.set(centerX, 0, centerZ);
  }
}

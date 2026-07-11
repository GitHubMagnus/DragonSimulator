// Endloses Low-Poly-Terrain. Das Mesh wird um den Spieler herum versetzt und
// seine Höhen/Farben werden neu berechnet (siehe rebuild()). Die Einfärbung ist
// biom- und hangabhängig: Sandstrände, Wiesen mit Flecken, felsige Steilhänge
// und Klippen sowie Schnee nur auf flacheren Höhenlagen.
import * as THREE from "three";
import {
  positionWorld, vertexColor, triNoise3D, float, mix as tslMix, color as tslColor,
  smoothstep as tslSmoothstep, normalWorld,
} from "three/tsl";
import { WORLD, SEG, STEP } from "./config.js";
import { heightAt, valueNoise, climateAt, moistureAt, hash } from "./noise.js";
import { roadDist, inField, distTo, VOLCANO, CITY, CASTLE, PORT } from "./world.js";

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

// Handgestaltete Welt: Straßen, Felder, Vulkanasche, Stadt-/Burgpflaster
const C_ROAD = new THREE.Color(0x9a7f58);
const C_COBBLE = new THREE.Color(0x8d8478);
const C_ASH = new THREE.Color(0x5a534b);
const C_BASALT = new THREE.Color(0x39332e);
const C_EMBERGLOW = new THREE.Color(0x7a2a12);
const C_HEDGE = new THREE.Color(0x41582f);
const CROPS = [0xc7a44e, 0x7fa04a, 0x8f6b40, 0x6f9c4f, 0xb98e3e].map((h) => new THREE.Color(h));
const _c2 = new THREE.Color();

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

  // ---- handgestaltete Überlagerungen ----

  // Felder: Parzellen-Raster mit wechselnden Feldfrüchten, Furchen und Hecken
  const fld = h > 5 && h < 150 && slope < 0.35 ? inField(x, z) : null;
  if (fld) {
    const px = Math.floor(fld.lx / 120), pz = Math.floor(fld.lz / 80);
    _c2.copy(CROPS[Math.floor(hash(px + 31, pz - 17) * CROPS.length)]);
    // Pflugfurchen + leichte Helligkeitsstreuung pro Parzelle
    const furrow = 1 + Math.sin(fld.lz * 0.9 + px * 2.6) * 0.05;
    _c2.multiplyScalar(furrow * (0.9 + 0.2 * hash(px * 5 + 1, pz * 7 + 2)));
    // Heckenstreifen zwischen den Parzellen
    const fx = fld.lx / 120 - px, fz = fld.lz / 80 - pz;
    if (fx < 0.05 || fz < 0.075) _c2.copy(C_HEDGE);
    out.lerp(_c2, fld.edge);
  }

  // Straßen: erdiger Weg mit weich auslaufenden Rändern
  const rd = roadDist(x, z);
  if (rd < 30) {
    _c2.copy(C_ROAD).multiplyScalar(0.92 + nFine * 0.16);
    out.lerp(_c2, (1 - sstep(rd, 10, 30)) * 0.92);
  }

  // Stadtboden und Burghof: Pflaster
  if (distTo(x, z, CITY) < CITY.r + 40) out.lerp(C_COBBLE, 0.85);
  if (distTo(x, z, CASTLE) < CASTLE.plateauR + 60) out.lerp(C_COBBLE, 0.8);
  if (distTo(x, z, PORT) < 170) out.lerp(C_ROAD, 0.6);

  // Vulkan: Asche und Basalt (überdeckt auch Schnee), Glutschimmer am Krater
  const dv = distTo(x, z, VOLCANO);
  if (dv < VOLCANO.ashR) {
    _c2.copy(C_ASH).lerp(C_BASALT, sstep(h, 120, 420) * 0.85 + nFine * 0.15);
    out.lerp(_c2, sstep(1 - dv / VOLCANO.ashR, 0.05, 0.7));
    out.lerp(C_EMBERGLOW, sstep(h, 470, 590) * 0.4);
  }
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

    // Weiches Shading statt Facetten; die Biom-Vertexfarben werden per
    // Fragment-Noise (zwei Oktaven, Weltkoordinaten) aufgebrochen, damit die
    // Fläche zwischen den Gitterpunkten nicht mehr flach wirkt.
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
    const detailA = triNoise3D(positionWorld.mul(0.012), 0, 0);
    const detailB = triNoise3D(positionWorld.mul(0.07), 0, 0);
    const shade = detailA.mul(0.30).add(detailB.mul(0.18)).add(float(0.78));
    // Felswände per Pixel: steile Flächen (Normale) kippen in geschichteten
    // Fels — unabhängig von der Gitterauflösung, mit Noise-Bänderung.
    const steep = float(1.0).sub(tslSmoothstep(0.52, 0.74, normalWorld.y));
    const bands = triNoise3D(positionWorld.mul(0.028).mul(float(1.0).add(positionWorld.y.mul(0.0004))), 0, 0);
    const rock = tslMix(tslColor(0x5f584e), tslColor(0x8d8478), bands);
    mat.colorNode = tslMix(vertexColor().mul(shade), rock.mul(shade), steep.mul(0.88));

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true; // Berge werfen Schatten auf Täler
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

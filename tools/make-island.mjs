// Erzeugt die feste Insel-Heightmap des Spiels: assets/island.png
// Aufruf:  node tools/make-island.mjs
//
// Die Landschaft wird aus dem handgestalteten Layout in src/world.js geformt:
// Vulkan mit Krater (NO), Burgberg-Plateau, eingeebnete Stadt- und Hafen-
// flächen, See mit Fluss zum Meer, ruhige Ebenen für Felder und Straßen,
// Gebirgszüge im Westen/Süden. Karte: 1024×1024 px für 24000×24000 Einheiten.
//
// Kodierung — muss zu src/map.js passen:
//   Höhe = SEA_FLOOR + H_RANGE * (pixel/255)^GAMMA
//   Schwarz (0) = Meeresboden (−48) · ~33 = Meereshöhe · Weiß (255) = +712
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  VOLCANO, CASTLE, CITY, PORT, LAKE, WEST_PEAK, PROTECT, CALM_ZONES,
  LIGHTHOUSE, WATERFALL, CAVE, COLOSSI, CANYON2, SPIKES,
  riverDist, canyonDist, distTo, polyDist,
} from "../src/world.js";

const N = 1024;
const MAP_SIZE = 24000;
const SEA_FLOOR = -48;
const H_RANGE = 920; // muss zu src/map.js passen!
const GAMMA = 1.35;

// ---- deterministisches Noise (identisch zur Logik in src/noise.js) ----
function hash(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const ux = smooth(fx), uz = smooth(fz);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}
function fbm(x, z, octaves, freq) {
  let amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    norm += amp; amp *= 0.5; freq *= 2.05;
  }
  return sum / norm;
}
function ridged(x, z, octaves, freq) {
  let amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(2 * valueNoise(x * freq, z * freq) - 1);
    sum += amp * n * n;
    norm += amp; amp *= 0.5; freq *= 2.1;
  }
  return sum / norm;
}
const sstep = (x, a, b) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const gauss = (dx, dz, s) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));
const mix = (a, b, t) => a + (b - a) * t;

// ---- Landschaftsform ----
function islandHeight(x, z) {
  // Küstenlinie: radiale Distanz, von grobem Noise verbeult → Buchten und
  // Halbinseln. Wichtige Orte werden per PROTECT-Zonen an Land gehalten.
  let d = Math.hypot(x, z) / (MAP_SIZE / 2);
  d += (fbm(x + 40000, z - 21000, 4, 1 / 5200) - 0.5) * 0.38;
  let island = 1 - sstep(d, 0.6, 0.88);
  for (const p of PROTECT) {
    island = Math.max(island, 1 - sstep(distTo(x, z, p), p.r0, p.r1));
  }

  // Sanftes Hügelland mit fester Grundhöhe
  let h = 14 + Math.pow(fbm(x, z, 4, 1 / 900), 1.35) * 225;

  // Gebirgszüge — aber nicht in den ruhigen Zonen (Ebenen, Stadt, Felder …)
  let calm = 1;
  for (const zn of CALM_ZONES) calm *= sstep(distTo(x, z, zn), zn.r0, zn.r1);
  const mMask = sstep(fbm(x + 5000, z - 3000, 2, 1 / 2600), 0.4, 0.72);
  // Höhere Hauptkämme + scharfe, zerklüftete Nebengipfel
  h += ridged(x, z, 5, 1 / 1100) * 780 * mMask * calm;
  h += Math.pow(ridged(x + 700, z - 300, 3, 1 / 300), 4) * 190 * mMask * calm;

  // Fester West-Gipfel (Landmarke, vom Spawn aus sichtbar)
  h += WEST_PEAK.h * gauss(x - WEST_PEAK.x, z - WEST_PEAK.z, WEST_PEAK.sigma);

  // Vulkan: rauer Kegel mit Krater (der Kraterboden liegt bei ~420 —
  // dort platziert src/volcano.js den Lavasee)
  const dv = distTo(x, z, VOLCANO);
  if (dv < VOLCANO.coneR) {
    const t = 1 - dv / VOLCANO.coneR;
    const rough = 1 + (fbm(x + 900, z - 400, 3, 1 / 420) - 0.5) * 0.3;
    let cone = VOLCANO.topH * Math.pow(t, 1.5) * rough;
    cone -= VOLCANO.craterDepth * gauss(dv, 0, 260);
    h = Math.max(h, cone);
  }

  // Burgberg: markanter Hügel mit exakt flachem Plateau für die große Burg
  const dc = distTo(x, z, CASTLE);
  if (dc < CASTLE.hillR) {
    h += 165 * sstep(1 - dc / CASTLE.hillR, 0.1, 0.6);
    const pl = 1 - sstep(dc, CASTLE.plateauR, CASTLE.plateauR + 170);
    h = mix(h, CASTLE.plateauH, pl);
  }

  // Stadt- und Hafenfläche einebnen (Stadtfläche für die große Stadt)
  h = mix(h, CITY.groundH, 1 - sstep(distTo(x, z, CITY), 700, 1150));
  h = mix(h, PORT.groundH, 1 - sstep(distTo(x, z, PORT), 340, 700));

  // Wasserfall im Westgebirge: Oberbecken, Steilstufe, Unterbecken-Tal
  h = mix(h, WATERFALL.topH, 1 - sstep(distTo(x, z, WATERFALL), 70, 150));
  const dvf = Math.hypot((x - WATERFALL.x) * 1.4, z - (WATERFALL.z + 380));
  h = mix(h, WATERFALL.baseH, 1 - sstep(dvf, 130, 300));

  // Felsvorsprung für die Drachenhöhle
  h = mix(h, CAVE.shelfH, 1 - sstep(distTo(x, z, CAVE), 90, 190));

  // Leuchtturm-Klippe: kleiner Felskopf über dem Meer
  h = Math.max(h, 26 - 26 * sstep(distTo(x, z, LIGHTHOUSE), 120, 260));

  // See und Fluss (unter Meereshöhe gegraben → die Wasserfläche füllt sie)
  h = mix(h, LAKE.depth, 1 - sstep(distTo(x, z, LAKE), 480, 800));
  const rt = 1 - sstep(riverDist(x, z), 45, 160);
  if (rt > 0) h = mix(h, Math.min(h, -9), rt);

  // Die Große Schlucht: erhöhte Felskanten, dann fast senkrechte Wände,
  // am Grund ein Fluss (unter Meereshöhe → Wasser). Vom Spawn nach Norden.
  const cd = canyonDist(x, z);
  if (cd < 520) {
    h += 95 * sstep(cd, 190, 300) * (1 - sstep(cd, 320, 520)); // Randwulst
    h = mix(h, -12, 1 - sstep(cd, 150, 250));                   // Steilwände + Flussgrund
  }
  // Engerer Seitenarm der Schlucht (vom Ahnenhain kommend)
  const cd2 = polyDist(x, z, CANYON2);
  if (cd2 < 320) {
    h += 70 * sstep(cd2, 130, 210) * (1 - sstep(cd2, 220, 320));
    h = mix(h, -10, 1 - sstep(cd2, 95, 175));
  }

  // Zackenland: Feld scharfer Felsnadeln (Slalom-Fliegen)
  const sd = distTo(x, z, SPIKES);
  if (sd < SPIKES.r) {
    const m = 1 - sstep(sd, SPIKES.r * 0.5, SPIKES.r);
    h += Math.pow(ridged(x - 3000, z + 8000, 2, 1 / 140), 6) * 340 * m;
  }

  // Podeste der beiden Kolosse am Schlucht-Eingang
  for (const c of COLOSSI) {
    h = mix(h, c.groundH, 1 - sstep(distTo(x, z, c), 90, 170));
  }

  // Übergang Land ↔ Meeresboden (flacher Schelf, dann Strand)
  h = SEA_FLOOR + (h - SEA_FLOOR) * island;

  // Drei vorgelagerte kleine Inseln
  h = Math.max(h, SEA_FLOOR + 210 * gauss(x - 8600, z - 5000, 700));
  h = Math.max(h, SEA_FLOOR + 170 * gauss(x + 8200, z + 6600, 620));
  h = Math.max(h, SEA_FLOOR + 140 * gauss(x + 1800, z - 9600, 560));

  return Math.min(h, SEA_FLOOR + H_RANGE);
}

// ---- Höhen rastern und als 8-Bit-Graustufen kodieren ----
const raw = Buffer.alloc(N * (N + 1)); // je Zeile 1 Filterbyte + N Pixel
for (let py = 0; py < N; py++) {
  raw[py * (N + 1)] = 0; // PNG-Zeilenfilter: none
  for (let px = 0; px < N; px++) {
    const x = (px / (N - 1) - 0.5) * MAP_SIZE;
    const z = (py / (N - 1) - 0.5) * MAP_SIZE;
    const t = Math.pow((islandHeight(x, z) - SEA_FLOOR) / H_RANGE, 1 / GAMMA);
    raw[py * (N + 1) + 1 + px] = Math.round(Math.min(Math.max(t, 0), 1) * 255);
  }
}

// ---- minimaler PNG-Writer (Graustufen, 8 Bit) ----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8;  // Bittiefe
ihdr[9] = 0;  // Farbtyp 0 = Graustufen
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = join(import.meta.dirname, "..", "assets");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "island.png");
writeFileSync(outFile, png);
console.log(`geschrieben: ${outFile} (${N}×${N}, ${(png.length / 1024).toFixed(0)} KiB)`);

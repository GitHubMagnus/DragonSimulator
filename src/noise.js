// Deterministisches Rauschen + Geländehöhe. Die grobe Landschaftsform kommt
// aus der festen Insel-Heightmap (src/map.js); hier wird nur noch feines
// Detailrauschen daraufgelegt und die Biom-Felder (Klima/Feuchte) berechnet.
import { mapHeightAt } from "./map.js";

/** Hash einer ganzzahligen Koordinate auf einen Wert in [0, 1). */
export function hash(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Bilinear interpoliertes Value-Noise in [0, 1). */
export function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const ux = smooth(fx), uz = smooth(fz);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) +
         c * (1 - ux) * uz + d * ux * uz;
}

// ---- Biom-Felder (sehr niederfrequent → große Regionen) ----
/** „Temperatur" 0..1: arid → gemäßigt → kalt. Steuert Boden- & Baumfarben. */
export function climateAt(x, z) {
  return valueNoise(x * 0.00032 + 300, z * 0.00032 - 120);
}
/** „Feuchte" 0..1: trocken → üppig. Mischt Herbst-/Laubtöne und Walddichte. */
export function moistureAt(x, z) {
  return valueNoise(x * 0.00045 - 80, z * 0.00045 + 260);
}

/**
 * Geländehöhe an Weltposition (x, z): feste Insel-Heightmap plus zwei feine
 * Detail-Oktaven. Das Detail (±~2,5) bricht die 8-Bit-Höhenstufen der Karte
 * auf, ist deterministisch und ändert die Landschaftsform nicht.
 */
export function heightAt(x, z) {
  const d1 = (valueNoise(x * 0.022, z * 0.022) - 0.5) * 3.4;
  const d2 = (valueNoise(x * 0.085 + 40, z * 0.085 - 17) - 0.5) * 1.4;
  return mapHeightAt(x, z) + d1 + d2;
}

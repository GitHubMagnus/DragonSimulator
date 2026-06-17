// Prozedurales Höhenrauschen — deterministisch, ohne externe Library.
// Liefert für jede Weltkoordinate (x, z) eine reproduzierbare Höhe.

/** Hash einer ganzzahligen Koordinate auf einen Wert in [0, 1). */
export function hash(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * (3 - 2 * x);
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

/** Fractal Brownian Motion — sanfte, geschichtete Hügel. */
function fbm(x, z, octaves, freq) {
  let amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    norm += amp; amp *= 0.5; freq *= 2.05;
  }
  return sum / norm;
}

/** Ridged Noise — scharfe Grate für Gebirge. */
function ridged(x, z, octaves, freq) {
  let amp = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(2 * valueNoise(x * freq, z * freq) - 1);
    sum += amp * n * n;
    norm += amp; amp *= 0.5; freq *= 2.1;
  }
  return sum / norm;
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
 * Geländehöhe an Weltposition (x, z).
 * Kombiniert sanftes Grundland mit Gebirgen, die nur in maskierten Regionen aufragen.
 */
export function heightAt(x, z) {
  const base = Math.pow(fbm(x, z, 4, 1 / 900), 1.35);
  const mask = smoothstep(fbm(x + 5000, z - 3000, 2, 1 / 2600), 0.4, 0.72);
  const mountains = ridged(x, z, 5, 1 / 1100) * mask;
  return base * 240 + mountains * 650 - 55;
}

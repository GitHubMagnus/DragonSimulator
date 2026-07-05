// Feste Insel-Karte: lädt die Heightmap (assets/island.png, erzeugt mit
// tools/make-island.mjs) und liefert bilinear interpolierte Geländehöhen.
// Außerhalb der Karte ist endloser, flacher Meeresboden — man kann also in
// jede Richtung aufs offene Meer hinausfliegen.
//
// Kodierung (muss zu tools/make-island.mjs passen):
//   Höhe = SEA_FLOOR + H_RANGE * (pixel/255)^GAMMA
//   Schwarz = tiefer Meeresboden, ~33 = Meereshöhe, Weiß = höchster Gipfel.

const MAP_SIZE = 24000;  // abgedeckte Weltfläche (Kantenlänge)
const SEA_FLOOR = -48;
const H_RANGE = 920;     // muss zu tools/make-island.mjs passen!
const GAMMA = 1.35;

let grid = null; // Float32-Höhenraster (N×N)
let N = 0;

/** Heightmap laden und in ein Float32-Höhenraster dekodieren. */
export async function loadIsland(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  N = img.width;

  const cv = document.createElement("canvas");
  cv.width = N;
  cv.height = N;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, N, N).data;

  grid = new Float32Array(N * N);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = SEA_FLOOR + H_RANGE * Math.pow(px[i * 4] / 255, GAMMA);
  }
}

/** Kartenhöhe an Weltposition (x, z), bilinear interpoliert. */
export function mapHeightAt(x, z) {
  const gx = (x / MAP_SIZE + 0.5) * (N - 1);
  const gz = (z / MAP_SIZE + 0.5) * (N - 1);
  if (!grid || gx < 0 || gz < 0 || gx >= N - 1 || gz >= N - 1) return SEA_FLOOR;

  const ix = gx | 0, iz = gz | 0;
  const fx = gx - ix, fz = gz - iz;
  const i = iz * N + ix;
  const a = grid[i], b = grid[i + 1], c = grid[i + N], d = grid[i + N + 1];
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) +
         c * (1 - fx) * fz + d * fx * fz;
}

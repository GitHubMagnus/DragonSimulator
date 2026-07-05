// Handgestaltetes Welt-Layout der Insel: feste Orte (Vulkan, Burgberg, Stadt,
// Fischerdorf, See), das Straßennetz, der Fluss, Felder- und Waldzonen.
// Dieses Modul ist bewusst abhängigkeitsfrei (pures JS), damit es sowohl vom
// Spiel (Terrain-Färbung, Baum-/Bauwerk-Platzierung) als auch vom Karten-
// Generator (tools/make-island.mjs, Node) importiert werden kann.
// Alle Koordinaten in Welteinheiten; die Karte deckt 24000×24000 ab.

// ---- Feste Orte ----
export const VOLCANO = { x: 5200, z: -4800, coneR: 2300, topH: 620, craterR: 320, craterDepth: 200, ashR: 2700 };
export const CASTLE = { x: -3600, z: 900, hillR: 1150, plateauH: 230, plateauR: 340 };
export const CITY = { x: -2500, z: 2500, r: 560, groundH: 32 };
export const PORT = { x: -3050, z: 5100, groundH: 9 };
export const LAKE = { x: 1900, z: 1300, r: 620, depth: -14 };
export const WEST_PEAK = { x: -4600, z: -4200, h: 380, sigma: 1600 };
export const LIGHTHOUSE = { x: -5300, z: 6100 };                 // Leuchtturm-Klippe (Südwestkap)
export const WATERFALL = { x: -4250, z: -3480, topH: 318, baseH: 185 }; // Bergbach-Wasserfall
export const CAVE = { x: -4750, z: -2950, shelfH: 215 };         // Drachenhöhle (Felsvorsprung)
export const SKELETON = { x: 4250, z: -3350, rot: 0.7 };         // Drachenskelett im Aschefeld
export const BRIDGE = { x: 2255, z: 2500, rot: -0.17 };          // Steinbrücke über den Fluss
export const WRECK = { x: 3900, z: 7800, rot: 2.3 };             // Schiffswrack in der Ostbucht
export const SHIP_ROUTE = { x: 6800, z: 7600, r: 1600 };         // Handelsschiff-Rundkurs (offene See)

// ---- Fluss: vom See nach Süden ins Meer ----
export const RIVER = [
  [1900, 1300], [2300, 2200], [2100, 3400], [2500, 4800], [2300, 6500], [2500, 8500],
];

// ---- Die Große Schlucht: vom Spawn nach Norden bis zum Meer ----
// Steile Wände, Fluss am Grund, bewaldete Kanten mit erhöhten Rändern.
export const CANYON = [
  [0, -1100], [300, -2200], [-200, -3500], [400, -4800], [100, -6200], [500, -7800], [300, -9400],
];
// Engerer Seitenarm: vom Ahnenhain in die Hauptschlucht
export const CANYON2 = [
  [-1900, -2600], [-1200, -3000], [-500, -3300], [100, -3500],
];
// Natürliche Felsbögen über der Schlucht (zum Durchfliegen)
export const ARCHES = [
  { x: 350, z: -4700, rot: 0.2, s: 1.15 },
  { x: 150, z: -6100, rot: -0.15, s: 0.9 },
];
// Zackenland: Feld aus Felsnadeln (Slalom-Gelände)
export const SPIKES = { x: 1800, z: -3800, r: 1400 };

// ---- Epische Landmarken rund um den Spawn ----
// Zwei Kolosse flankieren den Schlucht-Eingang (Blick vom Spawn nach Norden).
export const COLOSSI = [
  { x: -300, z: -1150, rot: 0.35, groundH: 130 },
  { x: 320, z: -1000, rot: -0.4, groundH: 130 },
];
// Aquädukt überspannt die Schlucht — man fliegt unter den Bögen hindurch.
export const AQUEDUCT = { x: 60, z: -3000, rot: 0.12 };
// Schwebende Inseln mit Wasserfällen über dem See (vom Spawn aus rechts).
export const FLOAT_ISLES = [
  { x: 1750, z: 900, y: 620, r: 200 },
  { x: 2350, z: 1500, y: 760, r: 145 },
  { x: 1450, z: 1750, y: 830, r: 115 },
  { x: 2150, z: 500, y: 920, r: 85 },
];
// Ahnenhain: urzeitliche Riesenbäume nordwestlich vom Spawn.
export const MEGA_TREES = [
  { x: -1500, z: -1500, s: 1.25 }, { x: -1100, z: -2100, s: 1.0 },
  { x: -1950, z: -2300, s: 1.15 }, { x: -800, z: -1400, s: 0.85 },
  { x: -1650, z: -900, s: 0.95 }, { x: -2300, z: -1700, s: 1.1 },
  { x: -1300, z: -2750, s: 0.9 },
];

// ---- Straßennetz (Polylinien) ----
export const ROADS = [
  // Stadt-Osttor → Spawn-Ebene → nördlich am See vorbei → Vulkanfuß
  [[-2050, 2450], [-900, 1900], [0, 1050], [900, 600], [1600, 550], [2600, -300], [3500, -1600], [4100, -2800]],
  // Stadt-Südtor → Küstenweg → Fischerdorf
  [[-2500, 2950], [-2600, 3800], [-2900, 4500], [-3050, 5000]],
  // Stadt-Westtor → Serpentine auf den Burgberg
  [[-2940, 2500], [-3300, 1900], [-3620, 1350], [-3600, 980]],
  // Ostweg: von der Spawn-Straße über die Steinbrücke in die Osthügel
  [[900, 600], [1500, 1300], [2000, 2300], [2255, 2500], [2600, 2560], [3400, 2700], [4200, 3200]],
];

// ---- Felderzonen (gedrehte Rechtecke: Zentrum, Halbachsen, Drehung) ----
export const FIELDS = [
  { x: -1500, z: 2500, rx: 1500, rz: 1100, ang: 0.3 },  // Kornkammer vor der Stadt
  { x: 300, z: 900, rx: 900, rz: 650, ang: -0.2 },      // Felder an der Spawn-Straße
  { x: 3400, z: 3000, rx: 950, rz: 650, ang: 0.15 },    // Osthügel-Felder (an der Brückenstraße)
];

// ---- Dichte Waldzonen ----
export const FOREST_ZONES = [
  { x: 700, z: -2600, r: 2000, boost: 1.8 },   // großer Wald nördlich vom Spawn
  { x: -1200, z: -900, r: 1400, boost: 1.5 },
  { x: 4200, z: 900, r: 1500, boost: 1.6 },    // Ostwald zwischen See und Feldern
  { x: -900, z: 4400, r: 1300, boost: 1.5 },   // Küstenwald südlich der Stadt
];

// ---- Küstenschutz: diese Orte liegen garantiert an Land ----
export const PROTECT = [
  { x: CITY.x, z: CITY.z, r0: 1500, r1: 2600 },
  { x: PORT.x, z: PORT.z, r0: 500, r1: 1200 },
  { x: VOLCANO.x, z: VOLCANO.z, r0: 2800, r1: 3600 },
  { x: LAKE.x, z: LAKE.z, r0: 1200, r1: 2000 },
  { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r0: 240, r1: 700 },
];

// ---- Ruhige Zonen: hier wachsen keine Gebirgszüge ----
export const CALM_ZONES = [
  { x: 0, z: 600, r0: 1900, r1: 4600 },                     // Spawn-Ebene
  { x: 300, z: -3200, r0: 2400, r1: 4200 },                 // Hügelwald im Norden (freier Erstflug)
  { x: CITY.x, z: CITY.z, r0: 1400, r1: 3200 },             // Stadt + Umland
  { x: -1500, z: 2500, r0: 1700, r1: 3000 },                // Felder West
  { x: 300, z: 900, r0: 1100, r1: 2200 },                   // Felder Ost
  { x: VOLCANO.x, z: VOLCANO.z, r0: 2500, r1: 4000 },       // Vulkan steht frei
  { x: LAKE.x, z: LAKE.z, r0: 900, r1: 1800 },
  { x: PORT.x, z: PORT.z, r0: 700, r1: 1600 },
];

// ---- Geometrie-Helfer ----
export function distTo(x, z, p) {
  return Math.hypot(x - p.x, z - p.z);
}

/** Abstand Punkt → Strecke (a → b). */
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** Abstand Punkt → Polylinie. */
export function polyDist(x, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const s = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (s < d) d = s;
  }
  return d;
}

/** Abstand zur nächsten Straße. */
export function roadDist(x, z) {
  let d = Infinity;
  for (const r of ROADS) {
    const s = polyDist(x, z, r);
    if (s < d) d = s;
  }
  return d;
}

/** Abstand zum Fluss. */
export function riverDist(x, z) {
  return polyDist(x, z, RIVER);
}

/** Abstand zur Großen Schlucht. */
export function canyonDist(x, z) {
  return polyDist(x, z, CANYON);
}

/**
 * Liegt (x, z) in einer Felderzone? Liefert Parzellen-Koordinaten (lx, lz im
 * gedrehten Zonenraster) und einen weichen Randfaktor edge (0 Rand … 1 Kern),
 * sonst null.
 */
export function inField(x, z) {
  for (const f of FIELDS) {
    const dx = x - f.x, dz = z - f.z;
    const c = Math.cos(f.ang), s = Math.sin(f.ang);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const ex = 1 - Math.abs(lx) / f.rx;
    const ez = 1 - Math.abs(lz) / f.rz;
    if (ex > 0 && ez > 0) {
      const e = Math.min(ex, ez);
      const edge = e > 0.12 ? 1 : e / 0.12; // weicher Übergang am Zonenrand
      return { lx, lz, edge };
    }
  }
  return null;
}

/** Walddichte-Faktor (≥1 in ausgewiesenen Waldzonen, sanft auslaufend). */
export function forestBoost(x, z) {
  let b = 1;
  for (const f of FOREST_ZONES) {
    const t = 1 - distTo(x, z, f) / f.r;
    if (t > 0) b = Math.max(b, 1 + (f.boost - 1) * Math.min(t * 2.5, 1));
  }
  return b;
}

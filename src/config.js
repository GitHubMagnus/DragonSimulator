// Zentrale, einstellbare Konstanten des Spiels.

// ---- Welt ----
export const WORLD = 9000;                 // Kantenlänge des Terrain-Meshes
export const SEG = 240;                     // Terrain-Auflösung (SEG × SEG Quads)
export const STEP = WORLD / SEG;            // Abstand zweier Gitterpunkte
export const WATER_LEVEL = 0;
export const RECENTER_DIST = WORLD * 0.2;   // ab dieser Distanz zieht die Welt nach

// ---- Bäume (instanziert, deterministisch pro Rasterzelle) ----
export const TREE_CELL = 150;
export const TREE_SPAN = Math.round(WORLD / TREE_CELL);
export const TREE_COUNT = TREE_SPAN * TREE_SPAN;

// ---- Bauwerke ----
export const STRUCT_CELL = 850;             // Rasterzelle für Burgen/Dörfer

// ---- Flugphysik (Arcade) ----
export const FLIGHT = {
  MAX_SPEED: 300,
  MIN_SPEED: 45,
  PITCH_RATE: 1.45,
  ROLL_RATE: 2.1,
  YAW_RATE: 1.05,
  GRAVITY: 95,
  SPAWN_ALT: 360,
  START_THROTTLE: 0.6,
};

// ---- Auswählbare Drachenfarben ----
export const DRAGON_PALETTE = [
  { name: "Drachenrot", hex: 0x7d1f24 },
  { name: "Waldgrün", hex: 0x2e6b34 },
  { name: "Königsblau", hex: 0x274b8f },
  { name: "Gold", hex: 0xb8902f },
  { name: "Amethyst", hex: 0x5e2f7a },
  { name: "Nachtschwarz", hex: 0x2b2b33 },
  { name: "Eisweiß", hex: 0xcfd8e6 },
  { name: "Glut", hex: 0xd2641b },
];

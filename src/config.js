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

// ---- Auswählbare Flugzeug-Lackierungen ----
export const AIRPLANE_PALETTE = [
  { name: "Jagdgrün", hex: 0x3d6b3a },
  { name: "Stahlblau", hex: 0x37597f },
  { name: "Wüstensand", hex: 0xc2a663 },
  { name: "Feuerrot", hex: 0xa83232 },
  { name: "Silbergrau", hex: 0x9aa3ad },
  { name: "Marineblau", hex: 0x223a5e },
  { name: "Elfenbein", hex: 0xe6e0cf },
  { name: "Nachtschwarz", hex: 0x2b2b33 },
];

// ---- Auswählbare Ikarus-Töne (Tunika & Federsaum) ----
export const ICARUS_PALETTE = [
  { name: "Reinweiß", hex: 0xf2efe6 },
  { name: "Himmelblau", hex: 0x6f9fd0 },
  { name: "Safran", hex: 0xd8a13a },
  { name: "Purpur", hex: 0x7a3b66 },
  { name: "Olivgrün", hex: 0x6f7a3a },
  { name: "Terrakotta", hex: 0xb5613a },
  { name: "Taubengrau", hex: 0x9a9aa0 },
  { name: "Karmin", hex: 0x9e2b3a },
];

// ---- Wählbare Fluggeräte (Reihenfolge = Anzeige im Menü) ----
// `fire` steuert nur den Steuerungs-Hinweis im Menü; die Mechanik selbst
// hängt an `fireEnabled` des jeweiligen Modells.
export const FLIERS = [
  { id: "dragon",   label: "Drache",   emoji: "🐉", palette: DRAGON_PALETTE,   fire: true,  desc: "Wendiger Feuerspeier mit Flügelschlag" },
  { id: "airplane", label: "Flugzeug", emoji: "✈️", palette: AIRPLANE_PALETTE, fire: true,  desc: "Propellerjäger, schnell und stabil" },
  { id: "icarus",   label: "Ikarus",   emoji: "🪶", palette: ICARUS_PALETTE,   fire: false, desc: "Federschwingen aus Wachs — flieg nicht zu hoch" },
];

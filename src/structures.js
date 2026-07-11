// Mittelalterliche Bauwerke: Dörfer (Fachwerkhäuser) und epische Burgen.
// Pro Bauwerk werden alle Teile per Geometrie-Merging zu wenigen Meshes
// zusammengefasst, damit die Anzahl der Draw-Calls niedrig bleibt.
// Bauwerke werden deterministisch pro Rasterzelle erzeugt und inkrementell
// um den Spieler herum ein- und ausgeblendet.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { uv, time, vec3, color, float, mix, smoothstep, positionLocal, triNoise3D } from "three/tsl";
import { WORLD, STRUCT_CELL } from "./config.js";
import { hash, heightAt } from "./noise.js";
import { uNight } from "./scene.js";
import {
  roadDist, inField, distTo, canyonDist, VOLCANO, CITY, CASTLE, PORT, LAKE,
  LIGHTHOUSE, WATERFALL, CAVE, SKELETON, BRIDGE, WRECK,
  COLOSSI, AQUEDUCT, FLOAT_ISLES, MEGA_TREES, ARCHES,
} from "./world.js";

/** Schornstein-Positionen der Landmarken (für den Kaminrauch, s. smoke.js). */
export const SMOKE_SPOTS = [];

// ---- Materialien ----
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, flatShading: true, roughness: 1 });
const spireMat = new THREE.MeshStandardMaterial({ color: 0x39496b, flatShading: true });
// Fahnen wehen: Vertex-Welle, deren Amplitude über die UV-Breite wächst
// (an der Stange fest, am freien Ende flatternd).
const flagMat = new THREE.MeshStandardNodeMaterial({ color: 0xb0282a, side: THREE.DoubleSide });
flagMat.positionNode = positionLocal.add(vec3(0, 0,
  time.mul(6.0).add(positionLocal.x.mul(0.5)).add(positionLocal.y.mul(0.35)).sin().mul(uv().x).mul(1.4)));
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, flatShading: true });
const plasterMat = new THREE.MeshStandardMaterial({ color: 0xd8c39a, flatShading: true });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a3a2c, flatShading: true });
const mossMat = new THREE.MeshStandardMaterial({ color: 0x6f7560, flatShading: true, roughness: 1 });
// Tücher (Segel, Marktplanen, Mühlenflügel) kräuseln leicht im Wind.
const clothMat = new THREE.MeshStandardNodeMaterial({ color: 0xe9e2cf, side: THREE.DoubleSide });
clothMat.positionNode = positionLocal.add(vec3(0, 0,
  time.mul(4.0).add(positionLocal.x.mul(0.4)).add(positionLocal.y.mul(0.4)).sin().mul(0.35)));
const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a13b, metalness: 0.75, roughness: 0.35 });
const boneMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.9 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
const redMat = new THREE.MeshStandardMaterial({ color: 0xb03030, roughness: 0.6 });
const darkMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
// Fenster: tagsüber dunkle Scheiben, nachts warm leuchtend (uNight aus scene.js)
const windowMat = new THREE.MeshStandardNodeMaterial({ color: 0x1e1a16, roughness: 0.4 });
windowMat.emissiveNode = color(0xffb45e).mul(uNight).mul(2.2);
// Funkelnder Goldschatz (immer leicht HDR → Bloom)
const sparkleMat = new THREE.MeshStandardNodeMaterial({ color: 0xc9a13b });
sparkleMat.emissiveNode = color(0xfff2b0).mul(2.5);
// Leuchtturm-Lampe und -Strahl (nachts aktiv)
const lampMat = new THREE.MeshStandardNodeMaterial({ color: 0x8a8070 });
lampMat.emissiveNode = color(0xffe9a0).mul(uNight.mul(3.0).add(0.15));
const beamMat = new THREE.MeshBasicNodeMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
});
beamMat.colorNode = color(0xffe9b0).mul(1.2);
beamMat.opacityNode = uNight.mul(0.22).mul(float(1.0).sub(uv().y)); // zum Strahlende hin ausblenden
// Schwebende Inseln & Riesenbäume
const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f9248, roughness: 1 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, flatShading: true, roughness: 0.95 });
const leafAMat = new THREE.MeshStandardMaterial({ color: 0x3f7a34, flatShading: true, roughness: 0.92 });
const leafBMat = new THREE.MeshStandardMaterial({ color: 0x2c5a30, flatShading: true, roughness: 0.92 });
// Feuerschalen-Flammen (Kolossen-Sockel): züngelndes Shader-Feuer auf Kreuz-Quads
const flameFxMat = new THREE.MeshBasicNodeMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
{
  const u = uv();
  const fx = u.x.sub(0.5).mul(2.0);
  const n = triNoise3D(vec3(u.x.mul(2.5), u.y.mul(3.0).sub(time.mul(1.8)), 6.1), 0.4, time);
  const shape = float(1.0).sub(fx.abs().mul(u.y.mul(1.7).add(0.9))).sub(u.y.mul(0.5)).add(n.sub(0.5).mul(1.1));
  flameFxMat.opacityNode = smoothstep(0.08, 0.5, shape);
  flameFxMat.colorNode = mix(color(0xc23004), color(0xffd23a).mul(2.6), smoothstep(0.15, 0.75, shape));
}
// Schäumendes Wasser (Wasserfall-Kaskade, Inselfälle) — scrollendes Noise
const foamMat = new THREE.MeshBasicNodeMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
{
  const n = triNoise3D(vec3(uv().x.mul(3.0), uv().y.mul(5.0).add(time.mul(1.4)), 2.2), 0.3, time);
  const edge = smoothstep(0.0, 0.18, uv().x).mul(smoothstep(1.0, 0.82, uv().x));
  foamMat.colorNode = color(0xeaf4fb).mul(1.15);
  foamMat.opacityNode = n.mul(0.55).add(0.35).mul(edge);
}
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
// Handgebaute Landmarken (Große Burg, Stadt, Fischerdorf)
const bigPoleGeo = new THREE.CylinderGeometry(1.8, 1.8, 50, 6);
const bigFlagGeo = new THREE.PlaneGeometry(34, 20);
const drawbridgeGeo = new THREE.BoxGeometry(24, 2.2, 46);
const wellGeo = new THREE.CylinderGeometry(7, 8, 5, 10);
const roseGeo = new THREE.CylinderGeometry(6.5, 6.5, 1.2, 14);
const goldTipGeo = new THREE.ConeGeometry(2.4, 10, 8);
const plankGeo = new THREE.BoxGeometry(6, 1, 26);
const pierPostGeo = new THREE.CylinderGeometry(0.6, 0.7, 10, 6);
const boatGeo = new THREE.BoxGeometry(6, 2.6, 16);
const sailGeo = new THREE.PlaneGeometry(8, 11);
const windowGeo = new THREE.PlaneGeometry(2.0, 2.4);
const ribGeo = new THREE.TorusGeometry(20, 1.7, 6, 12, Math.PI);
const boneBallGeo = new THREE.SphereGeometry(2.6, 6, 5);
const skullGeo = new THREE.BoxGeometry(10, 7, 15);
const hornGeo = new THREE.ConeGeometry(1.2, 7, 5);
const beamGeo = new THREE.ConeGeometry(26, 380, 10, 1, true);
beamGeo.translate(0, -190, 0);        // Spitze an den Ursprung (Lampe)
beamGeo.rotateZ(Math.PI / 2);         // Strahl zeigt entlang +X

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
  if (!list.length) return null;
  const m = new THREE.Mesh(mergeGeometries(list), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
  const plaster = [], roof = [], wood = [], stone = [], windows = [];
  for (const h of houses) {
    const seed = Math.abs(Math.round(h.x * 0.7) + Math.round(h.z * 1.3) * 31);
    const pc = PCOLORS[seed % PCOLORS.length];
    const rc = RCOLORS[(seed * 7 + 2) % RCOLORS.length];
    const scale = 1.4 + ((seed % 5) * 0.16); // deutlich größere Häuser

    _o.position.set(h.x, h.y + 6 * scale, h.z); _o.rotation.set(0, h.rot, 0); _o.scale.set(scale, scale, scale); _o.updateMatrix();
    let g = houseWallGeo.clone(); g.applyMatrix4(_o.matrix); tintGeo(g, pc); plaster.push(g);
    _o.position.set(h.x, h.y + 17.5 * scale, h.z); _o.rotation.set(0, h.rot + Math.PI / 4, 0); _o.updateMatrix();
    g = houseRoofGeo.clone(); g.applyMatrix4(_o.matrix); tintGeo(g, rc); roof.push(g);

    const [dx, dz] = rotOff(h.rot, 0, 7.4 * scale);
    part(wood, houseDoorGeo, h.x + dx, h.y + 3 * scale, h.z + dz, 0, h.rot, 0, scale);
    const [cx, cz] = rotOff(h.rot, 5 * scale, 0);
    part(stone, chimneyGeo, h.x + cx, h.y + 18 * scale, h.z + cz, 0, h.rot, 0, scale);
    // Fenster neben der Tür (leuchtet nachts)
    const [wx2, wz2] = rotOff(h.rot, 3.4 * scale, 7.35 * scale);
    part(windows, windowGeo, h.x + wx2, h.y + 7 * scale, h.z + wz2, 0, h.rot, 0, scale);
  }
  const g = new THREE.Group();
  for (const m of [meshFrom(plaster, villagePlasterMat), meshFrom(roof, villageRoofMat),
                   meshFrom(wood, woodMat), meshFrom(stone, stoneMat),
                   meshFrom(windows, windowMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/**
 * Die Große Burg auf dem Burgberg-Plateau: doppelte Ringmauer (Achteck außen,
 * Sechseck innen) mit Türmen und Fahnen, Torhaus mit Zugbrücke nach Süden
 * (dort endet die Straße von der Stadt), gestufter Bergfried mit vergoldeter
 * Turmspitze sowie Palas, Kapelle und Stallungen im Burghof.
 */
function buildGrandCastle() {
  const stone = [], spire = [], wood = [], flag = [], roof = [], gold = [], windows = [];
  const flagAt = (x, baseY, z) => {
    part(wood, poleGeo, x, baseY + 9, z);
    part(flag, flagGeo, x + 6.5, baseY + 14, z);
  };

  // Äußere Ringmauer: Achteck mit acht Türmen, Torhaus im Süden (+z)
  const R1 = 150, n1 = 8;
  for (let i = 0; i < n1; i++) {
    const a = (i / n1) * Math.PI * 2;
    const tx = Math.cos(a) * R1, tz = Math.sin(a) * R1;
    const isGate = i === 2; // a = 90° → Südseite
    if (isGate) {
      part(stone, gateTowerGeo, tx - 22, 33, tz);
      part(stone, gateTowerGeo, tx + 22, 33, tz);
      part(spire, spireGeo, tx - 22, 76, tz, 0, 0, 0, 0.72);
      part(spire, spireGeo, tx + 22, 76, tz, 0, 0, 0, 0.72);
      flagAt(tx - 22, 68, tz);
      flagAt(tx + 22, 68, tz);
      part(wood, gateGeo, tx, 14, tz + 2);
      part(wood, drawbridgeGeo, tx, 1.2, tz + 38);
    } else {
      part(stone, towerGeo, tx, 50, tz, 0, 0, 0, 0.8);
      merlonRing(stone, tx, tz, 12, 96, 10, 0.9);
      part(spire, spireGeo, tx, 116, tz, 0, 0, 0, 0.85);
      if (i % 2 === 0) flagAt(tx, 100, tz);
    }
    // Mauersegment zum nächsten Turm
    const am = ((i + 0.5) / n1) * Math.PI * 2;
    const wr = R1 * Math.cos(Math.PI / n1);
    const chord = 2 * R1 * Math.sin(Math.PI / n1);
    part(stone, wallGeo, Math.cos(am) * wr, 18, Math.sin(am) * wr, 0, -am + Math.PI / 2, 0, chord / 150, 0.88, 1);
  }

  // Innere Ringmauer: Sechseck, höher, mit sechs schlanken Türmen
  const R2 = 82, n2 = 6;
  for (let i = 0; i < n2; i++) {
    const a = ((i + 0.5) / n2) * Math.PI * 2;
    const tx = Math.cos(a) * R2, tz = Math.sin(a) * R2;
    part(stone, towerGeo, tx, 56, tz);
    merlonRing(stone, tx, tz, 14, 114, 10, 1);
    part(spire, spireGeo, tx, 136, tz);
    flagAt(tx, 112, tz);
    const am = ((i + 1) / n2) * Math.PI * 2;
    const wr = R2 * Math.cos(Math.PI / n2);
    const chord = 2 * R2 * Math.sin(Math.PI / n2);
    part(stone, wallGeo, Math.cos(am) * wr, 22, Math.sin(am) * wr, 0, -am + Math.PI / 2, 0, chord / 150, 1.1, 0.9);
  }
  part(wood, gateGeo, 0, 14, R2 + 2, 0, 0, 0, 0.8); // inneres Tor Richtung Süden

  // Bergfried: zwei gestufte Blöcke, hoher Wachturm mit Goldspitze und Banner
  part(stone, keepGeo, 0, 48, 0, 0, 0, 0, 1.35, 1, 1.35);
  merlonRing(stone, 0, 0, 34, 98, 22, 1.3);
  part(stone, keepGeo, 0, 130, 0, 0, Math.PI / 8, 0, 0.95, 0.75, 0.95);
  merlonRing(stone, 0, 0, 24, 168, 16, 1.1);
  part(stone, watchGeo, 0, 205, 0, 0, 0, 0, 1.25, 1.2, 1.25);
  merlonRing(stone, 0, 0, 17, 246, 12, 1);
  part(spire, watchSpireGeo, 0, 268, 0, 0, 0, 0, 1.3);
  part(gold, goldTipGeo, 0, 296, 0);
  part(wood, bigPoleGeo, 0, 300, 0);
  part(flag, bigFlagGeo, 17, 315, 0);
  // Vier Ecktürmchen am Bergfried
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    part(stone, watchGeo, sx * 36, 100, sz * 36, 0, 0, 0, 0.45, 0.9, 0.45);
    part(spire, watchSpireGeo, sx * 36, 134, sz * 36, 0, 0, 0, 0.5);
  }

  // Fenster am Bergfried und Wachturm (leuchten nachts warm)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    part(windows, windowGeo, Math.cos(a) * 34, 62, Math.sin(a) * 34, 0, Math.PI / 2 - a, 0, 1.4);
    if (i % 2 === 0) {
      part(windows, windowGeo, Math.cos(a) * 24, 140, Math.sin(a) * 24, 0, Math.PI / 2 - a, 0, 1.2);
      part(windows, windowGeo, Math.cos(a) * 17, 220, Math.sin(a) * 17, 0, Math.PI / 2 - a, 0, 1.0);
    }
  }

  // Burghof: Palas (großer Saal), Kapelle und Stallungen
  part(stone, naveGeo, 62, 11, -34, 0, 0.5, 0, 2, 1.4, 1.6);
  part(roof, ridgeGeo, 62, 30, -34, 0, 0.5, Math.PI / 4, 1.9, 1.9, 1.55);
  part(stone, naveGeo, -68, 8, -30, 0, -0.6, 0, 1, 1, 0.9);
  part(roof, ridgeGeo, -68, 18, -30, 0, -0.6, Math.PI / 4, 0.95, 0.95, 0.9);
  part(wood, houseWallGeo, -58, 5, 52, 0, 1.1, 0, 1.6, 0.85, 0.9);
  part(roof, houseRoofGeo, -58, 14, 52, 0, 1.1 + Math.PI / 4, 0, 1.7, 0.8, 1.7);

  // Bannerallee vom Tor zum Bergfried
  for (let i = 0; i < 3; i++) {
    flagAt(-14, 0, 44 + i * 30);
    flagAt(14, 0, 44 + i * 30);
  }

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(spire, spireMat),
                   meshFrom(wood, woodMat), meshFrom(flag, flagMat),
                   meshFrom(roof, roofMat), meshFrom(gold, goldMat),
                   meshFrom(windows, windowMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/** Windmühle: Turm, Kegeldach — und ein drehendes Flügelkreuz (animiert
 *  über Structures.animate(), registriert via userData.rotors). */
function buildWindmill() {
  const body = [], roof = [], wood = [];
  part(body, millBodyGeo, 0, 21, 0);
  part(roof, millCapGeo, 0, 48, 0);
  part(wood, chapelDoorGeo, 0, 4, 12.5);
  const g = new THREE.Group();
  for (const m of [meshFrom(body, plasterMat), meshFrom(roof, roofMat),
                   meshFrom(wood, woodMat)]) if (m) g.add(m);

  // Drehendes Flügelkreuz als eigene Gruppe an der Nabe
  const arms = [], sails = [];
  part(arms, sailArmGeo, 0, 0, 0, 0, 0, Math.PI / 4);
  part(arms, sailArmGeo, 0, 0, 0, 0, 0, -Math.PI / 4);
  for (const [bx, by] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    part(sails, sailBladeGeo, bx * 11, by * 11, 0.4, 0, 0, Math.atan2(by, bx));
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, 33, 14);
  for (const m of [meshFrom(arms, woodMat), meshFrom(sails, clothMat)]) if (m) rotor.add(m);
  g.add(rotor);
  g.userData.rotors = [{ obj: rotor, axis: "z", speed: 0.35 + Math.random() * 0.3 }];
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

/** Steinbrücke über den Fluss: Fahrbahn, Brüstungen, Pfeiler, Auffahrten. */
function buildBridge() {
  const stone = [];
  part(stone, new THREE.BoxGeometry(190, 4, 16), 0, 6, 0);
  part(stone, new THREE.BoxGeometry(190, 3, 2), 0, 9, 8);
  part(stone, new THREE.BoxGeometry(190, 3, 2), 0, 9, -8);
  for (const px of [-55, 0, 55]) {
    part(stone, new THREE.CylinderGeometry(5, 6.5, 20, 8), px, -4, 0);
  }
  for (const s of [-1, 1]) {
    part(stone, new THREE.BoxGeometry(34, 3, 14), s * 108, 3.6, 0, 0, 0, s * -0.14);
  }
  const g = new THREE.Group();
  const m = meshFrom(stone, stoneMat);
  if (m) g.add(m);
  return g;
}

/** Leuchtturm auf der Klippe: weißer Turm mit roten Bändern, Lampe und
 *  rotierendem Doppel-Lichtstrahl (nachts sichtbar). */
function buildLighthouse() {
  const g = new THREE.Group();
  const white = [], red = [], stone = [];
  part(white, new THREE.CylinderGeometry(4.4, 6.4, 44, 12), 0, 22, 0);
  part(red, new THREE.CylinderGeometry(6.0, 6.4, 7, 12), 0, 7, 0);
  part(red, new THREE.CylinderGeometry(5.0, 5.3, 7, 12), 0, 26, 0);
  part(stone, new THREE.CylinderGeometry(6.4, 6.4, 2.4, 12), 0, 45, 0);
  part(red, new THREE.ConeGeometry(4.6, 7, 10), 0, 55, 0);
  for (const m of [meshFrom(white, whiteMat), meshFrom(red, redMat), meshFrom(stone, stoneMat)]) {
    if (m) g.add(m);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), lampMat);
  lamp.position.y = 48.5;
  g.add(lamp);

  // Rotierender Doppelstrahl
  const beams = new THREE.Group();
  beams.position.y = 48.5;
  const b1 = new THREE.Mesh(beamGeo, beamMat);
  const b2 = new THREE.Mesh(beamGeo, beamMat);
  b2.rotation.y = Math.PI;
  beams.add(b1, b2);
  g.add(beams);
  g.userData.rotors = [{ obj: beams, axis: "y", speed: 0.7 }];
  return g;
}

/** Halb versunkenes Schiffswrack: geborstener Rumpf, gekippter Mast. */
function buildWreck() {
  const wood = [], cloth = [];
  part(wood, new THREE.BoxGeometry(11, 8, 26), -8, 0, 0, 0.12, 0, 0.32);
  part(wood, new THREE.BoxGeometry(11, 8, 20), 14, -1.5, 3, -0.1, 0.5, -0.45);
  part(wood, new THREE.CylinderGeometry(0.7, 1, 26, 6), -8, 8, 0, 0.9, 0, 0.5);
  for (let i = 0; i < 4; i++) {
    part(wood, new THREE.BoxGeometry(0.9, 7, 1.6), -20 + i * 4, 1.5, -4 + i, 0.3, 0, 0.5 + i * 0.1);
  }
  part(cloth, sailGeo, -1, 6.5, 4, 0.7, 0.4, 0.4);
  const g = new THREE.Group();
  for (const m of [meshFrom(wood, woodMat), meshFrom(cloth, clothMat)]) if (m) g.add(m);
  return g;
}

/** Drachenhöhle: Felsbogen vor dunklem Eingang, davor der Goldhort. */
function buildCave() {
  const g = new THREE.Group();
  const rock = [], gold = [];
  // Felskulisse hinter dem Eingang
  for (const [rx, ry, rz, s] of [[-18, 8, -26, 34], [20, 6, -30, 30], [0, 16, -38, 42]]) {
    part(rock, new THREE.SphereGeometry(1, 8, 6), rx, ry, rz, 0, 0, 0, s, s * 0.7, s);
  }
  part(rock, new THREE.TorusGeometry(15, 5.5, 8, 12, Math.PI), 0, 1, -6);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(12.5, 16), darkMat);
  hole.position.set(0, 7, -7);
  g.add(hole);
  // Goldhort mit Funkeln
  part(gold, new THREE.ConeGeometry(12, 7, 12), 8, 3.5, 14);
  for (let i = 0; i < 5; i++) {
    part(gold, new THREE.SphereGeometry(1.4, 6, 5), -2 + i * 4.5, 1.2, 20 + (i % 2) * 5);
  }
  for (const m of [meshFrom(rock, mossMat), meshFrom(gold, goldMat)]) if (m) g.add(m);
  for (let i = 0; i < 4; i++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.55, 5, 4), sparkleMat);
    spark.position.set(2 + Math.sin(i * 2.1) * 8, 2.5 + i * 1.4, 14 + Math.cos(i * 1.7) * 6);
    g.add(spark);
  }
  return g;
}

/** Drachenskelett im Aschefeld: Schädel, Wirbelsäule, aufragende Rippen. */
function buildSkeleton() {
  const bone = [];
  part(bone, skullGeo, -14, 4, 0, 0, 0.15, 0);
  part(bone, hornGeo, -16, 9, 3, -0.6, 0, 0.4);
  part(bone, hornGeo, -16, 9, -3, -0.6, 0, -0.4);
  for (let i = 0; i < 10; i++) {
    const s = 1 - i * 0.06;
    part(bone, boneBallGeo, i * 8, 2.5 * s, 0, 0, 0, 0, s, s * 0.9, s * 0.9);
  }
  for (let i = 0; i < 6; i++) {
    const s = 1 - i * 0.1;
    part(bone, ribGeo, 6 + i * 8, 0, 0, 0, Math.PI / 2, 0, s, s, s);
  }
  const g = new THREE.Group();
  const m = meshFrom(bone, boneMat);
  if (m) g.add(m);
  return g;
}

/** Bergbach-Wasserfall: schäumende Kaskade (Shader-Scroll), zwei Becken, Gischt. */
function buildWaterfall() {
  const g = new THREE.Group();
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(26, 155), foamMat);
  fall.position.set(0, (WATERFALL.topH + WATERFALL.baseH) / 2 + 4, 222);
  fall.rotation.x = -0.62; // der Steilstufe folgen
  g.add(fall);

  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x2f6f9a, transparent: true, opacity: 0.82, roughness: 0.15,
  });
  const topPool = new THREE.Mesh(new THREE.CircleGeometry(76, 24), poolMat);
  topPool.rotation.x = -Math.PI / 2;
  topPool.position.set(0, WATERFALL.topH + 1.5, 0);
  g.add(topPool);
  const basePool = new THREE.Mesh(new THREE.CircleGeometry(115, 24), poolMat);
  basePool.rotation.x = -Math.PI / 2;
  basePool.position.set(0, WATERFALL.baseH + 1.5, 380);
  g.add(basePool);

  // Gischt: zwei gekreuzte Schaum-Flächen am Aufschlag
  for (const ry of [0.5, 2.1]) {
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), foamMat);
    mist.position.set(0, WATERFALL.baseH + 14, 300);
    mist.rotation.y = ry;
    g.add(mist);
  }
  return g;
}

/**
 * Koloss: 300 Einheiten hohe Titanenstatue auf Sockel — Gewand, Gürtel,
 * Schild am linken Arm, das rechte Schwert weit über den Kopf gereckt.
 * Die Augen glühen nachts (windowMat). Zwei flankieren den Schlucht-Eingang.
 */
function buildColossus() {
  const stone = [], gold = [], windows = [], cape = [], flames = [];

  // Dreistufiger Sockel mit Goldband, Eck-Obelisken und Feuerschalen
  part(stone, new THREE.BoxGeometry(104, 16, 104), 0, 8, 0);
  part(stone, new THREE.BoxGeometry(84, 14, 84), 0, 23, 0);
  part(stone, new THREE.BoxGeometry(64, 12, 64), 0, 36, 0);
  part(gold, new THREE.BoxGeometry(66, 2.6, 66), 0, 31, 0);
  for (const [ox, oz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    part(stone, new THREE.BoxGeometry(9, 30, 9), ox * 46, 25, oz * 46);
    part(gold, new THREE.ConeGeometry(5.5, 9, 4), ox * 46, 44, oz * 46, 0, Math.PI / 4);
    // Feuerschale mit züngelnder Flamme (Kreuz-Quads, Shader-animiert)
    part(stone, new THREE.CylinderGeometry(6, 3.5, 4.5, 8), ox * 46, 51, oz * 46);
    part(flames, new THREE.PlaneGeometry(11, 20), ox * 46, 62, oz * 46);
    part(flames, new THREE.PlaneGeometry(11, 20), ox * 46, 62, oz * 46, 0, Math.PI / 2);
  }

  // Gegliederte Robe mit Goldsäumen
  part(stone, new THREE.CylinderGeometry(31, 42, 36, 12), 0, 60, 0);
  part(gold, new THREE.TorusGeometry(31.5, 2, 6, 16), 0, 77, 0, Math.PI / 2);
  part(stone, new THREE.CylinderGeometry(26, 32, 52, 12), 0, 103, 0);

  // Torso mit goldenem Brustpanzer und glühendem Emblem
  part(stone, new THREE.CylinderGeometry(21, 27, 62, 10), 0, 158, 0);
  part(gold, new THREE.BoxGeometry(36, 28, 7), 0, 170, -17);
  part(windows, roseGeo, 0, 170, -21.5, Math.PI / 2, 0, 0, 1.15);      // Emblem glüht nachts
  part(gold, new THREE.TorusGeometry(23, 3, 8, 16), 0, 130, 0, Math.PI / 2); // Gürtel
  part(gold, new THREE.BoxGeometry(11, 11, 4), 0, 128, -23);           // Schnalle

  // Pauldrons mit Goldringen
  for (const s of [-1, 1]) {
    part(stone, new THREE.SphereGeometry(15.5, 10, 8), s * 25, 192, 0, 0, 0, 0, 1, 0.78, 1);
    part(gold, new THREE.TorusGeometry(13, 1.8, 6, 14), s * 25, 185, 0, Math.PI / 2 - 0.3, 0, s * 0.3);
  }

  // Kopf: Gesicht, Nase, Bart und geflügelter Goldhelm
  part(stone, new THREE.SphereGeometry(12.5, 12, 10), 0, 216, 0);
  part(stone, new THREE.BoxGeometry(3.5, 6, 4), 0, 214, -12);
  part(stone, new THREE.ConeGeometry(7.5, 15, 8), 0, 202, -7, 0.35, 0, Math.PI);
  part(gold, new THREE.CylinderGeometry(13.2, 14.2, 9, 12), 0, 227, 0);
  part(gold, new THREE.SphereGeometry(13.2, 12, 8), 0, 231, 0, 0, 0, 0, 1, 0.55, 1);
  for (const s of [-1, 1]) {
    part(gold, new THREE.BoxGeometry(2.2, 17, 10), s * 14.5, 236, 2, 0.15, 0, s * 0.55); // Helmflügel
  }
  part(windows, windowGeo, -5, 218, -11.6, 0, 0, 0, 0.9);              // Augen
  part(windows, windowGeo, 5, 218, -11.6, 0, 0, 0, 0.9);

  // Linker Arm (abgewinkelt) trägt den Großschild vor dem Körper
  part(stone, new THREE.CylinderGeometry(7.5, 9.5, 36, 8), -31, 175, -4, 0.3, 0, 0.55);
  part(stone, new THREE.CylinderGeometry(6.5, 8, 32, 8), -41, 150, -16, 0.9, 0, 0.15);
  part(stone, new THREE.CylinderGeometry(25, 25, 5, 16), -43, 138, -30, Math.PI / 2 - 0.18);
  part(gold, new THREE.TorusGeometry(24, 2.6, 8, 18), -43, 138, -30, Math.PI / 2 - 0.18);
  part(gold, new THREE.SphereGeometry(6.5, 8, 6), -43, 139, -35, 0, 0, 0, 1, 1, 0.5);

  // Rechter Arm reckt das Runenschwert empor
  part(stone, new THREE.CylinderGeometry(7.5, 9.5, 36, 8), 31, 190, 0, 0, 0, -0.55);
  part(stone, new THREE.CylinderGeometry(6.5, 8, 34, 8), 44, 218, 0, 0, 0, -0.2);
  part(gold, new THREE.TorusGeometry(7.5, 1.6, 6, 12), 40, 208, 0, 0, 0, -0.2); // Armschiene
  part(stone, new THREE.SphereGeometry(9, 8, 6), 50, 238, 0);
  part(gold, new THREE.CylinderGeometry(2.6, 2.6, 15, 6), 50, 243, 0);
  part(gold, new THREE.BoxGeometry(28, 5, 8), 50, 253, 0);             // Parierstange
  part(gold, new THREE.SphereGeometry(4, 6, 5), 36, 253, 0);
  part(gold, new THREE.SphereGeometry(4, 6, 5), 64, 253, 0);
  part(gold, new THREE.BoxGeometry(10, 144, 4), 50, 328, 0);           // Klinge
  part(gold, new THREE.BoxGeometry(3, 144, 5.5), 50, 328, 0);          // Mittelgrat
  part(windows, new THREE.BoxGeometry(2.2, 128, 1), 50, 326, -2.8);    // Rune (glüht nachts)
  part(gold, new THREE.ConeGeometry(7, 24, 4), 50, 412, 0, 0, 0, 0, 1, 1, 0.42); // Spitze

  // Umhang (fällt hinter den Schultern bis zur Robe)
  part(cape, new THREE.BoxGeometry(44, 118, 4), 0, 152, 19, -0.08);
  part(cape, new THREE.BoxGeometry(50, 30, 5), 0, 200, 14, -0.2);

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(gold, goldMat),
                   meshFrom(windows, windowMat), meshFrom(cape, spireMat)]) if (m) g.add(m);
  const fl = new THREE.Mesh(mergeGeometries(flames), flameFxMat);
  g.add(fl);
  return g;
}

/** Natürlicher Felsbogen über der Schlucht — zum Durchfliegen. */
function buildRockArch() {
  const rock = [];
  part(rock, new THREE.TorusGeometry(150, 26, 8, 18, Math.PI), 0, 18, 0);
  part(rock, new THREE.BoxGeometry(44, 70, 48), -150, 12, 0, 0.1, 0.3, 0.12);
  part(rock, new THREE.BoxGeometry(48, 80, 44), 150, 16, 0, -0.08, 0.5, -0.1);
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 0.6;
    part(rock, new THREE.BoxGeometry(18, 14, 16),
      Math.cos(a) * 150, 18 + Math.sin(a) * 150, 4, a, a * 0.7, 0);
  }
  const g = new THREE.Group();
  const m = meshFrom(rock, mossMat);
  if (m) g.add(m);
  return g;
}

/** Riesen-Aquädukt: sieben Pfeiler mit Rundbögen und Fahrbahn — überspannt
 *  die Schlucht; die Bögen sind groß genug zum Durchfliegen. */
function buildAqueduct() {
  const stone = [];
  const n = 7, SP = 120;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * SP;
    part(stone, new THREE.BoxGeometry(18, 220, 26), x, 60, 0);
    if (i < n - 1) part(stone, new THREE.TorusGeometry(52, 9, 6, 12, Math.PI), x + SP / 2, 120, 0);
  }
  part(stone, new THREE.BoxGeometry(760, 18, 30), 0, 172, 0);   // Fahrbahn
  part(stone, new THREE.BoxGeometry(760, 7, 4), 0, 184, 14);    // Brüstungen
  part(stone, new THREE.BoxGeometry(760, 7, 4), 0, 184, -14);

  const g = new THREE.Group();
  const m = meshFrom(stone, stoneMat);
  if (m) g.add(m);
  return g;
}

/** Schwebende Insel: Grasplateau auf hängendem Felskegel, oben ein kleiner
 *  Steinkreis und Kiefern, über die Kante stürzt ein endloser Wasserfall. */
function buildFloatingIsle(r) {
  const g = new THREE.Group();
  const stone = [], rock = [], leaf = [], trunk = [];

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, 16, 14), grassMat);
  cap.position.y = -8;
  g.add(cap);
  part(rock, new THREE.ConeGeometry(r * 0.88, r * 1.6, 12), 0, -16 - r * 0.8, 0, Math.PI);
  for (let i = 0; i < 4; i++) { // Felsbrocken am Rand
    const a = i * 1.7 + r;
    const rs = r * 0.13;
    part(rock, new THREE.BoxGeometry(rs, rs, rs), Math.cos(a) * r * 0.9, 2, Math.sin(a) * r * 0.9, a, a * 0.6, 0);
  }

  // Steinkreis auf der Kuppe
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(stone, megalithGeo, Math.cos(a) * r * 0.4, 7.5, Math.sin(a) * r * 0.4, 0, a, 0, 1.2);
  }
  part(stone, lintelGeo, r * 0.4, 16, 0, 0, 0, 0, 1.2);

  // Kiefern
  for (const [tx, tz] of [[-r * 0.5, r * 0.3], [r * 0.25, -r * 0.5], [-r * 0.15, -r * 0.2]]) {
    part(trunk, new THREE.CylinderGeometry(2, 3.2, 18, 6), tx, 9, tz);
    part(leaf, new THREE.ConeGeometry(11, 26, 7), tx, 28, tz);
    part(leaf, new THREE.ConeGeometry(7.5, 20, 7), tx, 42, tz);
  }

  // Endloser Wasserfall über die Kante + Quellteich
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.28, 430), foamMat);
  fall.position.set(r * 0.72, -215, 0);
  fall.rotation.y = Math.PI / 2;
  g.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f6f9a, transparent: true, opacity: 0.85, roughness: 0.15 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(r * 0.42, 0.6, 0);
  g.add(pool);

  for (const m of [meshFrom(rock, mossMat), meshFrom(stone, stoneMat),
                   meshFrom(leaf, leafBMat), meshFrom(trunk, trunkMat)]) if (m) g.add(m);
  return g;
}

/** Urzeitlicher Riesenbaum (~250 Einheiten): mächtiger Stamm mit Wurzel-
 *  anläufen und einer weit ausladenden Wolkenkrone. */
function buildMegaTree() {
  const trunk = [], leafA = [], leafB = [];
  part(trunk, new THREE.CylinderGeometry(9, 19, 175, 10), 0, 87, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    part(trunk, new THREE.ConeGeometry(9, 60, 5),
      Math.cos(a) * 17, 24, Math.sin(a) * 17, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  part(leafA, new THREE.SphereGeometry(74, 10, 8), 0, 208, 0, 0, 0, 0, 1, 0.72, 1);
  part(leafB, new THREE.SphereGeometry(50, 9, 7), 52, 182, 28);
  part(leafB, new THREE.SphereGeometry(54, 9, 7), -46, 188, -22);
  part(leafA, new THREE.SphereGeometry(42, 8, 6), 22, 172, -50);
  part(leafB, new THREE.SphereGeometry(38, 8, 6), -26, 168, 46);

  const g = new THREE.Group();
  for (const m of [meshFrom(trunk, trunkMat), meshFrom(leafA, leafAMat),
                   meshFrom(leafB, leafBMat)]) if (m) g.add(m);
  return g;
}

/** Zinnenkranz aus skalierten Merlonen. */
function merlonRing(list, cx, cz, radius, y, count, s) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    part(list, merlonGeo, cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius, 0, a, 0, s);
  }
}

/**
 * Die ummauerte Stadt: Ringmauer mit zwölf Türmen und drei Tortürmen (Ost →
 * Spawn-Straße, Süd → Hafenweg, West → Burgstraße), Kathedrale mit Doppelturm-
 * fassade, Rosette und hohem Vierungsturm, Marktplatz mit Brunnen und bunten
 * Ständen sowie Häuserringe mit Gassen, die zu den Toren führen.
 */
function buildCity() {
  const stone = [], spire = [], wood = [], flag = [], cloth = [], gold = [];
  const plaster = [], roofV = [], windows = [];
  const R = CITY.r;
  const gates = [0, Math.PI / 2, Math.PI]; // Ost, Süd, West

  // Ringmauer mit Türmen und Zinnen; Segmente nahe eines Tors werden zum Torhaus
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tx = Math.cos(a) * R, tz = Math.sin(a) * R;
    part(stone, towerGeo, tx, 52, tz, 0, 0, 0, 1.0);
    merlonRing(stone, tx, tz, 14, 110, 10, 1.1);
    part(spire, watchSpireGeo, tx, 130, tz, 0, 0, 0, 1.1);

    const am = ((i + 0.5) / n) * Math.PI * 2;
    const wr = R * Math.cos(Math.PI / n);
    const wx = Math.cos(am) * wr, wz = Math.sin(am) * wr;
    const px = -Math.sin(am), pz = Math.cos(am); // Tangente
    const isGate = gates.some((g2) => Math.abs(Math.atan2(Math.sin(am - g2), Math.cos(am - g2))) < 0.28);
    if (isGate) {
      // Torhaus: zwei Tortürme mit Spitzen, Fahnen und Tor
      part(stone, gateTowerGeo, wx + px * 32, 40, wz + pz * 32, 0, 0, 0, 1.2);
      part(stone, gateTowerGeo, wx - px * 32, 40, wz - pz * 32, 0, 0, 0, 1.2);
      part(spire, spireGeo, wx + px * 32, 95, wz + pz * 32, 0, 0, 0, 0.85);
      part(spire, spireGeo, wx - px * 32, 95, wz - pz * 32, 0, 0, 0, 0.85);
      part(wood, poleGeo, wx + px * 32, 108, wz + pz * 32);
      part(flag, flagGeo, wx + px * 32 + 6.5, 113, wz + pz * 32);
      part(wood, gateGeo, wx, 19, wz, 0, -am + Math.PI / 2, 0, 1.3);
    } else {
      const chord = 2 * R * Math.sin(Math.PI / n);
      part(stone, wallGeo, wx, 16, wz, 0, -am + Math.PI / 2, 0, chord / 150, 0.9, 1.1);
      // Zinnenkranz entlang des Mauersegments
      for (let k = -3; k <= 3; k++) {
        const t = k * chord / 8;
        part(stone, merlonGeo, wx + px * t, 37, wz + pz * t, 0, -am + Math.PI / 2, 0, 1.3);
      }
    }
  }

  // Große Kathedrale im Norden des Stadtinnern
  part(stone, naveGeo, 0, 20, -230, 0, 0, 0, 3.2, 2.6, 3.2);            // Langhaus
  part(spire, ridgeGeo, 0, 56, -230, 0, 0, Math.PI / 4, 3.0, 3.0, 3.4);  // blaues Dach
  part(stone, naveGeo, 0, 17, -230, 0, Math.PI / 2, 0, 1.6, 2.2, 4.0);   // Querschiff
  for (const s of [-1, 1]) {
    part(stone, steepleGeo, s * 26, 54, -178, 0, 0, 0, 1.7, 3.6, 1.7);   // Doppelturm-Fassade
    part(spire, steepleSpireGeo, s * 26, 124, -178, 0, Math.PI / 4, 0, 2.1);
    part(gold, crossVGeo, s * 26, 148, -178, 0, 0, 0, 1.3);
    // Strebepfeiler mit Fialen entlang des Langhauses
    for (let b = 0; b < 4; b++) {
      const bz = -262 + b * 24;
      part(stone, new THREE.BoxGeometry(4, 22, 6), s * 34, 11, bz);
      part(spire, spireGeo, s * 34, 26, bz, 0, 0, 0, 0.28);
    }
  }
  part(stone, steepleGeo, 0, 74, -230, 0, 0, 0, 2.0, 4.8, 2.0);          // Vierungsturm
  part(spire, steepleSpireGeo, 0, 168, -230, 0, Math.PI / 4, 0, 3.0);
  part(gold, crossVGeo, 0, 202, -230, 0, 0, 0, 1.9);
  part(gold, crossHGeo, 0, 205, -230, 0, 0, 0, 1.9);
  part(gold, roseGeo, 0, 42, -176, Math.PI / 2, 0, 0, 1.9);              // Rosette
  // Seitenfenster des Langhauses (leuchten nachts)
  for (let b = 0; b < 4; b++) {
    part(windows, windowGeo, 34.5, 24, -262 + b * 24, 0, Math.PI / 2, 0, 2.2);
    part(windows, windowGeo, -34.5, 24, -262 + b * 24, 0, -Math.PI / 2, 0, 2.2);
  }

  // Marktplatz: Brunnen und bunte Marktstände
  part(stone, wellGeo, 0, 4, 60, 0, 0, 0, 1.6);
  part(spire, watchSpireGeo, 0, 13, 60, 0, 0, 0, 0.45);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const sx = Math.cos(a) * 95, sz = 60 + Math.sin(a) * 82;
    part(wood, houseDoorGeo, sx, 4, sz, 0, a, 0, 2.0, 1.3, 1.7);        // Tresen
    part(wood, poleGeo, sx - 7, 6, sz, 0, 0, 0, 0.85, 0.8, 0.85);
    part(wood, poleGeo, sx + 7, 6, sz, 0, 0, 0, 0.85, 0.8, 0.85);
    part(cloth, flagGeo, sx, 13.5, sz, -0.4, a + Math.PI / 2, 0, 1.5);   // Plane
  }

  // Häuserringe mit Gassen zu den Toren und freiem Marktplatz.
  // Häuser sind deutlich größer, teils dreigeschossig, mit Fachwerkbalken.
  const rings = [[150, 6], [245, 9], [340, 12], [450, 15]];
  let hi = 0;
  for (const [rr, count] of rings) {
    for (let k = 0; k < count; k++) {
      hi++;
      const a = ((k + hash(hi, rr) * 0.5) / count) * Math.PI * 2;
      // Gassen freihalten (zu den Toren) und Platz um Kathedrale/Markt
      if (gates.some((g2) => Math.abs(Math.atan2(Math.sin(a - g2), Math.cos(a - g2))) < 0.16)) continue;
      const hx = Math.cos(a) * (rr + (hash(hi + 3, rr) - 0.5) * 36);
      const hz = Math.sin(a) * (rr + (hash(hi + 7, rr) - 0.5) * 36);
      if (hz < -130 && Math.abs(hx) < 130) continue; // Kathedralen-Bezirk
      if (Math.hypot(hx, hz - 60) < 130) continue;   // Marktplatz

      const seed = hi * 13 + Math.round(rr);
      const pc = PCOLORS[seed % PCOLORS.length];
      const rc = RCOLORS[(seed * 7 + 2) % RCOLORS.length];
      const s = 1.35 + (seed % 4) * 0.18;
      const sy = s * (seed % 3 === 0 ? 1.7 : seed % 3 === 1 ? 1.3 : 1); // zwei-/dreigeschossig
      const rot = a + Math.PI / 2 + (hash(hi, hi) - 0.5) * 0.3;

      _o.position.set(hx, 6 * sy, hz); _o.rotation.set(0, rot, 0); _o.scale.set(s, sy, s); _o.updateMatrix();
      let g2 = houseWallGeo.clone(); g2.applyMatrix4(_o.matrix); tintGeo(g2, pc); plaster.push(g2);
      _o.position.set(hx, 12 * sy + 5.5 * s, hz); _o.rotation.set(0, rot + Math.PI / 4, 0); _o.scale.set(s, s, s); _o.updateMatrix();
      g2 = houseRoofGeo.clone(); g2.applyMatrix4(_o.matrix); tintGeo(g2, rc); roofV.push(g2);

      // Fachwerk: Querbalken zwischen den Geschossen + Türbalken
      const [bx2, bz2] = rotOff(rot, 0, 7.45 * s);
      part(wood, new THREE.BoxGeometry(11, 0.8, 0.6), hx + bx2, 8 * sy, hz + bz2, 0, rot, 0, s);
      part(wood, houseDoorGeo, hx + bx2, 3.4 * s, hz + bz2, 0, rot, 0, s);

      // Fenster unten und oben (leuchten nachts) + Kaminrauch
      for (const sideX of [3.2, -3.2]) {
        const [fx2, fz2] = rotOff(rot, sideX * s, 7.35 * s);
        part(windows, windowGeo, hx + fx2, 5.5 * sy, hz + fz2, 0, rot, 0, s);
        part(windows, windowGeo, hx + fx2, 9.6 * sy, hz + fz2, 0, rot, 0, s);
      }
      if (hi % 3 === 0) {
        SMOKE_SPOTS.push({ x: CITY.x + hx, y: CITY.groundH + 12 * sy + 6 * s, z: CITY.z + hz });
      }
    }
  }

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(spire, spireMat),
                   meshFrom(wood, woodMat), meshFrom(flag, flagMat),
                   meshFrom(cloth, clothMat), meshFrom(gold, goldMat),
                   meshFrom(plaster, villagePlasterMat), meshFrom(roofV, villageRoofMat),
                   meshFrom(windows, windowMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/** Fischerdorf an der Südküste: Hütten am Hang, Holzpier und Segelboote. */
function buildFishingVillage() {
  const stone = [], wood = [], cloth = [];
  const plaster = [], roofV = [];

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 1.6 + 2;
    const hx = Math.cos(a) * (55 + hash(i, 3) * 60);
    const hz = -40 + Math.sin(a) * 55 - hash(i, 9) * 40;
    const s = 0.6 + hash(i, 5) * 0.25;
    const rot = hash(i, 7) * 6.28;
    const pc = PCOLORS[(i * 3 + 1) % PCOLORS.length];
    const rc = RCOLORS[(i * 5 + 2) % RCOLORS.length];
    _o.position.set(hx, 6 * s, hz); _o.rotation.set(0, rot, 0); _o.scale.set(s, s, s); _o.updateMatrix();
    let g2 = houseWallGeo.clone(); g2.applyMatrix4(_o.matrix); tintGeo(g2, pc); plaster.push(g2);
    _o.position.set(hx, 17.5 * s, hz); _o.rotation.set(0, rot + Math.PI / 4, 0); _o.updateMatrix();
    g2 = houseRoofGeo.clone(); g2.applyMatrix4(_o.matrix); tintGeo(g2, rc); roofV.push(g2);
    // Die Dorf-Gruppe wird ×1,5 skaliert platziert → Rauchpunkte mitskalieren
    if (i % 2 === 0) SMOKE_SPOTS.push({ x: PORT.x + hx * 1.5, y: PORT.groundH + 20 * s * 1.5, z: PORT.z + hz * 1.5 });
  }

  // Pier: Plankensteg auf Pfählen hinaus ins Meer (+z = Süden)
  for (let i = 0; i < 7; i++) {
    part(wood, plankGeo, 14, -5.5, 70 + i * 25);
    part(wood, pierPostGeo, 11, -9, 62 + i * 25);
    part(wood, pierPostGeo, 17, -9, 62 + i * 25);
  }

  // Zwei vertäute Segelboote
  for (const [bx, bz, rot] of [[34, 205, 0.4], [-6, 228, -0.7]]) {
    part(wood, boatGeo, bx, -7.6, bz, 0, rot, 0);
    part(wood, poleGeo, bx, -1, bz, 0, 0, 0, 0.7);
    part(cloth, sailGeo, bx + 3, -1.5, bz, 0, rot + 1.2, 0);
  }

  const g = new THREE.Group();
  for (const m of [meshFrom(stone, stoneMat), meshFrom(wood, woodMat),
                   meshFrom(cloth, clothMat),
                   meshFrom(plaster, villagePlasterMat), meshFrom(roofV, villageRoofMat)]) {
    if (m) g.add(m);
  }
  return g;
}

/** Deterministischer Inhalt einer Rasterzelle: Dorf, Kleinbau oder nichts.
 *  Die handgestalteten Orte (Stadt, Burg, Vulkan, See, Hafen, Straßen)
 *  bleiben frei von Zufallsbauten. */
function buildCell(cx, cz) {
  const r = hash(cx * 7 + 3, cz * 13 + 5);
  const jx = (hash(cx, cz) - 0.5) * STRUCT_CELL * 0.45;
  const jz = (hash(cz, cx) - 0.5) * STRUCT_CELL * 0.45;
  const wx = cx * STRUCT_CELL + STRUCT_CELL / 2 + jx;
  const wz = cz * STRUCT_CELL + STRUCT_CELL / 2 + jz;

  // Ausschlusszonen der handgestalteten Welt
  if (distTo(wx, wz, CITY) < 1300 || distTo(wx, wz, CASTLE) < 1500 ||
      distTo(wx, wz, VOLCANO) < 3000 || distTo(wx, wz, PORT) < 800 ||
      distTo(wx, wz, LAKE) < 850 || roadDist(wx, wz) < 100 ||
      distTo(wx, wz, LIGHTHOUSE) < 500 || distTo(wx, wz, WATERFALL) < 600 ||
      distTo(wx, wz, CAVE) < 450 || distTo(wx, wz, SKELETON) < 400 ||
      canyonDist(wx, wz) < 380 || distTo(wx, wz, AQUEDUCT) < 500 ||
      COLOSSI.some((c) => distTo(wx, wz, c) < 350) ||
      MEGA_TREES.some((m) => distTo(wx, wz, m) < 220)) return null;

  // Kleinbau (×1,5 skaliert) mit Flachheits-/Höhenprüfung platzieren.
  const small = (builder, rad, maxDelta, minH, maxH) => {
    const f = flatEnough(wx, wz, rad, maxDelta);
    if (!f.ok || f.h < minH || f.h > maxH) return null;
    const g = builder();
    g.position.set(wx, f.h - 2, wz);
    g.rotation.y = hash(cx + 2, cz + 9) * 6.28;
    g.scale.setScalar(1.5);
    return g;
  };

  // In Felderzonen stehen höchstens Windmühlen
  if (inField(wx, wz)) {
    if (r < 0.2) return small(buildWindmill, 27, 55, 6, 300);
    return null;
  }

  if (r < 0.055) return small(buildChapel, 39, 65, 8, 360);
  if (r < 0.12) return small(buildWindmill, 27, 55, 6, 300);
  if (r < 0.18) return small(buildRuin, 36, 100, 10, 430);
  if (r < 0.23) return small(buildHenge, 45, 75, 8, 360);

  if (r < 0.52) {
    const count = 8 + Math.floor(hash(cx + 1, cz + 2) * 9);
    const houses = [];
    for (let i = 0; i < count; i++) {
      const a = hash(cx + i * 3, cz + i * 7) * 6.28;
      const rad = 26 + hash(cx + i, cz + i) * 150;
      const hx = wx + Math.cos(a) * rad, hz = wz + Math.sin(a) * rad;
      const f = flatEnough(hx, hz, 18, 32);
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
    this._rotors = new Set();    // drehende Teile (Mühlenflügel, Leuchtturmstrahl)
    this._floaters = [];         // schwebende Inseln (sanftes Auf und Ab)
    this._t = 0;
    this.nightLights = [];       // Fackel-/Marktlichter (Intensität steuert main.js)
  }

  /** Drehende Teile eines (Zellen- oder Landmarken-)Objekts registrieren. */
  _track(g) {
    g.userData.rotors?.forEach((r) => this._rotors.add(r));
  }

  /** Windmühlen, Leuchtturmstrahl und schwebende Inseln animieren. */
  animate(dt) {
    this._t += dt;
    for (const r of this._rotors) r.obj.rotation[r.axis] += r.speed * dt;
    for (const f of this._floaters) {
      f.obj.position.y = f.baseY + Math.sin(this._t * f.spd + f.phase) * f.amp;
      f.obj.rotation.y += dt * f.spin;
    }
  }

  /**
   * Die handgestalteten Landmarken einmalig aufbauen (nach dem Laden der
   * Insel-Karte aufrufen — die Höhen kommen aus der Heightmap). Sie bleiben
   * dauerhaft in der Szene und sind von clear()/update() nicht betroffen.
   */
  buildLandmarks() {
    const place = (g, x, y, z, ry = 0, s = 1) => {
      g.position.set(x, y, z);
      g.rotation.y = ry;
      g.scale.setScalar(s);
      this.root.add(g);
      this._track(g);
    };

    place(buildGrandCastle(), CASTLE.x, CASTLE.plateauH - 2, CASTLE.z, 0, 1.7);
    place(buildCity(), CITY.x, CITY.groundH - 2.5, CITY.z);
    place(buildFishingVillage(), PORT.x, PORT.groundH - 1, PORT.z, 0, 1.5);
    place(buildBridge(), BRIDGE.x, 0, BRIDGE.z, BRIDGE.rot, 1.35);
    place(buildLighthouse(), LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) - 1, LIGHTHOUSE.z, 0, 1.6);
    place(buildWreck(), WRECK.x, -4, WRECK.z, WRECK.rot, 1.5);
    place(buildCave(), CAVE.x, CAVE.shelfH - 1, CAVE.z, 0, 1.6);
    place(buildSkeleton(), SKELETON.x, heightAt(SKELETON.x, SKELETON.z) - 1, SKELETON.z, SKELETON.rot, 1.7);
    place(buildWaterfall(), WATERFALL.x, 0, WATERFALL.z);

    // Epische Landmarken am Spawn: Kolosse, Aquädukt, schwebende Inseln, Ahnenhain
    for (const c of COLOSSI) {
      place(buildColossus(), c.x, c.groundH - 2, c.z, Math.PI + c.rot, 1.1);
    }
    place(buildAqueduct(), AQUEDUCT.x, 0, AQUEDUCT.z, AQUEDUCT.rot);
    for (const a of ARCHES) place(buildRockArch(), a.x, 0, a.z, a.rot, a.s);
    for (let i = 0; i < FLOAT_ISLES.length; i++) {
      const f = FLOAT_ISLES[i];
      const isle = buildFloatingIsle(f.r);
      place(isle, f.x, f.y, f.z, i * 1.9);
      this._floaters.push({
        obj: isle, baseY: f.y, amp: 6 + f.r * 0.035,
        spd: 0.22 + (i % 3) * 0.07, phase: i * 2.4, spin: 0.008 + i * 0.004,
      });
    }
    for (const mt of MEGA_TREES) {
      place(buildMegaTree(), mt.x, heightAt(mt.x, mt.z) - 2, mt.z, mt.x * 0.01, mt.s);
    }

    // Nachtlichter: Marktplatz, Burghof, Hafen (main.js koppelt sie an uNight)
    const mkLight = (x, y, z, base, dist) => {
      const l = new THREE.PointLight(0xffa050, 0, dist);
      l.position.set(x, y, z);
      l.userData.base = base;
      this.root.add(l);
      this.nightLights.push(l);
    };
    mkLight(CITY.x, CITY.groundH + 26, CITY.z + 60, 5.5, 850);
    mkLight(CASTLE.x, CASTLE.plateauH + 30, CASTLE.z, 4, 500);
    mkLight(PORT.x, PORT.groundH + 14, PORT.z, 2.5, 320);
  }

  /** Alle aktiven Zufallsbauwerke entfernen (z. B. beim Neustart). */
  clear() {
    this._cells.forEach((g) => {
      if (g) {
        this.root.remove(g);
        g.userData.rotors?.forEach((r) => this._rotors.delete(r));
      }
    });
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
          if (g) {
            g.userData.cellX = cx * STRUCT_CELL + STRUCT_CELL / 2;
            g.userData.cellZ = cz * STRUCT_CELL + STRUCT_CELL / 2;
            this.root.add(g);
            this._track(g);
          }
          this._cells.set(key, g || null);
        }
      }
    }
    for (const [key, g] of this._cells) {
      if (!needed.has(key)) {
        if (g) {
          this.root.remove(g);
          g.userData.rotors?.forEach((r) => this._rotors.delete(r));
        }
        this._cells.delete(key);
      } else if (g) {
        // Distanz-Culling: Zufallsbauten jenseits des Dunsts nicht zeichnen
        // (die großen Landmarken bleiben immer sichtbar).
        const dx = g.userData.cellX - centerX;
        const dz = g.userData.cellZ - centerZ;
        g.visible = dx * dx + dz * dz < 4200 * 4200;
      }
    }
  }
}

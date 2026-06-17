// Dichte Mischwälder als instanzierte Meshes (Nadel- + Laubbäume). Bäume werden
// deterministisch pro Rasterzelle gesetzt, in Clustern (Wald-Dichtefeld) statt
// gleichmäßig. Die Laubfarbe variiert pro Baum nach Biom (Klima/Feuchte): kühle
// Nadelwälder, sattes Grün, trockenes Oliv — und in feuchten gemäßigten Zonen
// leuchtende Herbstwälder. Das Laub schwingt per TSL-Vertex-Wind.
import * as THREE from "three";
import { positionLocal, instanceIndex, hash as tslHash, time, vec3 } from "three/tsl";
import { WORLD, TREE_CELL, TREE_SPAN, TREE_COUNT } from "./config.js";
import { hash, valueNoise, heightAt, climateAt, moistureAt } from "./noise.js";

// Laub-Grundtöne (werden über Instanzfarbe pro Baum gesetzt)
const F_TAIGA = new THREE.Color(0x2c5236);
const F_TEMP = new THREE.Color(0x3f7a34);
const F_DRY = new THREE.Color(0x6e7a39);
const F_DARK = new THREE.Color(0x244b21);
const A_RED = new THREE.Color(0xa8381c);
const A_ORANGE = new THREE.Color(0xce771d);
const A_GOLD = new THREE.Color(0xcaa92f);

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Laubfarbe eines Baums (Biom + Herbst + Streuung) in `out`. */
function foliageColor(out, x, z, r1, r2) {
  const climate = climateAt(x, z);
  const moisture = moistureAt(x, z);

  // kühl → gemäßigt → trocken
  out.copy(F_TAIGA).lerp(F_TEMP, sstep(climate, 0.15, 0.45));
  out.lerp(F_DRY, sstep(climate, 0.62, 0.9));
  out.lerp(F_DARK, r1 * 0.4); // Helligkeitsstreuung pro Baum

  // Herbst: feuchte, gemäßigte Regionen; einzelne Bäume leuchten auf
  const autumn = sstep(moisture, 0.42, 0.7) * (1 - sstep(climate, 0.55, 0.82)) * sstep(climate, 0.18, 0.4);
  if (r2 < autumn * 1.3) {
    const a = r1 < 0.4 ? A_RED : r1 < 0.75 ? A_ORANGE : A_GOLD;
    out.lerp(a, 0.85);
  }
}

/** Belaubtes Material (weiß; echte Farbe kommt aus der Instanzfarbe) mit Windschwung. */
function foliageMaterial(windAmp) {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 });
  const phase = tslHash(instanceIndex.toFloat()).mul(6.2832);
  const t = time.mul(1.5).add(phase);
  const up = positionLocal.y.max(0.0);
  const swayX = t.sin().mul(up).mul(windAmp);
  const swayZ = t.add(1.7).sin().mul(up).mul(windAmp * 0.7);
  m.positionNode = positionLocal.add(vec3(swayX, 0, swayZ));
  return m;
}

export class Trees {
  constructor(scene) {
    const trunkMat = new THREE.MeshStandardNodeMaterial({ color: 0x6a4a2c, flatShading: true, roughness: 0.95 });
    const pineMat = foliageMaterial(0.09);
    const broadMat = foliageMaterial(0.07);

    this._pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 2.2, 12, 5), trunkMat, TREE_COUNT);
    this._pineLow = new THREE.InstancedMesh(new THREE.ConeGeometry(10, 22, 6), pineMat, TREE_COUNT);
    this._pineTop = new THREE.InstancedMesh(new THREE.ConeGeometry(6.5, 18, 6), pineMat, TREE_COUNT);

    this._broadTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.7, 2.6, 14, 5), trunkMat, TREE_COUNT);
    this._broadCanopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(13, 1), broadMat, TREE_COUNT);

    this._pine = [this._pineTrunk, this._pineLow, this._pineTop];
    this._broad = [this._broadTrunk, this._broadCanopy];
    // Foliage-Meshes bekommen pro Instanz eine Farbe.
    this._pineFoliage = [this._pineLow, this._pineTop];
    [...this._pine, ...this._broad].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
    });
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
  }

  /** Wald für einen neuen Weltmittelpunkt verteilen (in Clustern, mit Biomfarben). */
  place(centerX, centerZ) {
    const d = this._dummy;
    const col = this._col;
    const startX = Math.floor((centerX - WORLD / 2) / TREE_CELL);
    const startZ = Math.floor((centerZ - WORLD / 2) / TREE_CELL);
    let pineN = 0;
    let broadN = 0;

    for (let cx = 0; cx < TREE_SPAN; cx++) {
      for (let cz = 0; cz < TREE_SPAN; cz++) {
        const gx = startX + cx;
        const gz = startZ + cz;
        const wx = gx * TREE_CELL + (hash(gx, gz) - 0.5) * TREE_CELL * 0.9;
        const wz = gz * TREE_CELL + (hash(gz, gx) - 0.5) * TREE_CELL * 0.9;
        const h = heightAt(wx, wz);
        if (h <= 4 || h >= 350) continue;

        const density = valueNoise(wx / 1300 + 100, wz / 1300 - 40);
        if (hash(gx * 2 + 1, gz * 2 + 7) > density * 1.05 - 0.05) continue;

        const s = 0.7 + hash(gx + 5, gz + 9) * 0.95;
        d.rotation.set(0, hash(gx + 3, gz + 8) * 6.2832, 0);
        d.scale.set(s, s, s);
        foliageColor(col, wx, wz, hash(gx + 17, gz + 4), hash(gx + 6, gz + 23));

        const broad = h < 235 && hash(gx + 11, gz + 4) < 0.4;
        if (broad) {
          d.position.set(wx, h + 7 * s, wz); d.updateMatrix(); this._broadTrunk.setMatrixAt(broadN, d.matrix);
          d.position.set(wx, h + 22 * s, wz); d.updateMatrix(); this._broadCanopy.setMatrixAt(broadN, d.matrix);
          this._broadCanopy.setColorAt(broadN, col);
          broadN++;
        } else {
          d.position.set(wx, h + 6 * s, wz); d.updateMatrix(); this._pineTrunk.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 18 * s, wz); d.updateMatrix(); this._pineLow.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 30 * s, wz); d.updateMatrix(); this._pineTop.setMatrixAt(pineN, d.matrix);
          this._pineLow.setColorAt(pineN, col);
          this._pineTop.setColorAt(pineN, col);
          pineN++;
        }
      }
    }

    this._pine.forEach((m) => { m.count = pineN; m.instanceMatrix.needsUpdate = true; });
    this._broad.forEach((m) => { m.count = broadN; m.instanceMatrix.needsUpdate = true; });
    this._pineFoliage.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    if (this._broadCanopy.instanceColor) this._broadCanopy.instanceColor.needsUpdate = true;
  }
}

// Dichte Mischwälder als instanzierte Meshes (Nadel- + Laubbäume). Bäume werden
// deterministisch pro Rasterzelle gesetzt, in Clustern (Wald-Dichtefeld) statt
// gleichmäßig. Die Laubfarbe variiert pro Baum nach Biom (Klima/Feuchte): kühle
// Nadelwälder, sattes Grün, trockenes Oliv — und in feuchten gemäßigten Zonen
// leuchtende Herbstwälder. Das Laub schwingt per TSL-Vertex-Wind.
import * as THREE from "three";
import {
  positionLocal, instanceIndex, hash as tslHash, time, vec3, uv, color, mix,
  float, smoothstep, triNoise3D,
} from "three/tsl";
import { WORLD, TREE_CELL, TREE_SPAN, TREE_COUNT } from "./config.js";
import { hash, valueNoise, heightAt, climateAt, moistureAt } from "./noise.js";
import { camera } from "./scene.js";
import { roadDist, inField, forestBoost, distTo, VOLCANO, CITY, CASTLE, PORT, COLOSSI } from "./world.js";

// Laub-Grundtöne (werden über Instanzfarbe pro Baum gesetzt)
const F_TAIGA = new THREE.Color(0x2c5236);
const F_TEMP = new THREE.Color(0x3f7a34);
const F_DRY = new THREE.Color(0x6e7a39);
const F_DARK = new THREE.Color(0x244b21);
const A_RED = new THREE.Color(0xa8381c);
const A_ORANGE = new THREE.Color(0xce771d);
const A_GOLD = new THREE.Color(0xcaa92f);

// ---- Baumbrand ----
const BURN_TIME = 7.0;                       // Sekunden bis verkohlt
const EMBER = new THREE.Color(0xff4d12);     // Glut
const EMBER_HOT = new THREE.Color(0xffb733); // helle, heiße Flamme
const CHAR = new THREE.Color(0x171210);      // verkohlt
const FLAME_POOL = 48;                       // max. gleichzeitige Flammen-Billboards

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
  // Selbstabschattung gefaked: Kronenunterseite dunkler → mehr Tiefe im Wald.
  m.aoNode = positionLocal.y.mul(0.045).add(0.72).clamp(0.55, 1.0);
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
    // Nur je eine Krone pro Baumtyp wirft Schatten — Stämme und obere
    // Nadelkronen liegen ohnehin im Kronenschatten, kosten aber einen
    // vollen Instanz-Durchlauf im Schatten-Pass.
    this._pineLow.castShadow = true;
    this._broadCanopy.castShadow = true;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._tmpCol = new THREE.Color();

    // Pro-Baum-Daten für Brand (Position, Laub-Slot, Brandzustand)
    this._trees = [];
    this._buildFlamePool(scene);
  }

  /** Pool aus prozeduralen Flammen-Billboards (Shader-Feuer + Rauchfahne). */
  _buildFlamePool(scene) {
    // Flammen-Shader auf einem Quad: nach oben schmaler werdende Zunge,
    // deren Ränder von aufsteigendem Noise zerfressen werden. Der Kern ist
    // HDR-hell (Bloom), die Spitzen laufen ins Rot aus.
    const flameMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      side: THREE.DoubleSide,
    });
    {
      const u = uv();
      const x = u.x.sub(0.5).mul(2.0); // -1 … 1
      const n = triNoise3D(vec3(u.x.mul(2.2), u.y.mul(2.8).sub(time.mul(1.5)), 3.7), 0.35, time);
      const shape = float(1.0)
        .sub(x.abs().mul(u.y.mul(1.6).add(0.9))) // oben schmaler
        .sub(u.y.mul(0.55))
        .add(n.sub(0.5).mul(1.2));
      const alpha = smoothstep(0.06, 0.5, shape);
      const heat = smoothstep(0.25, 0.95, shape);
      flameMat.colorNode = mix(color(0xc42804), mix(color(0xff7a10).mul(1.6), color(0xffe9a0).mul(3.5), heat), smoothstep(0.1, 0.5, shape));
      flameMat.opacityNode = alpha;
    }
    const flameGeo = new THREE.PlaneGeometry(24, 46);

    // Rauch: weiche, aufsteigend scrollende Noise-Scheibe über der Flamme.
    const smokeMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    {
      const p = uv().sub(0.5);
      const r = p.length().mul(2.0);
      const n = triNoise3D(vec3(uv().x.mul(2.0), uv().y.mul(2.4).sub(time.mul(0.5)), 8.9), 0.2, time);
      const disk = float(1.0).sub(smoothstep(0.15, 1.0, r));
      smokeMat.opacityNode = disk.mul(n.mul(0.8).add(0.2)).saturate().mul(0.42);
      smokeMat.colorNode = mix(color(0x3b3733), color(0x8d8880), uv().y);
    }
    const smokeGeo = new THREE.PlaneGeometry(34, 80);

    this._flames = [];
    for (let i = 0; i < FLAME_POOL; i++) {
      const g = new THREE.Group();
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.y = 14;
      g.add(f);
      const s = new THREE.Mesh(smokeGeo, smokeMat);
      s.position.y = 66;
      g.add(s);
      g.visible = false;
      g.frustumCulled = false;
      scene.add(g);
      this._flames.push(g);
    }
  }

  /** Wald für einen neuen Weltmittelpunkt verteilen (in Clustern, mit Biomfarben). */
  place(centerX, centerZ) {
    const d = this._dummy;
    const col = this._col;
    const startX = Math.floor((centerX - WORLD / 2) / TREE_CELL);
    const startZ = Math.floor((centerZ - WORLD / 2) / TREE_CELL);
    let pineN = 0;
    let broadN = 0;

    // Brand-Zustand zurücksetzen (Welt wird neu aufgebaut).
    this._trees.length = 0;
    for (const g of this._flames) g.visible = false;

    for (let cx = 0; cx < TREE_SPAN; cx++) {
      for (let cz = 0; cz < TREE_SPAN; cz++) {
        const gx = startX + cx;
        const gz = startZ + cz;
        const wx = gx * TREE_CELL + (hash(gx, gz) - 0.5) * TREE_CELL * 0.9;
        const wz = gz * TREE_CELL + (hash(gz, gx) - 0.5) * TREE_CELL * 0.9;
        const h = heightAt(wx, wz);
        if (h <= 4 || h >= 350) continue;

        // Handgestaltete Welt freihalten: Straßen, Felder, Stadt, Burgplateau,
        // Hafen und die Aschehänge des Vulkans bleiben baumfrei.
        if (roadDist(wx, wz) < 34) continue;
        if (inField(wx, wz)) continue;
        if (distTo(wx, wz, CITY) < CITY.r + 130) continue;
        if (distTo(wx, wz, CASTLE) < CASTLE.plateauR + 220) continue;
        if (distTo(wx, wz, PORT) < 330) continue;
        if (distTo(wx, wz, VOLCANO) < 2200) continue;
        if (COLOSSI.some((c) => distTo(wx, wz, c) < 190)) continue;

        // Dichtefeld, global angehoben und in Waldzonen nochmals verstärkt
        const density = Math.min(valueNoise(wx / 1300 + 100, wz / 1300 - 40) * 1.18 * forestBoost(wx, wz), 1);
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
          this._trees.push({ x: wx, y: h + 22 * s, z: wz, type: "broad", slot: broadN, r: col.r, g: col.g, b: col.b, burn: 0, charred: false });
          broadN++;
        } else {
          d.position.set(wx, h + 6 * s, wz); d.updateMatrix(); this._pineTrunk.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 18 * s, wz); d.updateMatrix(); this._pineLow.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 30 * s, wz); d.updateMatrix(); this._pineTop.setMatrixAt(pineN, d.matrix);
          this._pineLow.setColorAt(pineN, col);
          this._pineTop.setColorAt(pineN, col);
          this._trees.push({ x: wx, y: h + 24 * s, z: wz, type: "pine", slot: pineN, r: col.r, g: col.g, b: col.b, burn: 0, charred: false });
          pineN++;
        }
      }
    }

    this._pine.forEach((m) => { m.count = pineN; m.instanceMatrix.needsUpdate = true; });
    this._broad.forEach((m) => { m.count = broadN; m.instanceMatrix.needsUpdate = true; });
    this._pineFoliage.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    if (this._broadCanopy.instanceColor) this._broadCanopy.instanceColor.needsUpdate = true;
  }

  /**
   * Entzündet Bäume in einem Kegel (Drachen-Flammenstrahl).
   * @param {THREE.Vector3} origin  Mündung
   * @param {THREE.Vector3} dir     Flammenrichtung (normiert)
   * @param {number} length         Reichweite
   * @param {number} cosHalf        cos des halben Öffnungswinkels
   */
  igniteCone(origin, dir, length, cosHalf) {
    for (const t of this._trees) {
      if (t.charred || t.burn > 0) continue;
      const vx = t.x - origin.x, vy = t.y - origin.y, vz = t.z - origin.z;
      const proj = vx * dir.x + vy * dir.y + vz * dir.z;
      if (proj < 10 || proj > length) continue;
      const dist = Math.hypot(vx, vy, vz);
      if (dist < 1 || proj / dist < cosHalf) continue;
      t.burn = BURN_TIME * (0.8 + Math.random() * 0.4);
    }
  }

  /** Brennende Bäume animieren: Laub glüht, verkohlt; Flammen-Billboards setzen. */
  update(dt, tnow) {
    const col = this._tmpCol;
    let dirtyPine = false, dirtyBroad = false, flameIdx = 0;

    for (const t of this._trees) {
      if (t.burn <= 0) continue;
      t.burn -= dt;
      const f = clamp01(t.burn / BURN_TIME); // 1 frisch .. 0 fertig

      if (t.burn > 0) {
        const flick = 0.6 + 0.4 * Math.sin(tnow * 22 + t.x * 0.13);
        col.copy(EMBER).lerp(EMBER_HOT, flick);
        col.lerp(CHAR, 1 - sstep(0.0, 0.3, f)); // gegen Ende verkohlen
      } else {
        t.burn = 0; t.charred = true;
        col.copy(CHAR);
      }

      if (t.type === "pine") {
        this._pineLow.setColorAt(t.slot, col);
        this._pineTop.setColorAt(t.slot, col);
        dirtyPine = true;
      } else {
        this._broadCanopy.setColorAt(t.slot, col);
        dirtyBroad = true;
      }

      if (t.burn > 0 && flameIdx < FLAME_POOL) {
        const g = this._flames[flameIdx++];
        g.visible = true;
        g.position.set(t.x, t.y, t.z);
        const grow = 0.7 + 0.8 * f;
        g.scale.set(
          grow * (0.9 + 0.15 * Math.sin(tnow * 15 + t.x)),
          grow * (1.0 + 0.25 * Math.sin(tnow * 19 + t.z)),
          grow
        );
        g.quaternion.copy(camera.quaternion); // Billboard zur Kamera
      }
    }

    for (let i = flameIdx; i < FLAME_POOL; i++) this._flames[i].visible = false;
    if (dirtyPine) this._pineFoliage.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    if (dirtyBroad && this._broadCanopy.instanceColor) this._broadCanopy.instanceColor.needsUpdate = true;
  }
}

// Dichte Mischwälder als instanzierte Meshes (Nadel- + Laubbäume). Bäume werden
// deterministisch pro Rasterzelle gesetzt, in Clustern (Wald-Dichtefeld) statt
// gleichmäßig, und bleiben beim Nachziehen der Welt stabil. Das Laub schwingt
// per TSL-Vertex-Wind (positionNode), seitlich zunehmend zur Baumspitze.
import * as THREE from "three";
import { positionLocal, instanceIndex, hash as tslHash, time, vec3 } from "three/tsl";
import { WORLD, TREE_CELL, TREE_SPAN, TREE_COUNT } from "./config.js";
import { hash, valueNoise, heightAt } from "./noise.js";

/** Belaubtes Material mit sanftem Windschwung (oben stärker als unten). */
function foliageMaterial(hex, windAmp) {
  const m = new THREE.MeshStandardNodeMaterial({ color: hex, flatShading: true, roughness: 0.92 });
  const phase = tslHash(instanceIndex.toFloat()).mul(6.2832); // pro Baum versetzt
  const t = time.mul(1.5).add(phase);
  const up = positionLocal.y.max(0.0); // nur Krone (oberhalb des Geometriezentrums) schwingt
  const swayX = t.sin().mul(up).mul(windAmp);
  const swayZ = t.add(1.7).sin().mul(up).mul(windAmp * 0.7);
  m.positionNode = positionLocal.add(vec3(swayX, 0, swayZ));
  return m;
}

export class Trees {
  constructor(scene) {
    const trunkMat = new THREE.MeshStandardNodeMaterial({ color: 0x6a4a2c, flatShading: true, roughness: 0.95 });
    const pineMat = foliageMaterial(0x2c5a2e, 0.09);
    const broadMat = foliageMaterial(0x4f7a32, 0.07);

    // Nadelbaum: Stamm + zwei Kegel
    this._pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 2.2, 12, 5), trunkMat, TREE_COUNT);
    this._pineLow = new THREE.InstancedMesh(new THREE.ConeGeometry(10, 22, 6), pineMat, TREE_COUNT);
    this._pineTop = new THREE.InstancedMesh(new THREE.ConeGeometry(6.5, 18, 6), pineMat, TREE_COUNT);

    // Laubbaum: Stamm + runde Krone
    this._broadTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.7, 2.6, 14, 5), trunkMat, TREE_COUNT);
    this._broadCanopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(13, 1), broadMat, TREE_COUNT);

    this._pine = [this._pineTrunk, this._pineLow, this._pineTop];
    this._broad = [this._broadTrunk, this._broadCanopy];
    [...this._pine, ...this._broad].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; // Instanzen decken die ganze Welt ab
      scene.add(m);
    });
    this._dummy = new THREE.Object3D();
  }

  /** Wald für einen neuen Weltmittelpunkt verteilen (in Clustern). */
  place(centerX, centerZ) {
    const d = this._dummy;
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
        if (h <= 4 || h >= 350) continue; // kein Baum im Wasser oder auf Gipfeln

        // Wald-Dichtefeld: glatte Cluster (Wälder) mit Lichtungen dazwischen.
        const density = valueNoise(wx / 1300 + 100, wz / 1300 - 40);
        if (hash(gx * 2 + 1, gz * 2 + 7) > density * 1.05 - 0.05) continue;

        const s = 0.7 + hash(gx + 5, gz + 9) * 0.95;
        d.rotation.set(0, hash(gx + 3, gz + 8) * 6.2832, 0);
        d.scale.set(s, s, s);

        // Laubbäume nur in tieferen Lagen und seltener als Nadelbäume.
        const broad = h < 235 && hash(gx + 11, gz + 4) < 0.4;
        if (broad) {
          d.position.set(wx, h + 7 * s, wz); d.updateMatrix(); this._broadTrunk.setMatrixAt(broadN, d.matrix);
          d.position.set(wx, h + 22 * s, wz); d.updateMatrix(); this._broadCanopy.setMatrixAt(broadN, d.matrix);
          broadN++;
        } else {
          d.position.set(wx, h + 6 * s, wz); d.updateMatrix(); this._pineTrunk.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 18 * s, wz); d.updateMatrix(); this._pineLow.setMatrixAt(pineN, d.matrix);
          d.position.set(wx, h + 30 * s, wz); d.updateMatrix(); this._pineTop.setMatrixAt(pineN, d.matrix);
          pineN++;
        }
      }
    }

    // Nur die tatsächlich gefüllten Instanzen zeichnen.
    this._pine.forEach((m) => { m.count = pineN; m.instanceMatrix.needsUpdate = true; });
    this._broad.forEach((m) => { m.count = broadN; m.instanceMatrix.needsUpdate = true; });
  }
}

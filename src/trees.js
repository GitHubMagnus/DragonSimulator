// Tannenwälder als instanzierte Meshes. Bäume werden deterministisch pro
// Rasterzelle gesetzt, damit sie beim Nachziehen der Welt stabil bleiben.
import * as THREE from "three";
import { WORLD, TREE_CELL, TREE_SPAN, TREE_COUNT } from "./config.js";
import { hash, heightAt } from "./noise.js";

const HIDDEN = new THREE.Vector3(1e-4, 1e-4, 1e-4);

export class Trees {
  constructor(scene) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, flatShading: true });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x2c5a2e, flatShading: true });

    this._trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 2.2, 12, 5), trunkMat, TREE_COUNT);
    this._low = new THREE.InstancedMesh(new THREE.ConeGeometry(10, 22, 6), pineMat, TREE_COUNT);
    this._top = new THREE.InstancedMesh(new THREE.ConeGeometry(6.5, 18, 6), pineMat, TREE_COUNT);
    this._layers = [this._trunks, this._low, this._top];
    this._layers.forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    });
    this._dummy = new THREE.Object3D();
  }

  /** Bäume für einen neuen Weltmittelpunkt verteilen. */
  place(centerX, centerZ) {
    const d = this._dummy;
    const startX = Math.floor((centerX - WORLD / 2) / TREE_CELL);
    const startZ = Math.floor((centerZ - WORLD / 2) / TREE_CELL);
    let n = 0;

    for (let cx = 0; cx < TREE_SPAN; cx++) {
      for (let cz = 0; cz < TREE_SPAN; cz++) {
        const gx = startX + cx, gz = startZ + cz;
        const r = hash(gx * 2 + 1, gz * 2 + 7);
        const wx = gx * TREE_CELL + (hash(gx, gz) - 0.5) * TREE_CELL * 0.85;
        const wz = gz * TREE_CELL + (hash(gz, gx) - 0.5) * TREE_CELL * 0.85;
        const h = heightAt(wx, wz);

        if (r < 0.5 && h > 5 && h < 360) {
          const s = 0.7 + hash(gx + 5, gz + 9) * 1.0;
          d.rotation.set(0, r * 6.28, 0);
          d.scale.set(s, s, s);
          d.position.set(wx, h + 6 * s, wz); d.updateMatrix(); this._trunks.setMatrixAt(n, d.matrix);
          d.position.set(wx, h + 18 * s, wz); d.updateMatrix(); this._low.setMatrixAt(n, d.matrix);
          d.position.set(wx, h + 30 * s, wz); d.updateMatrix(); this._top.setMatrixAt(n, d.matrix);
        } else {
          d.position.set(0, -1e5, 0);
          d.scale.copy(HIDDEN);
          d.updateMatrix();
          this._layers.forEach((m) => m.setMatrixAt(n, d.matrix));
        }
        n++;
      }
    }
    this._layers.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }
}

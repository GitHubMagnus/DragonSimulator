// Blumenwiesen: instanzierte Kreuz-Sprites in bunten Tupfern, nur dort, wo
// niederfrequentes Noise Wiesenflecken ausweist (nicht auf Feldern, Straßen
// oder in Wäldern mit hoher Dichte). Wird wie die Bäume pro Weltmittelpunkt
// neu verteilt.
import * as THREE from "three";
import { WORLD } from "./config.js";
import { hash, valueNoise, heightAt } from "./noise.js";
import { roadDist, inField, distTo, CITY, CASTLE, VOLCANO, PORT } from "./world.js";

const CELL = 42;
const SPAN = Math.round(WORLD / CELL);
const MAX = SPAN * SPAN;
const COLORS = [0xffe08a, 0xff9ab5, 0xf2f0e8, 0x9ab8ff, 0xffb347].map((c) => new THREE.Color(c));

export class Flowers {
  constructor(scene) {
    // Kreuz aus zwei Quads als Blütenbüschel
    const p1 = new THREE.PlaneGeometry(1.8, 1.4);
    const p2 = p1.clone();
    p2.rotateY(Math.PI / 2);
    const geo = new THREE.BufferGeometry();
    const merged = [p1, p2];
    // einfache manuelle Zusammenführung (beide non-indexed, gleiche Attribute)
    const pos = [], uv2 = [], idx = [];
    let base = 0;
    for (const g of merged) {
      pos.push(...g.attributes.position.array);
      uv2.push(...g.attributes.uv.array);
      for (const i of g.index.array) idx.push(i + base);
      base += g.attributes.position.count;
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv2, 2));
    geo.setIndex(idx);

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 });
    this._mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this._mesh.frustumCulled = false;
    scene.add(this._mesh);
    this._dummy = new THREE.Object3D();

    // Findlinge: graue Felsbrocken, verstreut auf Wiesen und Hängen
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a857c, flatShading: true, roughness: 1 });
    this._rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.6, 0), rockMat, 1400);
    this._rocks.frustumCulled = false;
    this._rocks.castShadow = true;
    scene.add(this._rocks);
  }

  /** Blumen und Findlinge für einen neuen Weltmittelpunkt verteilen. */
  place(centerX, centerZ) {
    const d = this._dummy;
    const startX = Math.floor((centerX - WORLD / 2) / CELL);
    const startZ = Math.floor((centerZ - WORLD / 2) / CELL);
    let n = 0;
    let nr = 0;

    for (let cx = 0; cx < SPAN; cx++) {
      for (let cz = 0; cz < SPAN; cz++) {
        const gx = startX + cx;
        const gz = startZ + cz;
        const wx = gx * CELL + (hash(gx, gz + 55) - 0.5) * CELL;
        const wz = gz * CELL + (hash(gz + 3, gx + 9) - 0.5) * CELL;

        // Findlinge: dünn gestreut, auch im Hügelland
        if (nr < 1400 && hash(gx + 61, gz + 44) < 0.035) {
          const h = heightAt(wx, wz);
          if (h > 6 && h < 420 && roadDist(wx, wz) > 26 && !inField(wx, wz) &&
              distTo(wx, wz, CITY) > 640 && distTo(wx, wz, CASTLE) > 480) {
            const s = 0.7 + hash(gx + 5, gz + 66) * 2.4;
            d.position.set(wx, h + 0.4 * s, wz);
            d.rotation.set(hash(gx, gz + 1) * 3, hash(gx + 2, gz) * 3, 0);
            d.scale.set(s, s * (0.6 + hash(gx + 4, gz + 8) * 0.5), s);
            d.updateMatrix();
            this._rocks.setMatrixAt(nr++, d.matrix);
          }
        }

        // Wiesenflecken-Maske zuerst (billig), dann die teureren Prüfungen
        if (valueNoise(wx * 0.0045 + 7, wz * 0.0045 - 3) < 0.62) continue;
        if (hash(gx + 21, gz + 34) < 0.25) continue;
        const h = heightAt(wx, wz);
        if (h < 6 || h > 150) continue;
        if (inField(wx, wz) || roadDist(wx, wz) < 22) continue;
        if (distTo(wx, wz, CITY) < 700 || distTo(wx, wz, CASTLE) < 520 ||
            distTo(wx, wz, VOLCANO) < 2400 || distTo(wx, wz, PORT) < 400) continue;

        const s = 0.8 + hash(gx + 7, gz + 2) * 1.1;
        d.position.set(wx, h + 0.7 * s, wz);
        d.rotation.set(0, hash(gx, gz) * 3.14, 0);
        d.scale.setScalar(s);
        d.updateMatrix();
        this._mesh.setMatrixAt(n, d.matrix);
        this._mesh.setColorAt(n, COLORS[Math.floor(hash(gx + 13, gz + 27) * COLORS.length)]);
        n++;
      }
    }

    this._mesh.count = n;
    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;
    this._rocks.count = nr;
    this._rocks.instanceMatrix.needsUpdate = true;
  }
}

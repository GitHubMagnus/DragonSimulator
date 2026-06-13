// Endloses Low-Poly-Terrain. Das Mesh wird um den Spieler herum versetzt
// und seine Höhen/Farben werden neu berechnet (siehe rebuild()).
import * as THREE from "three";
import { WORLD, SEG } from "./config.js";
import { heightAt } from "./noise.js";

const C_SAND = new THREE.Color(0xcfbd8e);
const C_GRASS = new THREE.Color(0x5f9248);
const C_GRASS2 = new THREE.Color(0x3c6b30);
const C_ROCK = new THREE.Color(0x756d61);
const C_ROCK_HI = new THREE.Color(0x9a8f80);
const C_SNOW = new THREE.Color(0xfbfdff);
const _c = new THREE.Color();

/** Geländefarbe nach Höhe: Sand → Wiese → Fels → Schnee. */
function colorForHeight(h) {
  if (h < 2.5) return _c.copy(C_SAND);
  if (h < 160) return _c.copy(C_GRASS).lerp(C_GRASS2, h / 160);
  if (h < 330) return _c.copy(C_GRASS2).lerp(C_ROCK, (h - 160) / 170);
  if (h < 470) return _c.copy(C_ROCK).lerp(C_ROCK_HI, (h - 330) / 140);
  if (h < 560) return _c.copy(C_ROCK_HI).lerp(C_SNOW, (h - 470) / 90);
  return _c.copy(C_SNOW);
}

export class Terrain {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    this._pos = geo.attributes.position;
    this._count = this._pos.count;
    // Lokale x/z merken — sie ändern sich beim Nachziehen nicht.
    this._localX = new Float32Array(this._count);
    this._localZ = new Float32Array(this._count);
    for (let i = 0; i < this._count; i++) {
      this._localX[i] = this._pos.getX(i);
      this._localZ[i] = this._pos.getZ(i);
    }
    this._color = new THREE.BufferAttribute(new Float32Array(this._count * 3), 3);
    geo.setAttribute("color", this._color);

    this._geo = geo;
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })
    );
    scene.add(this.mesh);
  }

  /** Höhen und Farben für einen neuen Weltmittelpunkt neu berechnen. */
  rebuild(centerX, centerZ) {
    for (let i = 0; i < this._count; i++) {
      const h = heightAt(this._localX[i] + centerX, this._localZ[i] + centerZ);
      this._pos.setY(i, h);
      const c = colorForHeight(h);
      this._color.setXYZ(i, c.r, c.g, c.b);
    }
    this._pos.needsUpdate = true;
    this._color.needsUpdate = true;
    this._geo.computeVertexNormals();
    this.mesh.position.set(centerX, 0, centerZ);
  }
}

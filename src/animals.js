// Weidetiere und Wild: Schafe und Kühe auf den Feldern, Rehe im Nordwald.
// Jede Art ist EIN InstancedMesh (zusammengeführte Primitive) — die Herden
// grasen mit langsamen Zufallsschritten und stieben auseinander, wenn der
// Spieler tief über sie hinwegfliegt.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hash, heightAt } from "./noise.js";
import { FIELDS, FOREST_ZONES, roadDist } from "./world.js";

const _o = new THREE.Object3D();

/** Primitive zu einer Tier-Geometrie zusammenführen. */
function animalGeo(parts) {
  const list = [];
  for (const [geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1] of parts) {
    _o.position.set(x, y, z);
    _o.rotation.set(rx, ry, rz);
    _o.scale.setScalar(s);
    _o.updateMatrix();
    const g = geo.clone();
    g.applyMatrix4(_o.matrix);
    list.push(g);
  }
  return mergeGeometries(list);
}

const legGeo = new THREE.CylinderGeometry(0.28, 0.24, 2.2, 5);

function sheepGeo() {
  return animalGeo([
    [new THREE.SphereGeometry(1.6, 8, 6), 0, 3.2, 0, 0, 0, 0, 1],   // Wollkörper
    [new THREE.SphereGeometry(0.7, 6, 5), 0, 3.4, -1.9],            // Kopf
    [legGeo, 0.8, 1.1, 0.9], [legGeo, -0.8, 1.1, 0.9],
    [legGeo, 0.8, 1.1, -0.9], [legGeo, -0.8, 1.1, -0.9],
  ]);
}

function cowGeo() {
  return animalGeo([
    [new THREE.BoxGeometry(2.4, 2.6, 5), 0, 3.6, 0],                // Rumpf
    [new THREE.BoxGeometry(1.4, 1.4, 2), 0, 4.4, -3.2],             // Kopf
    [new THREE.ConeGeometry(0.22, 1, 4), 0.8, 5.3, -3.2, 0, 0, -1.2],
    [new THREE.ConeGeometry(0.22, 1, 4), -0.8, 5.3, -3.2, 0, 0, 1.2],
    [legGeo, 1, 1.1, 1.7], [legGeo, -1, 1.1, 1.7],
    [legGeo, 1, 1.1, -1.7], [legGeo, -1, 1.1, -1.7],
  ]);
}

function deerGeo() {
  return animalGeo([
    [new THREE.BoxGeometry(1.6, 1.8, 4), 0, 3.9, 0],                // Rumpf
    [new THREE.CylinderGeometry(0.5, 0.6, 2, 5), 0, 5, -2.2, 0.7],  // Hals
    [new THREE.BoxGeometry(0.9, 0.9, 1.6), 0, 6.2, -2.9],           // Kopf
    [new THREE.ConeGeometry(0.16, 2, 4), 0.5, 7.4, -2.7, 0, 0, -0.5], // Geweih
    [new THREE.ConeGeometry(0.16, 2, 4), -0.5, 7.4, -2.7, 0, 0, 0.5],
    [legGeo, 0.6, 1.4, 1.4, 0, 0, 0, 1.25], [legGeo, -0.6, 1.4, 1.4, 0, 0, 0, 1.25],
    [legGeo, 0.6, 1.4, -1.4, 0, 0, 0, 1.25], [legGeo, -0.6, 1.4, -1.4, 0, 0, 0, 1.25],
  ]);
}

/** Eine Herde: InstancedMesh + einfache Verhaltens-Zustände pro Tier. */
class Herd {
  constructor(scene, geo, mat, spots, { size = 1, fleeSpeed = 16 }) {
    this._mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    this._mesh.frustumCulled = false;
    scene.add(this._mesh);
    this._size = size;
    this._fleeSpeed = fleeSpeed;
    this._animals = spots.map(([x, z], i) => ({
      x, z, ang: hash(i, 91) * 6.28, moveT: hash(i, 17) * 4, mode: 0, bob: 0,
    }));
    this._apply(0);
  }

  _apply(t) {
    const d = _o;
    this._animals.forEach((a, i) => {
      d.position.set(a.x, heightAt(a.x, a.z) + a.bob, a.z);
      d.rotation.set(0, -a.ang + Math.PI / 2, 0);
      d.scale.setScalar(this._size);
      d.updateMatrix();
      this._mesh.setMatrixAt(i, d.matrix);
    });
    this._mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, t, player) {
    for (const a of this._animals) {
      const dx = a.x - player.x, dz = a.z - player.z;
      const dist = Math.hypot(dx, dz);
      const low = player.y - heightAt(player.x, player.z) < 110;

      if (dist < 160 && low) {
        // Flucht: weg vom Spieler, mit Hopser
        a.mode = 1;
        a.ang = Math.atan2(dz, dx);
        a.x += Math.cos(a.ang) * this._fleeSpeed * dt;
        a.z += Math.sin(a.ang) * this._fleeSpeed * dt;
        a.bob = Math.abs(Math.sin(t * 11)) * 1.1;
      } else if (a.mode === 1 && dist < 260) {
        a.x += Math.cos(a.ang) * this._fleeSpeed * 0.7 * dt;
        a.z += Math.sin(a.ang) * this._fleeSpeed * 0.7 * dt;
        a.bob = Math.abs(Math.sin(t * 9)) * 0.8;
      } else {
        // Grasen: gelegentlich ein paar Schritte in neue Richtung
        a.mode = 0;
        a.bob = 0;
        a.moveT -= dt;
        if (a.moveT < 0) {
          a.moveT = 2.5 + Math.random() * 5;
          a.ang = Math.random() * 6.28;
        }
        if (a.moveT > 1.6) {
          a.x += Math.cos(a.ang) * 1.6 * dt;
          a.z += Math.sin(a.ang) * 1.6 * dt;
        }
      }
    }
    this._apply(t);
  }
}

/** Deterministische Weideplätze in einer Zone suchen. */
function findSpots(count, seedBase, cx, cz, rx, rz) {
  const spots = [];
  for (let i = 0; i < count * 4 && spots.length < count; i++) {
    const x = cx + (hash(seedBase + i, 3) - 0.5) * 2 * rx;
    const z = cz + (hash(seedBase + i, 7) - 0.5) * 2 * rz;
    const h = heightAt(x, z);
    if (h < 6 || h > 150 || roadDist(x, z) < 24) continue;
    spots.push([x, z]);
  }
  return spots;
}

export class Animals {
  constructor(scene) {
    const sheepMat = new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: 0.95 });
    const cowMat = new THREE.MeshStandardMaterial({ color: 0x6e4a33, roughness: 0.9 });
    const deerMat = new THREE.MeshStandardMaterial({ color: 0x8a6644, roughness: 0.9 });

    const f0 = FIELDS[0], f1 = FIELDS[1], w0 = FOREST_ZONES[0];
    this._herds = [
      new Herd(scene, sheepGeo(), sheepMat,
        [...findSpots(34, 100, f0.x, f0.z, f0.rx * 0.85, f0.rz * 0.85),
         ...findSpots(22, 300, f1.x, f1.z, f1.rx * 0.85, f1.rz * 0.85)],
        { size: 1.15, fleeSpeed: 15 }),
      new Herd(scene, cowGeo(), cowMat,
        findSpots(20, 500, f0.x + 300, f0.z - 200, f0.rx * 0.7, f0.rz * 0.7),
        { size: 1.25, fleeSpeed: 12 }),
      new Herd(scene, deerGeo(), deerMat,
        findSpots(12, 700, w0.x, w0.z, w0.r * 0.7, w0.r * 0.7),
        { size: 1.1, fleeSpeed: 24 }),
    ];
  }

  update(dt, t, playerPos) {
    for (const h of this._herds) h.update(dt, t, playerPos);
  }
}

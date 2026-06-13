// Große Wasserfläche auf Meereshöhe, die dem Spieler folgt.
import * as THREE from "three";
import { WORLD, WATER_LEVEL } from "./config.js";

export class Water {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD * 1.6, WORLD * 1.6),
      new THREE.MeshStandardMaterial({
        color: 0x2b66a6, transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.25,
      })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    scene.add(this.mesh);
  }

  update(playerX, playerZ) {
    this.mesh.position.set(playerX, WATER_LEVEL - 0.5, playerZ);
  }
}

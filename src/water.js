// Große Wasserfläche auf Meereshöhe, die dem Spieler folgt. Sanfte Dünung per
// TSL-Vertex-Wellen; Wellenkämme werden heller eingefärbt (Schimmer). Die
// Wellen-Phase nutzt einen Welt-Offset (Spielerposition), damit die Dünung
// ortsfest bleibt, während die Fläche mitzieht.
import * as THREE from "three";
import { positionLocal, time, vec3, color, mix, uniform } from "three/tsl";
import { WORLD, WATER_LEVEL } from "./config.js";

export class Water {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WORLD * 1.6, WORLD * 1.6, 100, 100);
    geo.rotateX(-Math.PI / 2); // Fläche liegt in der XZ-Ebene (lokal)

    const mat = new THREE.MeshStandardNodeMaterial({
      transparent: true, roughness: 0.14, metalness: 0.35,
    });

    this._offset = uniform(new THREE.Vector2());
    const wx = positionLocal.x.add(this._offset.x);
    const wz = positionLocal.z.add(this._offset.y);

    // zwei sich kreuzende Wellenzüge
    const w1 = wx.mul(0.012).add(wz.mul(0.007)).add(time.mul(0.9)).sin();
    const w2 = wx.mul(-0.006).add(wz.mul(0.014)).add(time.mul(0.7)).sin();
    const wave = w1.mul(2.4).add(w2.mul(1.7));

    mat.positionNode = positionLocal.add(vec3(0, wave, 0));
    const crest = wave.mul(0.16).add(0.5).saturate();
    mat.colorNode = mix(color(0x1e4f86), color(0x4f8fce), crest);
    mat.opacityNode = mix(0.78, 0.92, crest);

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(playerX, playerZ) {
    this._offset.value.set(playerX, playerZ);
    this.mesh.position.set(playerX, WATER_LEVEL - 0.5, playerZ);
  }
}

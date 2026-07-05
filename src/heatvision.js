// Supermans Hitzeblick: zwei kontinuierliche rote Laserstrahlen aus den
// Augen, schräg nach vorn-unten gerichtet. Die Strahlen enden am Boden
// (Ray-March gegen die Geländehöhe) mit glühenden Aufschlagpunkten und
// rotem Licht — HDR-hell, blüht im Bloom. Getroffene Bäume fangen Feuer
// (Zündkegel setzt main.js, s. heat.origin/dir/length).
import * as THREE from "three";
import { uv, color, float, smoothstep } from "three/tsl";
import { heightAt } from "./noise.js";

// Augenpositionen lokal am Superman-Modell (inkl. group.scale 1.7)
const EYES = [new THREE.Vector3(-1.0, 2.2, -14.4), new THREE.Vector3(1.0, 2.2, -14.4)];
const DOWN_TILT = 0.55;  // wie stark die Strahlen nach unten geneigt sind
const MAX_LEN = 1400;
const FWD = new THREE.Vector3(0, 0, 1);

export class HeatVision {
  constructor(scene) {
    // Einheits-Strahl: Zylinder von z=0 bis z=1 (wird per scale.z gestreckt)
    const geo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0.5);

    const outerMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    outerMat.colorNode = color(0xff2416).mul(2.2);
    outerMat.opacityNode = float(0.3);
    const innerMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    innerMat.colorNode = color(0xff6a50).mul(5.0);
    innerMat.opacityNode = float(0.9);

    // Aufschlag-Glut: weiche additive Scheibe
    const hitMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const d = uv().sub(0.5).length();
    hitMat.colorNode = color(0xff5030).mul(3.0);
    hitMat.opacityNode = float(1.0).sub(smoothstep(0.1, 0.5, d));
    const hitGeo = new THREE.CircleGeometry(1, 16);
    hitGeo.rotateX(-Math.PI / 2);

    this._beams = [];
    this._hits = [];
    for (let i = 0; i < 2; i++) {
      const outer = new THREE.Mesh(geo, outerMat);
      const inner = new THREE.Mesh(geo, innerMat);
      outer.frustumCulled = inner.frustumCulled = false;
      outer.visible = inner.visible = false;
      scene.add(outer, inner);
      this._beams.push({ outer, inner });

      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.visible = false;
      scene.add(hit);
      this._hits.push(hit);
    }

    this._light = new THREE.PointLight(0xff3020, 0, 420);
    scene.add(this._light);

    // Für den Baum-Zündkegel (von main.js gelesen)
    this.origin = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.length = 0;

    this._o = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  update(dt, flier, forward, firing) {
    if (!firing) {
      for (const b of this._beams) b.outer.visible = b.inner.visible = false;
      for (const h of this._hits) h.visible = false;
      this._light.intensity *= 0.7;
      this.length = 0;
      return;
    }

    // Strahlrichtung: Blickrichtung, deutlich nach unten geneigt
    this.dir.copy(forward);
    this.dir.y -= DOWN_TILT;
    this.dir.normalize();
    this._q.setFromUnitVectors(FWD, this.dir);

    // Bodentreffer suchen (grober Ray-March gegen das Gelände)
    this.origin.copy(EYES[0]).add(EYES[1]).multiplyScalar(0.5)
      .applyQuaternion(flier.quaternion).add(flier.position);
    let len = MAX_LEN;
    for (let t = 40; t <= MAX_LEN; t += 45) {
      const px = this.origin.x + this.dir.x * t;
      const py = this.origin.y + this.dir.y * t;
      const pz = this.origin.z + this.dir.z * t;
      if (py <= Math.max(heightAt(px, pz), 0)) { len = t; break; }
    }
    this.length = len;

    const flick = 1 + Math.sin(performance.now() * 0.04) * 0.15;
    for (let i = 0; i < 2; i++) {
      const o = this._o.copy(EYES[i]).applyQuaternion(flier.quaternion).add(flier.position);
      const b = this._beams[i];
      for (const m of [b.outer, b.inner]) {
        m.visible = true;
        m.position.copy(o);
        m.quaternion.copy(this._q);
      }
      b.outer.scale.set(1.25 * flick, 1.25 * flick, len);
      b.inner.scale.set(0.5, 0.5, len);

      // Aufschlag-Glut flach auf den Boden legen
      const h = this._hits[i];
      h.visible = true;
      h.position.copy(o).addScaledVector(this.dir, len);
      h.position.y += 1.5;
      h.scale.setScalar(7 + Math.sin(performance.now() * 0.03 + i * 2) * 2);
    }

    this._light.intensity = 14;
    this._light.position.copy(this.origin).addScaledVector(this.dir, len).setY(
      Math.max(heightAt(this._light.position.x, this._light.position.z), 0) + 12);
  }

  reset() {
    this.update(0, null, null, false);
  }
}

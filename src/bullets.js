// Flugzeug-Bordwaffen: echte, diskrete Leuchtspur-Geschosse mit ballistischem
// Fall (Schwerkraft). Jede Patrone fliegt als eigenes Projektil schnell nach
// vorn, in Flugrichtung ausgerichtet, mit HDR-hellem Kopf und ausblendendem
// Schweif (Bloom lässt sie glühen). Trifft ein Geschoss Gelände oder Wasser,
// gibt es einen Einschlag: Funkengarbe + Staubwolke bzw. Gischtfontäne und
// ein kurzer Lichtblitz. Dazu Mündungsblitz + Mündungslicht.
import * as THREE from "three";
import {
  uv, color, mix, float, smoothstep, instancedBufferAttribute, positionGeometry,
  cameraWorldMatrix,
} from "three/tsl";
import { WATER_LEVEL } from "./config.js";
import { heightAt } from "./noise.js";

const MAX = 96;          // Pool-Größe
const LIFE = 1.6;        // Lebensdauer (s) → Reichweite ~1500 Einheiten
const SPREAD = 0.012;
const FWD = new THREE.Vector3(0, 0, 1);

/** CPU-Partikel-Burst als instanzierte Kamera-Billboards (Position/Größe/
 *  Farbe/Deckkraft pro Instanz über Attribute). Für Funken und Staub/Gischt. */
class PointBurst {
  constructor(scene, max, { blending, gravity, drag, grow }) {
    this._max = max;
    this._gravity = gravity;
    this._drag = drag;
    this._grow = grow;

    this._p = new Float32Array(max * 3);
    this._v = new Float32Array(max * 3);
    this._life = new Float32Array(max);
    this._lifeMax = new Float32Array(max);
    this._size0 = new Float32Array(max);

    // Quad-Basis + Instanz-Attribute
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(quad.getIndex());
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    this._aPos = new THREE.InstancedBufferAttribute(this._p, 3).setUsage(THREE.DynamicDrawUsage);
    this._aFade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this._aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this._aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iPos", this._aPos);
    geo.setAttribute("iFade", this._aFade);
    geo.setAttribute("iSize", this._aSize);
    geo.setAttribute("iCol", this._aCol);
    geo.instanceCount = max;

    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
    mat.transparent = true;
    mat.depthWrite = false;
    mat.blending = blending;

    // Billboard: Quad entlang der Kamera-Rechts/Hoch-Achsen aufspannen.
    const right = cameraWorldMatrix.element(0).xyz;
    const up = cameraWorldMatrix.element(1).xyz;
    const iPos = instancedBufferAttribute(this._aPos);
    const iSize = instancedBufferAttribute(this._aSize);
    mat.positionNode = iPos
      .add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(iSize));

    const d = uv().sub(0.5).length();
    const disk = float(1.0).sub(smoothstep(0.08, 0.5, d));
    mat.colorNode = instancedBufferAttribute(this._aCol);
    mat.opacityNode = instancedBufferAttribute(this._aFade).mul(disk);

    this.points = new THREE.Mesh(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._next = 0;
  }

  emit(pos, vel, life, size, r, g, b) {
    const i = this._next;
    this._next = (i + 1) % this._max;
    this._p.set([pos.x, pos.y, pos.z], i * 3);
    this._v.set([vel.x, vel.y, vel.z], i * 3);
    this._life[i] = this._lifeMax[i] = life;
    this._size0[i] = size;
    this._aCol.setXYZ(i, r, g, b);
  }

  update(dt) {
    for (let i = 0; i < this._max; i++) {
      if (this._life[i] <= 0) { this._aFade.setX(i, 0); continue; }
      this._life[i] -= dt;
      const k = i * 3;
      this._v[k + 1] -= this._gravity * dt;
      const dr = 1 - this._drag * dt;
      this._v[k] *= dr; this._v[k + 1] *= dr; this._v[k + 2] *= dr;
      this._p[k] += this._v[k] * dt;
      this._p[k + 1] += this._v[k + 1] * dt;
      this._p[k + 2] += this._v[k + 2] * dt;

      const t = Math.max(this._life[i] / this._lifeMax[i], 0); // 1 → 0
      this._aFade.setX(i, t * t);
      this._aSize.setX(i, this._size0[i] * (1 + (1 - t) * this._grow));
    }
    this._aPos.needsUpdate = true;
    this._aFade.needsUpdate = true;
    this._aSize.needsUpdate = true;
    this._aCol.needsUpdate = true;
  }

  reset() {
    this._life.fill(0);
    for (let i = 0; i < this._max; i++) this._aFade.setX(i, 0);
    this._aFade.needsUpdate = true;
  }
}

export class Bullets {
  /**
   * @param {object} [opts]  Projektil-Stil (Standard: gelbe MG-Leuchtspur;
   *   das UFO nutzt grüne Energie-Laser ohne Fallgravitation).
   */
  constructor(scene, opts = {}) {
    this._speed = opts.speed ?? 900;        // Tempo zusätzlich zum Flugzeug
    this._cooldown = opts.cooldown ?? 0.05; // s zwischen Schüssen
    this._gravity = opts.gravity ?? 90;     // ballistischer Fall
    this._flashTime = opts.flashTime ?? 0.04;
    this._sparkCol = opts.sparkCol ?? [3.5, 1.8, 0.5];
    const tailColor = opts.tailColor ?? 0xff8a2a;
    const headColor = opts.headColor ?? 0xfff2c8;
    const flashColor = opts.flashColor ?? 0xfff0b0;
    const lightColor = opts.lightColor ?? 0xffd070;
    const [rHead, rTail] = opts.radius ?? [0.95, 0.45];

    this.root = new THREE.Group();
    scene.add(this.root);

    // Leuchtspur: schmaler, langgestreckter Körper; der Kopf ist HDR-hell
    // (Bloom), der Schweif blendet nach hinten aus.
    const geo = new THREE.CylinderGeometry(rHead, rTail, opts.length ?? 22, 6);
    geo.rotateX(Math.PI / 2); // Achse entlang +Z; uv.y=1 ist der Kopf
    const mat = new THREE.MeshBasicNodeMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    mat.colorNode = mix(color(tailColor), color(headColor).mul(4.0), uv().y.pow(2.0));
    // Mindest-Deckkraft, damit die Geschosse auch von direkt hinten
    // (Blick aufs Schweifende) sichtbar bleiben.
    mat.opacityNode = smoothstep(0.0, 0.85, uv().y).mul(0.95).max(0.3);

    this._bullets = [];
    for (let i = 0; i < MAX; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.root.add(m);
      this._bullets.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }
    this._next = 0;
    this._cool = 0;

    // Mündungsblitz (HDR → Bloom) + Mündungslicht
    const flashMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    flashMat.colorNode = color(flashColor).mul(4.0);
    flashMat.opacityNode = float(0.9);
    this._flash = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 0), flashMat);
    this._flash.visible = false;
    this.root.add(this._flash);
    this._flashT = 0;
    this._light = new THREE.PointLight(lightColor, 0, 220);
    scene.add(this._light);

    // Einschlag-Effekte: Funken (additiv, fallen ballistisch) und
    // Staub/Gischt (normal, steigt und wächst) + kurzer Lichtblitz.
    this._sparks = new PointBurst(scene, 240, { blending: THREE.AdditiveBlending, gravity: 320, drag: 1.2, grow: 0.4 });
    this._dust = new PointBurst(scene, 64, { blending: THREE.NormalBlending, gravity: -14, drag: 2.2, grow: 3.2 });
    this._impactLight = new THREE.PointLight(0xffb050, 0, 260);
    scene.add(this._impactLight);

    this._muzzle = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._mIdx = 0; // wechselt bei mehreren Mündungen (flier.fireMuzzles)
  }

  update(dt, flier, forward, emitting, flierSpeed = 0) {
    // Fluggeräte mit mehreren Mündungen (z. B. UFO-Randgeschütze) feuern
    // abwechselnd; sonst die einzelne fireMuzzle.
    const mz = flier.fireMuzzles
      ? flier.fireMuzzles[this._mIdx % flier.fireMuzzles.length]
      : flier.fireMuzzle;
    this._muzzle.copy(mz).applyQuaternion(flier.quaternion).add(flier.position);

    this._cool -= dt;
    if (emitting && this._cool <= 0) {
      this._spawn(forward, flierSpeed);
      this._cool = this._cooldown;
      this._flash.visible = true;
      this._flash.position.copy(this._muzzle);
      this._flash.scale.setScalar(0.8 + Math.random() * 0.7);
      this._flashT = this._flashTime;
      this._light.intensity = 4.5;
      this._light.position.copy(this._muzzle);
    }

    this._flashT -= dt;
    if (this._flashT <= 0) this._flash.visible = false;
    this._light.intensity *= 0.8;
    this._impactLight.intensity *= 0.72;

    for (const b of this._bullets) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.vel.y -= this._gravity * dt; // ballistischer Fall (0 bei Energie-Lasern)
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.quaternion.setFromUnitVectors(FWD, this._tmpV.copy(b.vel).normalize());

      // Aufschlag auf Gelände oder Wasser?
      const p = b.mesh.position;
      const ground = heightAt(p.x, p.z);
      const surf = Math.max(ground, WATER_LEVEL);
      if (p.y <= surf) {
        p.y = surf + 1;
        this._impact(p, ground < WATER_LEVEL);
        b.life = 0;
      }
      if (b.life <= 0) b.mesh.visible = false;
    }

    this._sparks.update(dt);
    this._dust.update(dt);
  }

  /** Einschlag: Funkengarbe/Gischt + Staub + Lichtblitz. */
  _impact(pos, water) {
    const v = this._tmpV;
    for (let i = 0; i < 10; i++) {
      // Funken (bzw. Gischt-Tropfen) in einer aufwärts gerichteten Garbe
      v.set((Math.random() - 0.5) * 160, 60 + Math.random() * 170, (Math.random() - 0.5) * 160);
      if (water) this._sparks.emit(pos, v, 0.5 + Math.random() * 0.3, 6, 1.6, 2.2, 3.0);
      else this._sparks.emit(pos, v, 0.4 + Math.random() * 0.35, 5, this._sparkCol[0], this._sparkCol[1], this._sparkCol[2]);
    }
    for (let i = 0; i < 3; i++) {
      v.set((Math.random() - 0.5) * 26, 12 + Math.random() * 20, (Math.random() - 0.5) * 26);
      if (water) this._dust.emit(pos, v, 0.9 + Math.random() * 0.5, 26, 0.86, 0.92, 0.97);
      else this._dust.emit(pos, v, 1.0 + Math.random() * 0.6, 24, 0.55, 0.48, 0.38);
    }
    this._impactLight.position.copy(pos).add(FWD);
    this._impactLight.position.y += 6;
    this._impactLight.color.setHex(water ? 0xbfe0ff : 0xffb050);
    this._impactLight.intensity = 26;
  }

  _spawn(forward, flierSpeed) {
    const b = this._bullets[this._next];
    this._next = (this._next + 1) % MAX;

    this._dir.copy(forward);
    this._dir.x += (Math.random() - 0.5) * SPREAD;
    this._dir.y += (Math.random() - 0.5) * SPREAD;
    this._dir.z += (Math.random() - 0.5) * SPREAD;
    this._dir.normalize();

    b.vel.copy(this._dir).multiplyScalar(flierSpeed + this._speed);
    b.life = LIFE;
    b.mesh.position.copy(this._muzzle);
    b.mesh.quaternion.setFromUnitVectors(FWD, this._dir);
    b.mesh.visible = true;
    this._mIdx++;
  }

  reset() {
    for (const b of this._bullets) { b.life = 0; b.mesh.visible = false; }
    this._cool = 0;
    this._flashT = 0;
    this._flash.visible = false;
    this._light.intensity = 0;
    this._impactLight.intensity = 0;
    this._sparks.reset();
    this._dust.reset();
  }
}

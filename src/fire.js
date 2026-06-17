// Drachenfeuer als GPU-Partikelsystem (TSL compute): ein großer, weit nach vorn
// reichender Flammenstrahl. Die Partikel sind stets schneller als der Drache
// (Emissionstempo = Drachentempo + BONUS) und haben wenig Luftwiderstand, damit
// der Drache nie in sein eigenes Feuer fliegt. Ohne WebGPU (WebGL2-Fallback)
// bleibt nur ein Mündungslicht.
import * as THREE from "three";
import {
  Fn, If, instancedArray, instanceIndex, vertexIndex, uniform, float, vec3, color,
  hash, time, mix, step,
} from "three/tsl";
import { renderer } from "./scene.js";

const COUNT = 6000;
const BONUS = 360;   // wie viel schneller als der Drache der Strahl mindestens ist
const LIFE = 1.15;   // Lebensdauer (s) → langer Flammenschweif
const BUOY = 10;     // leichter Auftrieb
const DRAG = 0.5;    // wenig Luftwiderstand → bleibt schnell & vorn
const SPREAD = 0.32;
const SIZE_A = 32;   // frische Partikel
const SIZE_B = 150;  // ausgewachsene, große Flammen

export class FireBreath {
  constructor(scene) {
    this._pos = instancedArray(COUNT, "vec3");
    this._vel = instancedArray(COUNT, "vec3");
    this._life = instancedArray(COUNT, "float");

    this._emitterPos = uniform(new THREE.Vector3());
    this._emitterDir = uniform(new THREE.Vector3(0, 0, -1));
    this._emitting = uniform(0);
    this._dt = uniform(0);
    this._uSpeed = uniform(BONUS); // pro Frame: Drachentempo + BONUS

    this._enabled = !!(globalThis.navigator && navigator.gpu);
    this._initialized = false;
    this._buildCompute();
    this._buildPoints(scene);
    if (!this._enabled) this._points.visible = false;

    this._light = new THREE.PointLight(0xff7b1a, 0, 380);
    scene.add(this._light);
    this._tmp = new THREE.Vector3();
  }

  _buildCompute() {
    this._computeInit = Fn(() => {
      this._life.element(instanceIndex).assign(-1.0);
      this._pos.element(instanceIndex).assign(vec3(0, -1e5, 0));
      this._vel.element(instanceIndex).assign(vec3(0));
    })().compute(COUNT);

    this._computeUpdate = Fn(() => {
      const pos = this._pos.element(instanceIndex);
      const vel = this._vel.element(instanceIndex);
      const life = this._life.element(instanceIndex);
      const dt = this._dt;

      life.subAssign(dt);
      vel.y.addAssign(dt.mul(BUOY));
      vel.subAssign(vel.mul(dt.mul(DRAG)));
      pos.addAssign(vel.mul(dt));

      const idF = instanceIndex.toFloat();
      const gate = hash(idF.add(time.mul(60.0))).lessThan(0.5);
      If(life.lessThan(0.0).and(this._emitting.greaterThan(0.5)).and(gate), () => {
        const r1 = hash(idF.add(time.mul(91.0)));
        const r2 = hash(idF.add(time.mul(53.0)).add(2.0));
        const r3 = hash(idF.add(time.mul(17.0)).add(5.0));
        const spread = vec3(r1.sub(0.5), r2.sub(0.5), r3.sub(0.5)).mul(SPREAD);
        const dir = this._emitterDir.add(spread).normalize();
        const speed = this._uSpeed.mul(r1.mul(0.2).add(0.85)); // 0.85 … 1.05 × (Tempo+BONUS)
        pos.assign(this._emitterPos.add(spread.mul(5.0)));
        vel.assign(dir.mul(speed));
        life.assign(float(LIFE).mul(r2.mul(0.35).add(0.75)));
      });
    })().compute(COUNT);
  }

  _buildPoints(scene) {
    const mat = new THREE.PointsNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.blending = THREE.AdditiveBlending;

    const life = this._life.element(vertexIndex);
    const age = float(1).sub(life.div(LIFE)).saturate(); // 0 frisch .. 1 alt

    mat.positionNode = this._pos.element(vertexIndex);
    const hot = mix(color(0xfff2c0), color(0xff6a12), age.mul(1.5).saturate());
    mat.colorNode = mix(hot, color(0x6e1200), age.mul(age)).mul(mix(float(2.4), float(0.3), age));
    mat.sizeNode = mix(float(SIZE_A), float(SIZE_B), age);
    mat.opacityNode = step(float(0), life).mul(float(1).sub(age));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
    this._points = new THREE.Points(geo, mat);
    this._points.frustumCulled = false;
    scene.add(this._points);
  }

  /** @param {number} flierSpeed  aktuelles Tempo des Drachen (für relative Emission) */
  update(dt, flier, forward, emitting, flierSpeed = 0) {
    this._tmp.copy(flier.fireMuzzle).applyQuaternion(flier.quaternion).add(flier.position);
    if (emitting) {
      this._light.intensity = 6;
      this._light.position.copy(this._tmp);
    } else {
      this._light.intensity *= 0.8;
    }

    if (!this._enabled) return;

    if (!this._initialized) {
      renderer.compute(this._computeInit);
      this._initialized = true;
    }
    this._uSpeed.value = flierSpeed + BONUS;
    this._emitterPos.value.copy(this._tmp);
    this._emitterDir.value.copy(forward);
    this._emitting.value = emitting ? 1 : 0;
    this._dt.value = dt;
    renderer.compute(this._computeUpdate);
  }

  reset() {
    this._emitting.value = 0;
    this._light.intensity = 0;
    if (this._enabled && this._initialized) renderer.compute(this._computeInit);
  }
}

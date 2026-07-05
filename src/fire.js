// Drachenfeuer als GPU-Partikelsystem (TSL compute): ein langer, nach vorn
// geschossener Flammenstrahl aus weichen, runden Partikeln mit heißem
// HDR-Kern (weiß-gelb → orange → tiefrot), organischer Noise-Turbulenz und
// altersabhängigem Auftrieb (heiße Gase steigen). Ein zweites, langsameres
// Partikelsystem hinterlässt eine nachschwebende Rauchfahne. Die Flammen-
// partikel sind stets schneller als der Drache (Tempo + BONUS), damit er nie
// ins eigene Feuer fliegt. Ohne WebGPU (WebGL2-Fallback) bleibt nur ein
// Mündungslicht.
import * as THREE from "three";
import {
  Fn, If, instancedArray, instanceIndex, uniform, float, vec3, color,
  hash, time, mix, smoothstep, step, uv, triNoise3D,
} from "three/tsl";
import { renderer } from "./scene.js";

const COUNT = 2200;
const BONUS = 380;   // mind. so viel schneller als der Drache
const LIFE = 1.35;   // lange Lebensdauer → langer Flammenschweif
const DRAG = 0.42;   // wenig Widerstand → bleibt schnell & weit vorn
const SPREAD = 0.24;
const SIZE_A = 9;    // frisch (am Maul, dicht/solide)
const SIZE_B = 60;   // ausgewachsen (große Flammenzungen)

const SMOKE_COUNT = 700;
const SMOKE_LIFE = 2.2;

/** Weicher, runder Sprite-Falloff (0 am Rand, 1 im Zentrum). */
const softDisk = () => {
  const d = uv().sub(0.5).length();
  return float(1.0).sub(smoothstep(0.1, 0.5, d));
};

export class FireBreath {
  constructor(scene) {
    this._pos = instancedArray(COUNT, "vec3");
    this._vel = instancedArray(COUNT, "vec3");
    this._life = instancedArray(COUNT, "float");

    this._sPos = instancedArray(SMOKE_COUNT, "vec3");
    this._sVel = instancedArray(SMOKE_COUNT, "vec3");
    this._sLife = instancedArray(SMOKE_COUNT, "float");

    this._emitterPos = uniform(new THREE.Vector3());
    this._emitterDir = uniform(new THREE.Vector3(0, 0, -1));
    this._emitting = uniform(0);
    this._dt = uniform(0);
    this._uSpeed = uniform(BONUS);

    this._enabled = !!(globalThis.navigator && navigator.gpu);
    this._initialized = false;
    this._buildCompute();
    this._buildPoints(scene);
    this._buildSmoke(scene);
    if (!this._enabled) { this._points.visible = false; this._smoke.visible = false; }

    this._light = new THREE.PointLight(0xff6a1a, 0, 480);
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
      const idF = instanceIndex.toFloat();

      life.subAssign(dt);
      const age01 = float(1.0).sub(life.div(LIFE)).saturate();

      // Auftrieb wächst mit dem Alter: der junge Strahl fliegt gerade, die
      // ausgebrannten Zungen steigen auf (heiße Gase).
      vel.y.addAssign(dt.mul(mix(float(3.0), float(55.0), age01)));

      // Organische Turbulenz: drei versetzte Noise-Felder als Wirbelkraft
      // (statt reinem Zufallszittern) → züngelnde, verwirbelte Flammen.
      const np = pos.mul(0.012);
      const t1 = triNoise3D(np, 0.4, time).sub(0.45);
      const t2 = triNoise3D(np.add(vec3(31.7, 0.0, 17.3)), 0.4, time).sub(0.45);
      const t3 = triNoise3D(np.add(vec3(-11.3, 23.1, 5.7)), 0.4, time).sub(0.45);
      vel.addAssign(vec3(t1, t2.mul(0.6), t3).mul(dt.mul(mix(float(60.0), float(320.0), age01))));

      vel.subAssign(vel.mul(dt.mul(DRAG)));
      pos.addAssign(vel.mul(dt));

      const gate = hash(idF.add(time.mul(60.0))).lessThan(0.5);
      If(life.lessThan(0.0).and(this._emitting.greaterThan(0.5)).and(gate), () => {
        const r1 = hash(idF.add(time.mul(91.0)));
        const r2 = hash(idF.add(time.mul(53.0)).add(2.0));
        const r3 = hash(idF.add(time.mul(17.0)).add(5.0));
        const spread = vec3(r1.sub(0.5), r2.sub(0.5), r3.sub(0.5)).mul(SPREAD);
        const dir = this._emitterDir.add(spread).normalize();
        const speed = this._uSpeed.mul(r1.mul(0.2).add(0.85));
        pos.assign(this._emitterPos.add(spread.mul(4.0)));
        vel.assign(dir.mul(speed));
        life.assign(float(LIFE).mul(r2.mul(0.35).add(0.75)));
      });
    })().compute(COUNT);

    // ---- Rauch: langsamer Start, hoher Widerstand, steigt und verweht ----
    this._computeSmokeInit = Fn(() => {
      this._sLife.element(instanceIndex).assign(-1.0);
      this._sPos.element(instanceIndex).assign(vec3(0, -1e5, 0));
      this._sVel.element(instanceIndex).assign(vec3(0));
    })().compute(SMOKE_COUNT);

    this._computeSmokeUpdate = Fn(() => {
      const pos = this._sPos.element(instanceIndex);
      const vel = this._sVel.element(instanceIndex);
      const life = this._sLife.element(instanceIndex);
      const dt = this._dt;
      const idF = instanceIndex.toFloat();

      life.subAssign(dt);
      vel.y.addAssign(dt.mul(26.0)); // Auftrieb
      const np = pos.mul(0.008);
      const t1 = triNoise3D(np, 0.25, time).sub(0.5);
      const t3 = triNoise3D(np.add(vec3(19.0, 7.0, -13.0)), 0.25, time).sub(0.5);
      vel.addAssign(vec3(t1, 0.0, t3).mul(dt.mul(70.0)));
      vel.subAssign(vel.mul(dt.mul(1.5))); // starker Widerstand → bleibt stehen
      pos.addAssign(vel.mul(dt));

      const gate = hash(idF.add(time.mul(47.0))).lessThan(0.08);
      If(life.lessThan(0.0).and(this._emitting.greaterThan(0.5)).and(gate), () => {
        const r1 = hash(idF.add(time.mul(71.0)));
        const r2 = hash(idF.add(time.mul(29.0)).add(3.0));
        const r3 = hash(idF.add(time.mul(13.0)).add(7.0));
        const spread = vec3(r1.sub(0.5), r2.sub(0.5).add(0.25), r3.sub(0.5)).mul(0.5);
        const dir = this._emitterDir.add(spread).normalize();
        pos.assign(this._emitterPos.add(spread.mul(8.0)));
        vel.assign(dir.mul(this._uSpeed.mul(0.45)));
        life.assign(float(SMOKE_LIFE).mul(r2.mul(0.5).add(0.7)));
      });
    })().compute(SMOKE_COUNT);
  }

  _buildPoints(scene) {
    // Instanzierte Sprites (WebGPU-Pattern): jedes Partikel ist eine
    // kamerazugewandte Quad-Instanz; Position/Alter kommen aus den
    // Compute-Storage-Buffern.
    const mat = new THREE.SpriteNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.blending = THREE.AdditiveBlending; // heißer Kern weiß-gelb, Ränder orange

    const life = this._life.toAttribute();
    const age = float(1).sub(life.div(LIFE)).saturate(); // 0 frisch .. 1 alt

    mat.positionNode = this._pos.toAttribute();

    // Flammen-Farbverlauf: weißglühender Kern → Gelb → Orange → tiefrot.
    // Frische Partikel sind HDR-hell (>1) und blühen im Bloom auf; die Werte
    // sind bewusst moderat, weil sich tausende additive Partikel aufsummieren.
    let flame = mix(color(0xfff6d0).mul(1.7), color(0xffb02e).mul(1.2), smoothstep(0.05, 0.25, age));
    flame = mix(flame, color(0xff5a10).mul(0.7), smoothstep(0.25, 0.55, age));
    flame = mix(flame, color(0x4d0f04), smoothstep(0.55, 0.95, age));
    mat.colorNode = flame;
    mat.scaleNode = mix(float(SIZE_A), float(SIZE_B), age.pow(0.7));
    // Jedes Partikel dreht sich individuell → wabernde Flammenzungen.
    const rnd = hash(instanceIndex.toFloat().add(7.0));
    mat.rotationNode = rnd.mul(6.2832).add(time.mul(rnd.sub(0.5).mul(6.0)));

    const alive = step(float(0), life);
    // Weicher, runder Partikel statt hartem Quadrat.
    mat.opacityNode = alive.mul(softDisk()).mul(float(1).sub(age.mul(age)).mul(0.09).add(0.015));

    this._points = new THREE.Sprite(mat);
    this._points.count = COUNT;
    this._points.frustumCulled = false;
    this._points.renderOrder = 10;
    scene.add(this._points);
  }

  _buildSmoke(scene) {
    const mat = new THREE.SpriteNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false; // normales Blending: Rauch verdunkelt

    const life = this._sLife.toAttribute();
    const age = float(1).sub(life.div(SMOKE_LIFE)).saturate();

    mat.positionNode = this._sPos.toAttribute();
    mat.colorNode = mix(color(0x2e2823), color(0x8a857d), age);
    mat.scaleNode = mix(float(18), float(110), age.pow(0.6));
    const rnd = hash(instanceIndex.toFloat().add(13.0));
    mat.rotationNode = rnd.mul(6.2832).add(time.mul(rnd.sub(0.5).mul(1.6)));

    const alive = step(float(0), life);
    // Ein- und wieder ausblenden (sin-Bogen über die Lebenszeit).
    const fade = smoothstep(0.0, 0.15, age).mul(float(1).sub(smoothstep(0.45, 1.0, age)));
    mat.opacityNode = alive.mul(softDisk()).mul(fade).mul(0.045);

    this._smoke = new THREE.Sprite(mat);
    this._smoke.count = SMOKE_COUNT;
    this._smoke.frustumCulled = false;
    this._smoke.renderOrder = 9;
    scene.add(this._smoke);
  }

  /** @param {number} flierSpeed  aktuelles Tempo des Drachen (für relative Emission) */
  update(dt, flier, forward, emitting, flierSpeed = 0) {
    this._tmp.copy(flier.fireMuzzle).applyQuaternion(flier.quaternion).add(flier.position);
    if (emitting) {
      // Flackerndes Mündungslicht, leicht in den Strahl vorverlegt.
      this._light.intensity = 5 + Math.random() * 4;
      this._light.position.copy(this._tmp).addScaledVector(forward, 50);
    } else {
      this._light.intensity *= 0.8;
    }

    if (!this._enabled) return;

    if (!this._initialized) {
      renderer.compute(this._computeInit);
      renderer.compute(this._computeSmokeInit);
      this._initialized = true;
    }
    this._uSpeed.value = flierSpeed + BONUS;
    this._emitterPos.value.copy(this._tmp);
    this._emitterDir.value.copy(forward);
    this._emitting.value = emitting ? 1 : 0;
    this._dt.value = dt;
    renderer.compute(this._computeUpdate);
    renderer.compute(this._computeSmokeUpdate);
  }

  reset() {
    this._emitting.value = 0;
    this._light.intensity = 0;
    if (this._enabled && this._initialized) {
      renderer.compute(this._computeInit);
      renderer.compute(this._computeSmokeInit);
    }
  }
}

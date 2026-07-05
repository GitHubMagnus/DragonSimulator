// Wander-Regenschauer: eine unsichtbare Schauerzone zieht langsam über die
// Insel. Fliegt der Spieler hinein, fallen instanzierte Regen-Streifen um die
// Kamera (GPU-Loop) und der Nebel verdichtet sich spürbar.
import * as THREE from "three";
import {
  uv, vec3, color, float, time, uniform, instancedBufferAttribute,
  positionGeometry, cameraWorldMatrix, smoothstep,
} from "three/tsl";
import { scene } from "./scene.js";

const COUNT = 650;
const BOX = 360;    // Regen-Box um den Spieler (Kantenlänge)
const H = 260;      // Fallhöhe
const FALL = 210;   // Fallgeschwindigkeit

export class Weather {
  constructor() {
    this._uCenter = uniform(new THREE.Vector3());
    this._uK = uniform(0); // 0 trocken … 1 voller Schauer
    this._k = 0;

    const quad = new THREE.PlaneGeometry(0.16, 7);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(quad.getIndex());
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    const off = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      off.set([(Math.random() - 0.5) * BOX, Math.random() * H, (Math.random() - 0.5) * BOX], i * 3);
    }
    const aOff = new THREE.InstancedBufferAttribute(off, 3);
    geo.setAttribute("iOff", aOff);
    geo.instanceCount = COUNT;

    const mat = new THREE.MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const iOff = instancedBufferAttribute(aOff);
    const fallY = iOff.y.sub(time.mul(FALL)).mod(H);
    const right = cameraWorldMatrix.element(0).xyz;
    mat.positionNode = this._uCenter
      .add(vec3(iOff.x, fallY.sub(H * 0.35), iOff.z))
      .add(right.mul(positionGeometry.x))
      .add(vec3(0, positionGeometry.y, 0));
    mat.colorNode = color(0xaac3d8);
    mat.opacityNode = this._uK.mul(0.32).mul(smoothstep(0.0, 0.15, uv().y));

    this._rain = new THREE.Mesh(geo, mat);
    this._rain.frustumCulled = false;
    this._rain.visible = false;
    scene.add(this._rain);
  }

  update(dt, playerPos, t) {
    // Schauerzone wandert in einer langsamen Lissajous-Bahn über das Inland
    const zx = Math.sin(t * 0.011) * 3200 + 600;
    const zz = Math.cos(t * 0.0082) * 2800 + 1400;
    const inside = Math.hypot(playerPos.x - zx, playerPos.z - zz) < 1100;
    this._k += ((inside ? 1 : 0) - this._k) * Math.min(1, dt * 0.7);
    this._uK.value = this._k;
    this._rain.visible = this._k > 0.02;
    this._uCenter.value.copy(playerPos);
    // dichter Dunst im Schauer
    scene.fog.density *= 1 + this._k * 1.6;
  }
}

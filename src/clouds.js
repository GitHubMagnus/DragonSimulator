// Wolkenschicht in Weltkoordinaten: jede Wolke besteht aus mehreren weichen,
// kamerazugewandten Noise-Billboards (statt harter Polyeder) — von unten
// beschattet, oben sonnenbeschienen, mit fransigen, sich langsam wandelnden
// Rändern. Jede Wolke hat eine feste Weltposition und driftet nur langsam;
// weit entfernte Wolken werden (unsichtbar hinter dem Dunst) um den Spieler
// herum „umgeschlagen", damit der Himmel immer bevölkert bleibt.
import * as THREE from "three";
import { uv, vec3, color, mix, float, time, smoothstep, triNoise3D } from "three/tsl";
import { camera } from "./scene.js";

const CLOUD_COUNT = 21;
const SPAN = 9000;       // Umschlagbereich um den Spieler
const HALF = SPAN / 2;
const mod = (a, n) => ((a % n) + n) % n;

/** Weiches Wolken-Puff-Material: runder Falloff × fraktales Noise. */
function puffMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({
    transparent: true, depthWrite: false,
  });

  const p = uv().sub(0.5);
  const r = p.length().mul(2.0); // 0 Mitte … 1 Rand

  // Zwei Noise-Oktaven; die UVs sind pro Puff verschoben (siehe unten),
  // dadurch sieht jeder Puff anders aus. Sehr langsame Zeitdrift → die
  // Wolken wabern kaum merklich.
  const n1 = triNoise3D(vec3(uv().mul(2.6), 0.0), 0.02, time);
  const n2 = triNoise3D(vec3(uv().mul(6.5), 4.7), 0.03, time);
  const dens = n1.mul(0.75).add(n2.mul(0.35));

  // Weicher Kern, Noise frisst die Ränder fransig auf.
  const disk = float(1.0).sub(smoothstep(0.25, 1.0, r));
  const alpha = disk.mul(dens.add(0.35)).saturate();
  m.opacityNode = smoothstep(0.08, 0.6, alpha).mul(0.92);

  // Beleuchtung gefaked: unten bläulicher Schatten, oben warmes Sonnenweiß.
  const lit = uv().y.add(n1.mul(0.35)).saturate();
  m.colorNode = mix(color(0x93a3ba), color(0xffffff).mul(1.12), lit);

  return m;
}

export class Clouds {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    const mat = puffMaterial();
    const baseGeo = new THREE.PlaneGeometry(1, 1);

    this._clouds = [];
    this._puffs = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const c = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 2);
      for (let p = 0; p < puffs; p++) {
        // Eigene Geometrie je Puff mit verschobenen UVs → einzigartiges
        // Noise-Muster, das beim Kameradrehen nicht „schwimmt".
        const geo = baseGeo.clone();
        const uvA = geo.attributes.uv;
        const ox = Math.random() * 40, oy = Math.random() * 40;
        for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) + ox, uvA.getY(k) + oy);

        const m = new THREE.Mesh(geo, mat);
        m.position.set((Math.random() - 0.5) * 220, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 140);
        m.scale.set(240 + Math.random() * 260, 110 + Math.random() * 110, 1);
        m.frustumCulled = false;
        c.add(m);
        this._puffs.push(m);
      }
      c.userData = {
        wx: Math.random() * SPAN,
        wz: Math.random() * SPAN,
        y: 650 + Math.random() * 700,
        driftX: (Math.random() - 0.5) * 9,
        driftZ: (Math.random() - 0.5) * 7,
      };
      this._clouds.push(c);
      this.root.add(c);
    }
  }

  update(dt, playerX, playerZ) {
    for (const c of this._clouds) {
      const u = c.userData;
      u.wx += u.driftX * dt;
      u.wz += u.driftZ * dt;
      const x = playerX + mod(u.wx - playerX + HALF, SPAN) - HALF;
      const z = playerZ + mod(u.wz - playerZ + HALF, SPAN) - HALF;
      c.position.set(x, u.y, z);
    }
    // Billboards: alle Puffs zur Kamera ausrichten (bildschirmparallel).
    for (const m of this._puffs) m.quaternion.copy(camera.quaternion);
  }
}

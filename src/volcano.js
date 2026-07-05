// Der Vulkan im Nordosten: ein Lavasee im Krater (dunkle Kruste mit glühenden,
// langsam wandernden Rissen — HDR-hell, blüht im Bloom), eine hohe, vom Wind
// verwehte Rauchsäule aus Noise-Billboards und ein flackerndes Glutlicht.
// Der Kraterboden kommt aus der Insel-Heightmap (~420), daher erst nach
// loadIsland() erzeugen.
import * as THREE from "three";
import { positionWorld, time, uv, vec3, color, mix, float, smoothstep, triNoise3D, uniform } from "three/tsl";
import { VOLCANO } from "./world.js";
import { heightAt } from "./noise.js";
import { camera } from "./scene.js";

const SMOKE_COUNT = 9;
const RISE = 950;      // Steighöhe der Rauchsäule
const CYCLE = 26;      // Sekunden pro Rauch-Durchlauf
const BOMBS = 14;      // Lavabomben-Pool
const ERUPT_LEN = 8;   // Dauer eines Ausbruchs (s)

export class Volcano {
  constructor(scene) {
    this._baseY = heightAt(VOLCANO.x, VOLCANO.z) + 6;

    // ---- Lavasee (Helligkeit steigt beim Ausbruch über _uBoost) ----
    this._uBoost = uniform(1);
    const lavaMat = new THREE.MeshBasicNodeMaterial({ fog: false });
    {
      const p = positionWorld.mul(0.005);
      const n1 = triNoise3D(p, 0.05, time);
      const n2 = triNoise3D(p.mul(3.2).add(vec3(7.0, 0.0, 3.0)), 0.09, time);
      const n = n1.add(n2.mul(0.45));
      // wo das Noise klein ist, reißt die Kruste auf → glühende Adern
      const cracks = float(1.0).sub(smoothstep(0.22, 0.5, n));
      const hot = float(1.0).sub(smoothstep(0.1, 0.24, n)); // Kern der Risse
      lavaMat.colorNode = mix(color(0x17100b), color(0xff5a10).mul(2.4), cracks)
        .add(color(0xffd23a).mul(hot.mul(2.2)))
        .mul(this._uBoost);
    }
    const lavaGeo = new THREE.CircleGeometry(245, 40);
    lavaGeo.rotateX(-Math.PI / 2);
    this._lava = new THREE.Mesh(lavaGeo, lavaMat);
    this._lava.position.set(VOLCANO.x, this._baseY, VOLCANO.z);
    scene.add(this._lava);

    // ---- Lavastrom: glühende Ader vom Kraterrand den Südwesthang hinab ----
    // (nutzt dasselbe Riss-Material; folgt per heightAt dem Gelände)
    {
      const from = { x: VOLCANO.x - 230, z: VOLCANO.z + 220 };
      const to = { x: VOLCANO.x - 900, z: VOLCANO.z + 1350 };
      const STEPS = 30, W = 9;
      const pos = new Float32Array((STEPS + 1) * 2 * 3);
      const idx = [];
      const dirX = to.x - from.x, dirZ = to.z - from.z;
      const len = Math.hypot(dirX, dirZ);
      const px = -dirZ / len, pz = dirX / len; // Querrichtung
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const wig = Math.sin(t * 9.2) * 60 * t;
        const x = from.x + dirX * t + px * wig;
        const z = from.z + dirZ * t + pz * wig;
        const y = heightAt(x, z) + 1.2;
        pos.set([x - px * W, y, z - pz * W], i * 6);
        pos.set([x + px * W, y, z + pz * W], i * 6 + 3);
        if (i < STEPS) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const stream = new THREE.Mesh(geo, lavaMat);
      stream.frustumCulled = false;
      scene.add(stream);
    }

    // ---- Lavabomben (Eruptionen) ----
    const bombMat = new THREE.MeshBasicNodeMaterial({ fog: false });
    bombMat.colorNode = color(0xff8a20).mul(2.6);
    this._bombs = [];
    for (let i = 0; i < BOMBS; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0), bombMat);
      m.visible = false;
      scene.add(m);
      this._bombs.push({ mesh: m, vel: new THREE.Vector3(), active: false });
    }
    this._nextEruption = 30;    // erster Ausbruch nach ~30 s Spielzeit
    this._eruptUntil = -1;
    this._bombCooldown = 0;

    // ---- Glutlicht über dem See ----
    this._light = new THREE.PointLight(0xff5a1a, 2.5, 1600);
    this._light.position.set(VOLCANO.x, this._baseY + 90, VOLCANO.z);
    scene.add(this._light);

    // ---- Rauchsäule ----
    const smokeMat = new THREE.MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    {
      const r = uv().sub(0.5).length().mul(2.0);
      const n = triNoise3D(vec3(uv().x.mul(2.2), uv().y.mul(2.2).sub(time.mul(0.14)), 4.2), 0.12, time);
      const disk = float(1.0).sub(smoothstep(0.2, 1.0, r));
      smokeMat.opacityNode = disk.mul(n.mul(0.85).add(0.15)).saturate().mul(0.34);
      smokeMat.colorNode = mix(color(0x2f2b28), color(0x8b847c), uv().y);
    }
    const smokeGeo = new THREE.PlaneGeometry(1, 1);
    this._smoke = [];
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const m = new THREE.Mesh(smokeGeo, smokeMat);
      m.frustumCulled = false;
      m.userData = { off: i / SMOKE_COUNT, drift: 0.7 + (i % 3) * 0.25 };
      scene.add(m);
      this._smoke.push(m);
    }
  }

  /**
   * @param {number} dt          Frame-Zeit
   * @param {number} t           Spielzeit
   * @param {THREE.Vector3} playerPos  für das Beben in Vulkannähe
   */
  update(dt, t, playerPos) {
    // ---- Eruptions-Zyklus ----
    if (t >= this._nextEruption) {
      this._eruptUntil = t + ERUPT_LEN;
      this._nextEruption = t + 75 + Math.random() * 50;
    }
    const erupting = t < this._eruptUntil;

    // Beim Ausbruch: Lava heller, Licht stärker, dichterer Rauch
    const boost = erupting ? 2.3 : 1;
    this._uBoost.value += (boost - this._uBoost.value) * Math.min(1, dt * 2);
    const flicker = Math.sin(t * 6.7) * 0.35 + Math.sin(t * 17.3) * 0.25;
    this._light.intensity = (2.3 + flicker) * this._uBoost.value;

    // Lavabomben: ballistisch aus dem Krater, verlöschen am Boden
    if (erupting) {
      this._bombCooldown -= dt;
      if (this._bombCooldown <= 0) {
        this._bombCooldown = 0.45;
        const b = this._bombs.find((x) => !x.active);
        if (b) {
          b.active = true;
          b.mesh.visible = true;
          b.mesh.position.set(
            VOLCANO.x + (Math.random() - 0.5) * 160,
            this._baseY + 20,
            VOLCANO.z + (Math.random() - 0.5) * 160
          );
          b.vel.set((Math.random() - 0.5) * 190, 150 + Math.random() * 110, (Math.random() - 0.5) * 190);
        }
      }
    }
    for (const b of this._bombs) {
      if (!b.active) continue;
      b.vel.y -= 95 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 5;
      b.mesh.rotation.z += dt * 3.7;
      const p = b.mesh.position;
      if (p.y <= heightAt(p.x, p.z) + 2) { b.active = false; b.mesh.visible = false; }
    }

    // Beben in Vulkannähe während des Ausbruchs (nach dem Kamera-Rig!)
    if (erupting && playerPos) {
      const d = Math.hypot(playerPos.x - VOLCANO.x, playerPos.z - VOLCANO.z);
      if (d < 2600) {
        const amp = (1 - d / 2600) * 1.7;
        camera.position.x += (Math.random() - 0.5) * amp;
        camera.position.y += (Math.random() - 0.5) * amp;
      }
    }

    // Rauch-Billboards steigen im Kreislauf auf, wachsen und driften im Wind
    const thick = erupting ? 1.5 : 1;
    for (const m of this._smoke) {
      const u = m.userData;
      const p = (t / CYCLE + u.off) % 1;
      m.position.set(
        VOLCANO.x + Math.sin(t * 0.13 + u.off * 9) * 50 + p * 320 * u.drift, // Windversatz
        this._baseY + 60 + p * RISE,
        VOLCANO.z + Math.cos(t * 0.11 + u.off * 7) * 50 + p * 140
      );
      const s = (200 + p * 620) * thick;
      m.scale.set(s, s * 0.8, 1);
      m.quaternion.copy(camera.quaternion);
    }
  }
}

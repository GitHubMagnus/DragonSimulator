// Große Wasserfläche auf Meereshöhe, die dem Spieler folgt. Mehrere sich
// kreuzende Wellenzüge verformen die Fläche (Vertex); die Wellennormale wird
// im Fragment analytisch aus denselben Wellen (plus feiner Ripple-Wellen)
// berechnet — dadurch glitzert die Sonne physikalisch plausibel auf dem
// Wasser. Fresnel steuert Farbe und Deckkraft: flacher Blick → Himmelsspiegel,
// steiler Blick → tiefes Blau. Der Sonnenglitzer ist HDR und blüht im Bloom.
import * as THREE from "three";
import {
  positionLocal, positionWorld, cameraPosition, time, vec3, color, mix, uniform,
  float, normalize, transformNormalToView,
} from "three/tsl";
import { WORLD, WATER_LEVEL } from "./config.js";
import { SUN_DIR } from "./scene.js";

// Wellenzüge: Richtung (dx, dz), Frequenz, Amplitude, Tempo.
// Die ersten vier verformen das Mesh, die letzten beiden sind reine
// Normal-Ripples (zu fein fürs Gitter, aber wichtig fürs Glitzern).
const WAVES = [
  { dx: 1.0, dz: 0.55, f: 0.012, a: 2.2, s: 0.9 },
  { dx: -0.45, dz: 1.0, f: 0.014, a: 1.6, s: 0.7 },
  { dx: 0.8, dz: -0.6, f: 0.031, a: 0.7, s: 1.4 },
  { dx: -0.9, dz: -0.35, f: 0.026, a: 0.9, s: 1.1 },
];
const RIPPLES = [
  { dx: 0.7, dz: 0.9, f: 0.11, a: 0.16, s: 2.6 },
  { dx: -1.0, dz: 0.25, f: 0.16, a: 0.10, s: 3.3 },
];

export class Water {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WORLD * 1.6, WORLD * 1.6, 128, 128);
    geo.rotateX(-Math.PI / 2); // Fläche liegt in der XZ-Ebene (lokal)

    const mat = new THREE.MeshStandardNodeMaterial({
      transparent: true, roughness: 0.16, metalness: 0.0,
    });

    this._offset = uniform(new THREE.Vector2());
    const wx = positionLocal.x.add(this._offset.x);
    const wz = positionLocal.z.add(this._offset.y);

    // Höhe + analytische Ableitungen der Wellensumme aufbauen.
    const term = (w) => wx.mul(w.dx * w.f).add(wz.mul(w.dz * w.f)).add(time.mul(w.s));
    let height = float(0), dhdx = float(0), dhdz = float(0);
    for (const w of WAVES) {
      const ph = term(w);
      height = height.add(ph.sin().mul(w.a));
      dhdx = dhdx.add(ph.cos().mul(w.a * w.dx * w.f));
      dhdz = dhdz.add(ph.cos().mul(w.a * w.dz * w.f));
    }
    for (const w of RIPPLES) { // nur Normale, keine Verformung
      const ph = term(w);
      dhdx = dhdx.add(ph.cos().mul(w.a * w.dx * w.f));
      dhdz = dhdz.add(ph.cos().mul(w.a * w.dz * w.f));
    }

    mat.positionNode = positionLocal.add(vec3(0, height, 0));

    // Wellennormale (Objektraum = Weltausrichtung, Ebene liegt in XZ).
    const nrm = normalize(vec3(dhdx.negate(), 1.0, dhdz.negate()));
    mat.normalNode = transformNormalToView(nrm);

    // Fresnel: flacher Blickwinkel → Himmelsfarbe + deckender.
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const fres = float(1.0).sub(nrm.dot(viewDir).saturate()).pow(3.0);

    const crest = height.mul(0.09).add(0.5).saturate();
    const base = mix(color(0x0b3554), color(0x2b6d99), crest);
    mat.colorNode = mix(base, color(0xa9c9e6), fres.mul(0.7));
    mat.opacityNode = mix(float(0.74), float(0.97), fres);

    // Sonnenglitzer: Spiegelung der Blickrichtung gegen die Wellennormale,
    // eng gebündelt und HDR-hell → funkelnde Glanzlichter mit Bloom.
    const refl = viewDir.negate().reflect(nrm);
    const glint = refl.dot(uniform(SUN_DIR)).max(0.0).pow(220.0).mul(3.0);
    mat.emissiveNode = color(0xfff2cc).mul(glint);

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(playerX, playerZ) {
    this._offset.value.set(playerX, playerZ);
    this.mesh.position.set(playerX, WATER_LEVEL - 0.5, playerZ);
  }
}

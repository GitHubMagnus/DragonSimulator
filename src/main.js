// Kompositions-Wurzel: erstellt alle Systeme, verdrahtet sie und treibt die
// Animationsschleife an. Spiel-Logik liegt in den jeweiligen Modulen.
import * as THREE from "three";

import { RECENTER_DIST, STEP, FLIERS } from "./config.js";
import { scene, camera, renderer, updateSky, postFx } from "./scene.js";
import { Terrain } from "./terrain.js";
import { Trees } from "./trees.js";
import { Structures } from "./structures.js";
import { Clouds } from "./clouds.js";
import { Birds } from "./birds.js";
import { Water } from "./water.js";
import { createFliers } from "./fliers.js";
import { FireBreath } from "./fire.js";
import { Bullets } from "./bullets.js";
import { FlightModel } from "./flight.js";
import { Input } from "./input.js";
import { CameraRig } from "./cameraRig.js";
import { Hud } from "./hud.js";
import { StartMenu } from "./menu.js";

// ---- Systeme ----
const terrain = new Terrain(scene);
const trees = new Trees(scene);
const structures = new Structures(scene);
const clouds = new Clouds(scene);
const birds = new Birds(scene);
const water = new Water(scene);
const fliers = createFliers(scene); // { dragon, airplane, icarus }
const fire = new FireBreath(scene);
const bullets = new Bullets(scene);
const input = new Input();
const rig = new CameraRig(camera);
const hud = new Hud();

// Nur das aktive Fluggerät ist sichtbar; das Menü wechselt es.
let active = fliers.dragon;
for (const id in fliers) fliers[id].group.visible = false;
active.group.visible = true;

const flight = new FlightModel(active);

// ---- Zustand ----
const center = { x: 0, z: 0 }; // Weltmittelpunkt, dem die Welt folgt
let started = false;
let time = 0;

// ---- Welt-Verwaltung ----
function rebuildWorld() {
  terrain.rebuild(center.x, center.z);
  trees.place(center.x, center.z);
  structures.update(center.x, center.z);
}

function resetFlight() {
  flight.reset();
  center.x = 0;
  center.z = 0;
  structures.clear();
  rebuildWorld();
  fire.reset();
  bullets.reset();
  hud.hideCrash();
}

/** Welt nachziehen, wenn das Fluggerät zu weit vom Mittelpunkt entfernt ist. */
function recenterIfNeeded() {
  const dx = active.position.x - center.x;
  const dz = active.position.z - center.z;
  if (Math.abs(dx) > RECENTER_DIST || Math.abs(dz) > RECENTER_DIST) {
    center.x += Math.round(dx / STEP) * STEP;
    center.z += Math.round(dz / STEP) * STEP;
    rebuildWorld();
  }
}

/** Im Menü gewähltes Fluggerät aktiv schalten (ohne Kamerasprung). */
function selectFlier(id) {
  active.group.visible = false;
  const next = fliers[id];
  next.position.copy(active.position);
  next.quaternion.copy(active.quaternion);
  active = next;
  active.group.visible = true;
  flight.setFlier(active);
  hud.setThrottleLabel(id === "airplane" ? "SCHUB" : "SCHLAG");
}

// ---- Verdrahtung ----
flight.onCrash = () => hud.showCrash();
input.onPress("KeyR", resetFlight);
input.onPress("KeyC", () => rig.toggle());

const menu = new StartMenu({
  fliers: FLIERS,
  onFlier: (id) => selectFlier(id),
  onColor: (hex) => active.setColor(hex),
  onStart: () => {
    resetFlight();
    started = true;
  },
});

/** Nach einem Crash zurück zur Fluggerät-Auswahl. */
function returnToMenu() {
  resetFlight();
  started = false;
  menu.open();
}

document.getElementById("respawnBtn").addEventListener("click", resetFlight);
document.getElementById("menuBtn").addEventListener("click", returnToMenu);

// ---- Animationsschleife ----
const timer = new THREE.Timer();
function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  time += dt;

  if (started) flight.update(dt, input);
  active.update(time, flight.throttle);
  const firing = started && flight.firing;
  fire.update(dt, active, flight.forward, firing && active.fireMode === "flame", flight.speed);
  bullets.update(dt, active, flight.forward, firing && active.fireMode === "shots", flight.speed);

  if (started) recenterIfNeeded();

  water.update(active.position.x, active.position.z);
  updateSky();
  clouds.update(dt, active.position.x, active.position.z);
  birds.update(dt, time, active.position.x, active.position.z);
  rig.update(dt, active, flight.forward, started, time);
  if (started) hud.update(flight, active, flight.forward);

  postFx.render();
}

resetFlight();
// WebGPU asynchron initialisieren, dann die vom Renderer getriebene Schleife starten.
await renderer.init();
renderer.setAnimationLoop(animate);

// Kompositions-Wurzel: erstellt alle Systeme, verdrahtet sie und treibt die
// Animationsschleife an. Spiel-Logik liegt in den jeweiligen Modulen.
import * as THREE from "three";

import { RECENTER_DIST, STEP, DRAGON_PALETTE } from "./config.js";
import { scene, camera, renderer, updateSky } from "./scene.js";
import { Terrain } from "./terrain.js";
import { Trees } from "./trees.js";
import { Structures } from "./structures.js";
import { Clouds } from "./clouds.js";
import { Water } from "./water.js";
import { Dragon } from "./dragon.js";
import { FireBreath } from "./fire.js";
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
const water = new Water(scene);
const dragon = new Dragon(scene);
const fire = new FireBreath(scene);
const flight = new FlightModel(dragon);
const input = new Input();
const rig = new CameraRig(camera);
const hud = new Hud();

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
  hud.hideCrash();
}

/** Welt nachziehen, wenn der Drache zu weit vom Mittelpunkt entfernt ist. */
function recenterIfNeeded() {
  const dx = dragon.position.x - center.x;
  const dz = dragon.position.z - center.z;
  if (Math.abs(dx) > RECENTER_DIST || Math.abs(dz) > RECENTER_DIST) {
    center.x += Math.round(dx / STEP) * STEP;
    center.z += Math.round(dz / STEP) * STEP;
    rebuildWorld();
  }
}

// ---- Verdrahtung ----
flight.onCrash = () => hud.showCrash();
input.onPress("KeyR", resetFlight);
input.onPress("KeyC", () => rig.toggle());

new StartMenu(DRAGON_PALETTE, dragon, () => {
  resetFlight();
  started = true;
});

// ---- Animationsschleife ----
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (started) flight.update(dt, input, fire);
  dragon.update(time, flight.throttle);
  fire.update(dt, dragon);

  if (started) recenterIfNeeded();

  water.update(dragon.position.x, dragon.position.z);
  updateSky();
  clouds.update(dt, dragon.position.x, dragon.position.z);
  rig.update(dt, dragon, flight.forward, started, time);
  if (started) hud.update(flight, dragon, flight.forward);

  renderer.render(scene, camera);
}

resetFlight();
animate();

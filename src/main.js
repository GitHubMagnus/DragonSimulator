// Kompositions-Wurzel: erstellt alle Systeme, verdrahtet sie und treibt die
// Animationsschleife an. Spiel-Logik liegt in den jeweiligen Modulen.
import * as THREE from "three";

import { RECENTER_DIST, STEP, FLIERS } from "./config.js";
import { loadIsland } from "./map.js";
import { scene, camera, renderer, updateSky, postFx, uNight } from "./scene.js";
import { Terrain } from "./terrain.js";
import { Trees } from "./trees.js";
import { Flowers } from "./flowers.js";
import { Structures, SMOKE_SPOTS } from "./structures.js";
import { Clouds } from "./clouds.js";
import { Birds, Gulls } from "./birds.js";
import { Water } from "./water.js";
import { createFliers } from "./fliers.js";
import { Volcano } from "./volcano.js";
import { Animals } from "./animals.js";
import { Traffic } from "./traffic.js";
import { ChimneySmoke } from "./smoke.js";
import { Weather } from "./weather.js";
import { FireBreath } from "./fire.js";
import { Bullets } from "./bullets.js";
import { HeatVision } from "./heatvision.js";
import { FlightModel } from "./flight.js";
import { Input } from "./input.js";
import { CameraRig } from "./cameraRig.js";
import { Hud } from "./hud.js";
import { StartMenu } from "./menu.js";

// ---- Systeme ----
const terrain = new Terrain(scene);
const trees = new Trees(scene);
const flowers = new Flowers(scene);
const structures = new Structures(scene);
const clouds = new Clouds(scene);
const birds = new Birds(scene);
const gulls = new Gulls(scene);
const water = new Water(scene);
const weather = new Weather();
const fliers = createFliers(scene); // { dragon, airplane, icarus }
const fire = new FireBreath(scene);
const bullets = new Bullets(scene);
// UFO: grün glühende Energie-Laser (schneller, dicker, ohne Fallgravitation)
const lasers = new Bullets(scene, {
  tailColor: 0x1fd060, headColor: 0xb8ffd0, flashColor: 0xa0ffb0, lightColor: 0x40ff70,
  sparkCol: [0.6, 3.2, 1.0], speed: 1150, cooldown: 0.09, gravity: 0,
  radius: [2.6, 2.6], length: 10, flashTime: 0.06, // fette Plasmakugeln
});
const heat = new HeatVision(scene); // Supermans Hitzeblick
const input = new Input();
const rig = new CameraRig(camera);
const hud = new Hud();

// Alle Fluggeräte werfen Schatten auf die Welt. Transparente Teile (Kanzel,
// Propellerscheibe) sind ausgenommen — sie würden sonst voll-deckende
// Schatten werfen. Vögel werfen keine: ihre winzigen Schatten sind kaum
// sichtbar, kosten aber hunderte Draw-Calls im Schatten-Pass.
const enableShadow = (o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; };
for (const id in fliers) fliers[id].group.traverse(enableShadow);

// Nur das aktive Fluggerät ist sichtbar; das Menü wechselt es.
let active = fliers.dragon;
for (const id in fliers) fliers[id].group.visible = false;
active.group.visible = true;

const flight = new FlightModel(active);

// Werden nach dem Laden der Insel-Karte erzeugt (brauchen die Kartenhöhen).
let volcano, animals, traffic;

// ---- Zustand ----
const center = { x: 0, z: 0 }; // Weltmittelpunkt, dem die Welt folgt
let started = false;
let time = 0;
const igOrigin = new THREE.Vector3(); // Mündungspunkt für den Flammen-Trefferkegel

// ---- Welt-Verwaltung ----
function rebuildWorld() {
  terrain.rebuild(center.x, center.z);
  trees.place(center.x, center.z);
  flowers.place(center.x, center.z);
  structures.update(center.x, center.z);
}

function resetFlight() {
  flight.reset();
  center.x = 0;
  center.z = 0;
  // Entwicklungs-Helfer: #at=x,z[,höhe][,tSEK] in der URL startet den Flug
  // dort, optional zu einer bestimmten Tageszeit (Spielzeit in Sekunden;
  // z. B. http://localhost:8000/#at=-2500,3400,500,t210 → Stadt bei Nacht).
  const m = location.hash.match(/^#at=(-?\d+),(-?\d+)(?:,(\d+))?(?:,t(\d+))?$/);
  if (m) {
    active.position.set(+m[1], m[3] ? +m[3] : 500, +m[2]);
    center.x = Math.round(active.position.x / STEP) * STEP;
    center.z = Math.round(active.position.z / STEP) * STEP;
    if (m[4]) time = +m[4];
    globalThis.__pos = active.position; // Dev: Position in der Konsole abfragbar
    globalThis.__dbg = { scene, camera, renderer, trees, structures, lasers, heat, flight }; // Dev: Szene inspizieren
  }
  structures.clear();
  rebuildWorld();
  fire.reset();
  bullets.reset();
  lasers.reset();
  heat.reset();
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
  hud.setThrottleLabel(["airplane", "ufo", "superman"].includes(id) ? "SCHUB" : "SCHLAG");
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
  lasers.update(dt, active, flight.forward, firing && active.fireMode === "lasers", flight.speed);
  heat.update(dt, active, flight.forward, firing && active.fireMode === "beams");

  // Drachenfeuer und Hitzeblick entzünden getroffene Bäume.
  trees.update(dt, time);
  if (firing && active.fireMode === "flame") {
    igOrigin.copy(active.fireMuzzle).applyQuaternion(active.quaternion).add(active.position);
    trees.igniteCone(igOrigin, flight.forward, 520, 0.9);
  }
  if (firing && active.fireMode === "beams" && heat.length > 0) {
    trees.igniteCone(heat.origin, heat.dir, heat.length + 80, 0.985);
  }

  if (started) recenterIfNeeded();

  water.update(active.position.x, active.position.z);
  structures.animate(dt);                       // Mühlenflügel, Leuchtturmstrahl
  animals.update(dt, time, active.position);    // Herden grasen/fliehen
  traffic.update(dt, time);                     // Karren, Schiffe, Fischerboot
  gulls.update(dt, time);
  updateSky(time);                              // Tag-Nacht-Zyklus
  weather.update(dt, active.position, time);    // Regenschauer (nach updateSky: Nebel)
  clouds.update(dt, active.position.x, active.position.z);
  birds.update(dt, time, active.position.x, active.position.z);
  rig.update(dt, active, flight.forward, started, time);
  volcano.update(dt, time, active.position);    // nach dem Rig: Beben wirkt auf die Kamera
  for (const l of structures.nightLights) l.intensity = uNight.value * l.userData.base;
  if (started) hud.update(flight, active, flight.forward);

  postFx.render();
}

// Erst die feste Insel-Karte laden (alle Höhenabfragen hängen daran), dann
// die handgestalteten Landmarken (Burg, Stadt, Fischerdorf, Vulkan) aufbauen,
// die Welt erzeugen und die vom Renderer getriebene Schleife starten.
await loadIsland("assets/island.png");
volcano = new Volcano(scene);
structures.buildLandmarks();
animals = new Animals(scene);
traffic = new Traffic(scene);
new ChimneySmoke(scene, SMOKE_SPOTS); // Kamin-Positionen entstehen in buildLandmarks()
resetFlight();
await renderer.init();
renderer.setAnimationLoop(animate);

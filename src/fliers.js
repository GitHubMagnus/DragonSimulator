// Factory: erzeugt je eine Instanz jedes Fluggeräts und liefert sie nach id.
// main.js blendet jeweils nur das aktive sichtbar ein.
import { Dragon } from "./dragon.js";
import { Airplane } from "./airplane.js";
import { Icarus } from "./icarus.js";
import { Superman } from "./superman.js";
import { Ufo } from "./ufo.js";
import { Phoenix } from "./phoenix.js";

export function createFliers(scene) {
  return {
    dragon: new Dragon(scene),
    airplane: new Airplane(scene),
    icarus: new Icarus(scene),
    superman: new Superman(scene),
    ufo: new Ufo(scene),
    phoenix: new Phoenix(scene),
  };
}

// Factory: erzeugt je eine Instanz jedes Fluggeräts und liefert sie nach id.
// main.js blendet jeweils nur das aktive sichtbar ein.
import { Dragon } from "./dragon.js";
import { Airplane } from "./airplane.js";
import { Icarus } from "./icarus.js";

export function createFliers(scene) {
  return {
    dragon: new Dragon(scene),
    airplane: new Airplane(scene),
    icarus: new Icarus(scene),
  };
}

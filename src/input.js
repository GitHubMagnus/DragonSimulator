// Tastatureingabe. Gedrückte Tasten werden gehalten abgefragt (Steuerung),
// einmalige Tastendrücke über onPress() (z. B. Neustart, Kamera).
const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "Space"]);

export class Input {
  constructor() {
    this._keys = {};
    this._pressHandlers = {};

    addEventListener("keydown", (e) => {
      if (!this._keys[e.code]) this._pressHandlers[e.code]?.();
      this._keys[e.code] = true;
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => { this._keys[e.code] = false; });
  }

  isDown(code) {
    return !!this._keys[code];
  }

  /** Callback für einen einzelnen Tastendruck registrieren. */
  onPress(code, fn) {
    this._pressHandlers[code] = fn;
  }

  /** Steuerachsen aus den aktuell gehaltenen Tasten. */
  axes() {
    let pitch = 0, roll = 0, yaw = 0;
    if (this._keys["KeyW"]) pitch -= 1;
    if (this._keys["KeyS"]) pitch += 1;
    if (this._keys["KeyA"]) yaw += 1;   // drehen (Yaw)
    if (this._keys["KeyD"]) yaw -= 1;
    if (this._keys["KeyQ"]) roll += 1;  // rollen
    if (this._keys["KeyE"]) roll -= 1;
    return { pitch, roll, yaw };
  }
}

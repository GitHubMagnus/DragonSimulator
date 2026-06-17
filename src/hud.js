// HUD: Tempo, Höhe, Flügelschlag-Stärke und Kompasskurs; Crash-Overlay.
const COMPASS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

export class Hud {
  constructor() {
    this._speed = document.getElementById("speed");
    this._alt = document.getElementById("alt");
    this._thr = document.getElementById("thr");
    this._thrLabel = document.getElementById("thrLabel");
    this._hdg = document.getElementById("hdg");
    this._crash = document.getElementById("crash");
  }

  /** Beschriftung der Schub-Anzeige je nach Fluggerät setzen. */
  setThrottleLabel(text) {
    if (this._thrLabel) this._thrLabel.textContent = text;
  }

  update(flight, dragon, forward) {
    this._speed.textContent = Math.round(flight.speed * 1.4);
    this._alt.textContent = Math.max(0, Math.round(dragon.position.y));
    this._thr.textContent = Math.round(flight.throttle * 100);

    let deg = (Math.atan2(forward.x, -forward.z) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    this._hdg.textContent = COMPASS[Math.round(deg / 45) % 8];
  }

  showCrash() { this._crash.classList.add("show"); }
  hideCrash() { this._crash.classList.remove("show"); }
}

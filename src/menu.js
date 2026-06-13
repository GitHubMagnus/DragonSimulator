// Startmenü: Auswahl der Drachenfarbe und Start des Flugs.
export class StartMenu {
  /**
   * @param {Array<{name:string, hex:number}>} palette  Verfügbare Farben
   * @param {Dragon} dragon  wird live eingefärbt
   * @param {() => void} onStart  Aufruf beim Klick auf „Flug beginnen"
   */
  constructor(palette, dragon, onStart) {
    this._el = document.getElementById("menu");
    const colors = document.getElementById("colors");
    const startBtn = document.getElementById("startBtn");

    this._chosen = palette[0].hex;

    palette.forEach((c, i) => {
      const sw = document.createElement("div");
      sw.className = "swatch" + (i === 0 ? " selected" : "");
      sw.style.background = "#" + c.hex.toString(16).padStart(6, "0");
      sw.title = c.name;
      sw.addEventListener("click", () => {
        this._chosen = c.hex;
        colors.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
        sw.classList.add("selected");
        dragon.setColor(c.hex);
      });
      colors.appendChild(sw);
    });

    dragon.setColor(this._chosen);

    startBtn.addEventListener("click", () => {
      dragon.setColor(this._chosen);
      this._el.classList.add("hidden");
      onStart();
    });
  }
}

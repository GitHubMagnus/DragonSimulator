// Startmenü in zwei Schritten: zuerst das Fluggerät (Drache/Flugzeug/Ikarus),
// dann die Farbe. Färbt das gewählte Modell live in der Vorschau ein.
export class StartMenu {
  /**
   * @param {object}   cfg
   * @param {Array}    cfg.fliers   Definitionen aus config.FLIERS
   * @param {(id:string)=>void}   cfg.onFlier  aktives Modell wechseln
   * @param {(hex:number)=>void}  cfg.onColor  aktives Modell einfärben
   * @param {()=>void}            cfg.onStart  Flug starten
   */
  constructor({ fliers, onFlier, onColor, onStart }) {
    this._fliers = fliers;
    this._onFlier = onFlier;
    this._onColor = onColor;
    this._chosenColor = {}; // id -> hex (gemerkt je Fluggerät)
    this._current = fliers[0];

    this._menu = document.getElementById("menu");
    this._stepFlier = document.getElementById("step-flier");
    this._stepColor = document.getElementById("step-color");
    this._colors = document.getElementById("colors");
    this._fireHint = document.getElementById("fireHint");

    this._buildFlierCards();

    document.getElementById("toColorBtn").addEventListener("click", () => this._goToColor());
    document.getElementById("backBtn").addEventListener("click", () => this._goToFlier());
    document.getElementById("startBtn").addEventListener("click", () => {
      this._menu.classList.add("hidden");
      onStart();
    });

    // Anfangszustand: erstes Fluggerät aktiv + Standardfarbe
    this._selectFlier(fliers[0]);
  }

  _buildFlierCards() {
    const wrap = document.getElementById("fliers");
    this._fliers.forEach((f) => {
      const card = document.createElement("button");
      card.className = "flier-card";
      card.dataset.id = f.id;
      card.innerHTML =
        `<span class="ico">${f.emoji}</span>` +
        `<span class="nm">${f.label}</span>` +
        `<span class="ds">${f.desc}</span>`;
      card.addEventListener("click", () => this._selectFlier(f));
      wrap.appendChild(card);
    });
  }

  _selectFlier(f) {
    this._current = f;
    document.querySelectorAll(".flier-card").forEach((c) =>
      c.classList.toggle("selected", c.dataset.id === f.id)
    );
    this._onFlier(f.id);

    // gemerkte oder Standardfarbe anwenden
    const hex = this._chosenColor[f.id] ?? f.palette[0].hex;
    this._chosenColor[f.id] = hex;
    this._onColor(hex);

    this._fireHint.style.display = f.fire ? "" : "none";
  }

  _buildColorSwatches() {
    const f = this._current;
    this._colors.innerHTML = "";
    f.palette.forEach((c) => {
      const sw = document.createElement("div");
      sw.className = "swatch" + (c.hex === this._chosenColor[f.id] ? " selected" : "");
      sw.style.background = "#" + c.hex.toString(16).padStart(6, "0");
      sw.title = c.name;
      sw.addEventListener("click", () => {
        this._colors.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
        sw.classList.add("selected");
        this._chosenColor[f.id] = c.hex;
        this._onColor(c.hex);
      });
      this._colors.appendChild(sw);
    });
  }

  _goToColor() {
    this._buildColorSwatches();
    this._stepFlier.classList.add("hidden");
    this._stepColor.classList.remove("hidden");
  }

  _goToFlier() {
    this._stepColor.classList.add("hidden");
    this._stepFlier.classList.remove("hidden");
  }
}

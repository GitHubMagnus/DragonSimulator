# 🐉 Drachenflug — Mittelalter

Ein Browser-Flugspiel mit [Three.js](https://threejs.org/). Du wählst dein
Fluggerät — **Drache 🐉**, **Flugzeug ✈️** oder **Ikarus 🪶** — und dessen Farbe,
und fliegst dann durch ein endloses, mittelalterliches Königreich mit Gebirgen,
Wäldern, Dörfern und Burgen. Drache und Flugzeug können Feuer/Beschuss nach vorn
abgeben.

### ▶ [**Jetzt im Browser spielen**](https://githubmagnus.github.io/DragonSimulator/)

Kein Download, keine Installation — einfach den Link öffnen.

## Starten

### Online (empfohlen)

Direkt im Browser spielen: <https://githubmagnus.github.io/DragonSimulator/>

### Lokal

Repo klonen, lokalen Server starten und im Browser öffnen:

```bash
git clone https://github.com/GitHubMagnus/DragonSimulator.git
cd DragonSimulator
node server.mjs
# dann http://localhost:8000 öffnen
```

Voraussetzung: [Node.js](https://nodejs.org/) installiert. Three.js (r0.183, der
**WebGPU**-Build) wird per CDN geladen — eine Internetverbindung ist nötig. Das
Rendering läuft über den `WebGPURenderer`; Browser ohne WebGPU (z. B. ältere
Safari/Firefox) fallen automatisch auf **WebGL2** zurück.

> Ein lokaler Server ist nötig, weil Browser ES-Modul-`import`s über das
> `file://`-Protokoll blockieren. Die Online-Version (GitHub Pages) liefert die
> Dateien per HTTPS aus und braucht daher keinen lokalen Server.

## Steuerung

| Taste | Funktion |
|-------|----------|
| `W` / `S` | Nase senken / heben |
| `A` / `D` | Drehen links / rechts (Yaw) |
| `Q` / `E` | Rollen links / rechts |
| `↑` / `↓` | Flügelschlag schneller / langsamer (Schub) |
| `Leertaste` | Feuer / Beschuss 🔥 (nur Drache & Flugzeug) |
| `C` | Kamera (Verfolger / Cockpit) |
| `R` | Neustart |

Im Startmenü wählst du zuerst das **Fluggerät**, dann dessen **Farbe**.

## Welt & Details

- **Gebirge** durch Ridged-Noise mit Bergmaske — Schneegipfel, Felsen, Täler.
- **Dichte Mischwälder**: zehntausende instanzierte Nadel- und Laubbäume, in
  natürlichen Clustern (Wald-Dichtefeld) mit Lichtungen; das Laub schwingt per
  TSL-Vertex-Wind. Bäume meiden Wasser und Gipfel.
- **Dörfer** aus Fachwerkhäusern mit Dächern, Türen und Schornsteinen.
- **Burgen** mit Bergfried, vier Ecktürmen, Zinnen, Ringmauer, Tor und wehenden Fahnen.
- **Endlose Welt**: Terrain, Bäume und Bauwerke ziehen mit dem Drachen mit
  (Bauwerke werden inkrementell, deterministisch pro Rasterzelle erzeugt).
- **Fluggeräte** (je ein detailreiches Modell aus Primitiven):
  - **Drache** — Schuppenkörper, Rückenkamm, gehörnter Kopf mit Zähnen, glühende
    Augen, gegliederte Flügel (Knochen + Fingerstreben + Membran), wedelnder
    Schwanz, Flügelschlag abhängig vom Schub.
  - **Flugzeug** — Propellerjäger mit drehendem Propeller, gläserner Kanzel,
    Tragflächen mit V-Stellung, Leitwerk und Hoheitsabzeichen.
  - **Ikarus** — fliegende Figur mit großen, mehrreihig gefiederten Schwingen auf
    Wachs-/Armgerüst, Tunika und kräftigem Flügelschlag.
- **Atmosphäre**: Gradient-Himmel, Sonnenscheibe, driftende Wolken, Dunst (Fog),
  Feuerbälle mit Lichtschein.

## Projektstruktur

Der Code ist in kleine ES-Module mit je einer Verantwortung aufgeteilt:

```
DragonSimulator/
├── index.html        # Seitengerüst, HUD, Menü- und Crash-Overlay
├── style.css         # Oberfläche (Mittelalter-Optik)
├── server.mjs        # kleiner lokaler Node-Server
└── src/
    ├── main.js       # Kompositions-Wurzel + Animationsschleife
    ├── config.js     # alle einstellbaren Konstanten & Drachen-Palette
    ├── noise.js      # prozedurales Höhenrauschen (heightAt)
    ├── scene.js      # Renderer, Szene, Kamera, Licht, Himmel
    ├── terrain.js    # endloses Low-Poly-Terrain
    ├── trees.js      # dichte Mischwälder (instanziert) + TSL-Windschwung
    ├── structures.js # Burgen & Dörfer (Geometrie-Merging)
    ├── clouds.js     # driftende Wolken
    ├── water.js      # Wasserfläche
    ├── flier.js      # gemeinsame Basisklasse aller Fluggeräte
    ├── fliers.js     # Factory: erzeugt alle Fluggeräte nach id
    ├── dragon.js     # Drachen-Modell + Animation
    ├── airplane.js   # Flugzeug-Modell + Propelleranimation
    ├── icarus.js     # Ikarus-Modell + Federschwingen-Animation
    ├── fire.js       # Feuer/Beschuss nach vorn
    ├── flight.js     # Arcade-Flugphysik (fluggerät-unabhängig)
    ├── input.js      # Tastatursteuerung
    ├── cameraRig.js  # Kameraführung (Verfolger/Cockpit/Vorschau)
    ├── hud.js        # HUD-Anzeigen
    └── menu.js       # Startmenü: Fluggerät- und Farbwahl (zwei Schritte)
```

**Architekturprinzipien:**
- `main.js` ist die einzige Stelle, die Module zusammensteckt — die Systeme
  kennen sich gegenseitig nicht direkt.
- Reine Funktionen (`noise.js`) sind von Zustand und Rendering getrennt.
- Jedes Welt-/Entitäts-System ist eine Klasse mit klarer API
  (`update()`, `rebuild()`, `reset()` …) und kapselt seine Three.js-Objekte.
- Alle Fluggeräte erben von `Flier` und teilen dieselbe Schnittstelle
  (`position`, `quaternion`, `setColor()`, `update()`), sodass Flugphysik,
  Kamera, Feuer und HUD unverändert mit jedem Modell funktionieren.
- Alle Tuning-Werte liegen zentral in `config.js`.

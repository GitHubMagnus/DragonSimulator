# 🐉 Drachenflug — Mittelalter

Ein Browser-Flugspiel mit [Three.js](https://threejs.org/). Du steuerst einen
animierten Drachen durch ein endloses, mittelalterliches Königreich mit Gebirgen,
Wäldern, Dörfern und Burgen — und kannst Feuer speien.

## Starten

Repo klonen, lokalen Server starten und im Browser öffnen:

```bash
git clone https://github.com/GitHubMagnus/DragonSimulator.git
cd DragonSimulator
node server.mjs
# dann http://localhost:8000 öffnen
```

Voraussetzung: [Node.js](https://nodejs.org/) installiert. Three.js wird per CDN
geladen — eine Internetverbindung ist nötig.

## Steuerung

| Taste | Funktion |
|-------|----------|
| `W` / `S` | Nase senken / heben |
| `A` / `D` | Drehen links / rechts (Yaw) |
| `Q` / `E` | Rollen links / rechts |
| `↑` / `↓` | Flügelschlag schneller / langsamer (Schub) |
| `Leertaste` | Feuer speien 🔥 |
| `C` | Kamera (Verfolger / Cockpit) |
| `R` | Neustart |

## Welt & Details

- **Gebirge** durch Ridged-Noise mit Bergmaske — Schneegipfel, Felsen, Wälder, Täler.
- **Dörfer** aus Fachwerkhäusern mit Dächern, Türen und Schornsteinen.
- **Burgen** mit Bergfried, vier Ecktürmen, Zinnen, Ringmauer, Tor und wehenden Fahnen.
- **Endlose Welt**: Terrain, Bäume und Bauwerke ziehen mit dem Drachen mit
  (Bauwerke werden inkrementell, deterministisch pro Rasterzelle erzeugt).
- **Drache** mit Flügelschlag, wedelndem Schwanz, Hörnern, glühenden Augen.
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
    ├── trees.js      # instanzierte Tannenwälder
    ├── structures.js # Burgen & Dörfer (Geometrie-Merging)
    ├── clouds.js     # driftende Wolken
    ├── water.js      # Wasserfläche
    ├── dragon.js     # Drachen-Modell + Animation
    ├── fire.js       # Feueratem
    ├── flight.js     # Arcade-Flugphysik
    ├── input.js      # Tastatursteuerung
    ├── cameraRig.js  # Kameraführung (Verfolger/Cockpit/Vorschau)
    ├── hud.js        # HUD-Anzeigen
    └── menu.js       # Startmenü + Farbwahl
```

**Architekturprinzipien:**
- `main.js` ist die einzige Stelle, die Module zusammensteckt — die Systeme
  kennen sich gegenseitig nicht direkt.
- Reine Funktionen (`noise.js`) sind von Zustand und Rendering getrennt.
- Jedes Welt-/Entitäts-System ist eine Klasse mit klarer API
  (`update()`, `rebuild()`, `reset()` …) und kapselt seine Three.js-Objekte.
- Alle Tuning-Werte liegen zentral in `config.js`.

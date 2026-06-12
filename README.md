# ⛏ Foreuse Profonde

Jeu de forage type *Motherload* dans le navigateur : pilotez une foreuse, creusez
toujours plus profond, récoltez des minerais et revendez-les à la surface pour
améliorer votre machine.

## Lancer

```bash
bun install
bun run dev      # serveur de développement
bun run build    # build de production (dist/)
bun run preview  # sert le build de production
```

## Jouer

- **← → ↓** (ou ZQSD/WASD) : se déplacer et **creuser** les blocs adjacents
- **↑** : réacteur dorsal (consomme de l'essence)
- **E** : entrer dans le bâtiment le plus proche (à la surface)
- **T** : utiliser un téléporteur d'urgence
- **X** : larguer une dynamite sous la foreuse (mèche de 3 s — éloignez-vous !) ;
  c'est le seul moyen de détruire les **rochers**, mais l'explosion blesse
  aussi la foreuse

La boucle : creuser → récolter des minerais (de l'ironium à 30 $ jusqu'à
l'amazonite à 500 000 $, de plus en plus précieux avec la profondeur) →
remonter →
passer aux trois bâtiments de surface : le **comptoir de vente** (céder sa
cargaison), la **station essence** (refaire le plein) et l'**atelier**
(réparations, améliorations — vitesse de forage, réservoir, coque — et
téléporteurs d'urgence).

Attention aux chutes (dégâts de coque), aux **poches de lave** (forer dedans
brûle la coque — elles se multiplient passé ~120 m) et à la panne sèche : le
sauvetage vous ramène à la surface mais la cargaison est perdue. La partie est sauvegardée
automatiquement dans le navigateur (localStorage).

## Architecture

- **Bun + Vite + React 19 + TypeScript**, état UI partagé via **Zustand**
- Monde et physique dans une boucle de jeu Canvas 2D à pas fixe
  (`src/game/engine.ts`), génération procédurale seedée ligne par ligne
  (`src/game/world.ts`), rendu pixel-art 100 % procédural (`src/game/render.ts`)
- HUD et magasin en React (`src/ui/`), équilibrage centralisé dans
  `src/game/constants.ts`

## Test de fumée

Avec le serveur de dev lancé (port 5174) :

```bash
bun scripts/smoke.ts
```

Joue la boucle complète en Chromium headless : forage, jetpack, vente, plein,
améliorations, téléporteur, persistance de la sauvegarde.

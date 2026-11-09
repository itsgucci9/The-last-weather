# The Last Weather

This repository is the playable site. GitHub Pages serves it from `main`, folder `/` (root).

The Vite + React + TypeScript source lives in [`game/`](game/). `npm run build` there type-checks, writes `game/dist/`, and copies the built files here with relative asset paths (`base: ./`) and an empty `.nojekyll`. Do not commit a `.env`.

Open the game at [https://itsgucci9.github.io/The-last-weather/](https://itsgucci9.github.io/The-last-weather/).

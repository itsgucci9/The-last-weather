# The Last Weather — v0.7

A survival story in four chapters: crash on Vesper-6, beat the storm (or die trying), find the relay that kept the weather for 31 years, and choose a way home. No dice: every outcome follows from your choices and is shown before you commit.
Built with **React + TypeScript + Vite**, packaged for **Android and iOS with Capacitor**.
Five languages (EN, FR, ES, IT, PT-BR), plays offline, ambient sound, nothing to sign up for.

The playable site for GitHub Pages is the parent folder. `npm run build` writes `dist/` and, when this project lives in `game/` inside that repo, copies the build to the repository root (`base` is `./`, plus an empty `.nojekyll`). Do not commit a `.env`.

## Run it

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev        # play at the local address it prints (hot reload; no offline mode in dev)
npm run build      # production build in dist/, then copy it to the repo root for Pages
npm run preview    # serve dist/ locally
```

### Checks

| Command | What it checks |
|---|---|
| `npm run validate` | Story data, art and translations, then simulates **every** possible run (9,702 runs, 14,364 situations): no dead ends, nothing stuck, every ending, death and forced shelter reachable. Prints how often each outcome happens and where deaths occur. |
| `npm test` | 48 tests: survival thresholds, Storm Clock countdown, forced shelter, death-state locking, restart, preview equals result for every Vesper-6 choice, saves, translations; which meters show when; the short opening line; and a length limit on dialogue (no MICA line over 25 words). |
| `npm run qa` | Headless Chrome: Vesper-6 runs and a covering set of full runs through the real interface; the first-scene hint (no tour); the lethal two-tap confirm; phone and desktop layouts; keyboard play; 5 languages; offline, updates, sharing, sound, crash screen. Needs Chrome (set `CHROME_PATH` if not found). |
| `npm run check` | All of the above plus the type-checked build. Run it before every release. |

## How to play

Read the scene, check the status panel, pick a choice. Number keys pick a choice on a keyboard.

### Learning as you go

- **Play the first scene.** There is no tour and no caption. The choices pulse until the first tap, then that hint is gone.
- **One short line of story.** The opening line is a few words. **More** reveals the rest. What a choice did shows up on the meters, not in a “last action” box.
- **The game starts small.** The first screen shows only the three meters the first decision uses, as icons that fill and crack. Suit and Salvage appear when a choice first touches them, marked **New**.
- **The picture carries the weather.** Dust on the scene thickens as the Storm Clock falls, and a storm bank closes in when time runs out.
- **Menu → First hint → Show the first hint again:** the hint plays on your next new game.

### Reading a choice

Each choice is one card, with one meaning per line:

- **Title** (with its number on a keyboard), then a short description.
- **Costs** and **Gains**, on separate labelled lines under a rule: the exact amounts and items, with each meter's icon.
- **Deadly** (in red) when it would kill you, saying why; **Shelter** when it will force you into shelter.
- Options you **can't take yet** are listed apart and last, under "Not possible yet", each with what it **Needs**.

Where you are is said once, under the scene title: **Outside** (air or suit giving out here kills you), **In the storm** (the most dangerous place), or **Inside, sealed** (safe from the storm). Off the planet, where it no longer matters, the banner is not shown.

### Surviving Vesper-6 (chapters 1–2)

- **Where you are matters.** Every scene is *sealed* (the station, the shelter, the ship's cabin) or *exposed* (outside), and storm crossings are exposed to the storm. The banner under the scene title says which, and what it means.
- **Oxygen and Suit can kill you.** Oxygen reaching 0 outside means suffocation; the suit reaching 0 in the open means a breach. In a sealed place an empty meter is safe, but a cost larger than what you have is locked ("Oxygen: needs 2, you have 1"), never silently rounded down.
- **The Storm Clock** starts at 7 and drops with every slow action (shown as "−3 Storm Clock"). At 0 the storm has arrived: anything outside is fatal, and if you are sealed in the station it forces you into the shelter.
- **No surprises.** A choice that would kill you says so in red (**Deadly**: what will kill you) and needs a second tap (or the same number key twice). A choice that will force you into shelter says that too.
- **Shelter is always an option on the planet:** wait out the storm in the station, turn back from the storm front, or run from the ship. It ends the Vesper-6 part in "Signal in the Storm", and the story continues.
- **Death ends the run.** The death screen shows the cause, where it happened and the choice that led there, with **Try chapter N again** (back to the start of that chapter, as you entered it) or a new run. Deaths are listed separately on the title screen ("Ways to die"); they are not endings.

### The rest

- **Chapters:** the three ways off Vesper-6 (Clear Window, Hard Burn, Signal in the Storm) each lead into chapter 3, The Quiet Relay, then chapter 4, Home Vector, which has four endings. **Menu → Restart chapter** replays the current chapter from its start.
- **Sound:** wind, storm, engine and MICA's radio static, generated live (no audio files). Toggle with the speaker button in the top bar or in **Menu**. Starts on your first tap, pauses when the app is in the background.
- **Endings:** the title screen lists outcomes found, with a hint for each missing one. **Share** on a final ending opens the phone's share sheet, or copies a message with the link.
- **Saves:** progress saves on the device after every choice. **Menu → Restart run** starts over (it asks twice). The callsign is optional; MICA uses it.
- **Offline and updates (web):** after the first visit the game works without a connection. When a new version is published, players see "A new version of the game is ready · Reload"; their run is kept.

## Project layout

```
data/story.json           Scenes, choices, conditions, effects, endings, hints, sound moods (source of truth)
data/locales/*.json       Story translations (fr, es, it, pt-BR), keyed by scene/choice id
assets/*.svg              Handoff pixel art, used directly
asset-manifest.json       Alt text for every image
src/engine/               Platform-independent engine: pure TypeScript, no DOM, no randomness
src/ui/                   React interface (ErrorBoundary.tsx = the safety screen; guide.ts = what to show when; the first scene teaches by playing)
src/i18n/ui.ts            Interface strings (menus, labels) in 5 languages
src/audio.ts              Procedural ambience (Web Audio)
src/pwa.ts                Offline play and the update prompt (web only)
src/share.ts              Share sheet / clipboard
src/storage.ts            Local save (localStorage; works in browsers and the app WebViews)
scripts/build-sw.mjs      Writes dist/sw.js after each build (cache name = fingerprint of the files)
scripts/app-icons.mjs     App icons, splash, web icons and the link-preview image, from the pixel art
public/                   Copied as-is: manifest, icons, og-image.png, _headers (Netlify caching)
.env                      VITE_SITE_URL: the public address used in share messages and link previews
android/  ios/            Capacitor native shells
docs/                     The original handoff brief and design document
```

## Adding story content

Everything is data in `data/story.json`; the interface does not need changing.

- **Scene:** `id`, `chapter`, `title`, `art` (a file in `assets/`), `ambience` (`wind`, `interior`, `storm`, `launch`, `space`, `shelter`, `relay`, `field`), `exposure` (`sealed`, `exposed` or `storm`: required), `text`, `choices`. Optional `shelter`: a safe scene this place retreats to when the storm arrives or nothing else is open. Mark final endings with `"ending": true` (+ a `hint`), chapter closers with `"chapterEnd": true`.
- **Choice:** `label`, `detail` (say the cost and the danger in words), optional `conditions` (`all` = every item must pass, `any` = at least one; both groups when both exist), `effects` (`add` numbers; `set` flags), `next`, and `exposure` when the action happens somewhere else than the scene (a spacewalk from the cabin, a dash through the storm).
- **Survival meters (`stateRules`):** `lethal: "<cause>"` makes a meter fatal at 0 when exposed; `spend: true` locks a choice that costs more than is left; `clock: { cause, activeWhen }` makes a countdown (the Storm Clock). Every cause needs a death scene: a scene with `"death": "<cause>"` and no choices.
- **Deaths:** `death_asphyxiation`, `death_suit_breach`, `death_storm`. Their `textVariants` can mention what led there.
- **Consequences in later text:** `textVariants` on a scene add a paragraph (optionally spoken by MICA) when their conditions pass.
- **Status panel:** `stateRules` drive the meters; `flagRules` name the flags and choose which show in the pack (`hudWhen` hides an item when its conditions fail, e.g. the coupler once installed), the status line and the ending's field log.
- **Translations:** add the same ids to each `data/locales/<lang>.json`. `npm run validate` lists anything missing.

Run `npm run check` after editing.

## Changes to the handoff data, and why

The original scenes, choices and endings are all still there. Changed or added:

- **MICA talks less (v0.4.1, requested 9 Nov 2026):** her dialogue is down 39% (the opening from 57 words to 18). Lines that explained the rules (the storm count, "an empty tank is the end") are gone, since the interface shows them; the rest is shortened, keeping the plot (why she brought you down, the relay, the Halcyon). The keeper's briefing at the relay core moved from its speech to what its screen shows. In-game tips removed (too much text); the tour stays. Same changes in all 5 languages.
- **Clearer screens and a tutorial (v0.4.0, requested 9 Nov 2026):** costs and gains on separate labelled lines instead of tag boxes; the Outside/Storm tag on every choice replaced by one banner under the scene title; locked options grouped last; meters appear when they first matter; a guided first scene and one-time tips; Menu option to turn tips off or replay the tutorial. Choices now also list the items they give or use up. No story data changed.
- **Chapters 3–4 (v0.3.0):** The Quiet Relay and Home Vector, from the design document's chapter plan. The handoff's three endings now close the Vesper-6 part (chapters 1–2: Impact and The Last Weather) and each continues into chapter 3; chapter 4 has four endings. 14 new scenes, 9 new pixel-art scenes in the handoff's style, all translated.
- **Survival that can kill (v0.3.0, requested 9 Nov 2026):** Oxygen and Suit are lethal at 0 outside; a Storm Clock (7) counts down on slow actions; three death scenes; every scene declares sealed/exposed/storm. Time costs: restore memory 1, Glass Ridge 1, Dry Ravine 3, copy archive 3, trench and filtered crossing 1, careful repair 1; the exposed ridge costs the suit 2. Chosen by simulating several settings: this is the only one where every outcome (3 deaths, forced shelter, all endings) is reachable with a Clear Window route from every start.
- **The automatic shelter fallback is gone.** Shelter now depends on your state: sealed in with somewhere safe to go, or a choice you make. Outside with no way forward is a death.
- **New choices:** "Take the coupler and wait out the storm in the shelter" (station) and "Turn back to the station shelter" (storm front), so a safe option always exists on the planet. Copying the archive no longer needs 2 oxygen: the risk is shown instead.
- **Balance (approved 9 Nov 2026, v0.2.0):** starting oxygen 4; careful repair needs Suit 2+.
- **Text fixes:** "Fit the *station* filter" → "Fit the *ravine* filter"; choice details now say what each action costs in time and danger.
- **`textVariants`:** earlier choices show up later; new lines warn when the clock or the air is low, and say what led to a death.
- **`launch.stay_sheltered` is hidden (`hideWhenLocked`):** in the supplied data it can never be picked. The validator reports this as a warning.
- **New fields:** `exposure`, `shelter`, `death`, `chapter`, `chapterEnd`, `hint`, `ambience`; meters with `lethal`, `spend`, `clock`, `hudWhen`; `flagRules` with `hudWhen`.

## Publishing the web version on Netlify (one deploy)

To use as few Netlify credits as possible, build on your computer and deploy only the finished `dist/` folder, once per release:

1. Check `.env`: `VITE_SITE_URL` must be the final address (default `https://the-last-weather.netlify.app/`). If Netlify gives the site another name, change it here first.
2. `npm run check` (everything must pass), which also leaves a fresh `dist/`.
3. Deploy `dist/`: drag the folder onto Netlify's "Deploy manually" area, or `npx netlify deploy --prod --dir=dist`. `dist/_headers` sets the caching (built files cached for a year, the page and service worker always re-checked).
4. On your phone: open the address, play a scene, then turn on airplane mode and reload to confirm offline play. On iPhone, Share → Add to Home Screen.
5. Paste the link in WhatsApp to check the preview image.

Every later deploy is picked up automatically: the service worker's cache name is a fingerprint of the files, so there is no version to bump by hand. Bump `version` in `package.json` when you want the number shown in **Menu** to change.

Netlify's free plan shows a small "Powered by Netlify" badge in a corner; the page keeps space at the bottom so it never covers a button.

## Mobile apps (Capacitor)

The apps are the same web build inside a native WebView. No native plugins, accounts or network access are used. Saves stay on the device. The offline service worker is not used inside the apps (their files are already on the device).

### Android (works on your Windows PC)

1. Install [Android Studio](https://developer.android.com/studio) (it includes the Android SDK and Java).
2. In this folder: `npm install`, then `npm run cap:android`. This builds the game, copies it into `android/` and opens Android Studio.
3. In Android Studio, open the **Build** menu and choose the APK option (**Build APK(s)**, or **Generate App Bundles or APKs → Generate APKs** in newer versions). The file appears in `android/app/build/outputs/apk/debug/app-debug.apk`.
4. To install on a phone or tablet: copy the APK over and open it (allow "install unknown apps" when asked), or plug the device in with USB debugging on and press **Run**.

From a terminal instead: `npm run build`, `npx cap sync android`, then in `android/` run `gradlew.bat assembleDebug` (Windows) or `./gradlew assembleDebug` (macOS/Linux).

### iOS (needs a Mac with Xcode)

1. On a Mac with Xcode installed: `npm install`, then `npm run cap:ios`. Xcode opens the project.
2. Choose your team under **Signing & Capabilities**, pick a simulator or a connected iPhone, press **Run**.

Without a Mac: use a cloud macOS build service (for example Codemagic or GitHub Actions macOS runners), or publish the web version and add it to the iPhone home screen from Safari (it then runs full screen, offline, with its own icon).

### After any change

Run `npm run cap:sync` (builds and copies the game into both native projects), then rebuild in Android Studio or Xcode. Keep `versionCode`/`versionName` in `android/app/build.gradle` and the iOS version in sync with `package.json`.

### Icons, splash screen and link preview

`npm run images` renders MICA's pixel icon and the launch scene into `resources/`, `public/icons/` and `public/og-image.png`. `npm run cap:assets` does that and then generates every Android and iOS size.

### Before publishing to a store

- Change `appId` in `capacitor.config.ts` (currently `com.lastweather.prototype`) to a reverse-domain name you own, then run `npx cap sync`.
- Store release needs a signed build: a Google Play developer account for Android, and an Apple Developer Program membership for iOS. Both are paid and out of scope for this prototype.

## Limitations

- iOS builds need macOS and Xcode; they could not be built or tested here.
- The Android debug APK was built and inspected here (it contains the current web build), but not run on a device or emulator. A debug APK is for testing only: it is not signed for the Play Store.
- Sound levels were measured by rendering each mood offline (−25 to −30 dB RMS, no clipping), but nobody has listened to them yet.
- Italian and Portuguese translations have not been reviewed by native speakers.
- Android's back button closes the app (progress is saved, so reopening resumes the run).
- Deaths only happen on Vesper-6: the space chapters have no lethal choice that can actually be reached (the one spacewalk always has enough air).

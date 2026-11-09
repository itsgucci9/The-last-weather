# The Last Weather — v0.5 distribution patch

Open `index.html` through an HTTP server (ES modules and offline support require HTTP, not a `file://` double-click). No build step is needed.

```sh
python3 -m http.server 8765
```

This is a careful patch of the supplied compiled Vite distribution, **not a recovered Vite/React source project**. The original 29-file build is preserved separately, unchanged. No site was deployed or overwritten.

## Design
- Wider two-panel desktop layout; larger scene illustrations and cinematic title screen.
- Clearer vitals, numeric values, keyboard hints, choice costs and gains, borders, and typography.
- Mobile vitals appear before the passage; touch controls are at least 44px.
- Rebalanced run-over presentation: the visual column contains a complete choice timeline, not empty space. On mobile, the recap follows the ending.
- Heading focus still announces scene changes without a dashed outline; interactive keyboard focus stays visible.
- Tutorial spotlight no longer dims the interface. Modal tutorial steps trap keyboard focus; shortcuts cannot bypass them.

## Gameplay and safeguards
- A 550ms choice/scene/confirmation lock prevents rapid taps or keys from consuming multiple scenes. Held/repeated keys are ignored.
- The supplied build already had accurate oxygen/suit/storm death prediction and two-step fatal-choice confirmation. These were retained, made more prominent with an explicit “Ends run” label, and verified against actual outcomes.
- New-run supplies: **Story** (default: oxygen 5, storm clock 8) or **Survival** (original oxygen 4, storm clock 7). The common memory/archive/careful-repair route now survives in Story with one unit of each left. Survival retains all original failure routes. Saved runs are never topped up or reset by changing this setting. Story is deliberately forgiving: the current story graph does not reach oxygen death with its extra supplies; use Survival for all three death routes.
- Malformed endings/deaths collections, unknown history references, invalid enum values, non-finite numeric state, and mismatched checkpoints are validated before rendering.
- Existing `the-last-weather:*:v1` run/settings/ending/death keys and schema remain unchanged. Existing save values and chapter checkpoints were tested intact.
- The service-worker cache is versioned again and includes every new module/style, preserving offline play and the existing update prompt.

## New features
- **Expedition journal:** full choice history, available during play and from the title screen. Run-over recap uses the existing saved history.
- **Discovered passages:** a spoiler-safe, persistent archive keyed by scene IDs. Text changes language with the rest of the game. This intentionally stores base passages, not every state-dependent dialogue variant, because historical state snapshots are not in the original save format.
- **Passage fade-in:** a short whole-passage reveal, with a reveal button or tap-to-skip. No character-by-character screen-reader announcements.
- **Subtle weather:** illustration-only wind/dust intensifies as the remaining Storm Clock falls, then stops after escape. No lightning flashes. Reduced-motion is respected; a visual-effects switch is in the journal.
- Existing ending gallery is available immediately on the title screen. It remains the original seven chapter/final outcomes (four final endings), not seven newly added endings.
- All new UI strings cover English, Spanish, French, Italian, and Brazilian Portuguese.

## Checks completed
- JavaScript syntax checks: game bundle, new module, service worker.
- Static localization parity: no missing scene/variant/choice keys in any of the four non-English dictionaries; 116 original UI keys in each language. New interface strings cover all five.
- Pure-engine traversal: Story 18,400 unique scene/state combinations / 18,471 transitions; Survival 14,364 / 14,426. All 26 scenes reachable in Survival. Available lethal resolutions match resulting deaths.
- Chromium: opening, ordinary choices, key burst/repeat rejection, journal modal, archive, saving/resuming, and all four final endings through actual UI flows.
- Legacy v1 save at the reported one-oxygen repair: explicit fatal warning, rapid double-tap protection, deliberate confirmation, Run Over timeline, chapter restart.
- Lightweight 390px smoke: no horizontal scrolling in the tested legacy-repair/death/retry flow. All five language switches rendered without JavaScript errors. Offline reload succeeded with the new cached module. Malformed gallery data recovered.
- Automated axe checks on title, initial game, journal, and one final-ending page: no WCAG A/AA violations detected. This is not a claim of full accessibility certification.

The broad mobile/multi-width screenshot matrix was stopped when the brief changed to conserve resources. Real-device testing, complete per-language visual QA, audio perceptual testing, and manual assistive-technology testing remain for the actual source pass.

## Port to the real source
- `assets/expedition-v05.js`: readable standalone React factory and new locale strings.
- `assets/polish-v05.css`: isolated visual layer, intentionally separate from original CSS.
- `assets/game-v05.js`: formatted original compiled bundle with targeted integration points, validation, input guard, supply setting, and version changes.
- `sw.js`, `index.html`: new precache entries/cache version and entry references.

Do not treat hashed/minified bundle patches as a replacement for source maintenance. Port these changes into the real components and locales when source arrives. No new story branches/endings, full typewriter engine, new sound system, or haptics were added; the existing Web Audio ambience and toggle are retained.

# The Last Weather — audit, 9 Nov 2026

## v0.4.1: MICA talks less, no tips

- **MICA's dialogue:** 678 → 417 words of spoken lines over the whole story; the busiest screens cut hardest (Impact 57 → 18, Storm Front up to 72 → 34, relay core 105 → 54). Removed the line that explained the survival rules on the first screen (now shown by the tour, the place banner and the meters). Plot information kept. Same cuts in FR, ES, IT, PT; MICA stays feminine, the player stays gender-neutral.
- **Tips removed:** no tip boxes during play, no tips setting in the Menu. The guided first scene and "Replay tutorial" stay. Ending hints on the title screen stay.
- **New guard test:** no MICA line over 25 words, no other voice over 30, nothing on the first screen explaining rules.
- **Verified:** story simulation unchanged (9,702 runs, 0 stuck), 46 unit tests, 52 browser checks.

## v0.4.0: clearer screens, step-by-step start, tutorial

**UX audit (phone first, then desktop), what was wrong:**

| # | Finding | Fix |
|---|---|---|
| 1 | The first screen showed everything at once: 5 meters, pack, status line, 3–4 tags per choice. | Only the meters the current decision uses are shown; Suit and Salvage arrive at the route choice marked **New**; the pack appears with the first item. |
| 2 | Costs, gains, place and risk were all small bordered tags in one row: they looked like buttons and mixed different kinds of information. | One line per meaning, each with a label: **Costs**, **Gains**, **Deadly** / **Shelter**, **Needs**. Plain text with icons, no boxes. |
| 3 | The Outside / Storm crossing tag sat on every choice and did not say what it meant. | Removed from choices. One banner under the scene title says where you are and what it means (Outside, In the storm, Inside sealed). |
| 4 | Locked options were mixed in with the ones you can take, sometimes first. | Listed apart and last under "Not possible yet"; numbers count only options you can take. |
| 5 | The Storm Clock bar had no fill colour: a full clock looked empty. | Own colour. |
| 6 | Number-key badges and the keyboard hint showed on phones. | Hidden on touch screens. |
| 7 | "Chapter 1" card repeated the "Impact" heading. | Card says "Chapter 1 of 4" and only shows the chapter title when it differs. |
| 8 | No onboarding: the rules (deadly at 0 outside, the clock, locked options) were only in the story text. | Five-step guided first scene and one-time tips, in all 5 languages. |
| 9 | Choices did not say which items they give or use (the result did). | Items now listed under Gains / Costs before choosing. |
| 10 | Pack items were drawn as boxes, like buttons. | Plain text. |

**Found and fixed while doing it:** "Replay tutorial" pressed mid-run was cancelled immediately; the tour card could cover the element it was explaining (now placed beside it).

**Verified:** 50 unit tests (16 new for the step-by-step rules), 53 browser checks (7 new: tour, tips, Menu toggle and replay, gradual meters, locked-last order), axe clean on every tour step, the tip screen, the deadly/locked screen and the menu; phone and desktop screenshots reviewed in English and French. Story simulation unchanged (9,702 runs, 0 stuck).

**Open:** the tour has not been tried by a first-time player yet; that is the real test. Italian and Portuguese tutorial text still need a native speaker's read.

## v0.3.0: chapters 3–4 and deadly survival

- **Chapters 3–4** were written by an earlier attempt that was never built or tested. Verified now: types, story data, translations, art (consistent with the handoff), every path.
- **Survival rules** implemented as requested: lethal Oxygen and Suit outside, a Storm Clock, forced shelter, three deaths recorded apart from endings, no automatic fallback, costs never silently clamped, risk shown and confirmed before every lethal choice.
- **Simulated every path:** 9,702 complete runs; 0 dead ends; 0 stuck; reachable: asphyxiation (2 runs), suit breach (4), storm (2), storm-forced shelter, Clear Window, Hard Burn, Signal in the Storm, and all four chapter-4 endings. On Vesper-6 alone: 45 runs, 37 survive, 8 die; the Clear Window has a route from every start.
- **Verified:** 34 unit tests, 46 browser checks (all Vesper-6 runs + 24 covering runs through the UI), axe clean on the new screens.
- **Found and fixed while doing it:** later-chapter status lines (ship hull, keeper) showed on Vesper-6; the armed lethal choice turned cyan on hover; a flaky keyboard test (the test, not the game).
- **Open:** the space chapters have no reachable death; Salvage still rarely decides anything on the planet (it does in chapters 3–4).

## v0.2.0 (v0.1 → v0.2.0)

**How it was audited:** every possible run simulated from the story data; Lighthouse (mobile and desktop); axe accessibility scan on every screen, the menu, an ending and large-text French; the game played at 320–1280 px in 5 languages; code read end to end; the build also run inside a strict sandboxed frame (like a game portal embed).

**Result before → after:** Lighthouse mobile 98 / 100 / 100 / 100 → 99 / 100 / 100 / 100 (performance, accessibility, best practices, SEO); axe 1 issue → 0; automated checks 25 → 39 browser checks and 22 → 28 unit tests.

## Findings and what was done

| # | Area | Finding | Status |
|---|---|---|---|
| 1 | Game design | Oxygen, Suit and Salvage never locked a single choice in any of the 69 runs: 3 of 4 survival meters were decoration. | **Fixed** (your choice): start oxygen 4, careful repair needs Suit 2+. Oxygen and suit now decide outcomes; Clear Window in 9 of 59 runs. Salvage still never decides anything (see below). |
| 2 | Content | The pack kept showing "Reactor coupler" after it was installed in the ship. | Fixed (`hudWhen`). |
| 3 | Content | "Fit the *station* filter": the filter comes from the Dry Ravine (error in the supplied text, all 5 languages). | Fixed. |
| 4 | Content | Hard Burn ending said "the reactor is unstable" even after a careful calibration. | Fixed with a short reconciling line. |
| 5 | Content | Running low on air or suit had no warning in the story. | Added lines at the repair and launch scenes. |
| 6 | Robustness | Any rendering error would show a blank page. | Added a safety screen (Try again / Start a new run). |
| 7 | Robustness | A damaged "last action" in a save was accepted and would crash the game. | Fixed: damaged parts are dropped. |
| 8 | Robustness | Title screen used a web form: in sandboxed frames (portals, embeds) "Begin" did nothing. | Fixed: plain buttons, Enter still works. |
| 9 | Robustness | Built files could not load in sandboxed frames from another site. | Fixed in `public/_headers` (cross-origin allowed for public assets). |
| 10 | UX | After finishing, the title screen offered "Continue" back to the old ending. | Now offers Begin. |
| 11 | Accessibility | In-game screens had no main heading; the last action's result was skipped by screen readers. | Fixed (axe now clean). |
| 12 | Launch | No offline play; no update path once published. | Added offline play and "A new version is ready · Reload" (automatic, no version to bump). |
| 13 | Launch | No cache headers (Lighthouse), no link preview, no Netlify config. | Added `_headers`, preview image + tags, `netlify.toml`, one-deploy guide in README. |
| 14 | Launch | Netlify's free-plan corner badge could cover the last button. | Space reserved at the bottom of every screen. |
| 15 | Engagement | No reason to replay; no way to share. | Endings gallery with hints on the title screen; Share button on endings. |
| 16 | Atmosphere | Silent. | Procedural ambience (wind, storm, engine, MICA's radio static) with on/off toggle. |

## Still open (not blocking a first public test)

- **Salvage still never decides anything.** Making it matter needs a story change (for example a third repair option that costs 2 salvage), not just a number. Worth doing when chapter 2 is written.
- **Very short:** 7 steps, about 5 minutes per run. Fine for a free test; too short to sell. The design doc's chapters 3–4 are the natural next step.
- **Listen to the sound on real phones.** Levels were measured (quiet, no clipping) but not heard.
- **Native-speaker check** for Italian and Portuguese.
- **Android back button** closes the app (the run is saved).
- **iOS app** needs a Mac or a cloud Mac build; the web version installs on iPhone from Safari meanwhile.

## Before the Netlify deploy

1. Confirm the site name. If it is not `the-last-weather`, change `VITE_SITE_URL` in `.env`.
2. `npm run check`: everything must pass.
3. Deploy `dist/` once (drag and drop, or `npx netlify deploy --prod --dir=dist`).
4. On your iPhone and Android tablet: play one run, try airplane mode, Add to Home Screen, Share an ending, check the badge doesn't cover a button.

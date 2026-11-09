# Game Design — The Last Weather

## High concept

The Last Weather is a text-first survival RPG about a field engineer, an imperfect AI companion, and the choice to trust each other under pressure. A short prototype follows one complete attempt to repair a crashed survey ship and escape the electrical storms of Vesper-6.

## Story setting

Vesper-6 is a cold, mineral-rich planet with long twilight and recurring electrical superstorms. Dust, glassy ridges, and abandoned weather equipment shape the landscape. The storm is a physical threat, not an enemy to fight.

The player's survey ship made an emergency descent. MICA, its onboard AI, chose the landing site after detecting a larger orbital hazard. The impact damaged the reactor and corrupted MICA's memory. An old weather station is broadcasting a forecast and contains a reactor coupler that can restore the ship's ability to launch.

## Main characters

- Player: a survey pilot and field engineer. Let the player choose a callsign if it fits the prototype; avoid a long character creator.
- MICA: the ship's calm, concise AI companion. It is not a villain. Its missing memories make the player question its judgment, while its actions show it was trying to keep the pilot alive.

## Recommended full-game structure

Use a chapter-based campaign with a focused survival objective and one lasting personal choice in each chapter. Let chapters close a local problem while carrying resource habits, relationship state, and story flags forward. This supports meaningful choices without requiring every branch to remain separate forever.

1. Impact — survive the crash, decide what to restore, and choose a route to the weather station.
2. The Last Weather — retrieve the reactor coupler, learn why MICA diverted the ship, and cross the storm.
3. The Quiet Relay — follow a signal beyond Vesper-6 and discover who maintained the abandoned network.
4. Home Vector — decide whether to follow the signal's warning, return to known space, or help someone else in danger.

The prototype compresses the first two chapters into one short playable arc. Its closing signal should hint at a larger story without making the escape feel incomplete.

## Prototype scene flow

### 1. Impact

The pilot wakes beside the damaged ship. MICA reports that the reactor coupler is broken and the next superstorm will close the safe launch window.

The player chooses between restoring MICA's damaged memory cache or saving the backup battery for life support. Restoring memory increases trust and gives MICA a clearer recollection of the diversion. Saving the battery gives the player more oxygen but leaves the AI uncertain.

### 2. Route choice

The weather station lies beyond two routes:

- Glass Ridge is quicker and yields salvage, but crossing it can damage the suit.
- Dry Ravine is less exposed, but takes longer and costs oxygen. A filter found there can protect the player in the storm.

Both routes reach the weather station. The route choice changes the player's condition and the storm options.

### 3. Weather station

The player finds the reactor coupler. The station's forecast archive can reveal a safe maintenance trench through the coming storm. Copying it costs time and oxygen, but also restores part of MICA's flight log. Leaving immediately preserves oxygen but means crossing the storm with less information.

### 4. Storm front

MICA suggests a route through an old maintenance trench. A restored forecast or stronger trust makes that route viable. The player can instead use a filter found in the ravine, or cross an exposed ridge at the cost of suit integrity.

### 5. Repair

At the ship, the player can spend time and oxygen on a careful repair or use a quick patch that makes the ship less reliable. Both are valid choices; the quick patch leads to a costlier launch outcome.

### 6. Launch

- Clear window: the ship is carefully repaired and the player has enough oxygen plus a saved forecast or MICA's trust. The player escapes with a sense of earned partnership.
- Hard burn: the ship is patched or the safe window is missed. The player escapes, but MICA's memory or the ship is damaged.
- Shelter signal: the player cannot launch. They reach the weather station's storm shelter and send a distress signal, creating a hopeful continuation rather than a game-over screen.

## Prototype state

Keep a small, visible set of state:

- Oxygen: limited reserve for travel and repair.
- Suit Integrity: protection against exposed routes and storm damage.
- Salvage: materials for the repair.
- MICA Trust: a small relationship value, not a complex dialogue simulation.
- Flags: memoryRestored, hasFilter, forecastSaved, couplerFound, shipReady, repairMode, and route.

Clamp Oxygen to 0–6, Suit Integrity to 0–3, Salvage to 0–4, and MICA Trust to 0–3. Scene and choice requirements are defined in data/story.json.

## Visual direction

- Pixel-style scenes are small establishing images, not full-screen action backgrounds.
- Use crisp rectangular silhouettes, few colors, and visible negative space for text.
- Palette: near-black blue, muted navy, dusty rust, pale sand, desaturated teal, and a restrained cyan glow for MICA and signals.
- UI should feel like a quiet field terminal: compact labels, simple resource marks, and large readable narrative text.
- The SVG files in assets/ are original visual starting points. Keep their shapes and palette consistent when adding art.

## Audio direction for later

No audio is needed in the prototype. Later, consider restrained wind, radio static, and sparse low synth rather than constant music.

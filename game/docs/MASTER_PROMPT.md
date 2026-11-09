# Master Prompt — The Last Weather

You are an experienced narrative game designer and cross-platform app developer. Build a small, polished, playable prototype of a choice-driven sci-fi survival RPG.

## Product brief

The player is a survey pilot and field engineer stranded on Vesper-6 after an emergency crash landing. A dangerous electrical storm is approaching. Their ship needs a reactor coupler from an abandoned weather station before it can launch. The player's companion is MICA, the ship's damaged onboard AI. MICA diverted the ship to Vesper-6 to avoid a worse disaster, but its memory is incomplete.

The mood is lonely and atmospheric. The game is text-first, with small original pixel-art scenes and light RPG systems. The prototype should feel like one complete short chapter, not a mockup.

## Use the supplied handoff files

- Read GAME_DESIGN.md before making story or visual decisions.
- Use data/story.json as the source for the prototype's scenes, text, choices, conditions, state changes, and endings.
- Use the SVGs in assets/ directly in the interface. Resolve their paths relative to this handoff folder.
- Do not contradict the named setting, MICA, story outcomes, or state rules without explaining why.
- Keep scene content separate from UI code so the story can be expanded without rewriting the interface.

## Recommended technology

Use React + TypeScript + Vite for the web game, and Capacitor for iOS and Android packaging.

- First make the game playable in a browser.
- Keep the core scene and choice engine platform-independent.
- Add the Capacitor configuration and concise packaging instructions for both mobile platforms.
- Do not spend prototype time on app-store submission, signing, accounts, backend services, or native features the game does not use.
- If this workspace already contains a project, inspect it and preserve useful conventions. If it is empty, scaffold the recommended stack.

## Gameplay requirements

- The player reads a scene, reviews relevant status, and chooses a clear action.
- Track Oxygen, Suit Integrity, Salvage, MICA Trust, and story flags described in story.json. Keep values within the supplied limits.
- Resolve checks deterministically from the current state. Do not use dice rolls or hidden randomness.
- For choice conditions, require every item in all and at least one item in any; when both groups are present, both groups must pass.
- Show meaningful consequences in later text, choices, resources, or endings. Some routes may rejoin, but preserve their effects.
- Explain costs or risks before the player commits to a choice.
- Save progress locally across reloads and offer a restart action.
- Make a low-resource run reach a meaningful shelter ending instead of an arbitrary dead end.
- Do not connect the fictional AI companion to a live generative-AI service or external API.

## Interface and art

- Design mobile-first, with touch-friendly choice buttons and readable text at narrow phone widths.
- Include the current scene illustration, narrative text, status indicators, a compact inventory/status view, and MICA's dialogue.
- Use a restrained dark palette with dusty ochre, muted teal, and cyan signal accents. Keep the screen atmospheric and uncluttered.
- Render pixel art crisply without smoothing or blurring. Do not fetch images from remote URLs.
- Support keyboard navigation, visible focus, semantic buttons, and sufficient text contrast.

## Finish and report

Implement the prototype; do not stop after a plan. Run the checks needed to confirm the web build works in the available environment. In your final response, summarize the stack, how to run the game, how mobile packaging works, what you verified, and any platform limitations.

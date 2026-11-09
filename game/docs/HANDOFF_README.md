# The Last Weather — Claude Handoff

This folder is a self-contained design and art pack for a choice-driven sci-fi survival RPG prototype.

## Start here

1. Give Claude the contents of this folder, or upload claude-handoff.zip.
2. Ask Claude to follow MASTER_PROMPT.md.
3. Keep GAME_DESIGN.md and data/story.json as the source of truth for the setting, story beats, choices, state, and endings.
4. The SVGs in assets/ are original, editable pixel-style scene illustrations and interface icons.

## Contents

- MASTER_PROMPT.md — build instructions for Claude.
- GAME_DESIGN.md — story, character, gameplay, and art direction.
- data/story.json — first playable scene graph and state effects.
- assets/ — scene images and HUD icons.
- asset-manifest.json — descriptions and intended use for every SVG.

## Technology direction

Recommended prototype stack: React + TypeScript + Vite + Capacitor. Build and play the web version first, then use the same web interface inside iOS and Android app shells. The game is text-first and does not need real-time rendering or device-specific features.

## Art notes

The illustrations use SVG primitives with crisp edges. They can be used directly as local image assets, or Claude can recreate their style in canvas or another engine. The SVGs have no fonts, external links, embedded scripts, or third-party artwork.

## Story data notes

The JSON uses scene IDs, choices, conditions, and effects. Resolve asset paths from this folder. A choice can have an all/any condition group, add numeric values, set flags, and point to the next scene. When both condition groups are present, both groups must pass; items inside all must all pass, while any needs at least one match. Clamp values using the limits in stateRules.

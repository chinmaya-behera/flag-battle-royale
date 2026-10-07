# Verification

- Nineteen Node tests pass, covering the 250-flag dataset, collision impulses, energy conservation, wall and gate contacts, cloth stability, frame-rate consistency, and complete physical elimination brackets.
- A seeded world tournament completed the exact survivor targets 128, 64, 32, 16, 8, 4, 2, and 1. Every elimination came from a physical gate escape. Body and mesh coordinates remained finite, and all flags retained 100 HP.
- Closed gates with the simulation clock beyond one hour did not force any elimination or qualification. Simultaneous escapes could not overshoot the qualifying target, and each round completion fired once.
- Bracket construction was checked for every lineup size from 2 through 250. Repeated campaign tests covered 2, 5, 16, and 250 flags across four complete cycles each, restoring the original selected countries every time.
- Controller tests cover pause and stop during combat, intermissions, and champion celebrations, plus resume and changing lineups with pending transitions.
- Random gate tests verify two to four physical exits after the initial wave, wraparound angles, scheduled wave changes, and safe escape when a gate closes behind an exiting flag.
- Browser checks observed the world tournament advance to rounds two and three through actual escapes. Pasting India and Brazil started a two-flag campaign automatically, and it repeated into campaign two. Stop froze its champion transition and elapsed clock across subsequent observations.
- The battlefield design was visually checked on desktop and at a phone breakpoint, with no horizontal overflow. Browser console reported no errors.
- The elimination feed is capped at 80 events. Flag textures are cached; larger lineups use fewer cloth nodes. Campaign histories and debris are bounded.
- The offline export embeds the updated game, all 250 SVG flag assets, and their MIT license.
- Production address: https://flag-battle-royale-bay.vercel.app. The repository is connected to Vercel for automatic deployments from `main`. The earlier Sites edition remains a separate deployment.

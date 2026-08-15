# Design-sync notes for cartolang

Repo-specific context for whoever re-syncs this project next (human or agent). Read this before touching `.design-sync/overrides/` or `config.json`.

## Why three forks exist

cartolang is a private Vite app (`"private": true`, no `dist`/`main`/`exports`), so the converter's default assumptions (published library, self-installed under `node_modules/<pkg>`) don't hold. `node_modules/cartolang` is a symlink to the repo root (`ln -sfn .. node_modules/cartolang`) so the default `PKG_DIR` resolution finds `package.json` without `--entry` (which would skip synth-entry barrel generation). `.design-sync/node_modules` symlinks to `.ds-sync/node_modules` so forked scripts that `import` bare specifiers (`ts-morph`) resolve.

- **`source-kit.mjs`** — adds `cfg.srcExclude` (bare filenames) so `UpdatePrompt.tsx`'s Vite-only `virtual:pwa-register/react` import never enters the synth-entry barrel. `cfg.componentSrcMap: {"UpdatePrompt": null}` alone isn't enough — it only filters the *discovered component list*, not the barrel's file set feeding the actual esbuild bundle. Both keys are needed together.
- **`common.mjs`** — adds `srcExclude` to `CONFIG_KEYS` so `validateConfig` accepts the above.
- **`package-capture.mjs`** — two independent fixes, see below.

## `package-capture.mjs` fork: two real capture-harness bugs, not preview-authoring issues

1. **Mount-fade animations don't settle in time.** framer-motion `initial`/`animate` mount transitions (RuleNote's card, CoursePicker's sheet) render at frame 0 (`opacity: 0`) if the screenshot is taken too soon. Root-caused via a standalone replay harness: a component's SECOND+ per-story navigation *within the same page* starts its animation dramatically later than the first — not a fixed "cache-warm nav" cost, it *grows* with how many prior navigations that page has made in the run (confirmed against RuleNote's Grammar cell: still `opacity: 0` at +2.0s in a short 2-nav replay, but the SAME content was still stuck past a 3.5s cap once ~13 navigations deep into a real multi-component run). Full-page navigation resets all JS state each time, so this isn't app-level bleed — most likely Chromium compositor/rAF throttling on repeated same-origin reloads in one page/tab.

   Fixed by giving **every per-story capture its own fresh `page`** (closed right after its screenshot) instead of reusing one page for the whole run, plus polling the animated root's computed opacity (capped at 3.5s) instead of a blind fixed wait. If you see a component render blank in a raw screenshot but its DOM (checked via a quick Playwright script) shows correct content with `opacity: 0`, this is that bug — don't waste time debugging the preview content first.

2. **`fixed`-rooted components collapse in single-story capture.** The harness wraps a `?story=` render in `.ds-single { transform: translateZ(0) }` so `position:fixed` descendants stay contained instead of escaping the whole page (intentional — see `.ds-sync/lib/emit.mjs`). But that wrapper has no explicit size, so an ALL-`fixed` root (CoursePicker's `fixed inset-0` overlay) collapses its containing block to near-zero height and renders as a sliver. `emit.mjs` isn't forkable (explicitly marked app-contract surface). Fixed from the **preview file** instead: a `useEffect` in `CoursePicker.tsx`'s preview sets `#r0`'s width/height directly. Watch for this on any future component whose root is entirely `position:fixed` (grep `fixed inset` in `src/components/` before assuming a new one is safe).

## `cssEntry` hash fragility (unresolved — real risk on next re-sync)

`cfg.cssEntry` points at `dist/assets/index-<hash>.css`, a content-hashed filename from `npm run build`. It **will** change on the next rebuild if any source changes. There's no glob-based lookup wired up — after running `npm run build` for a re-sync, grep `dist/assets/index-*.css` and update `cssEntry` by hand, or the build will fail on `[CSS_IMPORT_MISSING]`/stale styles. Worth fixing with a small `readdirSync` glob in a future pass instead of hand-editing every time.

## `[RENDER_THIN]` warnings on 9 icon/Mascot components — confirmed false positives

`package-validate.mjs`'s render-thin check (grid-mode "no text, paints nothing") flags `BoltIcon`, `ChevronLeftIcon`, `CloseIcon`, `FlameIcon`, `LockIcon`, `Mascot`, `SpeakerIcon`, `StarIcon`, `UnitIcon`. All nine are pure-SVG components with no text content and (for the icons) a small glyph footprint — visually confirmed correct and complete via both the `?story=` capture screenshots (graded `good`) and the validator's own grid-mode contact sheets. This is a heuristic false positive for icon-shaped/no-text components, not a real render failure. Don't spend time "fixing" these; if the count changes on a re-sync, spot-check the specific component's screenshot before assuming regression.

## AppUpdateBanner / AppUpdateCard — intentional floor cards

Both take zero props and derive everything from `useAppUpdate()` (`src/content/useAppUpdate.ts`), a real hook doing a live async network fetch that defaults to `{ update: null }` — both components literally render `null` in that default state. There's no clean way to mock the hook's internal state from a prop-driven preview without either editing app source (out of scope) or a fragile module-mock. Left as Claude Design's automatic floor card. If a future pass wants these authored, the real fix is threading `update` as an optional prop through both components (a small, legitimate app-source change, not a preview-only workaround) — flag that to the user rather than hacking around it in `.design-sync/`.

## `UNIT_ICONS` keys confirmed in use

`src/components/icons.tsx`'s `UNIT_ICONS` map and the icon previews built on it use six keys — cross-checked against real `icon:` values in `content/courses/*/units/*.yaml`: `book`, `wave`, `people`, `cup`, `clock`, `compass`. All six are live content, none are speculative.

## Re-sync checklist

1. `npm run build`, then fix `cfg.cssEntry` to the new hash (see above).
2. Full `package-build.mjs` (needed after ANY `.design-sync/overrides/*` or `config.json` edit — the build stamps a `sourceKey`/`cfgSlice` that gates grading; editing a fork clears grades for every component that references it, even if the edit was capture-only, not render-affecting — expect a full re-grade pass after touching `overrides/package-capture.mjs`).
3. `preview-rebuild.mjs` + the forked `package-capture.mjs` (always `DS_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, never the un-forked `.ds-sync/package-capture.mjs` directly) for anything touched.
4. `package-validate.mjs` (same `DS_CHROMIUM_PATH`) before closing out — should show 34/34 render cleanly, 2 floor cards (AppUpdateBanner/Card), and the 9 known-benign `[RENDER_THIN]` warnings above.

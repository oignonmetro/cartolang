# Cartolang — conventions for the design agent

Cartolang is a French→English vocabulary and grammar learning app (React + Tailwind v4, mobile-first, wrapped for Android via Capacitor). Kartu the turtle is the app's mascot.

## Voice

All product copy is **French** — labels, buttons, error text, exercise prompts. Only the English being taught appears in English (vocabulary terms, example sentences, conjugated forms). When mocking new copy, keep this split: French chrome around English learning content.

**Vouvoiement, always.** Every screen addresses the learner as *vous*: « Votre réponse… », « Vos points les plus fragiles », « Complétez la phrase », « Choisissez le sens », « Reliez les paires ». Never *tu*. The app is warm but not familiar — it's a study tool, not a buddy.

**Never surface engine vocabulary.** The type names and `.d.ts` files carry the internal model's words, and they are not the product's words. `lapses` is *oublis*, never « rechutes » (clinical). `solidity`, `ease`, `interval`, `step`, `due` never appear on screen at all. `card`/`item` is *mot*, *règle* or *forme* depending on the track — see `countLabel`. When a prop name looks like a good label, it almost certainly isn't.

## Visual language

- **Cards** (`.card-3d`) and **buttons** (`.btn-3d`) share one signature: a solid flat "sliced" shadow (`box-shadow: 0 Npx 0 0 <deep-color>`), not a blurred drop shadow. It reads as a physical, pressable layer. Buttons visibly depress on tap (`whileTap={{ y: 4 }}`) to match.
- **Tone system**: five accent colors (teal, violet, sky, coral, amber), each with a `-deep` variant for shadows/emphasis. A given screen or exercise family commits to one tone throughout — vocabulary is teal, conjugation is sky, grammar is violet, achievements/streaks lean amber/coral. Don't mix tones within a single card.
- **Rounded, soft geometry** throughout — `rounded-2xl`/`rounded-blob`, no sharp corners. Borders are 2px, not 1px.
- **Typography**: Nunito, extra-bold/black weights for anything that needs to be scanned quickly (titles, terms, buttons); regular/soft-ink weights for supporting French translation text, so the eye learns to jump between the two.
- **Feedback color**: success = green tones, error = red/coral tones, applied as a light background tint (`/15`, `/10`) plus a matching border and text color — never a solid saturated fill on text-bearing surfaces.

## Component shape

- Exercise components (`session/`) all take an `exercise` object (a discriminated union on `kind`) plus a callback (`onAnswer`, `onDone`, or `onNext`) — never raw primitive props. Mocking a new exercise state means constructing a plausible `exercise` object, not passing loose strings/booleans.
- Most exercise roots are `flex-1` and expect to fill a parent's height (they normally sit inside `SessionScreen`'s full-height column). Isolated previews give them an explicit height.
- Answer/feedback state (the color-coded correct/incorrect panel) is internal `useState`, never a prop — a static mock can only show the pre-answer state honestly.
- Kartu (`Mascot`) appears anywhere the app wants warmth or reassurance: flashcards, QCM, vocab intros. Its mood should match the surrounding state (idle while waiting, happy/disappointed after a graded answer).

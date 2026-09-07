# PitchSort — Spec

Audio-first sorting game. Notes start Center; player sorts into Left/Right columns to match two target chords. Xbox gamepad only. Screen = debug view, game is playable blind.

## Layout

Three columns: Left, Center, Right. Notes start in Center (random order). Goal: Left column == target Left chord, Right column == target Right chord, Center empty.

## Controls

| Input | Action |
|---|---|
| D-pad Left/Right | Move cursor between columns |
| D-pad Up/Down | Move cursor between notes in column; selected note plays |
| A (hold) | Capture note: mutes, lowpass + 4Hz pulse, follows cursor; release to place |
| B (while holding A) | Cancel capture, note returns to origin |
| X | Play Left column as chord |
| B (standalone) | Play Right column as chord |
| Y | Play Center column |
| LT | Preview target Left chord |
| RT | Preview target Right chord |
| Start | Submit (enabled only when Center empty) |

## Flow

1. Level loads: notes in Center, randomized.
2. Intro: target Left chord, then Right.
3. Navigate / capture / place. LT/RT preview targets, X/B/Y audition columns.
4. Center empty → Submit unlocks. Start commits.
5. Grading: correct notes ring clean, wrong notes distort + detune.
6. Summary: target chords vs player chords back-to-back.

## Grading

- Pitch accuracy (correct note in correct column) — 60%
- Position accuracy — dropped (prototype: column membership only)
- Efficiency (moves vs optimal, optimal = 1 capture/note) — 20%
- Time — 20%

Pass = both chords exactly correct → next level. Fail → retry same deal.

Partial feedback: correctly-placed note sustains slightly longer on audition (subtle; disabled at high difficulty).

## Difficulty

- Lv 1–3: triads, 3 notes/target
- Lv 4–6: seventh chords, 4 notes/target
- Lv 7–10: extended chords, 5+ notes/target

(Distractors skipped in prototype. Revisit at Lv7+ if ambiguity needed.)

## Audio

- Pure tones / simple timbres only.
- Pan: Left −1, Right +1, Center 0.
- Captured: lowpass + gain LFO 4Hz.
- Correct placement: bright timbre, natural decay.
- Wrong placement: distortion + detune on audition.
- Submit success: consonant full chord. Failure: dissonant, then correct version.

## Open questions

- Time scoring curve: currently linear decay over 120s par. Per-level par when difficulty scales?

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

- Pitch accuracy (correct note in correct column) — 50%
- Position accuracy (correct vertical slot) — 30%
- Efficiency (moves vs optimal) — 10%
- Time — 10%

Partial feedback: correctly-placed note sustains slightly longer on audition (subtle; disabled at high difficulty).

## Difficulty

- Lv 1–3: triads, 3 notes/target, 2 distractors
- Lv 4–6: seventh chords, 4 notes/target, 3 distractors
- Lv 7–10: extended chords, 5+ notes, 4+ distractors, targets share notes (ambiguity)

## Audio

- Pure tones / simple timbres only.
- Pan: Left −1, Right +1, Center 0.
- Captured: lowpass + gain LFO 4Hz.
- Correct placement: bright timbre, natural decay.
- Wrong placement: distortion + detune on audition.
- Submit success: consonant full chord. Failure: dissonant, then correct version.

## Open questions (answer before v1 tuning)

1. Note range/ordering: sort vertical position by pitch height? Or fixed chord voicing slots?
2. Same-pitch ambiguity at Lv 7+: position accuracy still graded when duplicates exist?
3. Efficiency metric: optimal = min captures (n) or count Up/Down too?
4. Time scoring curve — per-level par time?
5. Fail state after submit: retry same layout or new deal?
6. Distractor notes: where do they belong at submit — must they be excluded from both columns, or is "Center empty" wrong (distractors stay Center)?

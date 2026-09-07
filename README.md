# MusicPrototypes

Prototypes for audio-only games. No visuals drive gameplay — ears do. Screen shows debug state only.

## PitchSort (`/pitchsort`)

Sort notes into Left/Right columns to build target chords. Xbox gamepad, Web Audio + Gamepad APIs, zero build — serve the folder and play.

    cd pitchsort && python3 -m http.server 8000

Open `http://localhost:8000`, connect gamepad, press any button.

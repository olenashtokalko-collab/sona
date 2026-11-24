# SONA Read — prototype v3

Built on v2 including its latest commit (ff371f0: "use a recorded read" / "use a voice sample", the Apply result line under the take, "X s longer than the clip"). In the word-fix start, the file link also says "use a recorded read". Switch between v2 and v3 in the prototype bar.

Drop-in update for the v2 prototype. Copy `index.html`, `app.js` and the new `sona-v3.css` over the existing project. `styles.css` and the `assets/` folder do not change. Everything in v2 still works as before.

## 1. Fix only some words (Tone · "Change how it's said")
- The line in the clip card is made of words you can click. Click a word to pick it, click another word to extend the pick, and click a picked word again (or press Esc) to go back to the whole line.
- Picked words are underlined in Burn. The main button becomes **Record "storm reaches"**, and "use a recording" still works.
- Record the words: after the 3-2-1 count-in, recording starts right away; say only the picked words. Then the take renders, like the whole line. (The punch-in pre-roll, where the original plays up to the words first, felt like something interrupting the flow; it now runs only with the ADR guide on, which has no switch in this prototype.)
- Lengths are checked against the words, not the whole line. The live strip, the timer (0.3 s / 0.5 s), the hints and the review thresholds all use the words.
- The take is the original with only those words re-said, so it is exactly as long as the clip. The take's dots show the changed part in Sky. With a word-fix take selected, the line shows the changed words in Sky, and the take chip has a small Sky bar.
- In the takes row, "Record another" becomes **Record "words"**, with × to go back to the whole line.
- Prototype control: when words are picked, **Use a sample recording** cuts the sample down to just those words.
- Voice mode is unchanged: picking words is a Tone feature.

## 2. Compare: Original / your read / take at the same point
- A row under every finished take, in Tone and Voice: **Original · Your read (or Recording / Voice sample) · Take N · Loop**.
- Switching while audio plays starts the next source at the same point in the line. Your read for a word fix maps onto just those words.
- If nothing is playing, a word-fix take starts 0.6 s before the changed words, so you hear them in context.
- Keys: **1 2 3** switch sources, **L** turns Loop on and off. The source that plays is marked in Burn (live).
- The plugin window is 36 px taller by default (480 × 412; v2 is 376) to fit the row. It can still be resized as in v2.

## Notes
- Word timings are estimated from the text. In the product they come from SONA's transcript alignment.
- The word-fix render is simulated: the original audio with the picked span replaced by the same span of a placeholder take, with 20 ms crossfades.

- **Take length follows the read.** The render is simulated with fixed files (2.97 / 3.72 / 2.6 s), so "longer than the clip" showed up even after a normal read. A take is now stretched to your read's length (Tone) or the clip's (Voice), ±3% between takes, pitch kept. The warning appears only when the read really is longer than the original. Same fix in flow-1-read-v2.
- **Compare: the voice sample is the chosen voice.** Checked every SONA voice: the sample in Compare and the takes are the same voice (pitch and timbre match). Lena's sample was a different voice than her takes; it is regenerated in the takes' voice (also in flow-1-read-v2).

- **Short word reads count as speech.** "No speech found" used the thresholds for a whole line (0.3 s of speech, 0.4 s span, a fixed loudness floor). One word said quickly or softly fell under them. For picked words the minimums are 0.1 s and 0.15 s, with a lower loudness floor; speech still has to be well above the room, so silence and room noise still say "No speech found".
- **A word-fix take auditions around the changed words.** After the render it plays from 0.6 s before the picked words to 0.4 s after them, so you hear the seams with the original, not the whole line. The take's ▶ still plays the whole line; Compare already starts just before the words.
- **No "longer than the clip" line.** After Apply the take shows only what happened in this DAW. The amber "X s longer than the clip · trim the clip end open" is removed (also in flow-1-read-v2): small overruns were trailing silence, and the warning trained people to ignore amber lines.

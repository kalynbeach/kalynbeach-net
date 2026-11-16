# Sound player

The Sound page shows the music player card in the main column and the Library in the rail. A visitor plays, pauses, skips, and seeks tracks there. Once playback is under way, a mini player follows them to the other pages and links back to Sound.

## Sub-features

- `player-play` plays and pauses the current track from the card.
- `player-skip` moves to the next or previous track, and disables `Next track` on the last one.
- `player-library` plays a track chosen in the Library.
- `player-seek` moves the position with the keyboard on the seek slider.
- `player-follow` keeps the mini player, its track, and its position on About, and its `Open player` link returns to Sound.

## How to get to it (user POV)

- Choose `Sound` in the sidebar, or open `/sound`.
- Choose a track in the `LIBRARY` region of the rail.
- After playback starts, choose `About` and use the mini player in the rail.

## Driving it with verify browser

Preconditions:

- Baseline state from the [index](./README.md), in either mode.
- The player is idle on `preview_tone_a`, so open `/sound` in a fresh session or after `verify stop` and `verify launch`.

- **Open Sound.** Run `verify browser open "$VERIFY_URL/sound"` and `verify browser wait --text "preview_tone_b"`. The `Music player` region shows `preview_tone_a`, `01 / 02`, `00:00`, and buttons `Previous track`, `Play`, `Next track`. The `LIBRARY` region lists buttons `preview_tone_a 00:08` and `preview_tone_b 00:08`.
- **Play.** Run `verify browser find role button click --name "Play"`, then `verify browser wait 1500`. The button is now `Pause` and the slider `Seek` reads 1 or more.
- **Pause.** Run `verify browser find role button click --name "Pause"`. The button is `Play` again and `Seek` stops moving across two snapshots.
- **Skip.** Run `verify browser find role button click --name "Next track"`. The card reads `preview_tone_b` and `02 / 02`, and `Next track` is disabled. Run `verify browser find role button click --name "Previous track"`. The card reads `preview_tone_a` and `01 / 02`.
- **Library.** Run `verify browser find role button click --name "preview_tone_b 00:08"`. The card reads `preview_tone_b` and `02 / 02`, and the button is `Pause`, because choosing a track plays it.
- **Seek.** Choose `Pause`, then `Previous track`, which restarts the current track at `00:00`. Run `verify browser focus 'input[aria-label="Seek"]'` and `verify browser press ArrowRight`. `verify browser get attr 'input[aria-label="Seek"]' aria-valuetext` returns `0:05 of 0:08`, and the card shows `00:05` and `-00:03`. Read the value at once, since `Previous track` can resume playback.
- **Follow.** Reopen `$VERIFY_URL/sound`, choose `Play`, run `verify browser wait 1200`, choose `Pause`, and run `verify browser find role link click --name "About"` and `verify browser wait --url "**/about"`. The `Player and controls` region holds a `Music player` region with `Open player`, `Previous track`, `Play`, `Next track`, and `Seek` at the paused second.
- **Return.** Run `verify browser wait 1500`, then `verify browser find role button click --name "Open player"` and `verify browser wait --url "**/sound"`. The card shows the same track and second.
- **Proof.** Save `verify browser snapshot -s main` and `verify browser screenshot` to `$VERIFY_EVIDENCE/sound-player/` before and after each action you claim, and the rail snapshot (`snapshot -s aside`) for `player-follow`.

## Gotchas

- Seed tracks last 8 seconds. A track left playing ends, and after the last track the mini player leaves the rail. Pause before you navigate or wait.
- `Seek` steps 5 seconds per arrow key. Seeking to the end, with `End` or a second `ArrowRight`, ends the track and advances to the next one at `0:00`.
- `Previous track` restarts the current track once it has played about a second, and moves to the previous track only near `0:00`. Start the skip step right after `Next track`.
- A click on `Open player` within about a second of landing on About does nothing (2 of 2 tries on 2026-11-15), and one after 1.5 seconds navigates (2 of 2). Wait 1.5 seconds first. If a change targets the mini player, also drive the immediate click and report what it does.
- `agent-browser find` has no `focus` action. Focus the slider with `verify browser focus 'input[aria-label="Seek"]'`.
- Audio plays muted in the headless browser. Prove playback by the `Pause` label and a moving `Seek` value, not by sound.
- The Library sits in the rail at 1200px and wider, and under the card below 1200px.

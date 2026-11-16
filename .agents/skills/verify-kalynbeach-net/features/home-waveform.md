# Home waveform

Home shows an interactive waveform under the site name. A visitor strikes it, plays it from the keyboard, and opens a key map that names each key and shows the value a key just changed.

## Sub-features

- `wave-strike` strikes the waveform from its button.
- `wave-controls-open` opens the `Waveform controls` key map with `?` or the ghost `?` button, and closes it with `Escape` or `Close waveform controls`.
- `wave-readout` shows the changed value beside its row after a mapped key.
- `wave-page-keys` turns page-wide keys off with the `Keys on this page` switch.

## How to get to it (user POV)

- Open `/`, or choose `Home` or the `Kalyn Beach` link in the sidebar.
- Press `?` anywhere on Home, or focus and choose the `Show waveform controls` button under the waveform.
- Choose the button `Waveform. Press to strike it.`

## Driving it with verify browser

Preconditions:

- Baseline state from the [index](./README.md).
- A viewport 1200px or wider, the default. The key map lives in the rail.

- **Open Home.** Run `verify browser open "$VERIFY_URL/"` and `verify browser wait --text "Kalyn Beach"`. `main` holds `Show waveform controls` (expanded false), `Waveform. Press to strike it.`, and the heading `Kalyn Beach`.
- **Open the key map.** Run `verify browser press "?"` and `verify browser wait --text "Waveform controls"`. The rail's `Player and controls` region holds a `Waveform controls` region with rows `Notes`, `Y freq`, `X freq`, `Ratio`, `Turn`, `Phase`, `Wave`, `Copies`, `Drift`, `Size`, `Presets`, `Strike`, `Saved look`, and the switch `Keys on this page`. `Show waveform controls` is expanded true.
- **Readout.** Run `verify browser press ArrowUp`. `verify browser get text '[data-slot=waveform-controls]'` shows `Phase 30°` on the Phase row.
- **Close.** Run `verify browser press Escape`. `verify browser get attr '[aria-label="Show waveform controls"]' aria-expanded` returns `false`.
- **Strike.** Run `verify browser wait 1500`, `verify browser screenshot "$VERIFY_EVIDENCE/home-waveform/before-strike.png"`, `verify browser find role button click --name "Waveform. Press to strike it."`, and at once `verify browser screenshot "$VERIFY_EVIDENCE/home-waveform/after-strike.png"`. The click succeeds. The two screenshots are the only record, and they do not prove the strike. See Gotchas.
- **Proof.** Save the rail snapshot (`verify browser snapshot -s aside`) after opening and after the readout, plus the strike screenshots, under `$VERIFY_EVIDENCE/home-waveform/`.

## Gotchas

- Keys reach the waveform only while focus sits outside a text field. Start each key step from a fresh `open`.
- The ghost `?` button is hidden until hover or focus. Clicking it while hidden does nothing, so use the `?` key, or focus the button first.
- Read a readout right after its key, before pressing another.
- With `Keys on this page` off, `?` and the play keys work only with focus on the waveform, the ghost button, or the key map.
- The figure animates while idle, so two screenshots half a second apart already differ by about 17% of pixels, and `diff screenshot` cannot tell a strike from idle motion. The accessibility tree does not change either. Report `wave-strike` as not verified by automation, and attach the two screenshots for a person to compare.

# Refactor: Sound

This document outlines the refactor for my application's core audio ("sound") code on branch `refactor/sound`.

## Sound Code

### Refactored (New) Sound Code

- `components/sound.tsx`: Sound block component
- `components/sound-card.tsx`: Primary sound component (initially)
- `components/sound-card-skeleton.tsx`
- `components/sound-device-select.tsx`: Sound input device selector component
- `components/sound-visualizer.tsx`: Sound visualization component
- `hooks/use-sound.ts`: Core sound logic (`AudioContext`, `MediaDevice`, and `MediaStream` managment, controls, etc.)
- `hooks/use-sound-visualizer.ts`: Core sound visualization logic

### Old Sound Code

- `components/sound/sound-block.tsx`
- `components/sound/sound-devices.tsx`
- `components/sound/chroma.tsx`
- `components/sound/waveform.tsx`
- `components/sound/frequency-bars.tsx`

## TODOs

- [ ] Write tests for refactored sound code
- [ ] Reorganize refactored sound code
- [ ] Clean up old sound code
- [ ] Integrate `meyda`, `tonal`, and other relevant libraries
- [ ] Review branch code
- [ ] Create PR and merge `refactor/sound` branch into `main`
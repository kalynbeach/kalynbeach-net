# Refactor: Sound

This document outlines the refactor for my application's core audio ("sound") code on branch `refactor/sound`.

## Refactor Goals

- Streamline and optimize sound code (lib, hooks, components, etc.)
  - Redesign and reimplement core sound code modules into reuseable, performant web audio primatives
    - Library for core sound functions
    - Hook(s) for sound state management (`AudioContext`, `MediaDevice`, `MediaStream`, etc.)
    - Hook(s) for sound visualizations
    - Hook(s) for sound features (using `meyda` and/or other audio feature extraction libraries)
    - Hook(s) for musical analysis (using `tonal` and other music theory libraries)
  - Ensure the core sound code is optimally designed and implemented, and that it follows relevant best practices

## Sound Code

### Old Sound Code

- `components/sound/sound-block.tsx`
- `components/sound/sound-devices.tsx`
- `components/sound/chroma.tsx`
- `components/sound/waveform.tsx`
- `components/sound/frequency-bars.tsx`

### Refactored Sound Code

- `lib/sound.ts`: Core sound libraries
- `hooks/use-sound.ts`: Core sound logic (`AudioContext`, `MediaDevice`, and `MediaStream` managment, controls, etc.)
- `hooks/use-sound-visualizer.ts`: Core sound visualization logic
- `components/sound.tsx`: Wrapped `SoundCard` sound block component
- `components/sound-card.tsx`: Primary sound component (initially)
- `components/sound-card-skeleton.tsx`: `SoundCard` skeleton
- `components/sound-device-select.tsx`: Sound input device selector component
- `components/sound-visualizer.tsx`: Sound visualization component

## TODOs

- [ ] Update `SoundCard` color styles so they resemble `WaveLab` color styles
- [ ] Reorganize refactored sound code
- [ ] Clean up old sound code
- [ ] Write tests for refactored sound code (might be better suited in `kalynbeach-registry` repo?)
- [ ] Create mermaid diagrams for sound system structure and audio data flow
- [ ] Integrate `meyda`, `tonal`, and other relevant libraries
- [ ] Review branch code
- [ ] Create PR and merge `refactor/sound` branch into `main`
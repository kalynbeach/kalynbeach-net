# WavePlayer TODOs

## General

### Core Audio

- [ ] Review `WavePlayerBufferPool` implementation:
  - [ ] Ensure that the current buffer pool strategy and implementation is optimal for both high-fidelity, memory-efficient audio playback and processing
  - [ ] Ensure that the buffer pool is properly managing the audio buffer chunks

## Issues

### Context

- [ ] Ensure `state.status` is properly updated when controls are used
- [ ] Fix `state.currentTime` continuing to increment after the track has ended
- [ ] Review `loadTrack` implementation:
  - [ ] Ensure that the current implementation is optimal
  - [ ] Ensure that the proper actions are dispatched when the track is loaded

### Components

- `WavePlayer`
  - [ ] Clean up and improve styles
    - [ ] Improve `Card` layout and section styles
    - [ ] Improve styles for larger screens (sizing, padding, etc.)
    - [ ] Improve audio buffer loading UI
- `WavePlayerTrackInfo`
  - [ ] Clean up and improve styles
- `WavePlayerTrackControls`
  - [ ] Fix progress `Slider` values (`state.currentTime`, `state.duration`) not properly updating
  - [ ] Fix progress `Slider` not updating properly when `state.currentTime` changes
  - [ ] Fix progress `Slider` not seeking to the correct position when interacted with
  - [ ] Clean up and improve styles
- `WavePlayerTrackVisuals`
  - [ ] Add initial canvas skeleton to display before audio is played
  - [ ] Clean up and improve styles

## Features

- `WavePlayerDashboard`: admin-only `WavePlayer` data management dashboard
  - [ ] Add initial zod schemas
  - [ ] Add initial dashboard components:
    - `WavePlayerTrackForm`
      - [ ] Add initial form component(s)
      - [ ] Add form validation
    - `WavePlayerPlaylistForm`
      - [ ] Add initial form component(s)
      - [ ] Add form validation
    - `WavePlayerSettingsForm`
      - [ ] Add initial form component(s)
      - [ ] Add form validation

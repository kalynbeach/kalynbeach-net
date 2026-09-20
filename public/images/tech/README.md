# WavePlayer captures

These are real browser captures of Kalyn Beach's WavePlayer experiment on September 20, 2026. The page frames the original images with CSS; their pixels are unaltered.

- `waveplayer-webgpu-light.jpg` shows the paused synthetic stereo study and its WebGPU XY trace.
- `waveplayer-webgpu-dark.jpg` shows the same synthetic study playing, with live WebGPU XY output.

The study is a generated 30-second, 48 kHz stereo PCM16 WAV. It passes through the same file preparation and Rust/Wasm playback path as a selected local file. Its name is explicitly synthetic. No private music, local paths, or account information appears in the captures.

The images document an unreleased prototype. They do not establish audible quality, speaker synchronization, or broad browser support. The case study's engine stress and preparation measurements predate this WebGPU integration.

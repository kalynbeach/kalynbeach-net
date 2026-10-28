/**
 * A stored look as a config the waveform engine can hold.
 *
 * The engine compares configs by reference: a new object reruns every
 * form's configured(), and the scope clears its trace. The same look
 * arrives as a new object at the server-to-client handoff, on every
 * reconnect, and whenever the list it sits in changes. This module is where
 * that stops: a look keeps its config object until its content changes.
 *
 * Content means the parsed config. Two stored configs are the same look
 * when parseWaveformConfig turns them into the same JSON with sorted keys,
 * so key order, unknown fields, and values the parser fits into range don't
 * count.
 *
 * Pure and free of React, so the root layout's server read can import it.
 */
import {
  parseWaveformConfig,
  type StoredValue,
  type WaveformConfig,
} from "@/components/waveform/settings";

/**
 * A parsed config and its content key. Invariant: settle() returns the
 * current KeyedConfig whenever the key matches, so one key holds one object.
 */
export type KeyedConfig = {
  readonly key: string;
  readonly config: WaveformConfig;
};

export function configKey(config: StoredValue): string {
  return keyOf(parseWaveformConfig(config));
}

function keyOf(config: WaveformConfig): string {
  return JSON.stringify(config, (_, value: unknown) =>
    value instanceof Object && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : value
  );
}

/**
 * The look a stored value draws. Anything but an object, such as null for
 * no live look, draws DEFAULT_WAVEFORM_CONFIG itself.
 */
export function toKeyedConfig(stored: StoredValue): KeyedConfig {
  const config = parseWaveformConfig(stored);

  return { key: keyOf(config), config };
}

export function settle(current: KeyedConfig, stored: StoredValue): KeyedConfig {
  const next = toKeyedConfig(stored);

  return next.key === current.key ? current : next;
}

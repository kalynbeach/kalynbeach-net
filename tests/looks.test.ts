import { describe, expect, it } from "vitest";
import {
  applyPreset,
  DEFAULT_WAVEFORM_CONFIG,
  PRESET_ORDER,
  type StoredValue,
  type WaveformConfig,
} from "@/components/waveform/settings";
import {
  configKey,
  settle,
  toKeyedConfig,
  type KeyedConfig,
} from "@/components/looks/look";
import { shownConfig } from "@/components/looks/live";

function roundTrip(config: WaveformConfig): StoredValue {
  return JSON.parse(JSON.stringify(config));
}

function reverseKeys(value: StoredValue): StoredValue {
  return JSON.parse(
    JSON.stringify(value, (_, inner: unknown) =>
      inner instanceof Object && !Array.isArray(inner)
        ? Object.fromEntries(Object.entries(inner).reverse())
        : inner
    )
  );
}

function withHz(config: WaveformConfig, hz: number): WaveformConfig {
  return {
    ...config,
    tones: { ...config.tones, x: { ...config.tones.x, hz } },
  };
}

const circle = applyPreset(DEFAULT_WAVEFORM_CONFIG, "circle");

describe("toKeyedConfig", () => {
  it("draws the block default itself when no look is live", () => {
    expect(toKeyedConfig(null).config).toBe(DEFAULT_WAVEFORM_CONFIG);
  });

  it.each<StoredValue>(["golden", 7, [circle]])(
    "draws the block default for the non-object %s",
    (stored) => {
      expect(toKeyedConfig(stored).config).toBe(DEFAULT_WAVEFORM_CONFIG);
    }
  );

  it("draws a stored look", () => {
    expect(toKeyedConfig(roundTrip(circle)).config).toEqual(circle);
  });
});

describe("configKey", () => {
  it("ignores key order and unknown fields", () => {
    const key = configKey(circle);

    expect(configKey(roundTrip(circle))).toBe(key);
    expect(configKey(reverseKeys(circle) as StoredValue)).toBe(key);
    expect(configKey({ ...circle, extra: 1 })).toBe(key);
  });

  it("changes when the drawn content changes", () => {
    expect(configKey(withHz(circle, 330))).not.toBe(configKey(circle));
  });

  it("gives every preset its own key, and the same key after a JSON round trip", () => {
    const keys = PRESET_ORDER.map((id) => {
      const config = applyPreset(DEFAULT_WAVEFORM_CONFIG, id);
      const key = configKey(config);

      expect(configKey(roundTrip(config)), id).toBe(key);

      return key;
    });

    expect(new Set(keys).size).toBe(PRESET_ORDER.length);
  });
});

describe("settle", () => {
  const held: KeyedConfig = toKeyedConfig(roundTrip(circle));

  it.each<[string, StoredValue]>([
    ["a clone", structuredClone(circle)],
    ["the keys reversed", reverseKeys(circle)],
    ["an extra field", { ...circle, extra: 1 }],
  ])("keeps the held look for %s", (_, stored) => {
    expect(settle(held, stored)).toBe(held);
  });

  it("returns a new look when the content changes", () => {
    const next = settle(held, roundTrip(withHz(circle, 330)));

    expect(next).not.toBe(held);
    expect(next.config.tones.x.hz).toBe(330);
  });
});

describe("shownConfig", () => {
  const live = toKeyedConfig(circle);
  const play = withHz(circle, 180);

  it("draws the live look before a visitor plays", () => {
    expect(shownConfig(live, null)).toBe(live.config);
  });

  it("draws a visitor's play on the live look it was made on", () => {
    expect(shownConfig(live, { live, config: play })).toBe(play);
  });

  it("keeps a visitor's play when the same live look arrives as a new object", () => {
    const resent = settle(live, roundTrip(circle));

    expect(shownConfig(resent, { live, config: play })).toBe(play);
  });

  it("draws a new live look over a visitor's stale play", () => {
    const next = settle(live, applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette"));

    expect(shownConfig(next, { live, config: play })).toBe(next.config);
  });

  it("never brings a stale play back when the live look returns to it", () => {
    const away = settle(live, applyPreset(DEFAULT_WAVEFORM_CONFIG, "rosette"));
    const back = settle(away, roundTrip(circle));

    expect(back.key).toBe(live.key);
    expect(shownConfig(back, { live, config: play })).toBe(back.config);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSoundDevices } from "@/hooks/wave-lab/use-sound-devices";

// Mock MediaStream
class MockMediaStream {
  getTracks() {
    return [];
  }
}

// Define MediaDeviceInfo mock type
class MockMediaDeviceInfo implements MediaDeviceInfo {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;

  constructor(init: {
    deviceId: string;
    kind: MediaDeviceKind;
    label: string;
    groupId: string;
  }) {
    this.deviceId = init.deviceId;
    this.kind = init.kind;
    this.label = init.label;
    this.groupId = init.groupId;
  }

  toJSON() {
    return {
      deviceId: this.deviceId,
      kind: this.kind,
      label: this.label,
      groupId: this.groupId,
    };
  }
}

// Mock devices
const mockDevices = [
  new MockMediaDeviceInfo({
    deviceId: "device1",
    kind: "audioinput",
    label: "Microphone 1",
    groupId: "group1",
  }),
  new MockMediaDeviceInfo({
    deviceId: "device2",
    kind: "audioinput",
    label: "Microphone 2",
    groupId: "group1",
  }),
  new MockMediaDeviceInfo({
    deviceId: "device3",
    kind: "videoinput",
    label: "Camera 1",
    groupId: "group2",
  }),
];

// Mock MediaDevices API
const mockMediaDevices = {
  getUserMedia: vi.fn(() => Promise.resolve(new MockMediaStream())),
  enumerateDevices: vi.fn(() => Promise.resolve(mockDevices)),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Setup global mocks
vi.stubGlobal("MediaStream", MockMediaStream);
vi.stubGlobal("navigator", {
  mediaDevices: mockMediaDevices,
});

describe("useSoundDevices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize with empty devices array", () => {
    const { result } = renderHook(() => useSoundDevices());

    expect(result.current.devices).toEqual([]);
    expect(result.current.selectedDevice).toBe("");
  });

  it("should fetch and filter audio input devices", async () => {
    const { result } = renderHook(() => useSoundDevices());

    // Wait for devices to be fetched
    await act(async () => {
      await Promise.resolve();
    });

    const expectedDevices = mockDevices.filter(
      (device) => device.kind === "audioinput"
    );
    expect(result.current.devices).toEqual(expectedDevices);
  });

  it("should select first device by default", async () => {
    const { result } = renderHook(() => useSoundDevices());

    // Wait for devices to be fetched
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.selectedDevice).toBe("device1");
  });

  it("should handle device selection", async () => {
    const { result } = renderHook(() => useSoundDevices());

    // Wait for devices to be fetched
    await act(async () => {
      await Promise.resolve();
    });

    // Change selected device
    act(() => {
      result.current.setSelectedDevice("device2");
    });

    expect(result.current.selectedDevice).toBe("device2");
  });

  it("should handle device changes", async () => {
    const { result } = renderHook(() => useSoundDevices());

    // Wait for initial devices to be fetched
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate device change
    const updatedDevices = [
      new MockMediaDeviceInfo({
        deviceId: "device1",
        kind: "audioinput",
        label: "Microphone 1",
        groupId: "group1",
      }),
      new MockMediaDeviceInfo({
        deviceId: "device4",
        kind: "audioinput",
        label: "New Microphone",
        groupId: "group1",
      }),
    ];

    await act(async () => {
      mockMediaDevices.enumerateDevices.mockResolvedValue(updatedDevices);
      const deviceChangeHandler =
        mockMediaDevices.addEventListener.mock.calls[0][1];
      deviceChangeHandler();
    });

    expect(result.current.devices).toEqual(updatedDevices);
  });

  it("should handle getUserMedia errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockMediaDevices.getUserMedia.mockRejectedValue(
      new Error("Permission denied")
    );

    const { result } = renderHook(() => useSoundDevices());

    // Wait for error to be handled
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.devices).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Error accessing audio devices:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it("should cleanup event listeners on unmount", () => {
    const { unmount } = renderHook(() => useSoundDevices());

    unmount();

    expect(mockMediaDevices.removeEventListener).toHaveBeenCalledWith(
      "devicechange",
      expect.any(Function)
    );
  });
});

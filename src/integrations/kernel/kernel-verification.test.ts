import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTrackingWithKernel } from "./client";
import Kernel from "@onkernel/sdk";

vi.mock("@onkernel/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      browsers: {
        create: vi.fn().mockResolvedValue({ session_id: "mock-session-789" }),
        playwright: {
          execute: vi.fn().mockResolvedValue({
            result: {
              statusText: "Delivered",
              title: "Referee Parcel Express - Tracking TRK-DELIV-999",
              screenshotBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            },
          }),
        },
        deleteByID: vi.fn().mockResolvedValue({}),
      },
    })),
  };
});

describe("verifyTrackingWithKernel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies tracking, extracts status, captures screenshot and cleans up session", async () => {
    const result = await verifyTrackingWithKernel("TRK-DELIV-999", "Mock Carrier");

    expect(result.trackingNumber).toBe("TRK-DELIV-999");
    expect(result.status).toBe("Delivered");
    expect(result.statusText).toContain("Delivered");
    expect(result.contentHash).toBeDefined();
    expect(result.screenshotUrl).toBeDefined();
    expect(result.replayUrl).toContain("mock-session-789");
  });

  it("rejects disallowed carriers immediately without creating a browser session", async () => {
    await expect(
      verifyTrackingWithKernel("TRK-123", "ShadyCourier")
    ).rejects.toThrow(/not in the allowed carriers list/);
  });
});


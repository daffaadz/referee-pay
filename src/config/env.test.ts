import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Environment Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads valid sandbox environment successfully", async () => {
    const { env } = await import("./env");
    expect(env.PAYPAL_ENV).toBe("sandbox");
  });
});


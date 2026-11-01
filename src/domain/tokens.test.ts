import { describe, it, expect } from "vitest";
import {
  generateCapabilityTokens,
  hashToken,
  resolveRoleByToken,
} from "./tokens";

describe("Capability Tokens (FR-2)", () => {
  it("generates tokens with sufficient entropy (>= 128 bits)", () => {
    const tokens = generateCapabilityTokens();

    // 32 bytes base64url is 43 characters (256 bits of entropy)
    expect(tokens.sellerToken.length).toBeGreaterThanOrEqual(22); // 128 bits base64 is 22 chars
    expect(tokens.buyerToken.length).toBeGreaterThanOrEqual(22);

    expect(tokens.sellerToken).not.toBe(tokens.buyerToken);
    expect(tokens.sellerTokenHash).toBe(hashToken(tokens.sellerToken));
    expect(tokens.buyerTokenHash).toBe(hashToken(tokens.buyerToken));
  });

  it("resolves role accurately given matching token", () => {
    const { sellerToken, sellerTokenHash, buyerToken, buyerTokenHash } =
      generateCapabilityTokens();

    expect(resolveRoleByToken(sellerToken, sellerTokenHash, buyerTokenHash)).toBe("seller");
    expect(resolveRoleByToken(buyerToken, sellerTokenHash, buyerTokenHash)).toBe("buyer");
  });

  it("returns null for wrong or unguessable tokens", () => {
    const { sellerTokenHash, buyerTokenHash } = generateCapabilityTokens();

    expect(resolveRoleByToken("wrong_token_12345", sellerTokenHash, buyerTokenHash)).toBeNull();
    expect(resolveRoleByToken("", sellerTokenHash, buyerTokenHash)).toBeNull();
  });
});


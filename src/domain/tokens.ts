import crypto from "crypto";

export type Role = "seller" | "buyer";

export interface CapabilityTokens {
  sellerToken: string;
  sellerTokenHash: string;
  buyerToken: string;
  buyerTokenHash: string;
}

/**
 * Generates cryptographically secure, unguessable capability tokens (256 bits > 128 bits required by FR-2).
 * Returns both raw tokens (to give to users) and their SHA-256 hashes (to store in the database).
 */
export function generateCapabilityTokens(): CapabilityTokens {
  const sellerToken = crypto.randomBytes(32).toString("base64url");
  const buyerToken = crypto.randomBytes(32).toString("base64url");

  return {
    sellerToken,
    sellerTokenHash: hashToken(sellerToken),
    buyerToken,
    buyerTokenHash: hashToken(buyerToken),
  };
}

/**
 * Computes SHA-256 hash of a capability token.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Derives role from a capability token by comparing its hash against the stored seller and buyer hashes.
 * Constant-time comparison prevents timing attacks.
 */
export function resolveRoleByToken(
  token: string,
  sellerTokenHash: string,
  buyerTokenHash: string
): Role | null {
  const candidateHash = hashToken(token);

  if (candidateHash.length === sellerTokenHash.length && crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(sellerTokenHash))) {
    return "seller";
  }

  if (candidateHash.length === buyerTokenHash.length && crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(buyerTokenHash))) {
    return "buyer";
  }

  return null;
}


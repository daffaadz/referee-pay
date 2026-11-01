import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

export const SESSION_COOKIE_NAME = "referee_session";
export const STATE_COOKIE_NAME = "paypal_auth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export const sessionPayloadSchema = z.object({
  sellerId: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable().optional(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.INTERNAL_SWEEP_SECRET ||
    "referee_session_secret_32chars_long_default!";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSecretKey();
  return await new SignJWT({
    sellerId: payload.sellerId,
    email: payload.email,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    const parsed = sessionPayloadSchema.safeParse({
      sellerId: payload.sellerId,
      email: payload.email,
      name: payload.name,
    });

    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export function generateOAuthState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

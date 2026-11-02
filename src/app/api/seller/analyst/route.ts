import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/domain/session";
import { runRefereeAnalyst } from "@/agent/analyst";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(1000, "Message is too long"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const response = await runRefereeAnalyst({
      sellerId: session.sellerId,
      query: parseResult.data.message,
      history: parseResult.data.history,
    });

    return NextResponse.json({
      ok: true,
      ...response,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error running analyst agent";
    console.error("[Analyst API Error]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


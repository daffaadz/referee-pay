import { NextResponse } from "next/server";
import { z } from "zod";
import { draftDeal } from "@/agent/drafter";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const draftRequestSchema = z.object({
  text: z.string().min(3, "Text must be at least 3 characters").max(4000),
  clarification: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log("[Drafter API] Received POST /api/deals/draft");

  // Rate limit: 15 requests per minute per IP
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`draft:${clientIp}`, { maxRequests: 15, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many draft requests. Please slow down.", retryAfterMs: rateLimit.resetMs },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = draftRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.warn("[Drafter API] Invalid draft request body:", parsed.error.format());
      return NextResponse.json(
        { error: "Invalid draft request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const preview = parsed.data.text.replace(/\s+/g, " ").slice(0, 60);
    console.log(`[Drafter API] Calling LLM to parse contract for: "${preview}..."`);

    const result = await draftDeal(parsed.data);
    const elapsed = Date.now() - startTime;

    console.log(
      `[Drafter API] Successfully drafted contract in ${elapsed}ms: ` +
        `"${result.contract.item.title}" (${result.contract.item.price.amount} ${result.contract.item.price.currency})`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Drafter API] Error drafting deal after ${elapsed}ms:`, error?.message || error);
    return NextResponse.json(
      { error: "Failed to draft deal contract", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


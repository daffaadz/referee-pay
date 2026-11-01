import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { updateMockTracking } from "@/integrations/kernel/mock-carrier-store";

const updateCarrierSchema = z.object({
  trackingNumber: z.string().min(1, "trackingNumber is required"),
  status: z.enum(["Label created", "In transit", "Delivered", "Returned"]),
  location: z.string().optional(),
});

export async function POST(req: Request) {
  if (!env.DEMO_MODE) {
    return NextResponse.json(
      { error: "Demo carrier control is disabled outside DEMO_MODE" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateCarrierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { trackingNumber, status, location } = parsed.data;
    const updated = updateMockTracking(trackingNumber, status, location);

    return NextResponse.json({
      success: true,
      message: `Updated tracking ${trackingNumber} to status '${status}'`,
      record: updated,
    });
  } catch (err: any) {
    console.error("Error updating carrier status:", err);
    return NextResponse.json(
      { error: "Failed to update carrier status", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


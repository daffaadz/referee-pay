import { NextResponse } from "next/server";
import { getDealByToken, getDecisionsForDeal } from "@/db/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const resolved = await getDealByToken(token);

    if (!resolved) {
      return NextResponse.json({ error: "Deal not found or invalid token" }, { status: 404 });
    }

    const decisionRows = await getDecisionsForDeal(resolved.deal.id);

    return NextResponse.json({
      success: true,
      decisions: decisionRows,
    });
  } catch (error: any) {
    console.error("Error fetching decisions:", error);
    return NextResponse.json(
      { error: "Failed to fetch decisions", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


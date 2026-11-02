import type { Metadata } from "next";
import { SellerDashboard } from "@/components/dashboard/SellerDashboard";

export const metadata: Metadata = {
  title: "Seller Dashboard: AG Studio | Referee",
  description: "Real-time escrow telemetry, risk detection, and verified PayPal ledger.",
};

export default function DashboardPage() {
  return (
    <main className="flex-1 min-h-0 md:h-full md:overflow-hidden flex flex-col bg-bg">
      <SellerDashboard />
    </main>
  );
}


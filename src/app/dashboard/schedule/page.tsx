import type { Metadata } from "next";
import { SellerDashboard } from "@/components/dashboard/SellerDashboard";

export const metadata: Metadata = {
  title: "Fulfillment Board | Referee",
  description: "Real-time fulfillment schedule, delivery deadlines, and automated Referee decisions.",
};

export default function SchedulePage() {
  return (
    <main className="flex-1 min-h-0 md:h-full md:overflow-hidden flex flex-col bg-bg">
      <SellerDashboard initialTab="fulfillment" />
    </main>
  );
}


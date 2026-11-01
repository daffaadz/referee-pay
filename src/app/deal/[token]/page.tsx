"use client";

import { useEffect, useState, use } from "react";
import { DecisionLog } from "@/components/DecisionLog";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import type { DealStatus, DealEventType } from "@/domain/state-machine";
import type { DealContract } from "@/domain/contract";
import type { Role } from "@/domain/tokens";
import type { Evidence } from "@/domain/evidence";

interface DealData {
  deal: {
    id: string;
    status: DealStatus;
    contract: DealContract;
    amount: string;
    currency: string;
    deadlines: {
      shipDeadlineDays?: number;
      deliveryDeadlineDays?: number;
      inspectionWindowDays?: number;
    };
    createdAt: string;
  };
  role: Role;
  events: Array<{
    id: string;
    type: DealEventType;
    payload?: Record<string, unknown>;
    createdAt: string;
  }>;
  evidence: Evidence[];
  payment: {
    orderId?: string;
    authorizationId?: string;
    status: string;
  } | null;
  decisions?: any[];
}

const STATUS_BADGES: Record<DealStatus, { label: string; badgeClass: string; description: string }> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    description: "Terms are drafted but pending funding.",
  },
  AWAITING_PAYMENT: {
    label: "Payment Required",
    badgeClass: "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
    description: "Waiting for buyer to authorize funds on PayPal Sandbox.",
  },
  FUNDS_HELD: {
    label: "Funds in Escrow",
    badgeClass: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
    description: "Money held safely in PayPal escrow. Seller can now ship.",
  },
  SHIPPED: {
    label: "Shipped / In Transit",
    badgeClass: "bg-zinc-100 text-zinc-900 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    description: "Item shipped. Referee cloud browser is verifying tracking.",
  },
  DELIVERED: {
    label: "Delivered (Inspection Active)",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    description: "Delivered. Buyer has inspection window to review item.",
  },
  CLAIM_OPEN: {
    label: "Under Dispute",
    badgeClass: "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    description: "A claim has been opened. Referee AI is reviewing evidence.",
  },
  ESCALATED: {
    label: "Escalated for Review",
    badgeClass: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    description: "Escalated for human operator review.",
  },
  RELEASED: {
    label: "Completed & Released",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200",
    description: "Funds successfully released to seller.",
  },
  REFUNDED: {
    label: "Refunded to Buyer",
    badgeClass: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
    description: "Escrow hold cancelled or refunded back to buyer.",
  },
  SETTLED: {
    label: "Settled",
    badgeClass: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    description: "Partial settlement concluded.",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    description: "Deal was cancelled.",
  },
};

function formatEventSummary(type: DealEventType, payload?: Record<string, unknown>): string {
  switch (type) {
    case "CONTRACT_CREATED":
      return "Escrow agreement terms created";
    case "PAYMENT_AUTHORIZED":
      return `Buyer authorized escrow hold on PayPal Sandbox${payload?.authorizationId ? ` (Auth ${String(payload.authorizationId).slice(0, 10)}...)` : ""}`;
    case "SHIPMENT_ADDED":
      return `Seller submitted tracking #${payload?.trackingNumber || ""} via ${payload?.carrier || "carrier"}`;
    case "DELIVERY_VERIFIED":
      return `Carrier verified as ${payload?.status || "Delivered"} by Kernel cloud browser`;
    case "DELIVERY_FAILED":
      return "Delivery tracking verification failed or exception reported";
    case "SHIP_DEADLINE_EXPIRED":
      return "Seller shipping deadline expired";
    case "DELIVERY_DEADLINE_EXPIRED":
      return "Delivery deadline expired";
    case "INSPECTION_PASSED":
      return "Inspection window concluded with no dispute claims";
    case "BUYER_CONFIRMED":
      return "Buyer confirmed receipt and approved escrow release";
    case "CLAIM_OPENED":
      return `Buyer opened dispute: "${payload?.reason || "Issue reported"}"`;
    case "DECISION_RELEASE":
      return "Referee approved release of funds to seller";
    case "DECISION_REFUND":
      return "Referee approved full refund to buyer";
    case "DECISION_SETTLE":
      return "Referee approved partial settlement";
    case "DECISION_ESCALATE":
      return "Deal escalated to human operator review";
    case "CANCEL":
      return "Deal cancelled before funding";
    case "EVIDENCE_ADDED":
      return "New verification evidence recorded";
    default:
      return String(type).replace(/_/g, " ").toLowerCase();
  }
}

export default function DealRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [dealData, setDealData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [carrier, setCarrier] = useState("Mock Carrier");
  const [trackingNumber, setTrackingNumber] = useState("MCK-123456");
  const [claimReason, setClaimReason] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/deals/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load deal");
        }
        if (isMounted) setDealData(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load deal");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  const reloadDeal = async () => {
    try {
      const res = await fetch(`/api/deals/${token}`);
      const data = await res.json();
      if (res.ok) {
        setDealData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Buyer: Initiate PayPal payment
  const handleBuyerCreateOrder = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deals/${token}/paypal/create-order`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

      setCreatedOrderId(data.orderId);
      if (data.approveUrl) {
        window.open(data.approveUrl, "_blank");
      }
    } catch (err: any) {
      alert(`Payment Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Buyer: Authorize PayPal payment
  const handleBuyerAuthorize = async () => {
    if (!createdOrderId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deals/${token}/paypal/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: createdOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to authorize payment");
      setCreatedOrderId(null);
      await reloadDeal();
    } catch (err: any) {
      alert(`Authorization Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Seller: Add Shipment
  const handleSellerShip = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deals/${token}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add shipment");
      await reloadDeal();
    } catch (err: any) {
      alert(`Shipping Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Buyer: Confirm Receipt
  const handleConfirmReceipt = async () => {
    if (
      !confirm(
        "Confirm delivery? This will immediately release the escrow funds to the seller's account."
      )
    )
      return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deals/${token}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm receipt");
      await reloadDeal();
    } catch (err: any) {
      alert(`Confirmation Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Buyer: Open Claim
  const handleOpenClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/deals/${token}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: claimReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open claim");
      setClaimReason("");
      setShowClaimForm(false);
      await reloadDeal();
    } catch (err: any) {
      alert(`Claim Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-zinc-400 text-sm">
        <span className="animate-pulse">Loading deal room...</span>
      </div>
    );
  }

  if (error || !dealData) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
        <div className="h-10 w-10 mx-auto rounded-full bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
          ✕
        </div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Deal Not Found</h2>
        <p className="text-xs text-zinc-500">{error || "Invalid capability link."}</p>
      </div>
    );
  }

  const { deal, role, events, evidence, payment } = dealData;
  const contract = deal.contract;
  const badgeInfo = STATUS_BADGES[deal.status] || {
    label: deal.status,
    badgeClass: "bg-zinc-100 text-zinc-800",
    description: "",
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Deal Header */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeInfo.badgeClass}`}>
                  {badgeInfo.label}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  #{deal.id.slice(0, 12)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {contract.item.title}
              </h1>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {contract.item.price.amount} {contract.item.price.currency}
              </div>
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Viewing as: <strong className="capitalize">{role}</strong> ({role === "seller" ? contract.seller.displayName : contract.buyer?.displayName || "Buyer"})
              </span>
            </div>
          </div>

          {/* Where is the money explanation banner */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="text-base leading-none">💰</span>
            <div className="flex-1">
              <strong className="text-zinc-900 dark:text-zinc-200 mr-1.5 font-medium">
                Escrow Status:
              </strong>
              <span>{badgeInfo.description}</span>
            </div>
            {payment?.authorizationId && (
              <span className="hidden sm:inline-block font-mono text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                PayPal Auth: {payment.authorizationId.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>

        {/* PRIMARY ACTION PANEL (Role-specific call to action) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Current Step
          </h2>

          {/* --- BUYER VIEWS --- */}
          {role === "buyer" && (
            <div className="space-y-4">
              {deal.status === "AWAITING_PAYMENT" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Step 1: Authorize PayPal Escrow Hold
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Click below to open PayPal Sandbox. Log in with your sandbox buyer account and approve the {contract.item.price.amount} {contract.item.price.currency} authorization.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleBuyerCreateOrder}
                        className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <span>💳 Authorize on PayPal ({contract.item.price.amount} {contract.item.price.currency})</span>
                      </button>

                      {createdOrderId && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleBuyerAuthorize}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
                        >
                          ✓ I Approved on PayPal &rarr; Finalize Escrow Hold
                        </button>
                      )}
                    </div>
                  </div>

                  {createdOrderId && (
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-400">
                      PayPal Order <code className="font-mono">{createdOrderId}</code> opened in popup. After completing login & approval in PayPal, click the green button above to finalize.
                    </div>
                  )}
                </div>
              )}

              {(deal.status === "FUNDS_HELD" || deal.status === "SHIPPED") && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {deal.status === "FUNDS_HELD" ? "Waiting for Seller to Ship" : "Package In Transit"}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Already received the package in good condition?
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirmReceipt}
                    className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition"
                  >
                    Confirm Early Receipt & Release Funds
                  </button>
                </div>
              )}

              {deal.status === "DELIVERED" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      Package Delivered — Inspection Window Active
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Carrier tracking confirmed delivery. Please inspect your item. If satisfied, release the funds. If no dispute is raised, funds will auto-release automatically.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleConfirmReceipt}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                      >
                        ✓ Confirm Receipt & Release Funds
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClaimForm(!showClaimForm)}
                        className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                      >
                        {showClaimForm ? "Hide Dispute Form" : "Report an Issue / Dispute"}
                      </button>
                    </div>
                  </div>

                  {showClaimForm && (
                    <form onSubmit={handleOpenClaim} className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-3">
                      <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200 block">
                        Describe the issue with your delivery:
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={claimReason}
                        onChange={(e) => setClaimReason(e.target.value)}
                        placeholder="e.g. Package arrived damaged, empty, or differs substantially from description..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-zinc-900"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
                      >
                        Submit Dispute to Referee
                      </button>
                    </form>
                  )}
                </div>
              )}

              {(deal.status === "RELEASED" || deal.status === "REFUNDED" || deal.status === "SETTLED") && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500">
                  Transaction is complete. No further action needed.
                </div>
              )}
            </div>
          )}

          {/* --- SELLER VIEWS --- */}
          {role === "seller" && (
            <div className="space-y-4">
              {deal.status === "AWAITING_PAYMENT" && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Awaiting Buyer Payment
                  </p>
                  <p>
                    The buyer has been sent their payment link. Once they approve the PayPal escrow hold, you will be notified to ship. Do not ship until funds are safely held.
                  </p>
                </div>
              )}

              {deal.status === "FUNDS_HELD" && (
                <form onSubmit={handleSellerShip} className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Funds Secured in Escrow — Ready to Ship!
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Enter your shipping tracking number below so Referee can automatically verify delivery.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Carrier</label>
                      <select
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                      >
                        <option value="Mock Carrier">Mock Carrier (Demo / Local)</option>
                        <option value="USPS">USPS</option>
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Tracking Number</label>
                      <input
                        type="text"
                        required
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. MCK-123456"
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition disabled:opacity-50"
                  >
                    {actionLoading ? "Submitting..." : "Submit Tracking Details &rarr;"}
                  </button>
                </form>
              )}

              {deal.status === "SHIPPED" && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Shipment Submitted
                  </p>
                  <p>
                    Referee cloud browser is periodically tracking package progress. Once marked delivered, the inspection countdown will begin.
                  </p>
                </div>
              )}

              {(deal.status === "RELEASED" || deal.status === "REFUNDED" || deal.status === "SETTLED") && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500">
                  Transaction is complete. No further action needed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Demo Control Panel */}
        <DemoControlPanel
          trackingNumber={
            (events.find((e) => e.type === "SHIPMENT_ADDED")?.payload as any)?.trackingNumber || trackingNumber
          }
          onActionComplete={reloadDeal}
        />

        {/* 2-Column: Timeline & Contract Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Timeline & Evidence (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            {/* Timeline */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Activity Timeline
              </h2>

              <div className="relative pl-5 space-y-4 border-l border-zinc-200 dark:border-zinc-800">
                {events.map((evt) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600 border-2 border-white dark:border-zinc-900" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatEventSummary(evt.type, evt.payload as any)}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {new Date(evt.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence items */}
            {evidence.length > 0 && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Verified Evidence ({evidence.length})
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs space-y-2"
                    >
                      <div className="flex justify-between items-center text-zinc-500">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {ev.kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] font-mono">
                          {new Date(ev.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {ev.contentText && (
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {ev.contentText}
                        </p>
                      )}
                      {ev.artifactUrl && (
                        <div className="pt-1 space-y-2">
                          {(ev.artifactUrl.endsWith(".png") ||
                            ev.artifactUrl.endsWith(".jpg") ||
                            ev.artifactUrl.includes("/screenshots/") ||
                            ev.artifactUrl.startsWith("data:image/")) && (
                            <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 max-w-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ev.artifactUrl}
                                alt={`Evidence ${ev.id}`}
                                className="w-full h-auto object-cover max-h-48 hover:max-h-none transition-all cursor-zoom-in"
                              />
                            </div>
                          )}
                          <a
                            href={ev.artifactUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                          >
                            View Cloud Browser Artifact &rarr;
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contract Terms (1 col) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 h-fit">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Contract Clauses
            </h2>
            <div className="space-y-3 text-xs">
              {contract.clauses.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px]">
                    Clause {c.id}
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decision Log (Screen 3) */}
        <DecisionLog
          token={token}
          decisions={dealData.decisions || []}
          clauses={contract.clauses || []}
          evidence={evidence || []}
          onRefresh={reloadDeal}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, use } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  FileText,
  Lock,
  Package,
  Receipt,
  Scales,
  ShieldCheck,
  Truck,
  User,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { DecisionLog } from "@/components/DecisionLog";
import { DemoControlPanel } from "@/components/DemoControlPanel";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { StatusChip, DealStatusType } from "@/components/ui/StatusChip";
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

const CARRIER_OPTIONS = [
  { value: "Mock Carrier", label: "Mock Carrier (Demo / Local)" },
  { value: "USPS", label: "USPS" },
  { value: "FedEx", label: "FedEx" },
  { value: "DHL", label: "DHL" },
];

function mapDealStatus(status: DealStatus): {
  type: DealStatusType;
  customLabel?: string;
  description: string;
} {
  switch (status) {
    case "DRAFT":
    case "AWAITING_PAYMENT":
      return {
        type: "WAITING",
        description: "Waiting for buyer to authorize payment on PayPal Sandbox.",
      };
    case "FUNDS_HELD":
      return {
        type: "HELD",
        description: "Payment held by Referee. Seller can now ship the item.",
      };
    case "SHIPPED":
      return {
        type: "SHIPPED",
        description: "Item shipped. Referee is verifying delivery on the carrier page.",
      };
    case "DELIVERED":
      return {
        type: "DELIVERED",
        description: "Carrier confirmed delivery. Buyer review period is open.",
      };
    case "RELEASED":
      return {
        type: "RELEASED",
        description: "Delivery confirmed. Payment released to seller.",
      };
    case "REFUNDED":
      return {
        type: "REFUNDED",
        description: "Escrow hold cancelled. Payment refunded to buyer.",
      };
    case "SETTLED":
      return {
        type: "RELEASED",
        customLabel: "Settled",
        description: "Partial settlement concluded.",
      };
    case "CLAIM_OPEN":
    case "ESCALATED":
      return {
        type: "NEEDS_REVIEW",
        description: "Issue reported. Referee is reviewing evidence.",
      };
    case "CANCELLED":
    default:
      return {
        type: "PROBLEM",
        customLabel: "Cancelled",
        description: "Deal was cancelled.",
      };
  }
}

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
  const [activeTab, setActiveTab] = useState<"evidence" | "decisions" | "terms">("evidence");

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
      alert(`Payment error: ${err.message}`);
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
      alert(`Authorization error: ${err.message}`);
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
      alert(`Shipping error: ${err.message}`);
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
      alert(`Confirmation error: ${err.message}`);
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
      alert(`Claim error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-neutral-600 text-sm">
        <span className="animate-pulse">Loading deal room...</span>
      </div>
    );
  }

  if (error || !dealData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center space-y-3">
          <div className="h-10 w-10 mx-auto rounded-full bg-danger-50 text-danger-700 flex items-center justify-center">
            <WarningCircle size={20} weight="bold" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900">Deal not found</h2>
          <p className="text-xs text-neutral-600">{error || "Invalid deal link."}</p>
        </Card>
      </div>
    );
  }

  const { deal, role, events, evidence, payment } = dealData;
  const contract = deal.contract;
  const statusInfo = mapDealStatus(deal.status);

  return (
    <div className="flex-1 md:min-h-0 flex flex-col md:flex-row gap-6 max-w-[1200px] w-full mx-auto p-4 sm:p-6 md:p-8 md:overflow-hidden">
      {/* LEFT PANE: Header, role actions, timeline, testing tools */}
      <div className="w-full md:w-5/12 flex flex-col gap-6 md:overflow-y-auto md:pr-2 md:min-h-0">
        {/* Deal Header Card */}
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusChip status={statusInfo.type} customLabel={statusInfo.customLabel} />
                <span className="text-xs text-neutral-500 font-mono">
                  #{deal.id.slice(0, 12)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif text-neutral-900 leading-snug">
                {contract.item.title}
              </h1>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-serif text-neutral-900 tabular-nums">
                {contract.item.price.amount}{" "}
                <span className="text-base font-sans font-medium text-neutral-600">
                  {contract.item.price.currency}
                </span>
              </div>
              <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                <User size={13} weight="bold" />
                <span>
                  Viewing as <strong className="capitalize">{role}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Escrow status banner */}
          <div className="pt-3 border-t border-border flex items-start gap-2.5 text-xs text-neutral-600">
            <ShieldCheck size={16} weight="bold" className="text-primary-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="text-neutral-900 font-medium mr-1">Escrow status:</strong>
              <span>{statusInfo.description}</span>
            </div>
            {payment?.authorizationId && (
              <span className="hidden sm:inline-block font-mono text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-sm">
                Auth {payment.authorizationId.slice(0, 8)}...
              </span>
            )}
          </div>
        </Card>

        {/* PRIMARY ACTION CARD (Current Step) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Current step
            </h2>
            <span className="text-xs text-neutral-500">
              {role === "buyer" ? "Buyer actions" : "Seller actions"}
            </span>
          </div>

          {/* --- BUYER ACTIONS --- */}
          {role === "buyer" && (
            <div className="space-y-4">
              {deal.status === "AWAITING_PAYMENT" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Step 1: Authorize PayPal escrow hold
                    </h3>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Click below to open PayPal Sandbox. Log in with your sandbox buyer account and approve the payment hold for {contract.item.price.amount} {contract.item.price.currency}.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Button
                      variant="primary"
                      loading={actionLoading}
                      onClick={handleBuyerCreateOrder}
                      className="w-full"
                    >
                      Authorize on PayPal ({contract.item.price.amount} {contract.item.price.currency})
                    </Button>

                    {createdOrderId && (
                      <div className="space-y-2 pt-2">
                        <div className="p-3 rounded-md bg-neutral-50 border border-border text-xs text-neutral-700">
                          PayPal order <code className="font-mono">{createdOrderId}</code> opened in popup. After completing approval in PayPal, click below to finalize.
                        </div>
                        <Button
                          variant="secondary"
                          loading={actionLoading}
                          onClick={handleBuyerAuthorize}
                          className="w-full"
                        >
                          I approved on PayPal, finalize escrow hold
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(deal.status === "FUNDS_HELD" || deal.status === "SHIPPED") && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {deal.status === "FUNDS_HELD" ? "Waiting for seller to ship" : "Package in transit"}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      Already received the package in good condition? You can confirm early receipt to release funds now.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    loading={actionLoading}
                    onClick={handleConfirmReceipt}
                    className="w-full"
                  >
                    Confirm early receipt and release funds
                  </Button>
                </div>
              )}

              {deal.status === "DELIVERED" && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-md bg-success-50 border border-success-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-success-700">
                      <CheckCircle size={15} weight="bold" />
                      <span>Package delivered: Inspection window active</span>
                    </div>
                    <p className="text-xs text-neutral-700 leading-relaxed">
                      Carrier tracking confirmed delivery. Please inspect your item. If satisfied, confirm receipt to release funds. If no dispute is raised, funds release automatically after the review period.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      loading={actionLoading}
                      onClick={handleConfirmReceipt}
                      className="w-full"
                    >
                      Confirm receipt and release funds
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => setShowClaimForm(!showClaimForm)}
                      className="w-full"
                    >
                      {showClaimForm ? "Hide dispute form" : "Report an issue / dispute"}
                    </Button>
                  </div>

                  {showClaimForm && (
                    <form onSubmit={handleOpenClaim} className="space-y-3 pt-2">
                      <Textarea
                        label="Describe the issue with your delivery:"
                        required
                        value={claimReason}
                        onChange={(e) => setClaimReason(e.target.value)}
                        placeholder="For example: Package arrived damaged, empty, or differs substantially from the description."
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        loading={actionLoading}
                        className="w-full bg-danger-600 hover:bg-danger-700"
                      >
                        Submit dispute to Referee
                      </Button>
                    </form>
                  )}
                </div>
              )}

              {(deal.status === "RELEASED" || deal.status === "REFUNDED" || deal.status === "SETTLED") && (
                <div className="p-3 rounded-md bg-neutral-100 text-xs text-neutral-700">
                  Transaction complete. No further action needed.
                </div>
              )}
            </div>
          )}

          {/* --- SELLER ACTIONS --- */}
          {role === "seller" && (
            <div className="space-y-4">
              {deal.status === "AWAITING_PAYMENT" && (
                <div className="p-3.5 rounded-md bg-neutral-50 border border-border space-y-1 text-xs text-neutral-700">
                  <p className="font-semibold text-neutral-900">Awaiting buyer payment</p>
                  <p className="text-neutral-600 leading-relaxed">
                    The buyer has received their payment link. Once they approve the PayPal escrow hold, you will be notified to ship. Do not ship until funds are safely held.
                  </p>
                </div>
              )}

              {deal.status === "FUNDS_HELD" && (
                <form onSubmit={handleSellerShip} className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Funds secured in escrow: Ready to ship
                    </h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Enter your shipping tracking number below so Referee can automatically verify delivery.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Select
                      label="Carrier"
                      value={carrier}
                      onValueChange={setCarrier}
                      options={CARRIER_OPTIONS}
                    />

                    <Input
                      label="Tracking number"
                      type="text"
                      required
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. MCK-123456"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={actionLoading}
                    className="w-full mt-2"
                  >
                    Submit tracking details
                  </Button>
                </form>
              )}

              {deal.status === "SHIPPED" && (
                <div className="p-3.5 rounded-md bg-neutral-50 border border-border space-y-1 text-xs text-neutral-700">
                  <p className="font-semibold text-neutral-900">Shipment submitted</p>
                  <p className="text-neutral-600 leading-relaxed">
                    Referee cloud browser is periodically tracking package progress. Once marked delivered, the inspection countdown will begin.
                  </p>
                </div>
              )}

              {deal.status === "DELIVERED" && (
                <div className="p-3.5 rounded-md bg-neutral-50 border border-border space-y-1 text-xs text-neutral-700">
                  <p className="font-semibold text-neutral-900">Package delivered</p>
                  <p className="text-neutral-600 leading-relaxed">
                    The buyer has an active inspection window. If no dispute is raised, funds will automatically release to your account.
                  </p>
                </div>
              )}

              {(deal.status === "RELEASED" || deal.status === "REFUNDED" || deal.status === "SETTLED") && (
                <div className="p-3 rounded-md bg-neutral-100 text-xs text-neutral-700">
                  Transaction complete. No further action needed.
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Activity Timeline Card */}
        <Card className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 border-b border-border pb-3">
            Activity timeline
          </h2>

          <div className="relative pl-5 space-y-4 border-l border-neutral-200">
            {events.map((evt) => (
              <div key={evt.id} className="relative">
                <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-neutral-400 border-2 border-surface" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-neutral-900">
                    {formatEventSummary(evt.type, evt.payload as any)}
                  </p>
                  <p className="text-[11px] text-neutral-500 tabular-nums">
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
        </Card>

        {/* Collapsible Demo Control Panel */}
        <DemoControlPanel
          trackingNumber={
            (events.find((e) => e.type === "SHIPMENT_ADDED")?.payload as any)?.trackingNumber ||
            trackingNumber
          }
          onActionComplete={reloadDeal}
        />
      </div>

      {/* RIGHT PANE: Tabs for Evidence, Decisions, Terms */}
      <div className="w-full md:w-7/12 flex flex-col md:overflow-hidden md:min-h-0">
        <Card className="flex flex-col md:h-full md:overflow-hidden md:min-h-0 p-4 sm:p-6">
          {/* Tab Bar */}
          <div className="flex items-center gap-2 border-b border-border pb-3 shrink-0" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "evidence"}
              onClick={() => setActiveTab("evidence")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "evidence"
                  ? "bg-primary-700 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Package size={14} weight={activeTab === "evidence" ? "bold" : "regular"} />
              <span>Evidence</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                  activeTab === "evidence"
                    ? "bg-primary-800 text-white"
                    : "bg-neutral-200 text-neutral-800"
                }`}
              >
                {evidence.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "decisions"}
              onClick={() => setActiveTab("decisions")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "decisions"
                  ? "bg-primary-700 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Scales size={14} weight={activeTab === "decisions" ? "bold" : "regular"} />
              <span>Decisions</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                  activeTab === "decisions"
                    ? "bg-primary-800 text-white"
                    : "bg-neutral-200 text-neutral-800"
                }`}
              >
                {dealData.decisions?.length || 0}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "terms"}
              onClick={() => setActiveTab("terms")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "terms"
                  ? "bg-primary-700 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Receipt size={14} weight={activeTab === "terms" ? "bold" : "regular"} />
              <span>Contract terms</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                  activeTab === "terms"
                    ? "bg-primary-800 text-white"
                    : "bg-neutral-200 text-neutral-800"
                }`}
              >
                {contract.clauses.length}
              </span>
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto pt-4">
            {/* 1. Evidence Tab */}
            {activeTab === "evidence" && (
              <div className="space-y-4">
                {evidence.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-neutral-600">
                    Nothing yet. Evidence appears here after the item ships.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-md border border-border bg-neutral-50 text-xs space-y-2 shadow-xs"
                      >
                        <div className="flex justify-between items-center text-neutral-600">
                          <span className="font-semibold text-neutral-900 capitalize">
                            {ev.kind.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums">
                            {new Date(ev.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {ev.contentText && (
                          <p className="text-neutral-800 leading-relaxed font-normal">
                            {ev.contentText}
                          </p>
                        )}
                        {ev.artifactUrl && (
                          <div className="pt-1 space-y-2">
                            {(ev.artifactUrl.endsWith(".png") ||
                              ev.artifactUrl.endsWith(".jpg") ||
                              ev.artifactUrl.includes("/screenshots/") ||
                              ev.artifactUrl.startsWith("data:image/")) && (
                              <div className="rounded-md overflow-hidden border border-border max-w-sm">
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
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"
                            >
                              <span>View cloud browser artifact</span>
                              <ArrowSquareOut size={13} weight="bold" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Decisions Tab */}
            {activeTab === "decisions" && (
              <DecisionLog
                token={token}
                decisions={dealData.decisions || []}
                clauses={contract.clauses || []}
                evidence={evidence || []}
                onRefresh={reloadDeal}
              />
            )}

            {/* 3. Terms Tab */}
            {activeTab === "terms" && (
              <div className="space-y-3">
                <div className="pb-2">
                  <h3 className="text-base font-semibold text-neutral-900 font-serif">
                    Contract clauses
                  </h3>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Pre-agreed escrow agreement rules governing releases, deadlines, and disputes.
                  </p>
                </div>

                <div className="space-y-3">
                  {contract.clauses.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-md bg-neutral-50 border border-border space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} weight="bold" className="text-primary-700" />
                        <span className="font-semibold text-neutral-900 text-xs">
                          Clause {c.id}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed pl-5">
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

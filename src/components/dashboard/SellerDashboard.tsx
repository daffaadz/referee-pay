"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Warning,
  ArrowSquareOut,
  DownloadSimple,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  Plus,
  Receipt,
  Funnel,
  Lock,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { SellerAnalyticsResponse } from "@/domain/analytics";
import { RefereeAnalystPanel } from "./RefereeAnalystPanel";
import type { WidgetAction } from "@/agent/analyst";

export function SellerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<SellerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLedger, setSearchLedger] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isAnalystOpen, setIsAnalystOpen] = useState(false);
  const [activeWidgetFilter, setActiveWidgetFilter] = useState<WidgetAction | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/seller/analytics");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/api/auth/demo?redirect=/dashboard");
          return;
        }
        throw new Error(`Failed to load seller analytics (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading dashboard";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/seller/analytics")
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/api/auth/demo?redirect=/dashboard");
            return;
          }
          throw new Error(`Failed to load seller analytics (${res.status})`);
        }
        const json = await res.json();
        if (active) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : "Error loading dashboard";
          setError(msg);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  // Filtered ledger rows
  const paymentsList = data?.payments || [];
  const filteredPayments = paymentsList.filter((p) => {
    const matchesSearch =
      searchLedger.trim() === "" ||
      (p.dealTitle && p.dealTitle.toLowerCase().includes(searchLedger.toLowerCase())) ||
      (p.paypalId && p.paypalId.toLowerCase().includes(searchLedger.toLowerCase())) ||
      p.dealId.toLowerCase().includes(searchLedger.toLowerCase());

    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  // CSV Export Handler
  const handleExportCsv = () => {
    if (!filteredPayments || filteredPayments.length === 0) return;

    const headers = ["Payment ID", "Deal ID", "Item Title", "Type", "PayPal Transaction ID", "Status", "Amount", "Currency", "Timestamp"];
    const rows = filteredPayments.map((p) => [
      `"${p.id}"`,
      `"${p.dealId}"`,
      `"${p.dealTitle || "Deal"}"`,
      `"${p.type.toUpperCase()}"`,
      `"${p.paypalId || "N/A"}"`,
      `"${p.status}"`,
      `"${p.amount}"`,
      `"${p.currency}"`,
      `"${p.createdAt}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `referee-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="h-10 w-64 bg-neutral-100 rounded-sm animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-surface border border-neutral-200 rounded-lg p-5 animate-pulse" />
          ))}
        </div>
        <div className="h-44 bg-surface border border-neutral-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-surface border border-neutral-200 rounded-lg animate-pulse" />
          <div className="h-72 bg-surface border border-neutral-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center">
          <Warning size={24} weight="bold" />
        </div>
        <h2 className="font-serif text-xl text-neutral-900">Dashboard Unavailable</h2>
        <p className="text-xs text-neutral-600">{error || "Please sign in to view your seller dashboard."}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium rounded-sm transition"
        >
          Try again
        </button>
      </div>
    );
  }

  // Filter at risk deals based on active analyst widget filter if applied
  const atRiskDeals = data.deals.filter((d) => {
    if (activeWidgetFilter?.widgetType === "deals_at_risk") {
      if (activeWidgetFilter.filter?.minRisk === "high") {
        return d.riskLevel === "high";
      }
    }
    return d.riskLevel === "high" || d.riskLevel === "medium";
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl text-neutral-900 tracking-tight">
              Seller Command Center
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
              AG Studio
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Real time escrow telemetry, risk detection, and verified PayPal ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAnalystOpen(!isAnalystOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border text-xs font-medium transition ${
              isAnalystOpen
                ? "bg-primary-50 border-primary-300 text-primary-800"
                : "bg-surface border-neutral-300 hover:bg-neutral-50 text-neutral-800"
            }`}
            title="Toggle Referee Analyst intelligence"
          >
            <Sparkle size={14} weight="fill" className="text-primary-700" />
            <span>AI Analyst</span>
          </button>
          <button
            onClick={fetchAnalytics}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-neutral-300 bg-surface hover:bg-neutral-50 text-neutral-800 text-xs font-medium transition"
            title="Refresh analytics data"
          >
            <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium transition"
          >
            <Plus size={14} weight="bold" />
            <span>New deal</span>
          </Link>
        </div>
      </div>

      {/* REFEREE ANALYST PANEL (Studio Agent Framework) */}
      <RefereeAnalystPanel
        isOpen={isAnalystOpen}
        onClose={() => setIsAnalystOpen(false)}
        onApplyWidgetAction={(action) => {
          setActiveWidgetFilter(action);
          if (action.widgetType === "financial_ledger" && action.filter?.search) {
            setSearchLedger(String(action.filter.search));
          }
        }}
      />

      {/* ACTIVE ANALYST FILTER BANNER */}
      {activeWidgetFilter && (
        <div className="flex items-center justify-between p-3 rounded-md bg-primary-50 border border-primary-200 text-xs text-primary-900">
          <div className="flex items-center gap-2">
            <Funnel size={14} weight="bold" className="text-primary-700" />
            <span>
              <strong>Analyst Filter Active:</strong> {activeWidgetFilter.title}: {activeWidgetFilter.explanation}
            </span>
          </div>
          <button
            onClick={() => setActiveWidgetFilter(null)}
            className="text-xs font-medium text-primary-700 hover:text-primary-900 underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* CUSTOM WIDGET: Money in Escrow (Segmented Ratio Bar) */}
      <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock size={18} weight="bold" className="text-primary-700" />
            <h2 className="text-sm font-semibold text-neutral-900">
              Money in Escrow (Portfolio Split)
            </h2>
          </div>
          <span className="text-xs text-neutral-600 font-tabular">
            Total active & historical: ${data.moneySplit.totalAmount.toFixed(2)} USD
          </span>
        </div>

        {/* Visual Segmented Bar */}
        <div className="w-full h-4 bg-neutral-100 rounded-full overflow-hidden flex border border-neutral-200">
          <div
            style={{ width: `${Math.max(data.moneySplit.heldPercent, 4)}%` }}
            className="bg-saffron-400 h-full transition-all duration-500 relative"
            title={`Held in Escrow: $${data.moneySplit.heldAmount.toFixed(2)} USD (${data.moneySplit.heldPercent}%)`}
          />
          <div
            style={{ width: `${Math.max(data.moneySplit.releasedPercent, 4)}%` }}
            className="bg-success-600 h-full transition-all duration-500 relative"
            title={`Released & Paid: $${data.moneySplit.releasedAmount.toFixed(2)} USD (${data.moneySplit.releasedPercent}%)`}
          />
          <div
            style={{ width: `${Math.max(data.moneySplit.refundedPercent, 4)}%` }}
            className="bg-neutral-400 h-full transition-all duration-500 relative"
            title={`Refunded: $${data.moneySplit.refundedAmount.toFixed(2)} USD (${data.moneySplit.refundedPercent}%)`}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-saffron-400 shrink-0" />
            <span className="text-neutral-700">Held in escrow:</span>
            <span className="font-semibold text-neutral-900 font-tabular">
              ${data.moneySplit.heldAmount.toFixed(2)} ({data.moneySplit.heldPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-success-600 shrink-0" />
            <span className="text-neutral-700">Released & paid:</span>
            <span className="font-semibold text-neutral-900 font-tabular">
              ${data.moneySplit.releasedAmount.toFixed(2)} ({data.moneySplit.releasedPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-neutral-400 shrink-0" />
            <span className="text-neutral-700">Refunded / voided:</span>
            <span className="font-semibold text-neutral-900 font-tabular">
              ${data.moneySplit.refundedAmount.toFixed(2)} ({data.moneySplit.refundedPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* WIDGET 1: KPI Row (Stat Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Funds Held Now */}
        <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Funds held now</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-saffron-300 text-neutral-950">
              Escrow
            </span>
          </div>
          <div className="font-serif text-2xl sm:text-3xl text-neutral-900 font-tabular tracking-tight">
            ${data.kpis.heldAmount}
          </div>
          <p className="text-xs text-neutral-500 pt-1">
            {data.kpis.heldCount} deals active in fulfillment or review.
          </p>
        </div>

        {/* Card 2: Released in 30 Days */}
        <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Released in 30 days</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-success-50 text-success-700 border border-success-100">
              Paid out
            </span>
          </div>
          <div className="font-serif text-2xl sm:text-3xl text-neutral-900 font-tabular tracking-tight text-success-700">
            ${data.kpis.releasedAmount30d}
          </div>
          <p className="text-xs text-neutral-500 pt-1">
            {data.kpis.releasedCount30d} deals delivered and paid to PayPal.
          </p>
        </div>

        {/* Card 3: Refund Rate */}
        <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Dispute & refund rate</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700">
              Resolved
            </span>
          </div>
          <div className="font-serif text-2xl sm:text-3xl text-neutral-900 font-tabular tracking-tight">
            {data.kpis.refundRate}
          </div>
          <p className="text-xs text-neutral-500 pt-1">
            {data.kpis.refundedCount30d} voided authorizations.
          </p>
        </div>

        {/* Card 4: Average Release Time */}
        <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Average release time</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-50 text-primary-700 border border-primary-100">
              Speed
            </span>
          </div>
          <div className="font-serif text-2xl sm:text-3xl text-neutral-900 font-tabular tracking-tight text-primary-700">
            {data.kpis.avgReleaseDays}
          </div>
          <p className="text-xs text-neutral-500 pt-1">
            From buyer funding to verified payout.
          </p>
        </div>
      </div>

      {/* 2-Column Section: WIDGET 2 (Pipeline Funnel) & WIDGET 3 (Deals at Risk) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WIDGET 2: Pipeline Stage Distribution (5 of 12 cols) */}
        <div className="lg:col-span-5 bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Funnel size={16} weight="bold" className="text-primary-700" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Deal Pipeline Stages
              </h2>
            </div>
            <span className="text-xs text-neutral-500">{data.deals.length} total deals</span>
          </div>

          <div className="space-y-3 flex-1">
            {data.pipeline.map((item) => (
              <div key={item.stage} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-800 font-medium">{item.stage}</span>
                  <div className="flex items-center gap-2 font-tabular">
                    <span className="text-neutral-500">{item.count} deals</span>
                    <span className="font-semibold text-neutral-900">${item.amount}</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${data.deals.length > 0 ? (item.count / data.deals.length) * 100 : 0}%`,
                    }}
                    className="h-full bg-primary-700 rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WIDGET 3: Deals at Risk Grid (Actionable: opens deal room) (7 of 12 cols) */}
        <div className="lg:col-span-7 bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Warning size={16} weight="bold" className="text-danger-600" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Deals at Risk (Action Required)
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-50 text-danger-700 border border-danger-100 font-tabular">
              {atRiskDeals.length} flagged
            </span>
          </div>

          {atRiskDeals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-neutral-500">
              <CheckCircle size={28} className="text-success-600 mb-1" />
              <span>All active deals are within safety deadlines. No immediate risk detected.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-600">
                    <th className="pb-2 font-medium">Item & Buyer</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium font-tabular text-right">Amount</th>
                    <th className="pb-2 font-medium">Risk Factor</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {atRiskDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-neutral-50 transition">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-neutral-900 truncate max-w-[140px] sm:max-w-[180px]">
                          {deal.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          Buyer: {deal.buyerName || "Anonymous"}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-saffron-300 text-neutral-950">
                          {deal.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-right font-semibold text-neutral-900 font-tabular">
                        ${deal.amount}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            deal.riskLevel === "high" ? "text-danger-700" : "text-warning-700"
                          }`}
                        >
                          <Warning size={12} weight="bold" />
                          <span>
                            {!deal.hasTracking ? "No tracking submitted" : "Expiring soon"}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/deal/${deal.sellerToken || deal.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium transition"
                        >
                          <span>Open</span>
                          <ArrowSquareOut size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* WIDGET 4: Financial Ledger Grid with CSV Export */}
      <div className="bg-surface rounded-lg border border-neutral-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt size={18} weight="bold" className="text-primary-700" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                PayPal Financial Ledger
              </h2>
              <p className="text-xs text-neutral-500">
                Verified PayPal Sandbox authorizations, captures, voids, and payouts.
              </p>
            </div>
          </div>

          {/* Controls: Search, Filter, Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search deals or transaction IDs..."
                value={searchLedger}
                onChange={(e) => setSearchLedger(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-sm border border-neutral-300 bg-surface text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-48 sm:w-64"
              />
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-sm border border-neutral-300 bg-surface text-neutral-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Events</option>
              <option value="authorized">Authorized</option>
              <option value="captured">Captured</option>
              <option value="payout">Payout</option>
              <option value="voided">Voided</option>
            </select>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition"
              title="Download CSV report"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-600 bg-neutral-50">
                <th className="py-2 px-3 font-medium">Timestamp</th>
                <th className="py-2 px-3 font-medium">Deal Title</th>
                <th className="py-2 px-3 font-medium">Event Type</th>
                <th className="py-2 px-3 font-medium">PayPal ID</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium font-tabular text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-neutral-50 transition">
                    <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap font-tabular">
                      {new Date(payment.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900 max-w-[160px] truncate">
                      {payment.dealTitle || payment.dealId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          payment.type === "payout"
                            ? "bg-primary-50 text-primary-700 border border-primary-100"
                            : payment.type === "captured"
                            ? "bg-success-50 text-success-700 border border-success-100"
                            : payment.type === "voided"
                            ? "bg-neutral-100 text-neutral-700"
                            : "bg-saffron-300 text-neutral-950"
                        }`}
                      >
                        {payment.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600">
                      {payment.paypalId || "N/A"}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-800">
                      {payment.status}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold font-tabular ${
                        payment.type === "captured" || payment.type === "payout"
                          ? "text-success-700"
                          : payment.type === "voided"
                          ? "text-neutral-500 line-through"
                          : "text-neutral-900"
                      }`}
                    >
                      ${payment.amount} {payment.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


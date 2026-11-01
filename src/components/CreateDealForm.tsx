"use client";

import { useState } from "react";
import type { DealContract } from "@/domain/contract";

export function CreateDealForm() {
  const [title, setTitle] = useState("Handmade Leather Wallet");
  const [description, setDescription] = useState(
    "Custom vegetable-tanned leather wallet with brass zipper, brown finish."
  );
  const [amount, setAmount] = useState("80.00");
  const [currency, setCurrency] = useState("USD");
  const [sellerName, setSellerName] = useState("Sari");
  const [sellerEmail, setSellerEmail] = useState("sari-seller@example.com");
  const [buyerName, setBuyerName] = useState("Maya");
  const [shipDeadlineDays, setShipDeadlineDays] = useState(3);
  const [deliveryDeadlineDays, setDeliveryDeadlineDays] = useState(14);
  const [inspectionWindowDays, setInspectionWindowDays] = useState(2);
  const [returnAllowed, setReturnAllowed] = useState(true);
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [returnShippingPaidBy, setReturnShippingPaidBy] = useState<"buyer" | "seller">("buyer");

  // Drafter AI state
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(
    "Selling handmade leather wallet to Maya for $80. I will ship within 3 days, delivery in 14 days, with a 7-day return policy."
  );
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [defaultedFields, setDefaultedFields] = useState<string[]>([]);

  // Presets for quick 1-click testing
  const presets = [
    {
      label: "🚲 Folding Bike ($80, No Return)",
      text: "Jual sepeda lipat seharga 80 dolar. Diantar dalam waktu maksimal 10 hari. Tidak bisa return.",
    },
    {
      label: "👜 Leather Bag ($75, 7d Return)",
      text: "Selling handmade leather bag to Maya for $75. Ship in 3 days, delivery in 14 days, 7 day return window.",
    },
    {
      label: "💻 Laptop ($450, High Value)",
      text: "Selling ThinkPad laptop for $450 to Alex. Ship within 2 days, 10 days delivery, 3 days inspection period.",
    },
  ];

  const handleApplyPreset = (presetText: string) => {
    setNaturalLanguageInput(presetText);
    setDraftError(null);
    setDraftSuccess(null);
  };

  const handleDraftWithAi = async () => {
    if (!naturalLanguageInput.trim()) return;
    setDrafting(true);
    setDraftError(null);
    setDraftSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/deals/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: naturalLanguageInput,
          clarification: clarificationAnswer.trim() || undefined,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to draft deal");
      }

      const c = data.contract;
      if (c) {
        if (c.item?.title) setTitle(c.item.title);
        if (c.item?.description) setDescription(c.item.description);
        if (c.item?.price?.amount) setAmount(c.item.price.amount);
        if (c.item?.price?.currency) setCurrency(c.item.price.currency);
        if (c.seller?.displayName) setSellerName(c.seller.displayName);
        if (c.seller?.paypalEmail) setSellerEmail(c.seller.paypalEmail);
        if (c.buyer?.displayName) setBuyerName(c.buyer.displayName);
        if (c.terms?.shipDeadlineDays) setShipDeadlineDays(c.terms.shipDeadlineDays);
        if (c.terms?.deliveryDeadlineDays) setDeliveryDeadlineDays(c.terms.deliveryDeadlineDays);
        if (c.terms?.inspectionWindowDays) setInspectionWindowDays(c.terms.inspectionWindowDays);
        if (c.terms?.returnPolicy) {
          setReturnAllowed(c.terms.returnPolicy.allowed ?? true);
          setReturnWindowDays(c.terms.returnPolicy.windowDays ?? 0);
          setReturnShippingPaidBy(c.terms.returnPolicy.returnShippingPaidBy ?? "buyer");
        }
      }

      setClarifyingQuestion(data.clarifyingQuestion || null);
      setDefaultedFields(data.defaultedFields || []);
      setDraftSuccess("Agreement terms extracted and filled below!");
    } catch (err: any) {
      const msg =
        err.name === "TimeoutError"
          ? "Request timed out after 20s. Please retry."
          : err.message || "Failed to process terms";
      setDraftError(msg);
    } finally {
      setDrafting(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDeal, setCreatedDeal] = useState<{
    dealId: string;
    sellerUrl: string;
    buyerUrl: string;
    contract: DealContract;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      item: {
        title,
        description,
        price: { amount, currency },
      },
      seller: {
        displayName: sellerName,
        paypalEmail: sellerEmail,
      },
      buyer: {
        displayName: buyerName || undefined,
      },
      terms: {
        shipDeadlineDays: Number(shipDeadlineDays),
        deliveryDeadlineDays: Number(deliveryDeadlineDays),
        inspectionWindowDays: Number(inspectionWindowDays),
        returnPolicy: {
          allowed: returnAllowed,
          windowDays: Number(returnWindowDays),
          returnShippingPaidBy,
        },
        autoReleaseAfterInspection: true,
      },
    };

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create deal");
      }

      setCreatedDeal(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          New Escrow Agreement
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lock terms, hold buyer funds in PayPal escrow, and verify delivery automatically before releasing payment.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {createdDeal ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="h-10 w-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-base">
              ✓
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Deal Created & Ready
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Item: {createdDeal.contract.item.title} — {createdDeal.contract.item.price.amount} {createdDeal.contract.item.price.currency}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Step 1: Buyer Link */}
            <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Step 1: Share with Buyer ({buyerName || "Buyer"})
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdDeal.buyerUrl, "buyer")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium hover:opacity-90 transition"
                >
                  {copiedLink === "buyer" ? "✓ Copied" : "Copy Buyer Link"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Send this link to the buyer. They will open it to review terms and fund the escrow via PayPal.
              </p>
              <div>
                <a
                  href={createdDeal.buyerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline"
                >
                  Open Buyer View (To test payment) &rarr;
                </a>
              </div>
            </div>

            {/* Step 2: Seller Link */}
            <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Step 2: Save Your Seller Link ({sellerName || "Seller"})
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdDeal.sellerUrl, "seller")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  {copiedLink === "seller" ? "✓ Copied" : "Copy Seller Link"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Keep this link to track buyer authorization and submit tracking numbers once shipped.
              </p>
              <div>
                <a
                  href={createdDeal.sellerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline"
                >
                  Open Seller Dashboard &rarr;
                </a>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCreatedDeal(null)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
            >
              &larr; Create another agreement
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* AI DRAFTER CARD */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI Deal Drafter
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  Natural Language
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">Gemini Powered</span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Type or paste your agreement terms. The AI will extract the item, price, deadlines, and return policy automatically.
            </p>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-zinc-400 mr-1">Presets:</span>
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyPreset(p.text)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <textarea
                rows={3}
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="e.g. Jual sepeda lipat seharga 80 dolar. Diantar dalam waktu maksimal 10 hari. Tidak bisa return..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-950 transition"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  Accepts English, Indonesian, and other languages
                </span>
                <button
                  type="button"
                  onClick={handleDraftWithAi}
                  disabled={drafting || !naturalLanguageInput.trim()}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs shadow-sm hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {drafting ? (
                    <>
                      <span className="inline-block animate-spin text-xs">⏳</span>
                      <span>Extracting terms (~1s)...</span>
                    </>
                  ) : (
                    "Draft with AI →"
                  )}
                </button>
              </div>
            </div>

            {/* Success Feedback */}
            {draftSuccess && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <span>✓</span>
                <span>{draftSuccess}</span>
              </div>
            )}

            {/* Error Feedback */}
            {draftError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <span>✕</span>
                <span>{draftError}</span>
              </div>
            )}

            {/* Clarification prompt if asked */}
            {clarifyingQuestion && (
              <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 space-y-2">
                <p className="font-medium">Clarifying question from AI:</p>
                <p className="text-zinc-600 dark:text-zinc-400">{clarifyingQuestion}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clarificationAnswer}
                    onChange={(e) => setClarificationAnswer(e.target.value)}
                    placeholder="Type your clarification..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleDraftWithAi}
                    className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium text-xs"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {defaultedFields.length > 0 && (
              <p className="text-[11px] text-zinc-400">
                Applied default standards for: {defaultedFields.join(", ")}
              </p>
            )}
          </div>

          {/* STRUCTURED AGREEMENT FORM */}
          <div className="space-y-6">
            {/* 1. Item & Price */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                1. Item & Price
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Item Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Sepeda Lipat"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Price Amount ({currency})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="80.00"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition font-medium"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="px-2 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Item Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Condition, model, color, or specific notes..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            {/* 2. Participants */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                2. Participants
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Seller Name
                  </label>
                  <input
                    type="text"
                    required
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="Sari"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Seller PayPal Sandbox Email
                  </label>
                  <input
                    type="email"
                    required
                    value={sellerEmail}
                    onChange={(e) => setSellerEmail(e.target.value)}
                    placeholder="seller@example.com"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Escrow payouts will be directed to this account
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Buyer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Maya"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 transition"
                  />
                </div>
              </div>
            </div>

            {/* 3. Escrow Deadlines & Rules */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                3. Fulfillment & Protection Rules
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Shipping Window
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={shipDeadlineDays}
                      onChange={(e) => setShipDeadlineDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
                    />
                    <span className="text-xs text-zinc-400">days</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Auto-refund if seller fails to ship</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Delivery Verification
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={deliveryDeadlineDays}
                      onChange={(e) => setDeliveryDeadlineDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
                    />
                    <span className="text-xs text-zinc-400">days</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Carrier tracking verification</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Buyer Inspection
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={inspectionWindowDays}
                      onChange={(e) => setInspectionWindowDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
                    />
                    <span className="text-xs text-zinc-400">days</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Auto-releases if no dispute</p>
                </div>
              </div>

              {/* Returns Policy */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="returnsAllowed"
                    checked={returnAllowed}
                    onChange={(e) => setReturnAllowed(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700"
                  />
                  <label htmlFor="returnsAllowed" className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    Returns Allowed
                  </label>
                </div>

                {returnAllowed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Return Window
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={returnWindowDays}
                          onChange={(e) => setReturnWindowDays(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
                        />
                        <span className="text-xs text-zinc-400">days</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Return Shipping Paid By
                      </label>
                      <select
                        value={returnShippingPaidBy}
                        onChange={(e) => setReturnShippingPaidBy(e.target.value as "buyer" | "seller")}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
                      >
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Escrow summary banner */}
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2.5">
              <span className="text-base leading-none">🛡️</span>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-200">
                  Automated Escrow Protection
                </p>
                <p className="text-[11px] mt-0.5">
                  Buyer authorizes {amount} {currency} on PayPal Sandbox. Funds stay safely held until delivery is verified via tracking. If the seller does not ship in {shipDeadlineDays} days, the hold is automatically voided and refunded.
                </p>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-sm shadow transition disabled:opacity-50"
            >
              {loading ? "Creating Agreement..." : `Create Escrow Deal (${amount} ${currency}) →`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

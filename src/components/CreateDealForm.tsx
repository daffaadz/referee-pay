"use client";

import React, { useState } from "react";
import type { DealContract } from "@/domain/contract";
import {
  Button,
  Input,
  Textarea,
  MoneyField,
  NumberStepper,
  Select,
  Checkbox,
  RadioGroup,
  Chip,
  Card,
  CardHeader,
  Toast,
} from "@/components/ui";
import {
  Bicycle,
  Handbag,
  Laptop,
  ArrowRight,
  Check,
  Lock,
  Copy,
  Wallet,
  Package,
  Truck,
  SealCheck,
  Tag,
  UserCircle,
  EnvelopeSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

export function CreateDealForm() {
  // Form fields
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

  // Authenticated seller state
  const [sessionSeller, setSessionSeller] = useState<{ id: string; email: string; name?: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  React.useEffect(() => {
    let mounted = true;
    fetch("/api/seller/me")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.authenticated && data.seller) {
          setSessionSeller(data.seller);
          setSellerEmail(data.seller.email);
          if (data.seller.name) setSellerName(data.seller.name);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    amount?: string;
    sellerEmail?: string;
    shipDeadlineDays?: string;
    deliveryDeadlineDays?: string;
    inspectionWindowDays?: string;
    returnWindowDays?: string;
  }>({});

  // Drafter AI state
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(
    "Selling handmade leather wallet to Maya for $80. I will ship within 3 days, delivery in 14 days, with a 7-day return policy."
  );
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");

  // Deal creation state
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdDeal, setCreatedDeal] = useState<{
    dealId: string;
    sellerUrl: string;
    buyerUrl: string;
    contract: DealContract;
  } | null>(null);

  // Link copy feedback
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const presets = [
    {
      id: "bike",
      label: "Folding bike, $80, no returns",
      icon: <Bicycle size={16} weight="regular" />,
      text: "Jual sepeda lipat seharga 80 dolar. Diantar dalam waktu maksimal 10 hari. Tidak bisa return.",
    },
    {
      id: "bag",
      label: "Leather bag, $75, 7-day returns",
      icon: <Handbag size={16} weight="regular" />,
      text: "Selling handmade leather bag to Maya for $75. Ship in 3 days, delivery in 14 days, 7 day return window.",
    },
    {
      id: "laptop",
      label: "Laptop, $450, high value",
      icon: <Laptop size={16} weight="regular" />,
      text: "Selling ThinkPad laptop for $450 to Alex. Ship within 2 days, 10 days delivery, 3 days inspection period.",
    },
  ];

  const handleApplyPreset = (presetId: string, presetText: string) => {
    setSelectedExample(presetId);
    setNaturalLanguageInput(presetText);
    setDraftError(null);
    setDraftSuccess(null);
  };

  const handleDraftWithAi = async () => {
    if (!naturalLanguageInput.trim()) return;
    setDrafting(true);
    setDraftError(null);
    setDraftSuccess(null);
    setCreateError(null);
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
        throw new Error(data.message || data.error || "We could not read that. Try adding the item, the price and when it will arrive.");
      }

      const c = data.contract;
      if (c) {
        if (c.item?.title) setTitle(c.item.title);
        if (c.item?.description) setDescription(c.item.description);
        if (c.item?.price?.amount) setAmount(c.item.price.amount);
        if (c.item?.price?.currency) setCurrency(c.item.price.currency);
        if (c.seller?.displayName && !sessionSeller) setSellerName(c.seller.displayName);
        if (c.seller?.paypalEmail && !sessionSeller) setSellerEmail(c.seller.paypalEmail);
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
      setDraftSuccess("Terms filled in. Please check them before you continue.");
      setErrors({});
    } catch (err: unknown) {
      const errorObj = err as Error;
      const msg =
        errorObj.name === "TimeoutError"
          ? "Request timed out after 20s. Please retry."
          : errorObj.message || "We could not read that. Try adding the item, the price and when it will arrive.";
      setDraftError(msg);
    } finally {
      setDrafting(false);
    }
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!title.trim()) {
      errs.title = "Add an item name.";
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      errs.amount = "Enter a price above zero.";
    }
    if (!sellerEmail.trim() || !sellerEmail.includes("@")) {
      errs.sellerEmail = "Enter a valid PayPal email.";
    }
    if (shipDeadlineDays < 1 || shipDeadlineDays > 60) {
      errs.shipDeadlineDays = "Choose a number of days between 1 and 60.";
    }
    if (deliveryDeadlineDays < 1 || deliveryDeadlineDays > 60) {
      errs.deliveryDeadlineDays = "Choose a number of days between 1 and 60.";
    }
    if (inspectionWindowDays < 1 || inspectionWindowDays > 60) {
      errs.inspectionWindowDays = "Choose a number of days between 1 and 60.";
    }
    if (returnAllowed && (returnWindowDays < 1 || returnWindowDays > 60)) {
      errs.returnWindowDays = "Choose a number of days between 1 and 60.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setCreateError(null);

    const payload = {
      item: {
        title: title.trim(),
        description: description.trim(),
        price: { amount, currency },
      },
      seller: {
        displayName: sellerName.trim(),
        paypalEmail: sellerEmail.trim(),
      },
      buyer: {
        displayName: buyerName.trim() || undefined,
      },
      terms: {
        shipDeadlineDays: Number(shipDeadlineDays),
        deliveryDeadlineDays: Number(deliveryDeadlineDays),
        inspectionWindowDays: Number(inspectionWindowDays),
        returnPolicy: {
          allowed: returnAllowed,
          windowDays: returnAllowed ? Number(returnWindowDays) : 0,
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
      setToastMessage("Your deal is ready. Links generated.");
    } catch (err: unknown) {
      const errorObj = err as Error;
      setCreateError(errorObj.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setToastMessage("Link copied to clipboard.");
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const formattedAmount = `${currency === "USD" ? "$" : currency + " "}${parseFloat(amount || "0").toFixed(2)}`;

  const summarySentence = `The buyer pays ${formattedAmount}. You are paid after delivery is confirmed and the ${inspectionWindowDays}-day review ends. If you do not ship within ${shipDeadlineDays} days, the buyer is refunded.`;

  return (
    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 flex-1 min-h-0 md:h-full md:overflow-hidden flex flex-col justify-start">
      {/* Two-Pane Shell */}
      <div className="flex flex-col md:flex-row gap-4 lg:gap-6 flex-1 min-h-0 md:h-full md:overflow-hidden">
        {/* LEFT PANE (5/12) */}
        <div className="w-full md:w-5/12 flex flex-col gap-4 md:h-full md:overflow-y-auto min-h-0 pr-1">
          {/* Page Top Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif text-neutral-900 tracking-tight">
              Start a protected deal
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Describe what you are selling. Referee holds the buyer payment and releases it only after delivery is confirmed.
            </p>
          </div>

          {/* Step 1 Card: Describe your deal */}
          <Card className="flex flex-col gap-4">
            <CardHeader
              title="Describe your deal"
              subtitle="Write it like a message to your buyer. We turn it into clear terms you can edit."
            />

            {/* Example chips */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-neutral-600">Try an example</span>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Chip
                    key={preset.id}
                    icon={preset.icon}
                    selected={selectedExample === preset.id}
                    onClick={() => handleApplyPreset(preset.id, preset.text)}
                  >
                    {preset.label}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Natural language description */}
            <div className="space-y-2">
              <Textarea
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="Example: I am selling a handmade leather wallet to Maya for $80. I will ship within 3 days. It should arrive within 14 days. She can return it within 7 days."
                minRows={3}
                maxRows={5}
                aria-label="Describe your deal text"
              />
            </div>

            {/* Clarifying question if proposed by drafter */}
            {clarifyingQuestion && (
              <div className="p-3 bg-warning-50 border border-warning-100 rounded-sm space-y-2">
                <p className="text-xs font-medium text-warning-700">{clarifyingQuestion}</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Your answer"
                    value={clarificationAnswer}
                    onChange={(e) => setClarificationAnswer(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleDraftWithAi}
                    loading={drafting}
                  >
                    Update
                  </Button>
                </div>
              </div>
            )}

            {/* Draft button */}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={handleDraftWithAi}
                loading={drafting}
                icon={<ArrowRight size={18} weight="bold" />}
                className="w-full"
              >
                {drafting ? "Reading your description" : "Fill in the terms"}
              </Button>

              <span className="text-xs text-neutral-500 text-center">
                Works in English, Indonesian and other languages.
              </span>
            </div>

            {/* Feedback notices */}
            {draftSuccess && (
              <div className="flex items-center gap-2 p-2.5 bg-success-50 border border-success-100 rounded-sm text-xs font-medium text-success-700">
                <Check size={16} weight="bold" className="shrink-0" />
                <span>{draftSuccess}</span>
              </div>
            )}
            {draftError && (
              <div className="flex items-center gap-2 p-2.5 bg-danger-50 border border-danger-100 rounded-sm text-xs font-medium text-danger-700">
                <WarningCircle size={16} weight="bold" className="shrink-0" />
                <span>{draftError}</span>
              </div>
            )}
          </Card>

          {/* Compact How It Works Card (4 steps) */}
          <Card className="bg-neutral-50/70 border-neutral-200">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block mb-3">
              How it works
            </span>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-primary-700 shrink-0">
                  <Wallet size={16} weight="bold" />
                </div>
                <p className="text-xs text-neutral-700 leading-snug pt-1">
                  Buyer pays. The payment is held, not sent.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-primary-700 shrink-0">
                  <Package size={16} weight="bold" />
                </div>
                <p className="text-xs text-neutral-700 leading-snug pt-1">
                  You ship and add the tracking number.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-primary-700 shrink-0">
                  <Truck size={16} weight="bold" />
                </div>
                <p className="text-xs text-neutral-700 leading-snug pt-1">
                  Referee checks the delivery on the carrier page.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-primary-700 shrink-0">
                  <SealCheck size={16} weight="bold" />
                </div>
                <p className="text-xs text-neutral-700 leading-snug pt-1">
                  You get paid when delivery is confirmed.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT PANE (7/12) */}
        <div className="w-full md:w-7/12 flex flex-col md:h-full min-h-0 md:overflow-hidden">
          {!createdDeal ? (
            /* STEP 2: REVIEW THE TERMS */
            <Card className="flex flex-col h-full min-h-0 overflow-hidden">
              <CardHeader
                title="Review the terms"
                subtitle="Check the details extracted from your description before creating the escrow deal."
              />

              {!sessionSeller && !authLoading && (
                <div className="mb-4 p-3 bg-neutral-100 border border-neutral-300 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-neutral-800">
                    <Lock size={16} weight="bold" className="text-primary-700 shrink-0" />
                    <span>Sellers sign in so payouts go to a verified PayPal account. Buyers never need an account.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="/api/auth/paypal/login"
                      className="px-3 py-1.5 rounded-sm bg-primary-700 hover:bg-primary-800 text-white font-medium transition"
                    >
                      Continue with PayPal
                    </a>
                  </div>
                </div>
              )}

              {createError && (
                <div className="mb-3 flex items-center gap-2 p-3 bg-danger-50 border border-danger-100 rounded-sm text-xs font-medium text-danger-700">
                  <WarningCircle size={16} weight="bold" className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Scrollable fields container */}
              <form
                id="create-deal-form"
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto space-y-5 pr-2"
              >
                {/* Group 1: What is being sold */}
                <div className="space-y-3 p-3.5 bg-neutral-50 rounded-sm border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    What is being sold
                  </h3>

                  <Input
                    label="Item name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    error={errors.title}
                    placeholder="Handmade leather wallet"
                    iconPrefix={<Tag size={16} />}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyField
                      label="Price"
                      currency={currency}
                      value={amount}
                      onChange={setAmount}
                      error={errors.amount}
                    />

                    <Select
                      label="Currency"
                      value={currency}
                      onValueChange={setCurrency}
                      options={[
                        { value: "USD", label: "USD", sublabel: "US Dollar" },
                        { value: "EUR", label: "EUR", sublabel: "Euro" },
                        { value: "GBP", label: "GBP", sublabel: "British Pound" },
                      ]}
                    />
                  </div>

                  <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    helperText="The buyer sees this before paying."
                    minRows={2}
                    maxRows={3}
                  />
                </div>

                {/* Group 2: Who is involved */}
                <div className="space-y-3 p-3.5 bg-neutral-50 rounded-sm border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Who is involved
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Your name"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="Your name"
                      iconPrefix={<UserCircle size={16} />}
                    />

                    <Input
                      label="Your PayPal email"
                      type="email"
                      value={sellerEmail}
                      onChange={sessionSeller ? undefined : (e) => setSellerEmail(e.target.value)}
                      readOnly={Boolean(sessionSeller)}
                      error={errors.sellerEmail}
                      helperText={
                        sessionSeller
                          ? "Locked to your verified PayPal account for payouts."
                          : "You are paid here after delivery is confirmed."
                      }
                      iconPrefix={
                        sessionSeller ? (
                          <Lock size={16} className="text-primary-700" />
                        ) : (
                          <EnvelopeSimple size={16} />
                        )
                      }
                    />
                  </div>

                  <Input
                    label="Buyer name (optional)"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Buyer name"
                    iconPrefix={<UserCircle size={16} />}
                  />
                </div>

                {/* Group 3: Timing and protection */}
                <div className="space-y-3 p-3.5 bg-neutral-50 rounded-sm border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Timing and protection
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <NumberStepper
                      label="Ship within"
                      unitSuffix="days"
                      value={shipDeadlineDays}
                      min={1}
                      max={60}
                      onChange={setShipDeadlineDays}
                      error={errors.shipDeadlineDays}
                      helperText="Add tracking by this deadline or the buyer is refunded."
                    />

                    <NumberStepper
                      label="Arrive within"
                      unitSuffix="days"
                      value={deliveryDeadlineDays}
                      min={1}
                      max={60}
                      onChange={setDeliveryDeadlineDays}
                      error={errors.deliveryDeadlineDays}
                      helperText="Delivery must be confirmed by this deadline."
                    />

                    <NumberStepper
                      label="Buyer review period"
                      unitSuffix="days"
                      value={inspectionWindowDays}
                      min={1}
                      max={60}
                      onChange={setInspectionWindowDays}
                      error={errors.inspectionWindowDays}
                      helperText="The buyer can report a problem. After this, payment is released."
                    />
                  </div>

                  <div className="pt-2 border-t border-neutral-200 space-y-3">
                    <Checkbox
                      label="Accept returns"
                      helperText="The buyer can return the item for a refund."
                      checked={returnAllowed}
                      onCheckedChange={setReturnAllowed}
                    />

                    {returnAllowed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                        <NumberStepper
                          label="Return window"
                          unitSuffix="days"
                          value={returnWindowDays}
                          min={1}
                          max={60}
                          onChange={setReturnWindowDays}
                          error={errors.returnWindowDays}
                          helperText="Days to request a return."
                        />

                        <RadioGroup
                          label="Return shipping paid by"
                          variant="card"
                          value={returnShippingPaidBy === "buyer" ? "BUYER" : "SELLER"}
                          onValueChange={(val) =>
                            setReturnShippingPaidBy(val === "BUYER" ? "buyer" : "seller")
                          }
                          options={[
                            { value: "BUYER", label: "Buyer" },
                            { value: "SELLER", label: "Seller" },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </form>

              {/* Sticky Card Footer */}
              <div className="pt-3 border-t border-border mt-auto shrink-0 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-neutral-600 leading-snug sm:max-w-md">
                  {summarySentence}
                </p>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Button
                    type="submit"
                    form="create-deal-form"
                    variant="primary"
                    loading={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? "Creating deal..." : `Create deal for ${formattedAmount}`}
                  </Button>
                  <span className="text-[11px] text-neutral-500 hidden sm:inline">
                    You get two links: one for you and one to send to the buyer.
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            /* STEP 3: SUCCESS STATE (REPLACES RIGHT CARD IN PLACE) */
            <Card className="flex flex-col h-full min-h-0 justify-between">
              <div>
                <CardHeader
                  title="Your deal is ready"
                  subtitle={`Item: ${createdDeal.contract.item.title} (${createdDeal.contract.item.price.amount} ${createdDeal.contract.item.price.currency})`}
                />

                <div className="space-y-4 mt-4">
                  {/* Your Link (Seller) */}
                  <div className="p-4 bg-neutral-50 rounded-sm border border-neutral-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                        <Lock size={14} weight="bold" className="text-neutral-700" />
                        <span>Your link</span>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        Keep this private. You use it to add tracking.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdDeal.sellerUrl}
                        className="h-10 w-full bg-white text-xs text-neutral-800 rounded-sm border border-neutral-300 px-3 outline-none"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(createdDeal.sellerUrl, "seller")}
                        icon={
                          copiedLink === "seller" ? (
                            <Check size={14} weight="bold" className="text-success-700" />
                          ) : (
                            <Copy size={14} weight="regular" />
                          )
                        }
                      >
                        {copiedLink === "seller" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {/* Buyer Link */}
                  <div className="p-4 bg-neutral-50 rounded-sm border border-neutral-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                        <span>Buyer link</span>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        Send this to the buyer so they can pay.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdDeal.buyerUrl}
                        className="h-10 w-full bg-white text-xs text-neutral-800 rounded-sm border border-neutral-300 px-3 outline-none"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(createdDeal.buyerUrl, "buyer")}
                        icon={
                          copiedLink === "buyer" ? (
                            <Check size={14} weight="bold" className="text-success-700" />
                          ) : (
                            <Copy size={14} weight="regular" />
                          )
                        }
                      >
                        {copiedLink === "buyer" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Success Bottom Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-between gap-3 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreatedDeal(null);
                    setErrors({});
                  }}
                >
                  Create another deal
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    window.location.href = createdDeal.sellerUrl;
                  }}
                  icon={<ArrowRight size={16} weight="bold" />}
                >
                  Open deal room
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile Sticky Action Bar (< 768px) */}
      {!createdDeal && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-surface border-t border-border flex items-center justify-between gap-3 shadow-menu z-30">
          <div>
            <span className="text-xs text-neutral-500 block">Total</span>
            <span className="text-base font-serif text-neutral-900 font-bold tabular-nums">
              {formattedAmount}
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            onClick={() => handleSubmit()}
          >
            Create deal
          </Button>
        </div>
      )}

      {/* Global Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

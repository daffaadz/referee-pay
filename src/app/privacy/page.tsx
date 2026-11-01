import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Referee",
  description: "Privacy policy and data protection practices for Referee.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-neutral-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Last updated: November 2026
          </p>
        </div>

        <section className="space-y-3 text-sm text-neutral-800 leading-relaxed bg-surface p-6 rounded-md border border-neutral-200 shadow-sm">
          <h2 className="font-semibold text-base text-neutral-900">
            1. Overview
          </h2>
          <p>
            Referee operates as a neutral intermediary for peer-to-peer commerce. This policy outlines how information is gathered, utilized, and guarded during transaction lifecycles.
          </p>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            2. Data We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-neutral-700">
            <li>
              <strong>PayPal Account Information:</strong> When sellers log in via PayPal, we receive account identifier, verified email address, and name to facilitate secure payouts.
            </li>
            <li>
              <strong>Deal Contract Information:</strong> Item titles, descriptions, agreed pricing, and fulfillment deadlines submitted during deal drafting.
            </li>
            <li>
              <strong>Carrier Tracking Information:</strong> Tracking numbers and carrier names submitted to verify fulfillment via automated cloud browser queries.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            3. How We Use Data
          </h2>
          <p>
            Collected information is utilized strictly to draft deal contracts, verify physical delivery against public tracking pages, execute escrow releases or refunds through PayPal sandbox APIs, and maintain transparent audit logs.
          </p>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            4. Security and Storage
          </h2>
          <p>
            Authentication credentials and sessions are signed cryptographically using secure, stateless httpOnly tokens. We do not store raw financial account credentials or passwords.
          </p>

          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <Link
              href="/"
              className="text-xs font-medium text-primary-700 hover:text-primary-800 underline"
            >
              Back to Home
            </Link>
            <Link
              href="/terms"
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
            >
              Terms of Service
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

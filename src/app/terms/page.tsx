import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Referee",
  description: "Terms of service and escrow guidelines for Referee.",
};

export default function TermsPage() {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-neutral-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Last updated: November 2026
          </p>
        </div>

        <section className="space-y-3 text-sm text-neutral-800 leading-relaxed bg-surface p-6 rounded-md border border-neutral-200 shadow-sm">
          <h2 className="font-semibold text-base text-neutral-900">
            1. Agreement to Terms
          </h2>
          <p>
            By accessing Referee or creating an escrow deal, both buyers and sellers agree to adhere to these terms and the specific contractual clauses generated for each agreement.
          </p>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            2. Escrow Mechanics
          </h2>
          <p>
            Buyer funds are held in authorization escrow via PayPal sandbox until delivery verification is confirmed by our automated arbiter or early confirmation is granted by the buyer.
          </p>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            3. Delivery and Deadlines
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-neutral-700">
            <li>
              Sellers must submit valid carrier tracking before the agreed shipping deadline expires.
            </li>
            <li>
              If tracking is not submitted before deadline expiration, the arbiter voids the authorization hold and refunds the buyer in full.
            </li>
            <li>
              Once delivery is verified, buyers receive an inspection period to review the item before automatic fund release.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-neutral-900 pt-2">
            4. Sandbox and Prototype Notice
          </h2>
          <p>
            Referee operates strictly in the PayPal sandbox environment for testing and hackathon evaluation purposes. No real currency is transferred.
          </p>

          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <Link
              href="/"
              className="text-xs font-medium text-primary-700 hover:text-primary-800 underline"
            >
              Back to Home
            </Link>
            <Link
              href="/privacy"
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
            >
              Privacy Policy
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

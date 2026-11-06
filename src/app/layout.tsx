import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { youngSerif, hankenGrotesk } from "./fonts";
import { SellerAuthNav } from "@/components/auth/SellerAuthNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referee: Start a protected deal",
  description: "Referee holds the buyer payment and releases it only after delivery is confirmed.",
  icons: {
    icon: [
      { url: "/brand/favicon.ico" },
      { url: "/brand/referee-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/referee-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F5C4D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${youngSerif.variable} ${hankenGrotesk.variable} md:h-screen md:overflow-hidden`}
    >
      <body className="antialiased min-h-screen md:h-screen md:max-h-screen md:overflow-hidden bg-bg text-text flex flex-col font-sans">
        {/* Header (64px) */}
        <header className="sticky top-0 z-40 w-full h-16 shrink-0 border-b border-border bg-surface px-4 sm:px-6 flex items-center">
          <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center p-2 rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring"
              aria-label="Referee homepage"
            >
              <Image
                src="/brand/referee-logo.svg"
                alt="Referee"
                width={954}
                height={256}
                priority
                className="h-6 sm:h-7 w-auto"
              />
            </Link>

            <div className="flex items-center gap-3">
              <SellerAuthNav />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 md:min-h-0 md:h-[calc(100dvh-64px-40px)] md:overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Footer (Compact 40px) */}
        <footer className="border-t border-border bg-surface shrink-0 h-10 px-4 sm:px-6 flex items-center">
          <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted text-center sm:text-left">
            <p>Referee. Neutral AI escrow with PayPal sandbox.</p>
            <p>AI drafts the terms. Always review them before you continue.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

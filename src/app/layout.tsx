import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referee: Neutral AI Escrow & Arbiter",
  description: "Proactive AI escrow arbiter for peer-to-peer commerce powered by PayPal and Kernel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
        {/* Minimal Monotone Top Navigation */}
        <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-opacity hover:opacity-85"
            >
              <div className="h-6 w-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xs tracking-wider">
                R
              </div>
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                Referee
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                AI Escrow
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                PayPal Sandbox
              </span>
              <Link
                href="/"
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
              >
                + New Deal
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          <p>Referee: Autonomous escrow arbiter on PayPal Sandbox & Kernel Cloud Browser</p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referee — Neutral AI Escrow & Arbiter",
  description: "Proactive AI arbiter for peer-to-peer commerce powered by PayPal and Kernel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}


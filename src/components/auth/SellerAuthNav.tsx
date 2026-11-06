"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, SignOut, Plus } from "@phosphor-icons/react/dist/ssr";
import { PayPalLoginButton } from "./PayPalLoginButton";

interface SellerProfile {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}

export function SellerAuthNav() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/seller/me")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.authenticated && data.seller) {
          setSeller(data.seller);
        }
      })
      .catch(() => {
        // Leave unauthenticated
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSeller(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return <div className="h-9 w-24 bg-neutral-100 rounded-sm animate-pulse" />;
  }

  if (seller) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. email user */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-300"
          title={`Signed in as ${seller.email}`}
        >
          <User size={14} weight="bold" className="text-primary-700 shrink-0" />
          <span className="max-w-[120px] sm:max-w-[160px] truncate">{seller.email}</span>
        </div>

        {/* 2. dashboard button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium text-neutral-800 hover:bg-neutral-100 border border-neutral-300 transition focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <span>Dashboard</span>
        </Link>

        {/* 3. new deal button (styled with page's pine button theme) */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium transition shadow-xs focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <Plus size={14} weight="bold" />
          <span>New deal</span>
        </Link>

        {/* 4. sign out button */}
        <button
          onClick={handleLogout}
          type="button"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium text-neutral-700 hover:text-danger-700 hover:bg-danger-50 transition focus-visible:outline-2 focus-visible:outline-focus-ring"
          aria-label="Sign out"
        >
          <SignOut size={14} weight="bold" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium transition shadow-xs focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <Plus size={14} weight="bold" />
        <span>New deal</span>
      </Link>
      <PayPalLoginButton size="sm" />
    </div>
  );
}

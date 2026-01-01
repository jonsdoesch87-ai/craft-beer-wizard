"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "@/components/LoginModal";
import { ActiveBatchesIndicator } from "@/components/ActiveBatchesIndicator";
import { Beaker, User, LogOut, BookOpen, LogIn, Globe, Wine, Crown, CreditCard } from "lucide-react";
import { toast } from "sonner";

export function Navbar() {
  const { user, loading, logout, isPro, userProfile } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }

    setIsUpgrading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Failed to start checkout process");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!user || !userProfile?.stripeCustomerId) {
      toast.error("No subscription found");
      return;
    }

    setIsOpeningPortal(true);
    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: userProfile.stripeCustomerId }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.url) {
        // Redirect to Stripe Billing Portal
        window.location.href = data.url;
      } else {
        toast.error("Failed to create portal session");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Beaker className="h-6 w-6 text-[#FFBF00]" />
          <span className="text-xl font-bold text-foreground">Craft Beer Wizard</span>
        </Link>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-zinc-800" />
          ) : user ? (
            <>
              <ActiveBatchesIndicator />
              {!isPro && (
                <Button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="hidden sm:flex bg-gradient-to-r from-[#FFBF00] to-[#FFD700] text-black hover:from-[#E5AC00] hover:to-[#FFBF00] font-semibold"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  {isUpgrading ? "Loading..." : "Upgrade to Pro"}
                </Button>
              )}
              {isPro && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#FFBF00]/20 to-[#FFD700]/20 border border-[#FFBF00]/30">
                  <Crown className="h-4 w-4 text-[#FFBF00]" />
                  <span className="text-sm font-semibold text-[#FFBF00]">Pro</span>
                </div>
              )}
              <Link href="/community">
                <Button variant="ghost" className="hidden sm:flex">
                  <Globe className="mr-2 h-4 w-4" />
                  Community
                </Button>
              </Link>
              <Link href="/my-recipes">
                <Button variant="ghost" className="hidden sm:flex">
                  <BookOpen className="mr-2 h-4 w-4" />
                  My Recipes
                </Button>
              </Link>
              <Link href="/cellar">
                <Button variant="ghost" className="hidden sm:flex">
                  <Wine className="mr-2 h-4 w-4" />
                  Cellar
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{user.displayName || "User"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{user.displayName || "User"}</p>
                        {isPro && (
                          <Crown className="h-3 w-3 text-[#FFBF00]" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isPro && (
                    <>
                      <DropdownMenuItem onClick={handleUpgrade} disabled={isUpgrading}>
                        <Crown className="mr-2 h-4 w-4 text-[#FFBF00]" />
                        Upgrade to Pro
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isPro && userProfile?.stripeCustomerId && (
                    <>
                      <DropdownMenuItem onClick={handleManageBilling} disabled={isOpeningPortal}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Manage Billing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/my-recipes" className="flex items-center">
                      <BookOpen className="mr-2 h-4 w-4" />
                      My Recipes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-400">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                onClick={() => setLoginModalOpen(true)}
                className="bg-[#FFBF00] text-black hover:bg-[#FFBF00]/90"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
              <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}


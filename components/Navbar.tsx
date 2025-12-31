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
import { Beaker, User, LogOut, BookOpen, LogIn, Globe } from "lucide-react";

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

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
                      <p className="text-sm font-medium">{user.displayName || "User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
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


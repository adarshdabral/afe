"use client";

import Link from "next/link";
import { Sparkles, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { darkMode, toggleDarkMode } = useApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`glass sticky top-0 z-40 w-full transition-all duration-300 ${
        scrolled ? "border-b border-border/70" : "border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto h-14 px-5 sm:px-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-foreground tracking-tight"
        >
          <span className="w-7 h-7 rounded-[10px] bg-violet-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px]">AI For Everyone</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/courses"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Courses
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <Link href="/login">
            <Button variant="ghost" className="rounded-full h-9 px-4 text-[13px]">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button className="rounded-full h-9 px-4 text-[13px] bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

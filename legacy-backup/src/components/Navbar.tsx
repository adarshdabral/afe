import { Link } from "@tanstack/react-router";
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
      className={`sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-gray-900/80 transition-shadow ${
        scrolled ? "shadow-sm border-b border-gray-100 dark:border-gray-800" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          <span>AI For Everyone</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Courses
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link to="/login">
            <Button variant="outline" className="rounded-xl h-9">Login</Button>
          </Link>
          <Link to="/register">
            <Button className="rounded-xl h-9 bg-violet-600 hover:bg-violet-700 text-white">Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

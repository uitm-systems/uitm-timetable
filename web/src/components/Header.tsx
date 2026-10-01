"use client";
import { FaGithub } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  dark: boolean;
  toggleDark: () => void;
}

export default function Header({ dark, toggleDark }: Props) {
  const pathname = usePathname();

  return (
    <div className="mb-10">
      {/* Top bar */}
      <div className="flex justify-end items-center gap-2 mb-6">
        <a
          href="https://github.com/uitm-systems/uitm-timetable"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-medium text-gray-600 dark:text-gray-300 hover:scale-105 transition-transform"
        >
          <FaGithub className="w-3.5 h-3.5" />
          GitHub
        </a>
        <button
          onClick={toggleDark}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 transition-transform text-base"
          title="Toggle theme"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700">
          Open Source UiTM Project
        </div>

        <div className="flex items-center justify-center gap-4">
          <svg width="56" height="56" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-md">
            <rect width="52" height="52" rx="12" fill="#7C3AED" fillOpacity="0.12"/>
            <rect x="8" y="10" width="9" height="14" rx="2.5" fill="#C4B5FD"/>
            <rect x="8" y="27" width="9" height="15" rx="2.5" fill="#DDD6FE"/>
            <rect x="21.5" y="10" width="9" height="8" rx="2.5" fill="#7C3AED"/>
            <rect x="21.5" y="21.5" width="9" height="20.5" rx="2.5" fill="#8B5CF6"/>
            <rect x="35" y="10" width="9" height="20" rx="2.5" fill="#A78BFA"/>
            <rect x="35" y="33" width="9" height="9" rx="2.5" fill="#C4B5FD"/>
          </svg>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">
            UiTM <span className="text-purple-600 dark:text-purple-400">Timetable</span>
          </h1>
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
          Advanced class scheduling and empty room finder. Powered by open data.
        </p>

        {/* Warning */}
        <div className="max-w-2xl mx-auto mt-2">
          <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded-lg px-4 py-2.5">
            Always cross-check with UiTM&apos;s official portal to avoid confusion.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center mt-6 gap-2">
        <Link 
          href="/" 
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            pathname === "/" 
              ? "bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700/50 dark:text-purple-100" 
              : "bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10"
          }`}
        >
          My Timetable
        </Link>
        <Link 
          href="/free-rooms" 
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            pathname === "/free-rooms" 
              ? "bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700/50 dark:text-purple-100" 
              : "bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10"
          }`}
        >
          Find Free Room
        </Link>
      </div>

    </div>
  );
}

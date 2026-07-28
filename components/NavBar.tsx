"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Station Gaps" },
  { href: "/optimize", label: "Optimization of Weather Station Placement" },
  { href: "/interpolate", label: "Interpolation" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-black/10 dark:border-white/10 bg-[#f9f9f7] dark:bg-[#0d0d0d] px-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-[#2a78d6] dark:border-[#3987e5] text-[#0b0b0b] dark:text-white"
                : "border-transparent text-[#52514e] dark:text-[#c3c2b7] hover:text-[#0b0b0b] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

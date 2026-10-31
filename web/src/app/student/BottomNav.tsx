"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/student", label: "홈", icon: "🏠", match: (p: string) => p === "/student" },
  { href: "/student/reserve", label: "예약", icon: "📅", match: (p: string) => p.startsWith("/student/reserve") },
  { href: "/student/check-in", label: "체크인", icon: "✓", match: (p: string) => p.startsWith("/student/check-in") },
  { href: "/student/notifications", label: "알림", icon: "🔔", match: (p: string) => p.startsWith("/student/notifications") },
  { href: "/student/preferences", label: "마이", icon: "👤", match: (p: string) => p.startsWith("/student/preferences") },
];

type Props = {
  unreadCount: number;
};

export function BottomNav({ unreadCount }: Props) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/95 backdrop-blur z-10"
      aria-label="학생 하단 네비게이션"
    >
      <ul className="mx-auto flex max-w-xl items-center justify-between px-2 py-1">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const showBadge = item.href === "/student/notifications" && unreadCount > 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[11px] transition ${
                  active ? "text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span className="relative text-base leading-none" aria-hidden>
                  {item.icon}
                  {showBadge && (
                    <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

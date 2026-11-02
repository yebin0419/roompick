import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: "/student",
    label: "홈",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    ),
  },
  {
    href: "/student/reserve",
    label: "예약",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/student/check-in",
    label: "체크인",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: "/student/reports",
    label: "신고",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2.5 20h19L12 3Z" />
        <path strokeLinecap="round" d="M12 10v4M12 17h.01" />
      </svg>
    ),
  },
  {
    href: "/student/notifications",
    label: "알림",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
        <path strokeLinecap="round" d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
  {
    href: "/student/preferences",
    label: "마이",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, approval_status")
    .eq("id", user.id).maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 pt-safe">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <Link href="/student" className="font-bold text-brand-500 flex items-center h-full px-1 gap-2" aria-label="룸픽 홈으로">
            <Image
              src="/logo.png"
              alt="룸픽 로고"
              width={48}
              height={48}
              priority
              className="w-9 h-9 rounded-lg"
            />
            <span>룸픽</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 hidden sm:inline">
              {profile?.name ?? user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-32">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-slate-200 pb-safe z-50">
        <div className="max-w-5xl mx-auto grid grid-cols-6">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="min-h-[60px] py-1.5 flex flex-col items-center justify-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-500 active:bg-slate-50"
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

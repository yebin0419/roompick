import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

const TABS = [
  { href: "/student", label: "홈" },
  { href: "/student/reserve", label: "예약" },
  { href: "/student/check-in", label: "체크인" },
  { href: "/student/reports", label: "신고" },
  { href: "/student/notifications", label: "알림" },
  { href: "/student/preferences", label: "마이" },
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
          <Link href="/student" className="font-bold text-brand-500 flex items-center h-full px-1">룸픽</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 hidden sm:inline">
              {profile?.name ?? user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 pb-safe z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-6">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="min-h-[56px] py-2 flex items-center justify-center text-center text-xs font-medium text-slate-600 hover:text-brand-500 active:bg-slate-50"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/verifications", label: "학생증 승인" },
  { href: "/admin/reservations", label: "예약 관리" },
  { href: "/admin/reports", label: "신고 처리" },
  { href: "/admin/analytics", label: "운영 리포트" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="min-h-screen">{children}</div>;
  }

  const { data: profile } = await supabase.from("profiles")
    .select("role, name").eq("id", user.id).maybeSingle();

  if (!profile || (profile.role !== "ADMIN" && profile.role !== "OPERATOR")) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-bold text-slate-900">
            룸픽 <span className="text-slate-400 font-normal">· 관리자</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 hidden sm:inline">
              {profile.name ?? user.email} · {profile.role === "ADMIN" ? "행정실" : "운영진"}
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4">
                로그아웃
              </button>
            </form>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="py-2.5 px-3 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

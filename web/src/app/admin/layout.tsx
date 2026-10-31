import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { NotificationBadge } from "@/components/NotificationBadge";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const NAV: NavItem[] = [
  { href: "/admin/notifications", label: "알림", roles: ["OPERATOR", "ADMIN"] },
  { href: "/admin/students", label: "학생증 승인함", roles: ["OPERATOR", "ADMIN"] },
  { href: "/admin/reservations", label: "예약 승인함", roles: ["OPERATOR", "ADMIN"] },
  { href: "/admin/reports", label: "신고 처리함", roles: ["OPERATOR", "ADMIN"] },
  { href: "/admin/rooms", label: "빈 강의실 조회", roles: ["OPERATOR", "ADMIN"] },
  { href: "/admin/dashboard", label: "행정실 대시보드", roles: ["ADMIN"] },
  { href: "/admin/analytics", label: "운영 리포트", roles: ["ADMIN"] },
  { href: "/admin/analytics/archive", label: "리포트 아카이브", roles: ["ADMIN"] },
  { href: "/admin/policy", label: "자율 조정 정책", roles: ["ADMIN"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "OPERATOR" && profile.role !== "ADMIN")) {
    redirect("/login?error=forbidden");
  }

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const role = profile.role;
  const visibleNav = NAV.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="px-5 py-6">
          <Link href="/admin" className="block text-lg font-semibold tracking-tight">
            룸픽 관리자
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {role === "ADMIN" ? "행정실" : "운영진 (자리있조)"}
          </p>
        </div>

        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {visibleNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
                >
                  <span>{item.label}</span>
                  {item.href === "/admin/notifications" && (
                    <NotificationBadge userId={user.id} initial={unreadCount ?? 0} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-zinc-200 px-3 py-4">
          <div className="px-2 pb-2 text-xs text-zinc-500">
            {profile.name ?? user.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

import { BottomNav } from "./BottomNav";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "STUDENT") redirect("/login?error=forbidden");

  const showNav = profile.approval_status === "APPROVED";

  let unreadCount = 0;
  if (showNav) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/student" className="text-base font-semibold tracking-tight">
            룸픽
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-zinc-500 underline-offset-4 hover:underline"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <main className={`flex-1 ${showNav ? "pb-20" : ""}`}>{children}</main>

      {showNav && <BottomNav unreadCount={unreadCount} />}
    </div>
  );
}

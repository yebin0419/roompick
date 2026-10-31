import Link from "next/link";
import { redirect } from "next/navigation";

import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { linkFromNotificationData } from "@/lib/notification-link";
import { createClient } from "@/lib/supabase/server";

import { markAllRead } from "./actions";

type SP = { filter?: string };

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filter = sp.filter === "all" ? "all" : "unread";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "unread") query = query.is("read_at", null);
  const { data: rows } = await query;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <RealtimeRefresher
        table="notifications"
        filter={`user_id=eq.${user.id}`}
        channelKey={`admin-notifications:${user.id}`}
      />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">알림</h1>
          <p className="mt-1 text-sm text-zinc-500">
            학생증 제출 · 예약 승인 대기 · 신고 접수 알림.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <nav className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            <Link
              href="/admin/notifications?filter=unread"
              className={`rounded-md px-3 py-1.5 transition ${
                filter === "unread"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              미읽음
            </Link>
            <Link
              href="/admin/notifications?filter=all"
              className={`rounded-md px-3 py-1.5 transition ${
                filter === "all"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              전체
            </Link>
          </nav>
          <form action={markAllRead}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
            >
              모두 읽음
            </button>
          </form>
        </div>
      </header>

      {(!rows || rows.length === 0) && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          {filter === "unread" ? "미읽음 알림이 없습니다." : "알림 내역이 없습니다."}
        </div>
      )}

      <ul className="space-y-2">
        {rows?.map((n) => {
          const href = linkFromNotificationData(n.data);
          const content = (
            <div
              className={`flex items-start justify-between rounded-xl border px-4 py-3 shadow-sm transition ${
                n.read_at
                  ? "border-zinc-200 bg-white"
                  : "border-blue-200 bg-blue-50"
              } ${href ? "hover:bg-zinc-50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{n.title}</span>
                  {!n.read_at && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="mt-0.5 text-sm text-zinc-600 line-clamp-2">
                  {n.body}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {new Date(n.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
              {href && <span className="ml-3 text-zinc-400">→</span>}
            </div>
          );
          return (
            <li key={n.id}>
              {href ? <Link href={href}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

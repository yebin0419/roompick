"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type N = { id: string; title: string; body: string | null; link: string | null;
  is_read: boolean; created_at: string };

export default function NotificationsClient({ items }: { items: N[] }) {
  const router = useRouter();
  const supabase = createClient();

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    router.refresh();
  }
  async function markAll() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">알림</h1>
        <button onClick={markAll} className="text-xs text-slate-500 underline underline-offset-4">
          모두 읽음
        </button>
      </header>

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-4 ${
              n.is_read ? "bg-white border-slate-200" : "bg-brand-50 border-brand-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{n.title}</p>
              <span className="text-xs text-slate-400">
                {new Date(n.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs">
              {n.link && (
                <Link href={n.link} className="text-brand-500">자세히 →</Link>
              )}
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} className="text-slate-500 underline underline-offset-4">
                  읽음 처리
                </button>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-500">알림이 없습니다.</p>
        )}
      </ul>
    </div>
  );
}

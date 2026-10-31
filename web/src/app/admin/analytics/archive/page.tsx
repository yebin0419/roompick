import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { generateReport } from "./actions";

export default async function ArchivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") redirect("/admin/students?error=forbidden");

  const { data: rows } = await supabase
    .from("operations_reports")
    .select("id, title, period_label, status, created_at, recommendations")
    .order("created_at", { ascending: false })
    .limit(50);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">리포트 아카이브</h1>
          <p className="mt-1 text-sm text-zinc-500">
            발행된 운영 리포트 보관함. 특정 시점의 KPI·자동 추천 스냅샷.
          </p>
        </div>
        <form action={generateReport} className="flex items-center gap-2">
          <input
            name="month"
            defaultValue={currentMonth}
            placeholder="YYYY-MM"
            className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            리포트 발행
          </button>
        </form>
      </header>

      {(!rows || rows.length === 0) && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          아직 발행된 리포트가 없습니다. 상단에서 월을 지정해 발행하세요.
        </div>
      )}

      <ul className="space-y-2">
        {rows?.map((r) => {
          const recs = (r.recommendations ?? []) as Array<{ severity: string }>;
          const warn = recs.filter((x) => x.severity === "warning").length;
          const danger = recs.filter((x) => x.severity === "danger").length;
          return (
            <li key={r.id}>
              <Link
                href={`/admin/analytics/archive/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:bg-zinc-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {r.period_label} · 발행 {new Date(r.created_at).toLocaleString("ko-KR")} ·
                    추천 {recs.length}건
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {danger > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                      긴급 {danger}
                    </span>
                  )}
                  {warn > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                      경고 {warn}
                    </span>
                  )}
                  <span className="text-zinc-400">→</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPublished = status === "PUBLISHED";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] ${
        isPublished ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
      }`}
    >
      {isPublished ? "발행됨" : "초안"}
    </span>
  );
}

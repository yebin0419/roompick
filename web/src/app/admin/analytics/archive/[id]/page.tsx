import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { OpsReportKpi, OpsReportRecommendation } from "@/lib/supabase/types";

import {
  deleteReport,
  publishReport,
  revertToDraft,
  updateReportNotes,
} from "../actions";

type Params = { id: string };

export default async function ReportDetail({ params }: { params: Promise<Params> }) {
  const { id } = await params;
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

  const { data: report } = await supabase
    .from("operations_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) notFound();

  const kpi = report.kpi as OpsReportKpi;
  const recs = (report.recommendations ?? []) as OpsReportRecommendation[];
  const isPublished = report.status === "PUBLISHED";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link
            href="/admin/analytics/archive"
            className="text-xs text-zinc-500 hover:underline"
          >
            ← 아카이브
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{report.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span>{report.period_label}</span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                isPublished
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {isPublished ? "발행됨" : "초안"}
            </span>
            <span>· 발행 {new Date(report.created_at).toLocaleString("ko-KR")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPublished ? (
            <form action={publishReport}>
              <input type="hidden" name="id" value={report.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                발행
              </button>
            </form>
          ) : (
            <form action={revertToDraft}>
              <input type="hidden" name="id" value={report.id} />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                초안으로 되돌리기
              </button>
            </form>
          )}
          {!isPublished && (
            <form action={deleteReport}>
              <input type="hidden" name="id" value={report.id} />
              <button
                type="submit"
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
              >
                삭제
              </button>
            </form>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard title="예약" value={`${kpi.reservations_total ?? 0}건`} hint={`승인 ${kpi.reservations_approved ?? 0}`} />
        <KpiCard title="체크인률" value={`${kpi.checkin_rate_pct ?? 0}%`} hint={`${kpi.checked_in ?? 0}/${kpi.reservations_approved ?? 0}`} />
        <KpiCard title="노쇼" value={`${kpi.no_shows ?? 0}건`} tone={kpi.no_shows ? "warning" : undefined} />
        <KpiCard title="신고" value={`${kpi.reports_total ?? 0}건`} hint={`미처리 ${kpi.reports_open ?? 0}`} tone={kpi.reports_open ? "danger" : undefined} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">자동 추천</h2>
        <p className="mt-1 text-xs text-zinc-500">
          공간 재배치 · 시설 투자 · 정책 조정 · 처리 백로그.
        </p>
        {recs.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
            특별한 추천이 없습니다. 지표가 양호합니다.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {recs.map((rec, i) => (
              <li key={i}>
                <RecCard rec={rec} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">행정실 메모</h2>
        <p className="mt-1 text-xs text-zinc-500">
          후속 의사결정 · 승인 · 공유 대상 등 자유롭게 기록.
        </p>
        <form action={updateReportNotes} className="mt-4 space-y-2">
          <input type="hidden" name="id" value={report.id} />
          <textarea
            name="notes"
            defaultValue={report.notes ?? ""}
            readOnly={isPublished}
            placeholder={isPublished ? "발행된 리포트는 초안으로 되돌려야 수정 가능합니다." : "메모를 입력하세요."}
            rows={6}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-900 disabled:bg-zinc-50"
          />
          {!isPublished && (
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                메모 저장
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-zinc-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-zinc-900">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-zinc-400">{hint}</div>}
    </div>
  );
}

function RecCard({ rec }: { rec: OpsReportRecommendation }) {
  const tone =
    rec.severity === "danger"
      ? "border-red-200 bg-red-50"
      : rec.severity === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-zinc-200 bg-white";
  const toneLabel =
    rec.severity === "danger" ? "긴급" : rec.severity === "warning" ? "경고" : "참고";
  return (
    <div className={`flex items-start justify-between rounded-md border p-3 ${tone}`}>
      <div>
        <div className="text-sm font-medium text-zinc-900">{rec.title}</div>
        <div className="mt-1 text-xs text-zinc-600">{rec.detail}</div>
      </div>
      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-zinc-700 border border-zinc-200">
        {toneLabel}
      </span>
    </div>
  );
}

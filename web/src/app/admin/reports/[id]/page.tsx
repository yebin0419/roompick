import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ReportCategory, ReportStatus } from "@/lib/supabase/types";

import { dismissReport, markInProgress, resolveReport } from "../actions";

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  UNAUTHORIZED_USE: "무단 점유",
  EQUIPMENT_BROKEN: "비품 고장",
  CLEANLINESS: "청결 문제",
  OTHER: "기타",
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "접수됨",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
  DISMISSED: "반려",
};

const STATUS_TONE: Record<ReportStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-zinc-100 text-zinc-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-red-100 text-red-700",
};

export default async function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || (me.role !== "OPERATOR" && me.role !== "ADMIN")) {
    redirect("/login?error=forbidden");
  }

  const { data: r } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: reporter }, { data: handler }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, student_number, no_show_count")
      .eq("id", r.reporter_id)
      .maybeSingle(),
    r.handled_by
      ? supabase.from("profiles").select("id, name").eq("id", r.handled_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let photoUrl: string | null = null;
  if (r.photo_url) {
    const { data: signed } = await supabase.storage
      .from("report-photos")
      .createSignedUrl(r.photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  const canStart = r.status === "OPEN";
  const canResolve = r.status === "OPEN" || r.status === "IN_PROGRESS";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header>
        <Link
          href="/admin/reports"
          className="text-xs text-zinc-500 hover:underline"
        >
          ← 신고 처리함
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {CATEGORY_LABEL[r.category]}
          </h1>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[r.status]}`}>
            {STATUS_LABEL[r.status]}
          </span>
          {r.room_code && (
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600">
              {r.room_code}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          접수 {new Date(r.created_at).toLocaleString("ko-KR")}
        </div>
      </header>

      {photoUrl && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">첨부 사진</h2>
          <div className="relative mt-3 h-80 w-full overflow-hidden rounded-md bg-zinc-100">
            <Image
              src={photoUrl}
              alt="신고 사진"
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-contain"
              unoptimized
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">신고 내용</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
          {r.description}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">신고자</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <KV k="이름" v={reporter?.name ?? "(이름 미입력)"} />
          <KV k="학번" v={reporter?.student_number ?? "-"} />
          <KV
            k="누적 노쇼"
            v={
              <span
                className={
                  (reporter?.no_show_count ?? 0) > 0
                    ? "text-amber-700 font-medium"
                    : "text-zinc-500"
                }
              >
                {reporter?.no_show_count ?? 0}회
              </span>
            }
          />
        </dl>
      </section>

      {(r.handled_at || r.resolution_note) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">처리 이력</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {r.handled_at && (
              <KV k="처리 시각" v={new Date(r.handled_at).toLocaleString("ko-KR")} />
            )}
            {handler?.name && <KV k="처리자" v={handler.name} />}
          </dl>
          {r.resolution_note && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                r.status === "DISMISSED"
                  ? "bg-red-50 text-red-900"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              <div className="text-xs font-semibold">
                {r.status === "DISMISSED" ? "반려 사유" : "처리 메모"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{r.resolution_note}</div>
            </div>
          )}
        </section>
      )}

      {(canStart || canResolve) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">처리</h2>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            {canStart && (
              <form action={markInProgress}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  처리 시작
                </button>
              </form>
            )}
            {canResolve && (
              <>
                <form action={resolveReport} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    name="note"
                    required
                    placeholder="처리 메모 (필수)"
                    className="w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    완료
                  </button>
                </form>
                <form action={dismissReport} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    name="note"
                    required
                    placeholder="반려 사유 (필수)"
                    className="w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    반려
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="mt-0.5 text-zinc-800">{v}</dd>
    </div>
  );
}

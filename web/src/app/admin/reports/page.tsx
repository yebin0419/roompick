import Image from "next/image";
import Link from "next/link";

import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { createClient } from "@/lib/supabase/server";
import type { ReportCategory, ReportStatus } from "@/lib/supabase/types";

const STATUS_FILTERS: Array<{ key: ReportStatus; label: string }> = [
  { key: "OPEN", label: "접수됨" },
  { key: "IN_PROGRESS", label: "처리 중" },
  { key: "RESOLVED", label: "완료" },
  { key: "DISMISSED", label: "반려" },
];

const STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "접수됨",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
  DISMISSED: "반려",
};

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  UNAUTHORIZED_USE: "무단 점유",
  EQUIPMENT_BROKEN: "비품 고장",
  CLEANLINESS: "청결 문제",
  OTHER: "기타",
};

type SP = { status?: string };

export default async function ReportsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = (STATUS_FILTERS.some((f) => f.key === sp.status)
    ? sp.status
    : "OPEN") as ReportStatus;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });

  const reporterIds = Array.from(new Set((rows ?? []).map((r) => r.reporter_id)));
  const { data: reporters } =
    reporterIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name, student_number")
          .in("id", reporterIds)
      : { data: [] };
  const reporterMap = new Map(reporters?.map((r) => [r.id, r]) ?? []);

  const photoPaths = (rows ?? [])
    .map((r) => r.photo_url)
    .filter((p): p is string => Boolean(p));
  const signedPhotos = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("report-photos")
      .createSignedUrls(photoPaths, 300);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedPhotos.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <RealtimeRefresher table="reports" filter={`status=eq.${status}`} />
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">신고 처리함</h1>
          <p className="mt-1 text-sm text-zinc-500">
            무단 점유 · 비품 고장 · 청결 문제 신고를 접수·처리합니다.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-xs">
          {STATUS_FILTERS.map((f) => (
            <a
              key={f.key}
              href={`/admin/reports?status=${f.key}`}
              className={`rounded-md px-3 py-1.5 transition ${
                status === f.key
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </a>
          ))}
        </nav>
      </header>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          조회 실패: {error.message}
        </div>
      )}

      {!error && (!rows || rows.length === 0) && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          해당 상태의 신고가 없습니다.
        </div>
      )}

      <ul className="space-y-3">
        {rows?.map((r) => {
          const reporter = reporterMap.get(r.reporter_id);
          const photoUrl = r.photo_url ? signedPhotos.get(r.photo_url) : undefined;
          return (
            <li key={r.id}>
              <Link
                href={`/admin/reports/${r.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
              >
                <div className="flex gap-4">
                  {photoUrl ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                      <Image
                        src={photoUrl}
                        alt="신고 사진"
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] text-zinc-400">
                      사진 없음
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700">
                        {CATEGORY_LABEL[r.category]}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.room_code && (
                        <span className="text-xs text-zinc-500">{r.room_code}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {reporter?.name ?? "(이름 미입력)"} · 학번{" "}
                      {reporter?.student_number ?? "-"} ·{" "}
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </div>
                    <p className="mt-2 text-sm text-zinc-700 line-clamp-2">
                      {r.description}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

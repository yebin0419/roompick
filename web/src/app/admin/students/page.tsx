import Image from "next/image";
import Link from "next/link";

import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus } from "@/lib/supabase/types";

const STATUS_FILTERS: Array<{ key: ApprovalStatus; label: string }> = [
  { key: "PENDING", label: "승인 대기" },
  { key: "APPROVED", label: "승인 완료" },
  { key: "REJECTED", label: "거절" },
];

type SP = { status?: string };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = (typeof sp.status === "string" ? sp.status : "PENDING") as ApprovalStatus;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, name, student_number, student_id_card_url, created_at, rejected_reason")
    .eq("role", "STUDENT")
    .eq("approval_status", status)
    .order("created_at", { ascending: true });

  // 학생증 사진은 private 버킷에 저장되므로 신뢰 짧은 signed URL 로 변환
  const signedUrls = new Map<string, string>();
  const paths = (rows ?? [])
    .map((r) => r.student_id_card_url)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("student-id-cards")
      .createSignedUrls(paths, 300);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <RealtimeRefresher table="profiles" filter={`approval_status=eq.${status}`} />
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">학생증 승인함</h1>
          <p className="mt-1 text-sm text-zinc-500">
            학번과 학생증 사진을 대조한 후 승인 또는 거절해 주세요.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          {STATUS_FILTERS.map((f) => (
            <a
              key={f.key}
              href={`/admin/students?status=${f.key}`}
              className={`rounded-md px-3 py-1.5 transition ${
                status === f.key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
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
          해당 상태의 학생이 없습니다.
        </div>
      )}

      <ul className="space-y-3">
        {rows?.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/students/${row.id}`}
              className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
            >
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                {row.student_id_card_url && signedUrls.get(row.student_id_card_url) ? (
                  <Image
                    src={signedUrls.get(row.student_id_card_url)!}
                    alt="학생증"
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-zinc-400">
                    사진 없음
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{row.name ?? "(이름 미입력)"}</span>
                  <span className="text-xs text-zinc-500">
                    학번 {row.student_number ?? "-"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-400">
                  제출 {new Date(row.created_at).toLocaleString("ko-KR")}
                </div>
                {row.rejected_reason && (
                  <div className="mt-2 line-clamp-1 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                    이전 거절 사유: {row.rejected_reason}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

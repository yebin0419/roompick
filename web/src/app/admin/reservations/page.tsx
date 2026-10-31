import Image from "next/image";
import Link from "next/link";

import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/supabase/types";

const STATUS_FILTERS: Array<{ key: ReservationStatus; label: string }> = [
  { key: "PENDING_OPERATOR", label: "운영진 대기" },
  { key: "PENDING_ADMIN", label: "행정실 대기" },
  { key: "AUTO_APPROVED", label: "자동 승인" },
  { key: "APPROVED", label: "승인됨" },
  { key: "REJECTED", label: "거절" },
  { key: "CANCELLED", label: "취소" },
];

const STATUS_LABEL: Record<ReservationStatus, string> = {
  AUTO_APPROVED: "자동 승인",
  PENDING_OPERATOR: "운영진 대기",
  PENDING_ADMIN: "행정실 대기",
  APPROVED: "승인",
  REJECTED: "거절",
  CANCELLED: "취소",
};

type SP = { status?: string };

export default async function ReservationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = (STATUS_FILTERS.some((f) => f.key === sp.status)
    ? sp.status
    : "PENDING_OPERATOR") as ReservationStatus;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("status", status)
    .order("reservation_date", { ascending: true })
    .order("start_period", { ascending: true });

  // 요청자 프로필 join
  const studentIds = Array.from(new Set((rows ?? []).map((r) => r.student_id)));
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name, student_number, no_show_count")
          .in("id", studentIds)
      : { data: [] };
  const studentMap = new Map(students?.map((s) => [s.id, s]) ?? []);

  // 체크인 사진 signed URL 변환
  const photoPaths = (rows ?? [])
    .map((r) => r.check_in_photo_url)
    .filter((p): p is string => Boolean(p));
  const signedPhotos = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("check-in-photos")
      .createSignedUrls(photoPaths, 300);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedPhotos.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <RealtimeRefresher table="reservations" filter={`status=eq.${status}`} />
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">예약 승인함</h1>
          <p className="mt-1 text-sm text-zinc-500">
            운영진 대기(일상 소규모) · 행정실 대기(대규모·행사)를 처리합니다.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-xs">
          {STATUS_FILTERS.map((f) => (
            <a
              key={f.key}
              href={`/admin/reservations?status=${f.key}`}
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
          해당 상태의 예약이 없습니다.
        </div>
      )}

      <ul className="space-y-3">
        {rows?.map((r) => {
          const student = studentMap.get(r.student_id);
          return (
            <li key={r.id}>
              <Link
                href={`/admin/reservations/${r.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-zinc-900">
                        {r.room_code}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500">
                        {r.kind}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {r.reservation_date} · {r.start_period}
                      {r.end_period !== r.start_period ? `-${r.end_period}` : ""}교시 · {r.attendees}명
                    </div>
                    <div className="mt-2 text-sm text-zinc-700">
                      {student?.name ?? "(이름 미입력)"}{" "}
                      <span className="text-xs text-zinc-400">
                        학번 {student?.student_number ?? "-"}
                      </span>
                      {student?.no_show_count ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                          누적 노쇼 {student.no_show_count}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {r.checked_in_at ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                          체크인 {new Date(r.checked_in_at).toLocaleString("ko-KR")}
                        </span>
                      ) : r.no_show ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                          노쇼
                        </span>
                      ) : r.status === "AUTO_APPROVED" || r.status === "APPROVED" ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500">
                          미체크인
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.check_in_photo_url && signedPhotos.get(r.check_in_photo_url) && (
                      <div className="relative h-20 w-20 overflow-hidden rounded-md border border-zinc-200">
                        <Image
                          src={signedPhotos.get(r.check_in_photo_url)!}
                          alt="체크인 사진"
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
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

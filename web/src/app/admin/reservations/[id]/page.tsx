import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/supabase/types";

import { approveReservation, rejectReservation } from "../actions";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  AUTO_APPROVED: "자동 승인",
  PENDING_OPERATOR: "운영진 대기",
  PENDING_ADMIN: "행정실 대기",
  APPROVED: "승인",
  REJECTED: "거절",
  CANCELLED: "취소",
};

const STATUS_TONE: Record<ReservationStatus, string> = {
  AUTO_APPROVED: "bg-emerald-100 text-emerald-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PENDING_OPERATOR: "bg-amber-100 text-amber-800",
  PENDING_ADMIN: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

export default async function ReservationDetail({
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
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: student }, { data: decider }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, student_number, no_show_count")
      .eq("id", r.student_id)
      .maybeSingle(),
    r.decided_by
      ? supabase.from("profiles").select("id, name").eq("id", r.decided_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let photoUrl: string | null = null;
  if (r.check_in_photo_url) {
    const { data: signed } = await supabase.storage
      .from("check-in-photos")
      .createSignedUrl(r.check_in_photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  const canAct = r.status === "PENDING_OPERATOR" || r.status === "PENDING_ADMIN";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header>
        <Link
          href="/admin/reservations"
          className="text-xs text-zinc-500 hover:underline"
        >
          ← 예약 승인함
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{r.room_code}</h1>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[r.status]}`}>
            {STATUS_LABEL[r.status]}
          </span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600">
            {r.kind}
          </span>
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          {r.reservation_date} · {r.start_period}
          {r.end_period !== r.start_period ? `-${r.end_period}` : ""}교시 · {r.attendees}명
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">신청자</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <KV k="이름" v={student?.name ?? "(이름 미입력)"} />
          <KV k="학번" v={student?.student_number ?? "-"} />
          <KV
            k="누적 노쇼"
            v={
              <span
                className={
                  (student?.no_show_count ?? 0) > 0
                    ? "text-amber-700 font-medium"
                    : "text-zinc-500"
                }
              >
                {student?.no_show_count ?? 0}회
              </span>
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">요청 정보</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <KV k="목적" v={r.purpose ?? "미입력"} />
          <KV k="요청" v={new Date(r.created_at).toLocaleString("ko-KR")} />
          {r.decided_at && (
            <>
              <KV k="결정" v={new Date(r.decided_at).toLocaleString("ko-KR")} />
              <KV k="처리자" v={decider?.name ?? "-"} />
            </>
          )}
          {r.rejected_reason && (
            <div className="col-span-2 mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              거절 사유: {r.rejected_reason}
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">체크인</h2>
        {r.checked_in_at ? (
          <div className="mt-3 flex gap-4">
            {photoUrl ? (
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                <Image
                  src={photoUrl}
                  alt="체크인 사진"
                  fill
                  sizes="128px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] text-zinc-400">
                사진 없음
              </div>
            )}
            <dl className="grid flex-1 grid-cols-1 gap-y-2 text-sm">
              <KV k="시각" v={new Date(r.checked_in_at).toLocaleString("ko-KR")} />
              {r.check_in_lat != null && r.check_in_lng != null && (
                <KV
                  k="좌표"
                  v={`${r.check_in_lat.toFixed(5)}, ${r.check_in_lng.toFixed(5)}`}
                />
              )}
            </dl>
          </div>
        ) : r.no_show ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            노쇼 적립됨 — 체크인 유예시간 내 미제출
          </div>
        ) : (
          <div className="mt-3 text-sm text-zinc-500">아직 체크인하지 않음</div>
        )}
      </section>

      {canAct && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">처리</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <form action={approveReservation}>
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                승인
              </button>
            </form>
            <form action={rejectReservation} className="flex items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input
                name="reason"
                required
                placeholder="거절 사유 (필수)"
                className="w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                거절
              </button>
            </form>
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

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus } from "@/lib/supabase/types";

import { approveStudent, rejectStudent } from "../actions";

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "거절",
};

const STATUS_TONE: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function StudentDetail({
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

  const { data: s } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "STUDENT")
    .maybeSingle();
  if (!s) notFound();

  const { data: approver } = s.approved_by
    ? await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", s.approved_by)
        .maybeSingle()
    : { data: null };

  let cardUrl: string | null = null;
  if (s.student_id_card_url) {
    const { data: signed } = await supabase.storage
      .from("student-id-cards")
      .createSignedUrl(s.student_id_card_url, 300);
    cardUrl = signed?.signedUrl ?? null;
  }

  const isPending = s.approval_status === "PENDING";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header>
        <Link
          href={`/admin/students?status=${s.approval_status}`}
          className="text-xs text-zinc-500 hover:underline"
        >
          ← 학생증 승인함
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {s.name ?? "(이름 미입력)"}
          </h1>
          <span className="text-sm text-zinc-500">학번 {s.student_number ?? "-"}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[s.approval_status]}`}>
            {STATUS_LABEL[s.approval_status]}
          </span>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">학생증</h2>
        {cardUrl ? (
          <div className="mt-3 flex gap-4">
            <div className="relative h-96 w-72 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              <Image
                src={cardUrl}
                alt="학생증"
                fill
                sizes="288px"
                className="object-contain"
                unoptimized
              />
            </div>
            <dl className="flex-1 space-y-2 text-sm">
              <KV k="이름" v={s.name ?? "(이름 미입력)"} />
              <KV k="학번" v={s.student_number ?? "-"} />
              <KV k="제출" v={new Date(s.created_at).toLocaleString("ko-KR")} />
              <KV
                k="누적 노쇼"
                v={
                  <span
                    className={
                      s.no_show_count > 0 ? "text-amber-700 font-medium" : "text-zinc-500"
                    }
                  >
                    {s.no_show_count}회
                  </span>
                }
              />
            </dl>
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-zinc-50 py-10 text-center text-sm text-zinc-500">
            제출된 학생증 사진이 없습니다.
          </div>
        )}
      </section>

      {(s.approved_at || s.rejected_reason) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">처리 이력</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {s.approved_at && (
              <KV k="처리 시각" v={new Date(s.approved_at).toLocaleString("ko-KR")} />
            )}
            {approver?.name && <KV k="처리자" v={approver.name} />}
          </dl>
          {s.rejected_reason && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
              <div className="text-xs font-semibold">거절 사유</div>
              <div className="mt-1 whitespace-pre-wrap">{s.rejected_reason}</div>
            </div>
          )}
        </section>
      )}

      {isPending && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">처리</h2>
          <p className="mt-1 text-xs text-zinc-500">
            학번과 학생증 사진을 대조한 후 결정하세요.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <form action={approveStudent}>
              <input type="hidden" name="id" value={s.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                승인
              </button>
            </form>
            <form action={rejectStudent} className="flex items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
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
    <div className="flex justify-between gap-4">
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="text-sm text-zinc-800">{v}</dd>
    </div>
  );
}

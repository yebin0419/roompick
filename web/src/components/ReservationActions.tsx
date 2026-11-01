"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ReservationActions({
  id, status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("정말 이 예약을 취소하시겠습니까? 남은 시간은 즉시 반환됩니다.")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("reservations")
      .update({ status: "CANCELLED" }).eq("id", id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  async function checkout() {
    if (!confirm("지금 퇴실 처리하시겠습니까? 남은 시간은 다른 사용자에게 반환됩니다.")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("reservations").update({
      status: "COMPLETED",
      end_time: new Date().toISOString(),
    }).eq("id", id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  if (status === "RESERVED") {
    return (
      <button
        type="button" onClick={cancel} disabled={busy}
        className="text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 disabled:opacity-50"
      >
        {busy ? "처리 중..." : "예약 취소"}
      </button>
    );
  }
  if (status === "CHECKED_IN") {
    return (
      <button
        type="button" onClick={checkout} disabled={busy}
        className="text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800 px-2.5 py-1 disabled:opacity-50"
      >
        {busy ? "처리 중..." : "퇴실하기"}
      </button>
    );
  }
  return null;
}

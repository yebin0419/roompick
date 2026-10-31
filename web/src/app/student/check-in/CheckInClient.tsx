"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type R = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  room: { id: string; code: string; building: string; floor: string | null };
};

export default function CheckInClient({ reservations }: { reservations: R[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function doCheckIn(r: R, file: File) {
    setError(null); setInfo(null); setBusy(r.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      // Geofencing은 추후 좌표 메타 추가. 지금은 사용자 위치 수집만.
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p.coords),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 7000 },
        );
      });

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${r.id}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("checkin-photos").upload(path, file, {
        contentType: file.type || "image/jpeg", upsert: true,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("checkin-photos").getPublicUrl(path);

      const { error: resErr } = await supabase.from("reservations").update({
        status: "CHECKED_IN",
        check_in_at: new Date().toISOString(),
        check_in_photo_url: pub.publicUrl,
      }).eq("id", r.id);
      if (resErr) throw resErr;

      setInfo(`${r.room.code} 체크인 완료${coords ? ` (±${Math.round(coords.accuracy)}m)` : ""}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">체크인</h1>
        <p className="mt-1 text-sm text-slate-500">
          현재 시작된 예약에서 사진을 첨부해 입실 처리할 수 있습니다.
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {info && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{info}</p>
      )}

      {reservations.length === 0 && (
        <p className="text-sm text-slate-500">현재 체크인 가능한 예약이 없어요.</p>
      )}

      <ul className="space-y-3">
        {reservations.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{r.room.code}</p>
                <p className="text-xs text-slate-500">
                  {r.room.building}동 · {r.room.floor}
                  {" · "}
                  {new Date(r.start_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  {"~"}
                  {new Date(r.end_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 ${
                r.status === "CHECKED_IN" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              }`}>
                {r.status === "CHECKED_IN" ? "입실 완료" : "체크인 대기"}
              </span>
            </div>

            {r.status !== "CHECKED_IN" && (
              <label className="mt-3 block">
                <span className="block text-xs font-medium text-slate-600 mb-1.5">현장 사진</span>
                <input
                  type="file" accept="image/*" capture="environment"
                  disabled={busy === r.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) doCheckIn(r, f);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-white"
                />
                {busy === r.id && <p className="mt-1 text-xs text-slate-500">처리 중...</p>}
              </label>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

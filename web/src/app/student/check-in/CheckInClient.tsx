"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CAMPUS, isWithinCampus } from "@/lib/geofence";
import { periodRangeLabel } from "@/lib/periods";
import { createClient } from "@/lib/supabase/browser";
import type { Reservation } from "@/lib/supabase/types";

type Props = {
  userId: string;
};

type Coord = { lat: number; lng: number };

export default function CheckInClient({ userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("id");

  const [options, setOptions] = useState<Reservation[]>([]);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [coord, setCoord] = useState<Coord | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [done, setDone] = useState<Reservation | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const supabase = useMemo(() => createClient(), []);

  // 체크인 가능한 예약 로드
  const loadOptions = useCallback(async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("student_id", userId)
      .in("status", ["AUTO_APPROVED", "APPROVED"])
      .is("checked_in_at", null)
      .eq("no_show", false)
      .gte("reservation_date", todayIso)
      .order("reservation_date", { ascending: true })
      .order("start_period", { ascending: true });
    const rows = (data ?? []) as Reservation[];
    setOptions(rows);
    if (reservationId) {
      const found = rows.find((r) => r.id === reservationId) ?? null;
      setSelected(found);
    } else if (rows.length === 1) {
      setSelected(rows[0]);
    }
  }, [supabase, userId, reservationId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const requestLocation = useCallback(() => {
    setLocBusy(true);
    setLocErr(null);
    if (!navigator.geolocation) {
      setLocErr("브라우저가 위치 정보를 지원하지 않습니다.");
      setLocBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocBusy(false);
      },
      (err) => {
        setLocErr(err.message || "위치를 가져오지 못했어요.");
        setLocBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    if (selected) requestLocation();
  }, [selected, requestLocation]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorText("이미지만 업로드할 수 있어요.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErrorText(null);
  };

  const withinCampus = coord && isWithinCampus(coord.lat, coord.lng);
  const canSubmit = !!selected && !!file && !!coord && !!withinCampus;

  const submit = async () => {
    if (!selected || !file || !coord) return;
    setBusy(true);
    setErrorText(null);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${userId}/${selected.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("check-in-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase.rpc("check_in", {
        p_reservation_id: selected.id,
        p_photo_path: path,
        p_lat: coord.lat,
        p_lng: coord.lng,
      });
      if (error) throw error;
      setDone(data as Reservation);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "체크인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 space-y-3">
        <h2 className="text-base font-semibold text-emerald-900">체크인 완료</h2>
        <p className="text-sm text-emerald-800">
          {done.room_code} · {done.reservation_date} ·{" "}
          {periodRangeLabel(done.start_period, done.end_period)}교시
        </p>
        <div className="pt-2">
          <Link
            href="/student"
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            홈으로
          </Link>
        </div>
      </section>
    );
  }

  if (options.length === 0 && !selected) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-sm text-zinc-500">
        체크인할 수 있는 예약이 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!selected ? (
        <ul className="space-y-2">
          {options.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50"
              >
                <div className="font-semibold text-zinc-900">{r.room_code}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {r.reservation_date} ·{" "}
                  {periodRangeLabel(r.start_period, r.end_period)}교시
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-900">{selected.room_code}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {selected.reservation_date} ·{" "}
                  {periodRangeLabel(selected.start_period, selected.end_period)}교시
                </div>
              </div>
              {options.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-zinc-500 underline-offset-4 hover:underline"
                >
                  다른 예약 선택
                </button>
              )}
            </div>
          </section>

          <StepCard
            index={1}
            title="위치 확인"
            tone={locBusy ? "muted" : withinCampus ? "success" : "warning"}
          >
            {locErr ? (
              <p className="text-sm text-red-700">{locErr}</p>
            ) : coord ? (
              withinCampus ? (
                <p className="text-sm text-emerald-700">
                  경영대 범위 안입니다 (반경 {CAMPUS.radiusMeters}m)
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  경영대 건물 근처에서 다시 시도해 주세요
                </p>
              )
            ) : (
              <p className="text-sm text-zinc-500">위치 확인 중…</p>
            )}
            <button
              type="button"
              onClick={requestLocation}
              disabled={locBusy}
              className="mt-2 text-xs text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50"
            >
              다시 측정
            </button>
          </StepCard>

          <StepCard
            index={2}
            title="강의실 내부 사진"
            tone={preview ? "success" : "muted"}
          >
            {preview ? (
              <img
                src={preview}
                alt="체크인 사진"
                className="mt-1 max-h-56 w-auto rounded-md border border-zinc-200 object-contain"
              />
            ) : (
              <p className="text-sm text-zinc-500">
                모바일에서는 카메라가 바로 열립니다. PC에서는 저장된 사진을 선택할 수 있어요.
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                {preview ? "다시 촬영" : "사진 촬영"}
              </button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChange}
                className="hidden"
              />
            </div>
          </StepCard>

          {errorText && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {errorText}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy}
            className="w-full rounded-xl bg-zinc-900 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy ? "체크인 중..." : "강의실 들어왔습니다"}
          </button>
        </>
      )}
    </div>
  );
}

function StepCard({
  index,
  title,
  tone,
  children,
}: {
  index: number;
  title: string;
  tone: "muted" | "success" | "warning";
  children: React.ReactNode;
}) {
  const border =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-zinc-200 bg-white";
  return (
    <section className={`rounded-xl border p-5 shadow-sm ${border}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
          {index}
        </span>
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

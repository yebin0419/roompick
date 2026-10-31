"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CATEGORY_LABEL, CATEGORY_OPTIONS } from "@/lib/reports";
import { createClient } from "@/lib/supabase/browser";
import type { ReportCategory, Room } from "@/lib/supabase/types";

type Props = { userId: string };

export default function ReportNewClient({ userId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportCategory>("EQUIPMENT_BROKEN");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true });
      setRooms(data ?? []);
    })();
  }, [supabase]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorText("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErrorText(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorText("상세 설명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErrorText(null);
    try {
      let photoPath: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        photoPath = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("report-photos")
          .upload(photoPath, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId,
        room_code: roomCode,
        category,
        description: description.trim(),
        photo_url: photoPath,
      });
      if (error) throw error;
      alert("신고가 접수되었습니다.");
      router.push("/student/reports");
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "제출에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="카테고리">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="강의실 (선택)">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoomCode(null)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              roomCode === null
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            미지정
          </button>
          {rooms.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => setRoomCode(r.code)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                roomCode === r.code
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {r.code}
            </button>
          ))}
        </div>
      </Section>

      <Section title="상세 설명">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="상황과 위치를 구체적으로 적어 주세요"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </Section>

      <Section title="사진 첨부 (선택)">
        {preview ? (
          <div className="flex items-start gap-3">
            <img
              src={preview}
              alt="첨부 사진"
              className="max-h-40 w-auto rounded-md border border-zinc-200 object-contain"
            />
            <button
              type="button"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setFile(null);
                setPreview(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-xs text-zinc-500 underline-offset-4 hover:underline"
            >
              제거
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            사진 선택
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </Section>

      {errorText && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "제출 중..." : "신고 접수"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

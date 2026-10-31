"use client";

import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

type Props = {
  userId: string;
};

const MAX_MB = 8;

export default function UploadCard({ userId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (f: File) => {
    setErrorText(null);
    if (!f.type.startsWith("image/")) {
      setErrorText("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrorText(`파일 크기는 ${MAX_MB}MB 이하여야 합니다.`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setErrorText(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/card_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("student-id-cards")
        .upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          student_id_card_url: path,
          approval_status: "PENDING",
          rejected_reason: null,
        })
        .eq("id", userId);
      if (profErr) throw profErr;

      alert("학생증 제출이 완료되었습니다. 운영진 승인을 기다려주세요.");
      setSubmitted(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "업로드에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-emerald-900">
          학생증 제출이 완료되었어요
        </h2>
        <p className="text-sm text-emerald-800">
          운영진이 학번과 사진을 대조한 뒤 승인하면 전체 기능이 열립니다.
          승인 결과가 반영되면 알림으로 안내해 드려요.
        </p>
        <div className="flex gap-2 pt-2">
          <a
            href="/student"
            className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            학생 홈으로
          </a>
          <button
            type="button"
            onClick={() => {
              clearSelection();
              setSubmitted(false);
            }}
            className="flex-1 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            다시 제출하기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-300 bg-zinc-50/50"
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="학생증 미리보기"
            className="max-h-56 w-auto rounded-md border border-zinc-200 object-contain"
          />
        ) : (
          <>
            <div className="text-sm font-medium text-zinc-700">
              이미지를 끌어다 놓거나
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              파일 선택
            </button>
            <div className="text-xs text-zinc-400">PNG · JPG · 최대 {MAX_MB}MB</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInput}
          className="hidden"
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="truncate">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </span>
          <div className="ml-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-zinc-700 underline-offset-4 hover:underline"
            >
              다시 선택
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-red-600 underline-offset-4 hover:underline"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {errorText && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || busy}
        className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "업로드 중..." : "학생증 제출하기"}
      </button>
    </section>
  );
}

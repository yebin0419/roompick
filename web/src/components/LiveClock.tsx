"use client";

import { useEffect, useState } from "react";

const DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const TIME_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // 다음 "정분" 경계에 맞춰 첫 틱, 이후 60초 간격
    const alignMs = 60_000 - (Date.now() % 60_000);
    const align = setTimeout(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60_000);
      (align as any)._interval = id;
    }, alignMs);
    return () => {
      clearTimeout(align);
      const id = (align as any)._interval;
      if (id) clearInterval(id);
    };
  }, []);

  // SSR/첫 수화 시점에는 비워 두고, 클라이언트에서만 채운다.
  if (!now) return <span className={className}>&nbsp;</span>;

  return (
    <span className={className}>
      {DATE_FMT.format(now)} · {TIME_FMT.format(now)}
    </span>
  );
}

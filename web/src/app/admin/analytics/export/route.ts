import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function csv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  // 엑셀 호환을 위해 UTF-8 BOM 선행
  return "﻿" + lines.join("\n");
}

function respond(filename: string, body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") {
    return new NextResponse("forbidden", { status: 403 });
  }

  const section = req.nextUrl.searchParams.get("section");
  const today = new Date().toISOString().slice(0, 10);

  if (section === "monthly") {
    // 월간 추이 — 예약·신고 통계를 월 기준으로 outer-join
    const [{ data: rsv }, { data: rep }] = await Promise.all([
      supabase
        .from("monthly_reservation_stats")
        .select("*")
        .order("month", { ascending: true }),
      supabase
        .from("monthly_report_stats")
        .select("*")
        .order("month", { ascending: true }),
    ]);
    const months = Array.from(
      new Set([...(rsv ?? []).map((r) => r.month), ...(rep ?? []).map((r) => r.month)]),
    ).sort();
    const rsvByMonth = new Map((rsv ?? []).map((r) => [r.month, r]));
    const repByMonth = new Map((rep ?? []).map((r) => [r.month, r]));
    const rows = months.map((m) => {
      const r = rsvByMonth.get(m);
      const p = repByMonth.get(m);
      return {
        month: m,
        reservations_total: r?.total ?? 0,
        reservations_approved: r?.approved ?? 0,
        checked_in: r?.checked_in ?? 0,
        checkin_rate_pct:
          r && r.approved > 0 ? Math.round((r.checked_in / r.approved) * 100) : 0,
        no_shows: r?.no_show ?? 0,
        reports_total: p?.total ?? 0,
        reports_unauthorized_use: p?.unauthorized_use ?? 0,
        reports_equipment_broken: p?.equipment_broken ?? 0,
        reports_cleanliness: p?.cleanliness ?? 0,
        reports_other: p?.other ?? 0,
        reports_resolved: p?.resolved ?? 0,
      };
    });
    const headers = [
      "month",
      "reservations_total",
      "reservations_approved",
      "checked_in",
      "checkin_rate_pct",
      "no_shows",
      "reports_total",
      "reports_unauthorized_use",
      "reports_equipment_broken",
      "reports_cleanliness",
      "reports_other",
      "reports_resolved",
    ];
    return respond(`monthly_${today}.csv`, csv(rows, headers));
  }

  if (section === "utilization") {
    const { data } = await supabase
      .from("room_weekly_utilization")
      .select("*")
      .order("idle_pct", { ascending: false });
    const headers = [
      "code",
      "building",
      "floor",
      "category",
      "scheduled_slots",
      "total_slots",
      "utilization_pct",
      "idle_pct",
    ];
    return respond(`utilization_${today}.csv`, csv(data ?? [], headers));
  }

  if (section === "reports-by-room") {
    const { data } = await supabase
      .from("reports")
      .select("room_code, category, status, created_at, handled_at")
      .order("created_at", { ascending: false });
    const headers = ["room_code", "category", "status", "created_at", "handled_at"];
    return respond(`reports_${today}.csv`, csv(data ?? [], headers));
  }

  if (section === "no-shows") {
    const { data } = await supabase
      .from("reservations")
      .select("room_code, reservation_date, start_period, end_period, student_id")
      .eq("no_show", true)
      .order("reservation_date", { ascending: false });
    const headers = [
      "room_code",
      "reservation_date",
      "start_period",
      "end_period",
      "student_id",
    ];
    return respond(`no_shows_${today}.csv`, csv(data ?? [], headers));
  }

  return new NextResponse("unknown section", { status: 400 });
}

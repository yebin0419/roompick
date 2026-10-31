"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") throw new Error("forbidden");
  return { supabase, userId: user.id };
}

function parseIntInRange(v: FormDataEntryValue | null, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("invalid number");
  const i = Math.trunc(n);
  if (i < min || i > max) throw new Error("out of range");
  return i;
}

export async function updateGlobalPolicy(formData: FormData) {
  const grace = parseIntInRange(formData.get("grace"), 0, 60);
  const max = parseIntInRange(formData.get("max"), 1, 9);
  const { supabase, userId } = await requireAdmin();
  await supabase
    .from("policy_rules")
    .update({
      check_in_grace_minutes: grace,
      max_reservation_periods: max,
      updated_by: userId,
    })
    .eq("scope", "global");
  revalidatePath("/admin/policy");
}

export async function upsertPeriodOverride(formData: FormData) {
  const period = String(formData.get("period") ?? "").trim();
  if (!period) return;
  const grace = parseIntInRange(formData.get("grace"), 0, 60);
  const max = parseIntInRange(formData.get("max"), 1, 9);
  const { supabase, userId } = await requireAdmin();
  // 수동 upsert: 있으면 update, 없으면 insert
  const { data: existing } = await supabase
    .from("policy_rules")
    .select("id")
    .eq("scope", "period")
    .eq("period_code", period)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("policy_rules")
      .update({
        check_in_grace_minutes: grace,
        max_reservation_periods: max,
        updated_by: userId,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("policy_rules").insert({
      scope: "period",
      period_code: period,
      check_in_grace_minutes: grace,
      max_reservation_periods: max,
      updated_by: userId,
    });
  }
  revalidatePath("/admin/policy");
}

export async function deletePeriodOverride(formData: FormData) {
  const period = String(formData.get("period") ?? "").trim();
  if (!period) return;
  const { supabase } = await requireAdmin();
  await supabase
    .from("policy_rules")
    .delete()
    .eq("scope", "period")
    .eq("period_code", period);
  revalidatePath("/admin/policy");
}

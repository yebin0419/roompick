"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/lib/supabase/types";

async function requireStaff() {
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
  if (!profile || (profile.role !== "OPERATOR" && profile.role !== "ADMIN")) {
    throw new Error("forbidden");
  }
  return { supabase, userId: user.id };
}

async function transition(id: string, status: ReportStatus, note: string | null) {
  const { supabase, userId } = await requireStaff();
  await supabase
    .from("reports")
    .update({
      status,
      handled_by: userId,
      handled_at: new Date().toISOString(),
      resolution_note: note,
    })
    .eq("id", id);
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${id}`);
}

export async function markInProgress(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await transition(id, "IN_PROGRESS", null);
}

export async function resolveReport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id || !note) return;
  await transition(id, "RESOLVED", note);
}

export async function dismissReport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id || !note) return;
  await transition(id, "DISMISSED", note);
}

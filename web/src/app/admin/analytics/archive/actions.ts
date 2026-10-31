"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  return supabase;
}

export async function generateReport(formData: FormData) {
  const month = String(formData.get("month") ?? "").trim() || null;
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("generate_operations_report", {
    p_month: month,
  });
  if (error) throw error;
  revalidatePath("/admin/analytics/archive");
  if (data) redirect(`/admin/analytics/archive/${data.id}`);
}

export async function updateReportNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!id) return;
  const supabase = await requireAdmin();
  await supabase.from("operations_reports").update({ notes }).eq("id", id);
  revalidatePath(`/admin/analytics/archive/${id}`);
}

export async function publishReport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireAdmin();
  await supabase
    .from("operations_reports")
    .update({ status: "PUBLISHED" })
    .eq("id", id);
  revalidatePath(`/admin/analytics/archive/${id}`);
  revalidatePath("/admin/analytics/archive");
}

export async function revertToDraft(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireAdmin();
  await supabase
    .from("operations_reports")
    .update({ status: "DRAFT" })
    .eq("id", id);
  revalidatePath(`/admin/analytics/archive/${id}`);
  revalidatePath("/admin/analytics/archive");
}

export async function deleteReport(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await requireAdmin();
  await supabase.from("operations_reports").delete().eq("id", id).eq("status", "DRAFT");
  revalidatePath("/admin/analytics/archive");
  redirect("/admin/analytics/archive");
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
  return { supabase, userId: user.id, role: profile.role };
}

export async function approveReservation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, userId } = await requireStaff();
  await supabase
    .from("reservations")
    .update({
      status: "APPROVED",
      decided_by: userId,
      decided_at: new Date().toISOString(),
      rejected_reason: null,
    })
    .eq("id", id);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/dashboard");
}

export async function rejectReservation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !reason) return;
  const { supabase, userId } = await requireStaff();
  await supabase
    .from("reservations")
    .update({
      status: "REJECTED",
      decided_by: userId,
      decided_at: new Date().toISOString(),
      rejected_reason: reason,
    })
    .eq("id", id);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/dashboard");
}

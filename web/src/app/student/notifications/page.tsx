import { createClient } from "@/lib/supabase/server";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "알림 · 룸픽" };

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("notifications")
    .select("id, title, body, link, is_read, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return <NotificationsClient items={data ?? []} />;
}

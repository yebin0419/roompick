import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function Profile() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!session?.user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .is("read_at", null);
    setUnread(count ?? 0);
  }, [session?.user?.id]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel(`notifications-badge:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => loadUnread(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, loadUnread]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>프로필</Text>

        <View
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Row label="이름" value={profile?.name ?? "-"} />
          <Row label="학번" value={profile?.student_number ?? "-"} />
          <Row label="이메일" value={session?.user?.email ?? "-"} />
          <Row
            label="승인 상태"
            value={profile?.approval_status ?? "-"}
            valueColor={
              profile?.approval_status === "APPROVED"
                ? colors.successText
                : profile?.approval_status === "REJECTED"
                  ? colors.dangerText
                  : colors.warning
            }
          />
        </View>

        <Pressable
          onPress={() => router.push("/notifications")}
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
              알림
            </Text>
            {unread > 0 && (
              <View
                style={{
                  minWidth: 20,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: colors.danger,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>→</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/preferences")}
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
              맞춤 빈자리 알림
            </Text>
            <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: 12 }}>
              관심 강의실·교시가 비면 즉시 푸시
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>→</Text>
        </Pressable>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{
            marginTop: 32,
            paddingVertical: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>로그아웃</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: valueColor ?? colors.text, fontSize: 13, fontWeight: "500" }}>
        {value}
      </Text>
    </View>
  );
}


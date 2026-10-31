import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { navigateFromNotification, targetFromData } from "@/lib/notification-routing";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function NotificationsScreen() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows(data ?? []);
    setRefreshing(false);
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: 새 알림 즉시 반영
  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, load]);

  // 열람 시 자동으로 모두 읽음 처리
  useEffect(() => {
    if (!session?.user) return;
    if (rows.some((r) => !r.read_at)) {
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .is("read_at", null)
        .then(() => {
          /* no-op */
        });
    }
  }, [rows, session?.user?.id]);

  const markAllRead = async () => {
    if (!session?.user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .is("read_at", null);
    load();
  };

  return (
    <>
      <Stack.Screen options={{ title: "알림", headerShown: true }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 4,
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Pressable onPress={markAllRead}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>모두 읽음</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {rows.length === 0 && (
            <View
              style={{
                padding: 32,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.textMuted }}>아직 받은 알림이 없어요.</Text>
            </View>
          )}

          {rows.map((n) => {
            const hasTarget = !!targetFromData(n.data);
            return (
              <Pressable
                key={n.id}
                onPress={() => hasTarget && navigateFromNotification(n.data)}
                disabled={!hasTarget}
                style={({ pressed }) => ({
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: n.read_at ? colors.card : "#f0f9ff",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "700", color: colors.text, fontSize: 14 }}>
                    {n.title}
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 11 }}>
                    {new Date(n.created_at).toLocaleString("ko-KR")}
                  </Text>
                </View>
                <Text style={{ marginTop: 4, color: colors.text, fontSize: 13 }}>
                  {n.body}
                </Text>
                {hasTarget && (
                  <Text style={{ marginTop: 6, color: colors.textMuted, fontSize: 11 }}>
                    탭하여 열기 →
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

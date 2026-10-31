import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/reports";
import { supabase } from "@/lib/supabase";
import type { Report } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function ReportsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", session.user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel(`my-reports:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports",
          filter: `reporter_id=eq.${session.user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          padding: 20,
          paddingBottom: 8,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>신고</Text>
          <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
            무단 점유, 비품 고장, 청결 문제 등
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/report-new")}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: "600" }}>
            + 새 신고
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10 }}
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
        {!loading && rows.length === 0 && (
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
            <Text style={{ color: colors.textMuted }}>
              아직 접수한 신고가 없어요.
            </Text>
          </View>
        )}

        {rows.map((r) => (
          <View
            key={r.id}
            style={{
              padding: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                {CATEGORY_LABEL[r.category]}
              </Text>
              <StatusBadge status={r.status} />
            </View>
            <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
              {r.room_code ?? "강의실 미지정"} · {new Date(r.created_at).toLocaleString("ko-KR")}
            </Text>
            <Text style={{ marginTop: 6, color: colors.text, fontSize: 13 }} numberOfLines={3}>
              {r.description}
            </Text>
            {r.resolution_note && (
              <View
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: colors.successBg,
                }}
              >
                <Text style={{ color: colors.successText, fontSize: 12 }}>
                  처리 메모: {r.resolution_note}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: Report["status"] }) {
  const tone = STATUS_TONE[status];
  const [bg, fg] =
    tone === "success"
      ? [colors.successBg, colors.successText]
      : tone === "warning"
        ? [colors.warningBg, colors.warning]
        : tone === "danger"
          ? [colors.dangerBg, colors.dangerText]
          : [colors.border, colors.textMuted];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "600" }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

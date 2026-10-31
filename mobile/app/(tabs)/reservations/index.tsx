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

import { periodRangeLabel } from "@/lib/periods";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/reservations";
import { supabase } from "@/lib/supabase";
import type { Reservation } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservationsIndex() {
  const router = useRouter();
  const { session } = useAuth();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("student_id", session.user.id)
      .order("reservation_date", { ascending: false })
      .order("start_period", { ascending: true });
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
      .channel(`my-reservations:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `student_id=eq.${session.user.id}`,
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
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>내 예약</Text>
        <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
          탭하면 상세 보기, 체크인·취소 가능.
        </Text>
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
              아직 예약이 없어요. 빈 강의실 탭에서 선택해 주세요.
            </Text>
          </View>
        )}

        {rows.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/(tabs)/reservations/${r.id}`)}
            style={({ pressed }) => ({
              padding: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {r.room_code}
              </Text>
              <Badge status={r.status} />
            </View>
            <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
              {r.reservation_date} · {periodRangeLabel(r.start_period, r.end_period)}교시 ·{" "}
              {r.attendees}명
            </Text>
            {r.checked_in_at && (
              <View
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: colors.successBg,
                }}
              >
                <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "600" }}>
                  체크인 {formatTime(r.checked_in_at)}
                </Text>
              </View>
            )}
            {r.no_show && (
              <View
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: colors.dangerBg,
                }}
              >
                <Text style={{ color: colors.dangerText, fontSize: 11, fontWeight: "600" }}>
                  노쇼 적립
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ status }: { status: Reservation["status"] }) {
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

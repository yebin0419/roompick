import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  currentDayAndPeriod,
  DAY_OPTIONS,
  nextDateFor,
  PERIOD_CODES,
  periodLabel,
} from "@/lib/periods";
import { supabase } from "@/lib/supabase";
import type { DayOfWeek, Room } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function RoomsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const initial = useMemo(() => currentDayAndPeriod(), []);
  const [day, setDay] = useState<DayOfWeek>(initial.day);
  const [period, setPeriod] = useState<string>(initial.period);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const date = useMemo(() => nextDateFor(day), [day]);

  const load = useCallback(async () => {
    const [roomRes, sessionRes, reservationRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("course_sessions")
        .select("room_code")
        .eq("day", day)
        .eq("period_code", period),
      // 예약은 교시 범위라서 겹침 체크. 간단히 start_period <= period <= end_period
      supabase
        .from("reservations")
        .select("room_code")
        .eq("reservation_date", date)
        .lte("start_period", period)
        .gte("end_period", period)
        .in("status", ["AUTO_APPROVED", "APPROVED", "PENDING_OPERATOR", "PENDING_ADMIN"]),
    ]);

    setRooms(roomRes.data ?? []);
    const occ = new Set<string>();
    for (const s of sessionRes.data ?? []) if (s.room_code) occ.add(s.room_code);
    for (const r of reservationRes.data ?? []) if (r.room_code) occ.add(r.room_code);
    setOccupied(occ);
    setLoading(false);
    setRefreshing(false);
  }, [day, period, date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const freeRooms = rooms.filter((r) => !occupied.has(r.code));
  const groups = new Map<string, Room[]>();
  for (const r of freeRooms) {
    const key = `${r.building} · ${r.floor ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const canReserve = profile?.approval_status === "APPROVED";

  const openReserve = (room: Room) => {
    if (!canReserve) return;
    router.push({
      pathname: "/reserve",
      params: { room: room.code, date, period },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>빈 강의실</Text>
        <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
          {date} · {periodLabel(period)} · 탭하면 예약 생성
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <PillRow
          items={DAY_OPTIONS.map((d) => ({ key: d.key, label: d.label }))}
          value={day}
          onChange={(v) => setDay(v as DayOfWeek)}
        />
        <View style={{ height: 10 }} />
        <PillRow
          items={PERIOD_CODES.map((p) => ({ key: p, label: p }))}
          value={period}
          onChange={setPeriod}
          scroll
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20 }}
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
          {freeRooms.length === 0 ? (
            <View
              style={{
                padding: 32,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: "dashed",
                borderRadius: 12,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.textMuted }}>
                이 시간에는 비어 있는 강의실이 없어요.
              </Text>
            </View>
          ) : (
            Array.from(groups.entries()).map(([groupKey, groupRooms]) => (
              <View key={groupKey} style={{ gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {groupKey}
                </Text>
                <View style={{ gap: 8 }}>
                  {groupRooms.map((r) => (
                    <Pressable
                      key={r.code}
                      onPress={() => openReserve(r)}
                      disabled={!canReserve}
                      style={({ pressed }) => ({
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: colors.successBg,
                        borderWidth: 1,
                        borderColor: "#a7f3d0",
                        opacity: pressed || !canReserve ? 0.6 : 1,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                            {r.code}
                          </Text>
                          {r.category && (
                            <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: 12 }}>
                              {r.category}
                            </Text>
                          )}
                        </View>
                        {canReserve && (
                          <Text style={{ color: colors.successText, fontSize: 12, fontWeight: "600" }}>
                            예약 →
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type PillRowProps = {
  items: Array<{ key: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  scroll?: boolean;
};
function PillRow({ items, value, onChange, scroll }: PillRowProps) {
  const content = items.map((it) => {
    const active = it.key === value;
    return (
      <Pressable
        key={it.key}
        onPress={() => onChange(it.key)}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          marginRight: 8,
          backgroundColor: active ? colors.primary : colors.card,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
        }}
      >
        <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 13 }}>
          {it.label}
        </Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 2 }}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 0 }}>{content}</View>
  );
}

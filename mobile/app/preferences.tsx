import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import { PERIOD_CODES, periodLabel } from "@/lib/periods";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function Preferences() {
  const router = useRouter();
  const { session } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const [{ data: roomRows }, { data: pref }] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("student_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle(),
    ]);
    setRooms(roomRows ?? []);
    if (pref) {
      setSelectedRooms(new Set(pref.preferred_rooms));
      setSelectedPeriods(new Set(pref.preferred_periods));
      setActive(pref.active);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRoom = (code: string) => {
    const next = new Set(selectedRooms);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedRooms(next);
  };

  const togglePeriod = (code: string) => {
    const next = new Set(selectedPeriods);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedPeriods(next);
  };

  const save = async () => {
    if (!session?.user) return;
    setSaving(true);
    await supabase.from("student_preferences").upsert({
      user_id: session.user.id,
      preferred_rooms: Array.from(selectedRooms),
      preferred_periods: Array.from(selectedPeriods),
      active,
    });
    setSaving(false);
    router.back();
  };

  // 건물/층별 그룹
  const groups = new Map<string, Room[]>();
  for (const r of rooms) {
    const key = `${r.building} · ${r.floor ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <>
      <Stack.Screen options={{ title: "맞춤 빈자리 알림", headerShown: true }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontWeight: "600", color: colors.text }}>알림 활성</Text>
                <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: 12 }}>
                  선택한 강의실·교시가 비면 즉시 푸시로 알려드려요.
                </Text>
              </View>
              <Switch value={active} onValueChange={setActive} />
            </View>

            <Section
              title={`선호 강의실 (${selectedRooms.size})`}
              subtitle="관심 있는 강의실을 모두 선택하세요."
            >
              {Array.from(groups.entries()).map(([groupKey, groupRooms]) => (
                <View key={groupKey} style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textFaint,
                      marginBottom: 6,
                      textTransform: "uppercase",
                    }}
                  >
                    {groupKey}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {groupRooms.map((r) => {
                      const picked = selectedRooms.has(r.code);
                      return (
                        <Pressable
                          key={r.code}
                          onPress={() => toggleRoom(r.code)}
                          style={pillStyle(picked)}
                        >
                          <Text style={pillText(picked)}>{r.code}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Section>

            <Section
              title={`선호 교시 (${selectedPeriods.size})`}
              subtitle="미선택 시 모든 교시 매칭."
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {PERIOD_CODES.map((p) => {
                  const picked = selectedPeriods.has(p);
                  return (
                    <Pressable
                      key={p}
                      onPress={() => togglePeriod(p)}
                      style={pillStyle(picked)}
                    >
                      <Text style={pillText(picked)}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedPeriods.size > 0 && (
                <Text style={{ marginTop: 8, fontSize: 11, color: colors.textFaint }}>
                  {Array.from(selectedPeriods).sort().map(periodLabel).join(" · ")}
                </Text>
              )}
            </Section>

            <Pressable
              onPress={save}
              disabled={saving}
              style={{
                marginTop: 4,
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: "center",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={{ color: colors.primaryText, fontWeight: "600" }}>저장</Text>
              )}
            </Pressable>

            <Text style={{ textAlign: "center", fontSize: 11, color: colors.textFaint }}>
              알림은 오늘·내일 날짜의 예약 취소 시에만 발송됩니다.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontWeight: "600", color: colors.text, fontSize: 13 }}>{title}</Text>
      {subtitle && (
        <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: 11 }}>
          {subtitle}
        </Text>
      )}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function pillStyle(active: boolean) {
  return {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: active ? colors.primary : colors.bg,
    borderWidth: 1,
    borderColor: active ? colors.primary : colors.border,
  } as const;
}

function pillText(active: boolean) {
  return {
    color: active ? colors.primaryText : colors.text,
    fontSize: 12,
  } as const;
}

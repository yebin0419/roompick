import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { PERIOD_CODES, periodLabel, periodRangeLabel } from "@/lib/periods";
import { supabase } from "@/lib/supabase";
import type { ReservationKind } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function ReserveScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ room?: string; date?: string; period?: string }>();

  const initialStart = params.period && PERIOD_CODES.includes(params.period) ? params.period : "01";
  const [start, setStart] = useState<string>(initialStart);
  const [end, setEnd] = useState<string>(initialStart);
  const [attendees, setAttendees] = useState<string>("4");
  const [purpose, setPurpose] = useState<string>("");
  const [kind, setKind] = useState<ReservationKind>("QUICK");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const span = useMemo(() => {
    const si = PERIOD_CODES.indexOf(start);
    const ei = PERIOD_CODES.indexOf(end);
    return ei >= si ? ei - si + 1 : 0;
  }, [start, end]);

  const attendeesNum = Number(attendees) || 0;
  const predictedAuto = kind === "QUICK" && attendeesNum > 0 && attendeesNum <= 10 && span > 0 && span <= 2;

  const submit = async () => {
    if (!params.room || !params.date) {
      setErrorText("강의실/날짜 정보가 없습니다.");
      return;
    }
    if (!session?.user) {
      setErrorText("세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }
    if (!purpose.trim()) {
      setErrorText("사용 목적을 입력해 주세요.");
      return;
    }
    if (attendeesNum <= 0) {
      setErrorText("예상 인원을 입력해 주세요.");
      return;
    }
    if (span <= 0) {
      setErrorText("종료 교시가 시작 교시보다 빠릅니다.");
      return;
    }

    setBusy(true);
    setErrorText(null);
    const { error } = await supabase.from("reservations").insert({
      student_id: session.user.id,
      room_code: params.room,
      reservation_date: params.date,
      start_period: start,
      end_period: end,
      attendees: attendeesNum,
      purpose: purpose.trim(),
      kind,
    });
    setBusy(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    Alert.alert(
      "예약 요청 완료",
      predictedAuto
        ? "자동 승인되었습니다. '내 예약' 탭에서 확인하세요."
        : kind === "EVENT"
          ? "행정실 승인 대기 상태입니다."
          : "운영진 승인 대기 상태입니다.",
      [{ text: "확인", onPress: () => router.replace("/(tabs)/reservations") }],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "예약하기", headerShown: true }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <SummaryCard room={params.room} date={params.date} start={start} end={end} />

            <Section title="시작 교시">
              <PillRow value={start} onChange={(v) => {
                setStart(v);
                if (PERIOD_CODES.indexOf(v) > PERIOD_CODES.indexOf(end)) setEnd(v);
              }} items={PERIOD_CODES} />
            </Section>

            <Section title="종료 교시">
              <PillRow value={end} onChange={setEnd} items={PERIOD_CODES} />
              <Text style={{ marginTop: 6, color: colors.textFaint, fontSize: 12 }}>
                {periodLabel(start)} ~ {periodLabel(end)} · {span}교시
              </Text>
            </Section>

            <Section title="예상 인원">
              <TextInput
                value={attendees}
                onChangeText={setAttendees}
                keyboardType="number-pad"
                style={inputStyle}
                placeholder="예: 4"
                placeholderTextColor={colors.textFaint}
              />
            </Section>

            <Section title="사용 목적">
              <TextInput
                value={purpose}
                onChangeText={setPurpose}
                style={inputStyle}
                placeholder="팀플 / 스터디 / 행사 등"
                placeholderTextColor={colors.textFaint}
              />
            </Section>

            <Section title="예약 종류">
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KindOption active={kind === "QUICK"} onPress={() => setKind("QUICK")}
                  title="소규모 (QUICK)" subtitle="10명↓ · 2교시↓ 자동 승인" />
                <KindOption active={kind === "EVENT"} onPress={() => setKind("EVENT")}
                  title="대규모·행사 (EVENT)" subtitle="행정실 최종 승인" />
              </View>
            </Section>

            <View
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: predictedAuto ? colors.successBg : colors.warningBg,
              }}
            >
              <Text style={{ color: predictedAuto ? colors.successText : colors.warning, fontWeight: "600" }}>
                {predictedAuto
                  ? "제출하면 자동 승인됩니다"
                  : kind === "EVENT"
                    ? "행정실 승인 후 사용 가능합니다"
                    : "운영진 승인 후 사용 가능합니다"}
              </Text>
            </View>

            {errorText && (
              <View style={{ backgroundColor: colors.dangerBg, padding: 12, borderRadius: 8 }}>
                <Text style={{ color: colors.dangerText }}>{errorText}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={{
                marginTop: 4,
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: "center",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={{ color: colors.primaryText, fontWeight: "600" }}>예약 요청</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const inputStyle = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: colors.text,
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SummaryCard({
  room,
  date,
  start,
  end,
}: {
  room?: string;
  date?: string;
  start: string;
  end: string;
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{room ?? "-"}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        {date ?? "-"} · {periodRangeLabel(start, end)}교시
      </Text>
    </View>
  );
}

function PillRow({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: string[];
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map((it) => {
        const active = it === value;
        return (
          <Pressable
            key={it}
            onPress={() => onChange(it)}
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
              {it}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function KindOption({
  active,
  onPress,
  title,
  subtitle,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ fontWeight: "600", color: active ? colors.primaryText : colors.text }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 11,
          color: active ? "rgba(255,255,255,0.75)" : colors.textMuted,
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

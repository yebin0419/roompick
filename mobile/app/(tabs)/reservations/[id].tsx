import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { periodRangeLabel } from "@/lib/periods";
import { isCancellable, STATUS_LABEL, STATUS_TONE } from "@/lib/reservations";
import { BUCKET_CHECK_IN, supabase } from "@/lib/supabase";
import type { Reservation } from "@/lib/types";
import { colors } from "@/theme";

function canCheckIn(r: Reservation): boolean {
  return (
    (r.status === "AUTO_APPROVED" || r.status === "APPROVED") &&
    !r.checked_in_at &&
    !r.no_show
  );
}

export default function ReservationDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setReservation(data);
    setLoading(false);

    if (data.check_in_photo_url) {
      const { data: signed } = await supabase.storage
        .from(BUCKET_CHECK_IN)
        .createSignedUrl(data.check_in_photo_url, 300);
      setPhotoUrl(signed?.signedUrl ?? null);
    } else {
      setPhotoUrl(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime 반영
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`reservation:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const cancel = () => {
    if (!reservation) return;
    Alert.alert(
      "예약 취소",
      `${reservation.room_code} ${reservation.reservation_date} 예약을 취소할까요?`,
      [
        { text: "유지", style: "cancel" },
        {
          text: "취소하기",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("reservations")
              .update({ status: "CANCELLED" })
              .eq("id", reservation.id);
            if (error) {
              Alert.alert("오류", error.message);
            } else {
              router.back();
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (notFound || !reservation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.dangerText, fontWeight: "600" }}>
            예약을 찾을 수 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const r = reservation;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* 요약 */}
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
              {r.room_code}
            </Text>
            <Badge status={r.status} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {r.reservation_date} · {periodRangeLabel(r.start_period, r.end_period)}교시
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Chip label={r.kind} />
            <Chip label={`${r.attendees}명`} />
          </View>
        </View>

        {/* 상세 */}
        <Section title="상세">
          <Row label="목적" value={r.purpose || "미입력"} />
          <Row
            label="요청"
            value={new Date(r.created_at).toLocaleString("ko-KR")}
          />
          {r.decided_at && (
            <Row
              label={r.status === "REJECTED" ? "거절 시각" : "결정 시각"}
              value={new Date(r.decided_at).toLocaleString("ko-KR")}
            />
          )}
          {r.rejected_reason && (
            <View
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 8,
                backgroundColor: colors.dangerBg,
              }}
            >
              <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "600" }}>
                거절 사유
              </Text>
              <Text style={{ marginTop: 2, color: colors.text, fontSize: 13 }}>
                {r.rejected_reason}
              </Text>
            </View>
          )}
        </Section>

        {/* 체크인 */}
        {r.checked_in_at && (
          <Section title="체크인">
            <Row
              label="체크인 시각"
              value={new Date(r.checked_in_at).toLocaleString("ko-KR")}
            />
            {photoUrl && (
              <View
                style={{
                  marginTop: 10,
                  aspectRatio: 3 / 4,
                  width: "60%",
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: colors.border,
                }}
              >
                <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} />
              </View>
            )}
          </Section>
        )}

        {r.no_show && (
          <View
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: colors.dangerBg,
            }}
          >
            <Text style={{ color: colors.dangerText, fontSize: 13, fontWeight: "600" }}>
              노쇼 1회 적립
            </Text>
            <Text style={{ marginTop: 4, color: colors.text, fontSize: 12 }}>
              체크인 유예시간 내 미제출로 자동 집계되었습니다.
            </Text>
          </View>
        )}

        {/* 액션 */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          {canCheckIn(r) && (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/check-in", params: { id: r.id } })
              }
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: colors.primary,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>체크인</Text>
            </Pressable>
          )}
          {isCancellable(r.status) && !r.checked_in_at && (
            <Pressable
              onPress={cancel}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>예약 취소</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13 }}>{value}</Text>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, color: colors.textMuted }}>{label}</Text>
    </View>
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

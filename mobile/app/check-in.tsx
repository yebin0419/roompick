import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";

import { CAMPUS, isWithinCampus } from "@/lib/geofence";
import { periodRangeLabel } from "@/lib/periods";
import { BUCKET_CHECK_IN, supabase } from "@/lib/supabase";
import type { Reservation } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

type Coord = { lat: number; lng: number };

export default function CheckIn() {
  const router = useRouter();
  const { session } = useAuth();
  const { id: reservationId } = useLocalSearchParams<{ id: string }>();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [coord, setCoord] = useState<Coord | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    (async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .maybeSingle();
      if (error) setLoadErr(error.message);
      else setReservation(data);
    })();
  }, [reservationId]);

  const requestLocation = useCallback(async () => {
    setLocBusy(true);
    setLocErr(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocErr("위치 권한을 허용해 주세요.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "위치를 가져오지 못했습니다.");
    } finally {
      setLocBusy(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const withinCampus = !!coord && isWithinCampus(coord.lat, coord.lng);
  const canCheckIn =
    !!reservation &&
    !reservation.checked_in_at &&
    (reservation.status === "AUTO_APPROVED" || reservation.status === "APPROVED") &&
    withinCampus;

  const doCheckIn = async () => {
    if (!reservation || !session?.user || !coord) return;
    setCheckInBusy(true);
    try {
      // 1) 실시간 카메라 전용 — 앨범 접근 차단 (launchCameraAsync 만 호출)
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error("카메라 권한이 필요합니다");

      const shot = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
      });
      if (shot.canceled || !shot.assets[0]) {
        setCheckInBusy(false);
        return;
      }
      setPreview(shot.assets[0].uri);

      // 2) Storage 업로드
      const resp = await fetch(shot.assets[0].uri);
      const buf = await (await resp.blob()).arrayBuffer();
      const path = `${session.user.id}/${reservation.id}_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_CHECK_IN)
        .upload(path, buf, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      // 3) RPC 호출 (서버에서 재검증: owner / status / 중복 / geofence / 시간)
      const { data, error: rpcErr } = await supabase.rpc("check_in", {
        p_reservation_id: reservation.id,
        p_photo_path: path,
        p_lat: coord.lat,
        p_lng: coord.lng,
      });
      if (rpcErr) throw rpcErr;

      setReservation(data as Reservation);
      Alert.alert("체크인 완료", "강의실 이용을 즐기세요!", [
        { text: "확인", onPress: () => router.replace("/(tabs)/reservations") },
      ]);
    } catch (e) {
      Alert.alert("체크인 실패", e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setCheckInBusy(false);
    }
  };

  if (loadErr) {
    return (
      <ErrorShell title="예약 조회 실패" message={loadErr} />
    );
  }
  if (!reservation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "체크인", headerShown: true }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 20, gap: 16, flex: 1 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              {reservation.room_code}
            </Text>
            <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 13 }}>
              {reservation.reservation_date} ·{" "}
              {periodRangeLabel(reservation.start_period, reservation.end_period)}교시
            </Text>
          </View>

          {/* 1차: GPS */}
          <StepCard
            index={1}
            title="위치 확인"
            tone={locBusy ? "muted" : withinCampus ? "success" : "warning"}
            busy={locBusy}
          >
            {locErr ? (
              <Text style={{ color: colors.dangerText, fontSize: 13 }}>{locErr}</Text>
            ) : coord ? (
              withinCampus ? (
                <Text style={{ color: colors.successText, fontSize: 13 }}>
                  경영대 범위 안입니다 (반경 {CAMPUS.radiusMeters}m)
                </Text>
              ) : (
                <Text style={{ color: colors.warning, fontSize: 13 }}>
                  경영대 건물 근처에서 다시 시도해 주세요
                </Text>
              )
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>위치 확인 중…</Text>
            )}
            <Pressable
              onPress={requestLocation}
              disabled={locBusy}
              style={{ alignSelf: "flex-start", marginTop: 8 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: "underline" }}>
                다시 측정
              </Text>
            </Pressable>
          </StepCard>

          {/* 2차: 사진 */}
          <StepCard
            index={2}
            title="강의실 내부 사진 촬영"
            tone={preview ? "success" : "muted"}
          >
            {preview ? (
              <View
                style={{
                  marginTop: 4,
                  width: 120,
                  height: 160,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: colors.border,
                }}
              >
                <Image source={{ uri: preview }} style={{ width: "100%", height: "100%" }} />
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                [강의실 들어왔습니다] 버튼을 누르면 카메라가 열립니다. 앨범 업로드는 차단되어 있어요.
              </Text>
            )}
          </StepCard>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={doCheckIn}
            disabled={!canCheckIn || checkInBusy}
            style={{
              backgroundColor: canCheckIn ? colors.primary : colors.border,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            {checkInBusy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text
                style={{
                  color: canCheckIn ? colors.primaryText : colors.textMuted,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                강의실 들어왔습니다
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

function StepCard({
  index,
  title,
  tone,
  busy,
  children,
}: {
  index: number;
  title: string;
  tone: "muted" | "success" | "warning";
  busy?: boolean;
  children: React.ReactNode;
}) {
  const border =
    tone === "success" ? "#a7f3d0" : tone === "warning" ? "#fcd34d" : colors.border;
  const bg =
    tone === "success" ? colors.successBg : tone === "warning" ? colors.warningBg : colors.card;
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: colors.primaryText, fontSize: 11, fontWeight: "700" }}>
            {index}
          </Text>
        </View>
        <Text style={{ fontWeight: "600", color: colors.text }}>{title}</Text>
        {busy && <ActivityIndicator size="small" />}
      </View>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

function ErrorShell({ title, message }: { title: string; message: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dangerText }}>{title}</Text>
        <Text style={{ marginTop: 6, color: colors.textMuted }}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

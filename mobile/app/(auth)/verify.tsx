import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { BUCKET_STUDENT_ID, supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function Verify() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setErrorText("카메라 권한이 필요합니다.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!r.canceled && r.assets[0]) setLocalUri(r.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ["images"],
    });
    if (!r.canceled && r.assets[0]) setLocalUri(r.assets[0].uri);
  };

  const upload = async () => {
    if (!localUri || !session?.user) return;
    setBusy(true);
    setErrorText(null);
    try {
      const resp = await fetch(localUri);
      const blob = await resp.blob();
      // RN의 fetch().blob() → Supabase SDK가 ArrayBuffer를 선호
      const buf = await new Response(blob).arrayBuffer();

      const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${session.user.id}/card_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET_STUDENT_ID)
        .upload(path, buf, {
          contentType: ext === "png" ? "image/png" : "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          student_id_card_url: path,
          approval_status: "PENDING",
          rejected_reason: null,
        })
        .eq("id", session.user.id);
      if (profErr) throw profErr;

      await refreshProfile();
      router.replace("/pending");
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
          경영대 학생 인증
        </Text>
        <Text style={{ marginTop: 6, color: colors.textMuted }}>
          모바일 학생증 또는 실물 학생증 사진 1장을 제출해 주세요. 운영진이 승인 후
          전체 기능을 사용할 수 있습니다.
        </Text>

        {profile?.rejected_reason && (
          <View
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 10,
              backgroundColor: colors.warningBg,
            }}
          >
            <Text style={{ color: colors.warning, fontWeight: "600" }}>이전 거절 사유</Text>
            <Text style={{ marginTop: 4, color: colors.text }}>{profile.rejected_reason}</Text>
          </View>
        )}

        <View
          style={{
            marginTop: 24,
            aspectRatio: 3 / 4,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {localUri ? (
            <Image source={{ uri: localUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <Text style={{ color: colors.textFaint }}>학생증 사진을 선택하세요</Text>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Pressable
            onPress={pickFromCamera}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>카메라로 촬영</Text>
          </Pressable>
          <Pressable
            onPress={pickFromLibrary}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>앨범에서 선택</Text>
          </Pressable>
        </View>

        {errorText && (
          <View
            style={{
              marginTop: 16,
              backgroundColor: colors.dangerBg,
              padding: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.dangerText }}>{errorText}</Text>
          </View>
        )}

        <Pressable
          onPress={upload}
          disabled={!localUri || busy}
          style={{
            marginTop: 20,
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
            opacity: !localUri || busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={{ color: colors.primaryText, fontWeight: "600" }}>제출하기</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

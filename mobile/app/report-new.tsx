import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { CATEGORY_LABEL, CATEGORY_OPTIONS } from "@/lib/reports";
import { BUCKET_REPORTS, supabase } from "@/lib/supabase";
import type { ReportCategory, Room } from "@/lib/types";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function NewReport() {
  const router = useRouter();
  const { session } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportCategory>("EQUIPMENT_BROKEN");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true });
      setRooms(data ?? []);
    })();
  }, []);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorText("카메라 권한이 필요합니다.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      mediaTypes: ["images"],
    });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  };

  const submit = async () => {
    if (!session?.user) return;
    if (!description.trim()) {
      setErrorText("상세 설명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErrorText(null);
    try {
      let photoPath: string | null = null;
      if (photoUri) {
        const resp = await fetch(photoUri);
        const buf = await (await resp.blob()).arrayBuffer();
        const ext = photoUri.split(".").pop()?.toLowerCase() ?? "jpg";
        photoPath = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET_REPORTS)
          .upload(photoPath, buf, {
            contentType: ext === "png" ? "image/png" : "image/jpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id: session.user.id,
        room_code: roomCode,
        category,
        description: description.trim(),
        photo_url: photoPath,
      });
      if (error) throw error;

      Alert.alert("신고가 접수되었습니다", "운영진이 확인 후 처리합니다.", [
        { text: "확인", onPress: () => router.replace("/(tabs)/reports") },
      ]);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "새 신고", headerShown: true }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Section title="카테고리">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CATEGORY_OPTIONS.map((c) => {
                  const active = c === category;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        style={{ color: active ? colors.primaryText : colors.text, fontSize: 13 }}
                      >
                        {CATEGORY_LABEL[c]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section title="강의실 (선택)">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable
                  onPress={() => setRoomCode(null)}
                  style={pillStyle(roomCode === null)}
                >
                  <Text style={pillTextStyle(roomCode === null)}>미지정</Text>
                </Pressable>
                {rooms.map((r) => {
                  const active = r.code === roomCode;
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => setRoomCode(r.code)}
                      style={pillStyle(active)}
                    >
                      <Text style={pillTextStyle(active)}>{r.code}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Section>

            <Section title="상세 설명">
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="상황과 위치를 구체적으로 적어 주세요"
                placeholderTextColor={colors.textFaint}
                style={{
                  minHeight: 100,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: colors.text,
                  textAlignVertical: "top",
                }}
              />
            </Section>

            <Section title="사진 첨부 (선택)">
              {photoUri ? (
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: colors.border,
                    }}
                  >
                    <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} />
                  </View>
                  <Pressable onPress={() => setPhotoUri(null)}>
                    <Text style={{ color: colors.textMuted, textDecorationLine: "underline" }}>
                      제거
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={takePhoto}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "600" }}>카메라</Text>
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
                    <Text style={{ color: colors.text, fontWeight: "600" }}>앨범</Text>
                  </Pressable>
                </View>
              )}
            </Section>

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
                <Text style={{ color: colors.primaryText, fontWeight: "600" }}>신고 접수</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

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

function pillStyle(active: boolean) {
  return {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: active ? colors.primary : colors.card,
    borderWidth: 1,
    borderColor: active ? colors.primary : colors.border,
  } as const;
}

function pillTextStyle(active: boolean) {
  return {
    color: active ? colors.primaryText : colors.text,
    fontSize: 13,
  } as const;
}

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// 모듈 로딩 1회 — foreground 수신 시에도 배너 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // SDK 51+ 신규 필드. 구버전 타입엔 없을 수 있으나 런타임에 무시된다.
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null; // 시뮬레이터·웹은 미지원
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === "granted";
  if (!granted) {
    const r = await Notifications.requestPermissionsAsync();
    granted = r.status === "granted";
  }
  if (!granted) return null;

  try {
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[push] token error:", e);
    return null;
  }
}

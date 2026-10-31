import type { ReportCategory, ReportStatus } from "./types";

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  UNAUTHORIZED_USE: "무단 점유",
  EQUIPMENT_BROKEN: "비품 고장",
  CLEANLINESS: "청결 문제",
  OTHER: "기타",
};

export const CATEGORY_OPTIONS: ReportCategory[] = [
  "UNAUTHORIZED_USE",
  "EQUIPMENT_BROKEN",
  "CLEANLINESS",
  "OTHER",
];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "접수됨",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
  DISMISSED: "반려",
};

export const STATUS_TONE: Record<ReportStatus, "warning" | "muted" | "success" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "muted",
  RESOLVED: "success",
  DISMISSED: "danger",
};

import type { ReportCategory, ReportStatus } from "@/lib/supabase/types";

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

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "접수됨",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
  DISMISSED: "반려",
};

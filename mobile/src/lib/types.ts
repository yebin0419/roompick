// 수동 유지 — Supabase CLI 연결 시 `supabase gen types typescript`로 교체 가능
// supabase/migrations/0001_init.sql 과 1:1 대응

export type UserRole = "STUDENT" | "OPERATOR" | "ADMIN";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type ReservationKind = "QUICK" | "EVENT";
export type ReservationStatus =
  | "AUTO_APPROVED"
  | "PENDING_OPERATOR"
  | "PENDING_ADMIN"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";
export type ReportCategory =
  | "UNAUTHORIZED_USE"
  | "EQUIPMENT_BROKEN"
  | "CLEANLINESS"
  | "OTHER";
export type ReportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type Profile = {
  id: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  student_number: string | null;
  name: string | null;
  student_id_card_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  no_show_count: number;
  created_at: string;
  updated_at: string;
};

export type Room = {
  code: string;
  alt_code: string | null;
  building: string;
  building_name: string | null;
  floor: string | null;
  category: string | null;
  in_scope: boolean;
  sort_order: number | null;
};

export type Period = {
  code: string;
  start_time: string | null;
  end_time: string | null;
  kind: "regular" | "night" | "intensive";
  sort_order: number;
};

export type Course = {
  id: string;
  course_code: string;
  class_section: string;
  name: string;
  grade_level: string | null;
  requirement_type: string | null;
  credits: number | null;
  lecture_type: string | null;
  professor: string | null;
  enrollment: number | null;
  capacity: number | null;
  attendees: number | null;
  source_file: string | null;
  source_row: number | null;
  raw_schedule: string | null;
  created_at: string;
};

export type CourseSession = {
  id: string;
  course_id: string;
  day: DayOfWeek;
  period_code: string;
  room_code: string | null;
};

export type StudentPreference = {
  user_id: string;
  preferred_rooms: string[];
  preferred_periods: string[];
  active: boolean;
  updated_at: string;
};

export type OpsReportStatus = "DRAFT" | "PUBLISHED";

export type OpsReportKpi = {
  period: string;
  reservations_total: number;
  reservations_approved: number;
  checked_in: number;
  checkin_rate_pct: number;
  no_shows: number;
  reports_total: number;
  reports_open: number;
};

export type OpsReportRecommendation = {
  type: "space_reallocation" | "facility_priority" | "policy_grace" | "report_backlog";
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
};

export type OperationsReport = {
  id: string;
  title: string;
  period_label: string;
  status: OpsReportStatus;
  kpi: OpsReportKpi;
  recommendations: OpsReportRecommendation[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PushToken = {
  user_id: string;
  token: string;
  platform: string | null;
  last_seen_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type PolicyScope = "global" | "period";

export type PolicyRule = {
  id: string;
  scope: PolicyScope;
  period_code: string | null;
  check_in_grace_minutes: number;
  max_reservation_periods: number;
  updated_by: string | null;
  updated_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  room_code: string | null;
  category: ReportCategory;
  description: string;
  photo_url: string | null;
  status: ReportStatus;
  handled_by: string | null;
  handled_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  student_id: string;
  room_code: string;
  reservation_date: string; // YYYY-MM-DD
  start_period: string;
  end_period: string;
  purpose: string | null;
  attendees: number;
  kind: ReservationKind;
  status: ReservationStatus;
  decided_by: string | null;
  decided_at: string | null;
  rejected_reason: string | null;
  checked_in_at: string | null;
  check_in_photo_url: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  no_show: boolean;
  created_at: string;
  updated_at: string;
};

type Empty = Record<string, never>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: Room;
        Update: Partial<Room>;
        Relationships: [];
      };
      periods: {
        Row: Period;
        Insert: Period;
        Update: Partial<Period>;
        Relationships: [];
      };
      courses: {
        Row: Course;
        Insert: Omit<Course, "id" | "created_at"> & { id?: string };
        Update: Partial<Course>;
        Relationships: [];
      };
      course_sessions: {
        Row: CourseSession;
        Insert: Omit<CourseSession, "id"> & { id?: string };
        Update: Partial<CourseSession>;
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey";
            columns: ["course_id"];
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_sessions_room_code_fkey";
            columns: ["room_code"];
            referencedRelation: "rooms";
            referencedColumns: ["code"];
          },
        ];
      };
      push_tokens: {
        Row: PushToken;
        Insert: PushToken;
        Update: Partial<PushToken>;
        Relationships: [];
      };
      notifications: {
        Row: AppNotification;
        Insert: Omit<AppNotification, "id" | "created_at" | "read_at"> & {
          id?: string;
          read_at?: string | null;
        };
        Update: Partial<AppNotification>;
        Relationships: [];
      };
      student_preferences: {
        Row: StudentPreference;
        Insert: Omit<StudentPreference, "updated_at"> & { updated_at?: string };
        Update: Partial<StudentPreference>;
        Relationships: [];
      };
      operations_reports: {
        Row: OperationsReport;
        Insert: Omit<OperationsReport, "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: OpsReportStatus;
        };
        Update: Partial<OperationsReport>;
        Relationships: [];
      };
      policy_rules: {
        Row: PolicyRule;
        Insert: Omit<PolicyRule, "id" | "updated_at"> & { id?: string; updated_at?: string };
        Update: Partial<PolicyRule>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: Omit<
          Report,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "handled_by"
          | "handled_at"
          | "resolution_note"
        > & {
          id?: string;
          status?: ReportStatus;
        };
        Update: Partial<Report>;
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_room_code_fkey";
            columns: ["room_code"];
            referencedRelation: "rooms";
            referencedColumns: ["code"];
          },
        ];
      };
      reservations: {
        Row: Reservation;
        // 서버 트리거가 status 를 결정하므로 Insert 시에는 생략 가능.
        // 체크인·노쇼 컬럼은 RPC/백엔드에서 채우므로 Insert 시 생략.
        Insert: Omit<
          Reservation,
          | "id"
          | "created_at"
          | "updated_at"
          | "decided_by"
          | "decided_at"
          | "rejected_reason"
          | "status"
          | "checked_in_at"
          | "check_in_photo_url"
          | "check_in_lat"
          | "check_in_lng"
          | "no_show"
        > & {
          id?: string;
          status?: ReservationStatus;
        };
        Update: Partial<Reservation>;
        Relationships: [
          {
            foreignKeyName: "reservations_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_room_code_fkey";
            columns: ["room_code"];
            referencedRelation: "rooms";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Views: {
      room_weekly_utilization: {
        Row: {
          code: string;
          building: string;
          floor: string | null;
          category: string | null;
          scheduled_slots: number;
          total_slots: number;
          utilization_pct: number;
          idle_pct: number;
        };
        Relationships: [];
      };
      monthly_reservation_stats: {
        Row: {
          month: string; // YYYY-MM
          total: number;
          approved: number;
          checked_in: number;
          no_show: number;
        };
        Relationships: [];
      };
      monthly_report_stats: {
        Row: {
          month: string;
          total: number;
          unauthorized_use: number;
          equipment_broken: number;
          cleanliness: number;
          other: number;
          resolved: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_in: {
        Args: {
          p_reservation_id: string;
          p_photo_path: string;
          p_lat: number;
          p_lng: number;
        };
        Returns: Reservation;
      };
      mark_no_shows: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_within_campus: {
        Args: { p_lat: number; p_lng: number };
        Returns: boolean;
      };
      get_policy_grace: {
        Args: { p_period?: string | null };
        Returns: number;
      };
      get_policy_max_periods: {
        Args: { p_period?: string | null };
        Returns: number;
      };
      send_ending_soon_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      generate_operations_report: {
        Args: { p_month?: string | null };
        Returns: OperationsReport;
      };
    };
    Enums: {
      user_role: UserRole;
      approval_status: ApprovalStatus;
      day_of_week: DayOfWeek;
      reservation_kind: ReservationKind;
      reservation_status: ReservationStatus;
      report_category: ReportCategory;
      report_status: ReportStatus;
      ops_report_status: OpsReportStatus;
    };
    CompositeTypes: Empty;
  };
};

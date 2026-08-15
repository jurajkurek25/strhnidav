// Hand-written mirror of supabase/migrations/0001_init.sql, shaped to match
// what `supabase gen types typescript` would produce (Row/Insert/Update/
// Relationships per table) so it satisfies @supabase/supabase-js's generic
// constraints. If the schema changes, prefer regenerating via:
//   supabase gen types typescript --project-id <id> > src/types/database.ts

export type TaskType = "text" | "image" | "pdf" | "self_check";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          has_full_access: boolean;
          purchased_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          has_full_access?: boolean;
          purchased_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      sections: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sections"]["Insert"]>;
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          section_id: string | null;
          day_number: number;
          title: string;
          description: string | null;
          video_path: string | null;
          video_duration_seconds: number | null;
          lock_image_path: string | null;
          is_free: boolean;
          task_type: TaskType;
          task_prompt: string | null;
          order_index: number;
          hls_ready: boolean;
          hls_segment_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_id?: string | null;
          day_number: number;
          title: string;
          description?: string | null;
          video_path?: string | null;
          video_duration_seconds?: number | null;
          lock_image_path?: string | null;
          is_free?: boolean;
          task_type?: TaskType;
          task_prompt?: string | null;
          order_index?: number;
          hls_ready?: boolean;
          hls_segment_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lessons"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lessons_section_id_fkey";
            columns: ["section_id"];
            referencedRelation: "sections";
            referencedColumns: ["id"];
          }
        ];
      };
      lesson_documents: {
        Row: {
          id: string;
          lesson_id: string;
          title: string;
          file_path: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          file_path: string;
          order_index?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lesson_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lesson_documents_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          }
        ];
      };
      lesson_audio: {
        Row: {
          id: string;
          lesson_id: string;
          title: string;
          file_path: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          file_path: string;
          order_index?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lesson_audio"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lesson_audio_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          }
        ];
      };
      action_steps: {
        Row: {
          id: string;
          lesson_id: string;
          body: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          body: string;
          order_index?: number;
        };
        Update: Partial<Database["public"]["Tables"]["action_steps"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "action_steps_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          }
        ];
      };
      user_action_step_completions: {
        Row: {
          id: string;
          user_id: string;
          action_step_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_step_id: string;
          completed_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_action_step_completions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "user_action_step_completions_action_step_id_fkey";
            columns: ["action_step_id"];
            referencedRelation: "action_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_action_step_completions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      user_lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          video_watched_percent: number;
          video_completed_at: string | null;
          task_completed_at: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          video_watched_percent?: number;
          video_completed_at?: string | null;
          task_completed_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_lesson_progress"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_lesson_progress_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      task_submissions: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          submission_type: TaskType;
          content_text: string | null;
          file_path: string | null;
          status: SubmissionStatus;
          ai_feedback: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          submission_type: TaskType;
          content_text?: string | null;
          file_path?: string | null;
          status?: SubmissionStatus;
          ai_feedback?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_submissions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "task_submissions_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_submissions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          lesson_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "comments_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "comments";
            referencedColumns: ["id"];
          }
        ];
      };
      free_access_grants: {
        Row: {
          id: string;
          email: string;
          note: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          note?: string | null;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["free_access_grants"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "free_access_grants_granted_by_fkey";
            columns: ["granted_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      lesson_video_keys: {
        Row: {
          lesson_id: string;
          key_id: string;
          aes_key_base64: string;
          created_at: string;
        };
        Insert: {
          lesson_id: string;
          key_id: string;
          aes_key_base64: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lesson_video_keys"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lesson_video_keys_lesson_id_fkey";
            columns: ["lesson_id"];
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          stripe_session_id: string | null;
          stripe_payment_intent: string | null;
          amount_cents: number;
          currency: string;
          status: PaymentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_session_id?: string | null;
          stripe_payment_intent?: string | null;
          amount_cents?: number;
          currency?: string;
          status?: PaymentStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/**
 * Tipos generados desde el schema de Supabase.
 *
 * NO EDITAR A MANO. Regenerar tras cada migración con:
 *   npx supabase gen types typescript --project-id bpitialkrbfgwsriiips > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          external_url: string | null
          file_name: string | null
          id: string
          issue_id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          issue_id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          issue_id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          issue_id: string
          system_reason: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          issue_id: string
          system_reason?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
          system_reason?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          field: string
          id: number
          issue_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          field: string
          id?: number
          issue_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          field?: string
          id?: number
          issue_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issue_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_labels: {
        Row: {
          issue_id: string
          label_id: string
        }
        Insert: {
          issue_id: string
          label_id: string
        }
        Update: {
          issue_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_labels_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_labels_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_labels_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_supporters: {
        Row: {
          created_at: string
          issue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_supporters_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_supporters_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_supporters_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_supporters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issue_supporters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_types: {
        Row: {
          abbrev: string
          archived: boolean
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          order: number
        }
        Insert: {
          abbrev: string
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order?: number
        }
        Update: {
          abbrev?: string
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      issues: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          external_id: string | null
          id: string
          imported: boolean
          number: number
          owner_id: string
          priority_id: string | null
          state: Database["public"]["Enums"]["issue_state"]
          title: string
          type_id: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          imported?: boolean
          number?: number
          owner_id: string
          priority_id?: string | null
          state?: Database["public"]["Enums"]["issue_state"]
          title: string
          type_id: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          imported?: boolean
          number?: number
          owner_id?: string
          priority_id?: string | null
          state?: Database["public"]["Enums"]["issue_state"]
          title?: string
          type_id?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          daily_digest: boolean
          on_assigned: boolean
          on_mention: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_digest?: boolean
          on_assigned?: boolean
          on_mention?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_digest?: boolean
          on_assigned?: boolean
          on_mention?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      priorities: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
          order: number
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          order?: number
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          created_at: string
          filters_json: Json
          id: string
          is_pinned: boolean
          is_shared: boolean
          name: string
          order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          filters_json?: Json
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          name: string
          order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          filters_json?: Json
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          name?: string
          order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          estimation_enabled: boolean
          estimation_scale: string
          id: boolean
          logo_url: string | null
          org_name: string
          updated_at: string
        }
        Insert: {
          estimation_enabled?: boolean
          estimation_scale?: string
          id?: boolean
          logo_url?: string | null
          org_name?: string
          updated_at?: string
        }
        Update: {
          estimation_enabled?: boolean
          estimation_scale?: string
          id?: boolean
          logo_url?: string | null
          org_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_transitions: {
        Row: {
          admin_only: boolean
          from_state: Database["public"]["Enums"]["issue_state"]
          note: string | null
          requires_comment: boolean
          to_state: Database["public"]["Enums"]["issue_state"]
        }
        Insert: {
          admin_only?: boolean
          from_state: Database["public"]["Enums"]["issue_state"]
          note?: string | null
          requires_comment?: boolean
          to_state: Database["public"]["Enums"]["issue_state"]
        }
        Update: {
          admin_only?: boolean
          from_state?: Database["public"]["Enums"]["issue_state"]
          note?: string | null
          requires_comment?: boolean
          to_state?: Database["public"]["Enums"]["issue_state"]
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          density: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          density?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          density?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          capacity: number
          created_at: string
          email: string
          id: string
          job_title: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          capacity?: number
          created_at?: string
          email: string
          id: string
          job_title?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          capacity?: number
          created_at?: string
          email?: string
          id?: string
          job_title?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      aging_wip: {
        Row: {
          aging_level: string | null
          days_idle: number | null
          due_date: string | null
          issue_id: string | null
          number: number | null
          owner_id: string | null
          owner_name: string | null
          state: Database["public"]["Enums"]["issue_state"] | null
          title: string | null
          type_abbrev: string | null
          type_color: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_inbox: {
        Row: {
          created_at: string | null
          creator_id: string | null
          creator_name: string | null
          days_waiting: number | null
          due_date: string | null
          issue_id: string | null
          number: number | null
          owner_id: string | null
          owner_name: string | null
          priority_color: string | null
          priority_name: string | null
          title: string | null
          type_abbrev: string | null
          type_color: string | null
          type_id: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_cycle_times: {
        Row: {
          completed_at: string | null
          cycle_days: number | null
          issue_id: string | null
          number: number | null
          owner_id: string | null
          started_at: string | null
          type_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_state_durations: {
        Row: {
          days_in_state: number | null
          entered_at: string | null
          is_current: boolean | null
          issue_id: string | null
          left_at: string | null
          state: Database["public"]["Enums"]["issue_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_cycle_times"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_timings"
            referencedColumns: ["issue_id"]
          },
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_timings: {
        Row: {
          category: Database["public"]["Enums"]["state_category"] | null
          completed_at: string | null
          created_at: string | null
          days_in_current_state: number | null
          due_date: string | null
          imported: boolean | null
          issue_id: string | null
          number: number | null
          owner_id: string | null
          reopen_count: number | null
          started_at: string | null
          state: Database["public"]["Enums"]["issue_state"] | null
          type_id: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      member_wip: {
        Row: {
          in_progress_count: number | null
          in_review_count: number | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
          wip_count: number | null
          wip_weight: number | null
        }
        Relationships: []
      }
      pending_drafts: {
        Row: {
          pending_count: number | null
        }
        Relationships: []
      }
      weekly_throughput: {
        Row: {
          closed_count: number | null
          closed_weight: number | null
          owner_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "member_wip"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_cycle_time: {
        Row: {
          median_days: number | null
          p85_days: number | null
          sample_size: number | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["issue_state"]
          p_is_admin: boolean
          p_to: Database["public"]["Enums"]["issue_state"]
        }
        Returns: boolean
      }
      can_write: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      counts_in_wip: {
        Args: { s: Database["public"]["Enums"]["issue_state"] }
        Returns: boolean
      }
      current_role_of: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      cycle_time_p85: {
        Args: { p_from?: string; p_owner?: string; p_to?: string }
        Returns: number
      }
      dashboard_summary: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      import_issues: {
        Args: { p_rows: Json }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_importing: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      monthly_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cancelled_count: number
          closed_count: number
          created_count: number
          cycle_p85_days: number
        }[]
      }
      move_issue_state: {
        Args: {
          p_comment?: string
          p_issue_id: string
          p_to_state: Database["public"]["Enums"]["issue_state"]
        }
        Returns: undefined
      }
      stale_issues: {
        Args: { p_days?: number }
        Returns: {
          days_idle: number
          issue_id: string
          number: number
          owner_id: string
          state: Database["public"]["Enums"]["issue_state"]
        }[]
      }
      state_category: {
        Args: { s: Database["public"]["Enums"]["issue_state"] }
        Returns: Database["public"]["Enums"]["state_category"]
      }
      state_order: {
        Args: { s: Database["public"]["Enums"]["issue_state"] }
        Returns: number
      }
      valid_weight: {
        Args: { w: number }
        Returns: boolean
      }
    }
    Enums: {
      attachment_kind: "file" | "link"
      issue_state:
        | "draft"
        | "todo"
        | "in_progress"
        | "in_review"
        | "done"
        | "cancelled"
      state_category:
        | "draft"
        | "unstarted"
        | "started"
        | "completed"
        | "cancelled"
      user_role: "viewer" | "member" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attachment_kind: ["file", "link"],
      issue_state: [
        "draft",
        "todo",
        "in_progress",
        "in_review",
        "done",
        "cancelled",
      ],
      state_category: [
        "draft",
        "unstarted",
        "started",
        "completed",
        "cancelled",
      ],
      user_role: ["viewer", "member", "admin"],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: number
          team_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: never
          team_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: never
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          created_at: string
          default_amount: number
          id: string
          reason: string
          team_id: string
        }
        Insert: {
          created_at?: string
          default_amount: number
          id?: string
          reason: string
          team_id: string
        }
        Update: {
          created_at?: string
          default_amount?: number
          id?: string
          reason?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_types_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          added_by: string
          amount: number
          archived_at: string | null
          created_at: string
          id: string
          member_id: string
          occurred_at: string
          reason: string
          season_label: string | null
          status: string
          team_id: string
        }
        Insert: {
          added_by: string
          amount: number
          archived_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          occurred_at?: string
          reason: string
          season_label?: string | null
          status?: string
          team_id: string
        }
        Update: {
          added_by?: string
          amount?: number
          archived_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          occurred_at?: string
          reason?: string
          season_label?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          global_role: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          global_role?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          global_role?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      suggestion_fees: {
        Row: {
          fee_id: string
          suggestion_id: string
        }
        Insert: {
          fee_id: string
          suggestion_id: string
        }
        Update: {
          fee_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_fees_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_fees_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_votes: {
        Row: {
          created_at: string
          member_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          amount: number
          comment: string | null
          created_at: string
          fee_date: string | null
          id: string
          reason: string
          related_fee_id: string | null
          resolved_at: string | null
          status: string
          suggested_by_member_id: string
          target_member_id: string
          team_id: string
          type: string
        }
        Insert: {
          amount: number
          comment?: string | null
          created_at?: string
          fee_date?: string | null
          id?: string
          reason: string
          related_fee_id?: string | null
          resolved_at?: string | null
          status?: string
          suggested_by_member_id: string
          target_member_id: string
          team_id: string
          type: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string
          fee_date?: string | null
          id?: string
          reason?: string
          related_fee_id?: string | null
          resolved_at?: string | null
          status?: string
          suggested_by_member_id?: string
          target_member_id?: string
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_related_fee_id_fkey"
            columns: ["related_fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_suggested_by_member_id_fkey"
            columns: ["suggested_by_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: string
          status: string
          team_id: string
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          team_id: string
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          team_id?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          allow_player_suggest: boolean
          created_at: string
          currency_symbol: string
          id: string
          invite_code: string
          is_active: boolean
          max_fee_amount: number
          name: string
          season_name: string
          vote_threshold: number
        }
        Insert: {
          allow_player_suggest?: boolean
          created_at?: string
          currency_symbol?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_fee_amount?: number
          name: string
          season_name?: string
          vote_threshold?: number
        }
        Update: {
          allow_player_suggest?: boolean
          created_at?: string
          currency_symbol?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_fee_amount?: number
          name?: string
          season_name?: string
          vote_threshold?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_fee: {
        Args: {
          p_amount: number
          p_fee_date?: string
          p_quantity?: number
          p_reason: string
          p_target_member_id: string
          p_team_id: string
        }
        Returns: string[]
      }
      add_fee_to_username: {
        Args: {
          p_amount: number
          p_fee_date?: string
          p_quantity?: number
          p_reason: string
          p_target_username: string
          p_team_id: string
        }
        Returns: string[]
      }
      add_fee_type: {
        Args: { p_default_amount: number; p_reason: string; p_team_id: string }
        Returns: string
      }
      apply_suggestion: {
        Args: {
          p_suggestion: Database["public"]["Tables"]["suggestions"]["Row"]
        }
        Returns: undefined
      }
      archive_season: {
        Args: { p_season_label: string; p_team_id: string }
        Returns: number
      }
      bulk_move_fees: {
        Args: {
          p_from_member_id: string
          p_team_id: string
          p_to_member_id: string
        }
        Returns: number
      }
      create_team: {
        Args: { p_creator_username: string; p_name: string }
        Returns: Json
      }
      delete_fee: {
        Args: { p_fee_id: string; p_team_id: string }
        Returns: undefined
      }
      delete_fee_type: { Args: { p_fee_type_id: string }; Returns: undefined }
      display_name: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      generate_invite_code: { Args: never; Returns: string }
      get_invite_code: { Args: { p_team_id: string }; Returns: string }
      has_team_role: {
        Args: { p_roles: string[]; p_team: string; p_user: string }
        Returns: boolean
      }
      is_global_admin: { Args: { p_user: string }; Returns: boolean }
      is_team_member: {
        Args: { p_team: string; p_user: string }
        Returns: boolean
      }
      join_team: {
        Args: { p_invite_code: string; p_username: string }
        Returns: Json
      }
      leave_team: { Args: { p_team_id: string }; Returns: undefined }
      log_audit: {
        Args: { p_action: string; p_details: Json; p_team_id: string }
        Returns: undefined
      }
      parse_fee_date: { Args: { p_date: string }; Returns: string }
      regenerate_invite_code: { Args: { p_team_id: string }; Returns: string }
      save_team_settings: {
        Args: {
          p_allow_player_suggest?: boolean
          p_currency_symbol?: string
          p_max_fee_amount?: number
          p_season_name?: string
          p_team_id: string
          p_vote_threshold?: number
        }
        Returns: undefined
      }
      set_global_admin: {
        Args: { p_make_admin: boolean; p_target_user_id: string }
        Returns: undefined
      }
      set_team_active: {
        Args: { p_is_active: boolean; p_team_id: string }
        Returns: undefined
      }
      set_team_role: {
        Args: { p_member_id: string; p_new_role: string; p_team_id: string }
        Returns: undefined
      }
      suggest_fee: {
        Args: {
          p_amount: number
          p_fee_date?: string
          p_reason: string
          p_target_member_id: string
          p_team_id: string
        }
        Returns: Json
      }
      suggest_mark_all_paid: {
        Args: { p_comment: string; p_team_id: string }
        Returns: string
      }
      suggest_mark_paid: {
        Args: { p_comment: string; p_fee_id: string; p_team_id: string }
        Returns: string
      }
      suggest_removal: {
        Args: { p_comment: string; p_fee_id: string; p_team_id: string }
        Returns: string
      }
      team_role: { Args: { p_team: string; p_user: string }; Returns: string }
      username_exists: { Args: { p_username: string }; Returns: boolean }
      vote_on_suggestion: {
        Args: {
          p_approve: boolean
          p_comment?: string
          p_suggestion_id: string
          p_team_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

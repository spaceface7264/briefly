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
  public: {
    Tables: {
      briefs: {
        Row: {
          category: Database["public"]["Enums"]["brief_category"]
          claim_expires_at: string | null
          claim_limit: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deliverable_specs: Json | null
          description: string
          format: Database["public"]["Enums"]["brief_format"]
          gym: string | null
          id: string
          is_ad_intended: boolean
          price_dkk: number
          reference_urls: string[] | null
          status: Database["public"]["Enums"]["brief_status"]
          title: string
          updated_at: string
          usage_rights: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["brief_category"]
          claim_expires_at?: string | null
          claim_limit?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_specs?: Json | null
          description: string
          format: Database["public"]["Enums"]["brief_format"]
          gym?: string | null
          id?: string
          is_ad_intended?: boolean
          price_dkk: number
          reference_urls?: string[] | null
          status?: Database["public"]["Enums"]["brief_status"]
          title: string
          updated_at?: string
          usage_rights?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["brief_category"]
          claim_expires_at?: string | null
          claim_limit?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_specs?: Json | null
          description?: string
          format?: Database["public"]["Enums"]["brief_format"]
          gym?: string | null
          id?: string
          is_ad_intended?: boolean
          price_dkk?: number
          reference_urls?: string[] | null
          status?: Database["public"]["Enums"]["brief_status"]
          title?: string
          updated_at?: string
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          brief_id: string
          claimed_at: string
          created_at: string
          expires_at: string
          id: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_id: string
          claimed_at?: string
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_id?: string
          claimed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          instagram_handle: string | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          instagram_handle?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          instagram_handle?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_claim_count: { Args: { brief_uuid: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      user_has_claimed: { Args: { brief_uuid: string }; Returns: boolean }
    }
    Enums: {
      brief_category: "entertaining" | "ad" | "guide" | "event" | "community"
      brief_format: "reel" | "tiktok" | "youtube_short" | "long_form" | "photo"
      brief_status:
        | "open"
        | "claimed"
        | "submitted"
        | "approved"
        | "paid"
        | "archived"
      user_role: "creator" | "admin"
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
      brief_category: ["entertaining", "ad", "guide", "event", "community"],
      brief_format: ["reel", "tiktok", "youtube_short", "long_form", "photo"],
      brief_status: [
        "open",
        "claimed",
        "submitted",
        "approved",
        "paid",
        "archived",
      ],
      user_role: ["creator", "admin"],
    },
  },
} as const

// Helper type exports
export type Profile = Tables<"profiles">;
export type Brief = Tables<"briefs">;
export type Claim = Tables<"claims">;

export type BriefCategory = Enums<"brief_category">;
export type BriefFormat = Enums<"brief_format">;
export type BriefStatus = Enums<"brief_status">;
export type UserRole = Enums<"user_role">;
export type ClaimStatus = "active" | "submitted" | "approved" | "paid" | "cancelled";

// Brief with claim count for display
export type BriefWithClaims = Brief & {
  claim_count: number;
  user_has_claimed: boolean;
};

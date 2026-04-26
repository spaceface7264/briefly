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
          org_id: string
          deadline: string | null
          deliverable_specs: Json | null
          description: string
          duration_class: Database["public"]["Enums"]["brief_duration_class"]
          location: string | null
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
          duration_class: Database["public"]["Enums"]["brief_duration_class"]
          location?: string | null
          id?: string
          is_ad_intended?: boolean
          org_id?: string
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
          duration_class?: Database["public"]["Enums"]["brief_duration_class"]
          location?: string | null
          id?: string
          is_ad_intended?: boolean
          org_id?: string
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
      notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          org_id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          dedupe_key: string
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          metadata: Json
          org_id: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          dedupe_key: string
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          metadata?: Json
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string
          entity_id?: string
          entity_type?: string
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          metadata?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_postal_code: string | null
          country: string | null
          created_at: string
          cvr_number: string | null
          email: string | null
          id: string
          instagram_handle: string | null
          is_platform_admin: boolean
          name: string | null
          notify_applications: boolean
          notify_claim_queue: boolean
          notify_claim_updates: boolean
          notify_new_briefs: boolean
          notify_payments: boolean
          notify_submissions: boolean
          role: Database["public"]["Enums"]["user_role"]
          self_billing_agreement_accepted_at: string | null
          self_billing_agreement_version: string | null
          stripe_account_id: string | null
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          tags: string[] | null
          updated_at: string
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          active_org_id?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          country?: string | null
          created_at?: string
          cvr_number?: string | null
          email?: string | null
          id: string
          instagram_handle?: string | null
          is_platform_admin?: boolean
          name?: string | null
          notify_applications?: boolean
          notify_claim_queue?: boolean
          notify_claim_updates?: boolean
          notify_new_briefs?: boolean
          notify_payments?: boolean
          notify_submissions?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          self_billing_agreement_accepted_at?: string | null
          self_billing_agreement_version?: string | null
          stripe_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          tags?: string[] | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          active_org_id?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          country?: string | null
          created_at?: string
          cvr_number?: string | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          is_platform_admin?: boolean
          name?: string | null
          notify_applications?: boolean
          notify_claim_queue?: boolean
          notify_claim_updates?: boolean
          notify_new_briefs?: boolean
          notify_payments?: boolean
          notify_submissions?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          self_billing_agreement_accepted_at?: string | null
          self_billing_agreement_version?: string | null
          stripe_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          tags?: string[] | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_dkk: number
          org_id: string
          brief_title_snapshot: string | null
          claim_id: string
          created_at: string
          creator_address_snapshot: string | null
          creator_country_snapshot: string | null
          creator_cvr_snapshot: string | null
          creator_id: string
          creator_name_snapshot: string | null
          creator_vat_number_snapshot: string | null
          error_message: string | null
          gross_dkk: number
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          invoice_seq: number | null
          invoice_year: number | null
          paid_by: string | null
          platform_address_snapshot: string | null
          platform_cvr_snapshot: string | null
          platform_fee_bp: number
          platform_fee_dkk: number
          platform_name_snapshot: string | null
          platform_vat_snapshot: string | null
          self_billing_agreement_version_snapshot: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_account_id: string
          stripe_transfer_id: string | null
          subtotal_dkk: number | null
          total_dkk: number | null
          updated_at: string
          vat_amount_dkk: number
          vat_rate_bp: number
          vat_scheme: Database["public"]["Enums"]["vat_scheme"]
        }
        Insert: {
          amount_dkk: number
          brief_title_snapshot?: string | null
          claim_id: string
          created_at?: string
          creator_address_snapshot?: string | null
          org_id?: string
          creator_country_snapshot?: string | null
          creator_cvr_snapshot?: string | null
          creator_id: string
          creator_name_snapshot?: string | null
          creator_vat_number_snapshot?: string | null
          error_message?: string | null
          gross_dkk: number
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          invoice_seq?: number | null
          invoice_year?: number | null
          paid_by?: string | null
          platform_address_snapshot?: string | null
          platform_cvr_snapshot?: string | null
          platform_fee_bp?: number
          platform_fee_dkk?: number
          platform_name_snapshot?: string | null
          platform_vat_snapshot?: string | null
          self_billing_agreement_version_snapshot?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id: string
          stripe_transfer_id?: string | null
          subtotal_dkk?: number | null
          total_dkk?: number | null
          updated_at?: string
          vat_amount_dkk?: number
          vat_rate_bp?: number
          vat_scheme?: Database["public"]["Enums"]["vat_scheme"]
        }
        Update: {
          amount_dkk?: number
          brief_title_snapshot?: string | null
          claim_id?: string
          created_at?: string
          creator_address_snapshot?: string | null
          creator_country_snapshot?: string | null
          creator_cvr_snapshot?: string | null
          creator_id?: string
          creator_name_snapshot?: string | null
          creator_vat_number_snapshot?: string | null
          error_message?: string | null
          gross_dkk?: number
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          invoice_seq?: number | null
          invoice_year?: number | null
          paid_by?: string | null
          platform_address_snapshot?: string | null
          platform_cvr_snapshot?: string | null
          platform_fee_bp?: number
          platform_fee_dkk?: number
          platform_name_snapshot?: string | null
          platform_vat_snapshot?: string | null
          self_billing_agreement_version_snapshot?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_account_id?: string
          stripe_transfer_id?: string | null
          subtotal_dkk?: number | null
          total_dkk?: number | null
          updated_at?: string
          vat_amount_dkk?: number
          vat_rate_bp?: number
          vat_scheme?: Database["public"]["Enums"]["vat_scheme"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_applications: {
        Row: {
          id: string
          user_id: string
          org_id: string
          message: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          message?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          message?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          logo_url: string | null
          accent_color: string | null
          description: string | null
          discoverable: boolean
          industry: string | null
          currency: string
          country: string
          address: string | null
          cvr: string | null
          vat_number: string | null
          contact_email: string | null
          sender_name: string | null
          sender_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_url?: string | null
          accent_color?: string | null
          description?: string | null
          discoverable?: boolean
          industry?: string | null
          currency?: string
          country?: string
          address?: string | null
          cvr?: string | null
          vat_number?: string | null
          contact_email?: string | null
          sender_name?: string | null
          sender_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          logo_url?: string | null
          accent_color?: string | null
          description?: string | null
          discoverable?: boolean
          industry?: string | null
          currency?: string
          country?: string
          address?: string | null
          cvr?: string | null
          vat_number?: string | null
          contact_email?: string | null
          sender_name?: string | null
          sender_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          id: string
          org_id: string
          plan_id: string
          status: string
          billing_interval: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          trial_end: string | null
          canceled_at: string | null
          paused_until: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          plan_id: string
          status?: string
          billing_interval?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          canceled_at?: string | null
          paused_until?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          billing_interval?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          canceled_at?: string | null
          paused_until?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_overrides: {
        Row: {
          id: string
          scope_org_id: string | null
          scope_user_id: string | null
          kind: string
          value: Json
          reason: string
          granted_by: string
          granted_at: string
          expires_at: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          kind: string
          value: Json
          reason: string
          granted_by: string
          granted_at?: string
          expires_at?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          kind?: string
          value?: Json
          reason?: string
          granted_by?: string
          granted_at?: string
          expires_at?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_overrides_scope_org_id_fkey"
            columns: ["scope_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_overrides_scope_user_id_fkey"
            columns: ["scope_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          scope_org_id: string | null
          scope_user_id: string | null
          before: Json | null
          after: Json | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          before?: Json | null
          after?: Json | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          before?: Json | null
          after?: Json | null
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          monthly_price_dkk: number
          annual_price_dkk: number
          default_fee_bp: number
          trial_days: number
          limits: Json
          features: Json
          visible: boolean
          legacy: boolean
          private_to_org_id: string | null
          stripe_monthly_price_id: string | null
          stripe_annual_price_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          monthly_price_dkk?: number
          annual_price_dkk?: number
          default_fee_bp?: number
          trial_days?: number
          limits?: Json
          features?: Json
          visible?: boolean
          legacy?: boolean
          private_to_org_id?: string | null
          stripe_monthly_price_id?: string | null
          stripe_annual_price_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          monthly_price_dkk?: number
          annual_price_dkk?: number
          default_fee_bp?: number
          trial_days?: number
          limits?: Json
          features?: Json
          visible?: boolean
          legacy?: boolean
          private_to_org_id?: string | null
          stripe_monthly_price_id?: string | null
          stripe_annual_price_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_private_to_org_id_fkey"
            columns: ["private_to_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_application: { Args: { p_application_id: string; p_admin_id: string }; Returns: boolean }
      allocate_invoice_number: { Args: { p_org_id: string; p_year: number }; Returns: number }
      create_notification_for_user: {
        Args: {
          p_actor_id: string
          p_body: string
          p_dedupe_key: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: Database["public"]["Enums"]["notification_event_type"]
          p_metadata: Json
          p_recipient_id: string
          p_title: string
        }
        Returns: undefined
      }
      expire_stale_claims: { Args: never; Returns: number }
      get_active_claim_count: { Args: { brief_uuid: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      user_has_claimed: { Args: { brief_uuid: string }; Returns: boolean }
    }
    Enums: {
      brief_category: "entertaining" | "ad" | "guide" | "event" | "community"
      brief_duration_class: "short" | "medium" | "long" | "static"
      brief_status:
        | "open"
        | "claimed"
        | "submitted"
        | "approved"
        | "paid"
        | "archived"
      notification_event_type:
        | "claim_created"
        | "claim_submitted"
        | "claim_approved"
        | "claim_rejected"
        | "claim_paid"
        | "claim_released"
        | "claim_expired"
        | "brief_published"
        | "application_received"
        | "application_approved"
        | "application_rejected"
      payment_status: "pending" | "succeeded" | "failed"
      user_role: "creator" | "admin"
      vat_scheme: "none" | "standard" | "reverse_charge"
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
      brief_duration_class: ["short", "medium", "long", "static"],
      brief_status: [
        "open",
        "claimed",
        "submitted",
        "approved",
        "paid",
        "archived",
      ],
      notification_event_type: [
        "claim_created",
        "claim_submitted",
        "claim_approved",
        "claim_rejected",
        "claim_paid",
        "claim_released",
        "claim_expired",
        "brief_published",
        "application_received",
        "application_approved",
        "application_rejected",
      ],
      payment_status: ["pending", "succeeded", "failed"],
      user_role: ["creator", "admin"],
      vat_scheme: ["none", "standard", "reverse_charge"],
    },
  },
} as const

// Helper type exports
export type Profile = Tables<"profiles">;
export type Brief = Tables<"briefs">;
export type Claim = Tables<"claims">;
export type Notification = Tables<"notifications">;
export type NotificationOutbox = Tables<"notification_outbox">;
export type Payment = Tables<"payments">;
export type PricingPlanRow = Tables<"pricing_plans">;
export type PricingOverrideRow = Tables<"pricing_overrides">;
export type PricingAuditLogRow = Tables<"pricing_audit_log">;
export type OrgSubscriptionRow = Tables<"org_subscriptions">;

export type BriefCategory = Enums<"brief_category">;
export type BriefDurationClass = Enums<"brief_duration_class">;
export type BriefStatus = Enums<"brief_status">;
export type PaymentStatus = Enums<"payment_status">;
export type NotificationEventType = Enums<"notification_event_type">;
export type VatScheme = Enums<"vat_scheme">;
export type UserRole = Enums<"user_role">;
export type ClaimStatus = "active" | "submitted" | "approved" | "paid" | "cancelled";

// Brief with claim count for display
export type BriefWithClaims = Brief & {
  claim_count: number;
  user_has_claimed: boolean;
};

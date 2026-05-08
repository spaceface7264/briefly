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
      brand_kits: {
        Row: {
          colors: Json
          created_at: string
          guidelines_url: string | null
          logo_dark_url: string | null
          logo_light_url: string | null
          logo_mark_url: string | null
          notes: string | null
          org_id: string
          typography: Json
          updated_at: string
        }
        Insert: {
          colors?: Json
          created_at?: string
          guidelines_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          notes?: string | null
          org_id: string
          typography?: Json
          updated_at?: string
        }
        Update: {
          colors?: Json
          created_at?: string
          guidelines_url?: string | null
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_mark_url?: string | null
          notes?: string | null
          org_id?: string
          typography?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          category: Database["public"]["Enums"]["brief_category"]
          claim_limit: number
          created_at: string
          created_by: string | null
          deadline: string | null
          deliverable_specs: Json | null
          description: string
          duration_class: Database["public"]["Enums"]["brief_duration_class"]
          escrow_amount_dkk: number | null
          escrow_held_dkk: number | null
          funded_status: Database["public"]["Enums"]["brief_funded_status"]
          id: string
          is_ad_intended: boolean
          location: string | null
          org_id: string
          overage_charge_dkk: number | null
          overage_payment_intent_id: string | null
          price_dkk: number
          published_at: string | null
          reference_urls: string[] | null
          status: Database["public"]["Enums"]["brief_status"]
          stripe_payment_intent_id: string | null
          title: string
          updated_at: string
          usage_rights: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["brief_category"]
          claim_limit?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_specs?: Json | null
          description: string
          duration_class?: Database["public"]["Enums"]["brief_duration_class"]
          escrow_amount_dkk?: number | null
          escrow_held_dkk?: number | null
          funded_status?: Database["public"]["Enums"]["brief_funded_status"]
          id?: string
          is_ad_intended?: boolean
          location?: string | null
          org_id: string
          overage_charge_dkk?: number | null
          overage_payment_intent_id?: string | null
          price_dkk: number
          published_at?: string | null
          reference_urls?: string[] | null
          status?: Database["public"]["Enums"]["brief_status"]
          stripe_payment_intent_id?: string | null
          title: string
          updated_at?: string
          usage_rights?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["brief_category"]
          claim_limit?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_specs?: Json | null
          description?: string
          duration_class?: Database["public"]["Enums"]["brief_duration_class"]
          escrow_amount_dkk?: number | null
          escrow_held_dkk?: number | null
          funded_status?: Database["public"]["Enums"]["brief_funded_status"]
          id?: string
          is_ad_intended?: boolean
          location?: string | null
          org_id?: string
          overage_charge_dkk?: number | null
          overage_payment_intent_id?: string | null
          price_dkk?: number
          published_at?: string | null
          reference_urls?: string[] | null
          status?: Database["public"]["Enums"]["brief_status"]
          stripe_payment_intent_id?: string | null
          title?: string
          updated_at?: string
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_attachments: {
        Row: {
          claim_id: string
          created_at: string
          file_size: number
          filename: string
          id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          file_size: number
          filename: string
          id?: string
          mime_type: string
          storage_path: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_attachments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
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
          submission_notes: string | null
          submission_url: string | null
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
          org_id: string
          status?: string
          submission_notes?: string | null
          submission_url?: string | null
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
          submission_notes?: string | null
          submission_url?: string | null
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
            foreignKeyName: "claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          intended_account_type: string
          org_id: string
          role: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          intended_account_type?: string
          org_id: string
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          intended_account_type?: string
          org_id?: string
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          last_seq: number
          org_id: string
          year: number
        }
        Insert: {
          last_seq?: number
          org_id: string
          year: number
        }
        Update: {
          last_seq?: number
          org_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
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
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id?: string
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
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      org_applications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          billing_interval: string
          briefs_published_this_period: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          paused_until: string | null
          period_anchor: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          briefs_published_this_period?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          paused_until?: string | null
          period_anchor?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          briefs_published_this_period?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          paused_until?: string | null
          period_anchor?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
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
      organizations: {
        Row: {
          accent_color: string | null
          address: string | null
          archived_at: string | null
          contact_email: string | null
          country: string
          created_at: string
          currency: string
          cvr: string | null
          default_payment_method_id: string | null
          description: string | null
          discoverable: boolean
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          sender_email: string | null
          sender_name: string | null
          slug: string
          status: string
          stripe_customer_id: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          archived_at?: string | null
          contact_email?: string | null
          country?: string
          created_at?: string
          currency?: string
          cvr?: string | null
          default_payment_method_id?: string | null
          description?: string | null
          discoverable?: boolean
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          slug: string
          status?: string
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          archived_at?: string | null
          contact_email?: string | null
          country?: string
          created_at?: string
          currency?: string
          cvr?: string | null
          default_payment_method_id?: string | null
          description?: string | null
          discoverable?: boolean
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_dkk: number
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string | null
          target_org_id: string | null
          target_row_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_org_id?: string | null
          target_row_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_org_id?: string | null
          target_row_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_audit_log_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string | null
          scope_org_id: string | null
          scope_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          scope_org_id?: string | null
          scope_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          scope_org_id?: string | null
          scope_user_id?: string | null
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
      pricing_overrides: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          kind: string
          reason: string
          scope_org_id: string | null
          scope_user_id: string | null
          value: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          kind: string
          reason: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          value: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          kind?: string
          reason?: string
          scope_org_id?: string | null
          scope_user_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pricing_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
        ]
      }
      pricing_plans: {
        Row: {
          annual_price_dkk: number
          created_at: string
          default_fee_bp: number
          description: string | null
          features: Json
          id: string
          legacy: boolean
          limits: Json
          monthly_brief_allowance: number | null
          monthly_price_dkk: number
          name: string
          overage_dkk_per_brief: number | null
          private_to_org_id: string | null
          slug: string
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          trial_days: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          annual_price_dkk?: number
          created_at?: string
          default_fee_bp?: number
          description?: string | null
          features?: Json
          id?: string
          legacy?: boolean
          limits?: Json
          monthly_brief_allowance?: number | null
          monthly_price_dkk?: number
          name: string
          overage_dkk_per_brief?: number | null
          private_to_org_id?: string | null
          slug: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          trial_days?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          annual_price_dkk?: number
          created_at?: string
          default_fee_bp?: number
          description?: string | null
          features?: Json
          id?: string
          legacy?: boolean
          limits?: Json
          monthly_brief_allowance?: number | null
          monthly_price_dkk?: number
          name?: string
          overage_dkk_per_brief?: number | null
          private_to_org_id?: string | null
          slug?: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          trial_days?: number
          updated_at?: string
          visible?: boolean
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
      profiles: {
        Row: {
          account_type: string
          active_org_id: string | null
          avatar_url: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_postal_code: string | null
          bio: string | null
          country: string | null
          created_at: string
          cvr_number: string | null
          email: string | null
          id: string
          instagram_handle: string | null
          is_platform_admin: boolean
          languages: string[]
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
          skills: string[]
          stripe_account_id: string | null
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          support_org_id: string | null
          tags: string[] | null
          updated_at: string
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          account_type?: string
          active_org_id?: string | null
          avatar_url?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          cvr_number?: string | null
          email?: string | null
          id: string
          instagram_handle?: string | null
          is_platform_admin?: boolean
          languages?: string[]
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
          skills?: string[]
          stripe_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          support_org_id?: string | null
          tags?: string[] | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          account_type?: string
          active_org_id?: string | null
          avatar_url?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          cvr_number?: string | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          is_platform_admin?: boolean
          languages?: string[]
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
          skills?: string[]
          stripe_account_id?: string | null
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          support_org_id?: string | null
          tags?: string[] | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_support_org_id_fkey"
            columns: ["support_org_id"]
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
      active_org_id: { Args: never; Returns: string }
      allocate_invoice_number:
        | { Args: { p_org_id: string; p_year: number }; Returns: number }
        | { Args: { p_year: number }; Returns: number }
      approve_application: {
        Args: { p_admin_id: string; p_application_id: string }
        Returns: boolean
      }
      commit_brief_publish: {
        Args: { p_org_id: string }
        Returns: {
          new_count: number
          period_anchor: string
        }[]
      }
      create_notification_for_user:
        | {
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
        | {
            Args: {
              p_actor_id: string
              p_body: string
              p_dedupe_key: string
              p_entity_id: string
              p_entity_type: string
              p_event_type: Database["public"]["Enums"]["notification_event_type"]
              p_metadata: Json
              p_org_id?: string
              p_recipient_id: string
              p_title: string
            }
            Returns: undefined
          }
      current_account_type: { Args: never; Returns: string }
      decrement_brief_publish: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      effective_brief_allowance: { Args: { p_org_id: string }; Returns: number }
      effective_org_limit: {
        Args: { p_limit_key: string; p_org_id: string }
        Returns: number
      }
      effective_overage_rate: { Args: { p_org_id: string }; Returns: number }
      expire_stale_claims: { Args: never; Returns: number }
      get_active_claim_count: { Args: { brief_uuid: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_org_account: { Args: never; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      notify_admins:
        | {
            Args: {
              p_actor_id: string
              p_body: string
              p_dedupe_key: string
              p_entity_id: string
              p_entity_type: string
              p_event_type: Database["public"]["Enums"]["notification_event_type"]
              p_metadata: Json
              p_title: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_actor_id: string
              p_body: string
              p_dedupe_key: string
              p_entity_id: string
              p_entity_type: string
              p_event_type: Database["public"]["Enums"]["notification_event_type"]
              p_metadata: Json
              p_org_id: string
              p_title: string
            }
            Returns: undefined
          }
      notify_creators:
        | {
            Args: {
              p_actor_id: string
              p_body: string
              p_dedupe_key: string
              p_entity_id: string
              p_entity_type: string
              p_event_type: Database["public"]["Enums"]["notification_event_type"]
              p_metadata: Json
              p_title: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_actor_id: string
              p_body: string
              p_dedupe_key: string
              p_entity_id: string
              p_entity_type: string
              p_event_type: Database["public"]["Enums"]["notification_event_type"]
              p_metadata: Json
              p_org_id: string
              p_title: string
            }
            Returns: undefined
          }
      release_escrow_slot: {
        Args: { p_brief_id: string; p_slot_dkk: number }
        Returns: {
          new_held: number
          new_status: Database["public"]["Enums"]["brief_funded_status"]
        }[]
      }
      reset_brief_publish_period: {
        Args: { p_anchor?: string; p_org_id: string }
        Returns: undefined
      }
      restore_escrow_slot: {
        Args: { p_brief_id: string; p_slot_dkk: number }
        Returns: undefined
      }
      use_invite_code: {
        Args: { invite_code: string; user_uuid: string }
        Returns: boolean
      }
      user_has_claimed: { Args: { brief_uuid: string }; Returns: boolean }
      user_not_in_reclaim_cooldown: {
        Args: { brief_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      brief_category: "entertaining" | "ad" | "guide" | "event" | "community"
      brief_duration_class: "short" | "medium" | "long" | "static"
      brief_funded_status:
        | "unfunded"
        | "funded"
        | "partially_released"
        | "released"
        | "refunded"
      brief_status:
        | "open"
        | "claimed"
        | "submitted"
        | "approved"
        | "paid"
        | "archived"
        | "draft"
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
      user_role: "creator" | "admin" | "member"
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
      brief_funded_status: [
        "unfunded",
        "funded",
        "partially_released",
        "released",
        "refunded",
      ],
      brief_status: [
        "open",
        "claimed",
        "submitted",
        "approved",
        "paid",
        "archived",
        "draft",
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
      user_role: ["creator", "admin", "member"],
      vat_scheme: ["none", "standard", "reverse_charge"],
    },
  },
} as const

// ============================================================
// Hand-maintained helper aliases.
//
// IMPORTANT: regenerating this file via `supabase gen types`
// will overwrite the auto-generated portion above, but the
// helpers below must be re-appended afterward. The codebase
// imports these from "@/types/database".
// ============================================================

export type Profile = Tables<"profiles">;
export type BrandKit = Tables<"brand_kits">;
export type Brief = Tables<"briefs">;
export type Claim = Tables<"claims">;
export type ClaimAttachment = Tables<"claim_attachments">;
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
export type BriefFundedStatus = Enums<"brief_funded_status">;
export type PaymentStatus = Enums<"payment_status">;
export type NotificationEventType = Enums<"notification_event_type">;
export type VatScheme = Enums<"vat_scheme">;
export type UserRole = Enums<"user_role">;
export type ClaimStatus = "active" | "submitted" | "approved" | "paid" | "cancelled";

// Brief enriched with per-user/per-list claim metadata for display.
export type BriefWithClaims = Brief & {
  claim_count: number;
  user_has_claimed: boolean;
};

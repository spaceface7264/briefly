export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BriefCategory =
  | "entertaining"
  | "ad"
  | "guide"
  | "event"
  | "community";

export type BriefFormat =
  | "reel"
  | "tiktok"
  | "youtube_short"
  | "long_form"
  | "photo";

export type BriefStatus =
  | "open"
  | "claimed"
  | "submitted"
  | "approved"
  | "paid"
  | "archived";

export type UserRole = "creator" | "admin";

export type ClaimStatus = "active" | "submitted" | "approved" | "paid" | "cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          instagram_handle: string | null;
          tags: string[];
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email?: string | null;
          instagram_handle?: string | null;
          tags?: string[];
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          instagram_handle?: string | null;
          tags?: string[];
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      briefs: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: BriefCategory;
          format: BriefFormat;
          price_dkk: number;
          deadline: string | null;
          gym: string | null;
          reference_urls: string[];
          deliverable_specs: Json;
          usage_rights: string | null;
          status: BriefStatus;
          claim_limit: number;
          claimed_by: string | null;
          claimed_at: string | null;
          claim_expires_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          category: BriefCategory;
          format: BriefFormat;
          price_dkk: number;
          deadline?: string | null;
          gym?: string | null;
          reference_urls?: string[];
          deliverable_specs?: Json;
          usage_rights?: string | null;
          status?: BriefStatus;
          claim_limit?: number;
          claimed_by?: string | null;
          claimed_at?: string | null;
          claim_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: BriefCategory;
          format?: BriefFormat;
          price_dkk?: number;
          deadline?: string | null;
          gym?: string | null;
          reference_urls?: string[];
          deliverable_specs?: Json;
          usage_rights?: string | null;
          status?: BriefStatus;
          claim_limit?: number;
          claimed_by?: string | null;
          claimed_at?: string | null;
          claim_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      claims: {
        Row: {
          id: string;
          brief_id: string;
          user_id: string;
          status: ClaimStatus;
          claimed_at: string;
          expires_at: string;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brief_id: string;
          user_id: string;
          status?: ClaimStatus;
          claimed_at?: string;
          expires_at: string;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brief_id?: string;
          user_id?: string;
          status?: ClaimStatus;
          claimed_at?: string;
          expires_at?: string;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Enums: {
      brief_category: BriefCategory;
      brief_format: BriefFormat;
      brief_status: BriefStatus;
      user_role: UserRole;
      claim_status: ClaimStatus;
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Brief = Database["public"]["Tables"]["briefs"]["Row"];
export type Claim = Database["public"]["Tables"]["claims"]["Row"];

// Brief with claim count for display
export type BriefWithClaims = Brief & {
  claim_count: number;
  user_has_claimed: boolean;
};

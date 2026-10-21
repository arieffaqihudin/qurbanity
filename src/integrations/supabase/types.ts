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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      animal_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["animal_kind"]
          max_shares: number
          name: string
          program_id: string
          sort_order: number
          updated_at: string
          weight_range: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["animal_kind"]
          max_shares: number
          name: string
          program_id: string
          sort_order?: number
          updated_at?: string
          weight_range?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["animal_kind"]
          max_shares?: number
          name?: string
          program_id?: string
          sort_order?: number
          updated_at?: string
          weight_range?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animal_categories_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_prices: {
        Row: {
          animal_cost: number
          category_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_final: boolean
          note: string | null
          operational_cost: number
        }
        Insert: {
          animal_cost: number
          category_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_final?: boolean
          note?: string | null
          operational_cost: number
        }
        Update: {
          animal_cost?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_final?: boolean
          note?: string | null
          operational_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "animal_prices_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      contract_consents: {
        Row: {
          commitment_id: string
          consented_at: string
          contract_code: string
          contract_status_at_consent: Database["public"]["Enums"]["contract_status"]
          contract_version: string
          contract_version_id: string
          decision: Database["public"]["Enums"]["consent_decision"]
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          commitment_id: string
          consented_at?: string
          contract_code: string
          contract_status_at_consent: Database["public"]["Enums"]["contract_status"]
          contract_version: string
          contract_version_id: string
          decision: Database["public"]["Enums"]["consent_decision"]
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          commitment_id?: string
          consented_at?: string
          contract_code?: string
          contract_status_at_consent?: Database["public"]["Enums"]["contract_status"]
          contract_version?: string
          contract_version_id?: string
          decision?: Database["public"]["Enums"]["consent_decision"]
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_consents_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_consents_contract_version_id_fkey"
            columns: ["contract_version_id"]
            isOneToOne: false
            referencedRelation: "contract_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          approved_at: string | null
          body: string
          contract_code: string
          created_at: string
          id: string
          is_active: boolean
          is_mandatory: boolean
          program_id: string
          status: Database["public"]["Enums"]["contract_status"]
          summary: string
          title: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          body: string
          contract_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          program_id: string
          status?: Database["public"]["Enums"]["contract_status"]
          summary: string
          title: string
          version: string
        }
        Update: {
          approved_at?: string | null
          body?: string
          contract_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          program_id?: string
          status?: Database["public"]["Enums"]["contract_status"]
          summary?: string
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          journey_updates: boolean
          payment_reminders: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          email_enabled?: boolean
          journey_updates?: boolean
          payment_reminders?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          email_enabled?: boolean
          journey_updates?: boolean
          payment_reminders?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      participant_publication_consents: {
        Row: {
          commitment_id: string | null
          created_at: string
          id: string
          preference: Database["public"]["Enums"]["publication_preference"]
          user_id: string
        }
        Insert: {
          commitment_id?: string | null
          created_at?: string
          id?: string
          preference: Database["public"]["Enums"]["publication_preference"]
          user_id: string
        }
        Update: {
          commitment_id?: string | null
          created_at?: string
          id?: string
          preference?: Database["public"]["Enums"]["publication_preference"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_publication_consents_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          commitment_id: string
          created_at: string
          deadline: string
          frequency: Database["public"]["Enums"]["payment_frequency"]
          id: string
          periods: number
          suggested_amount: number
          updated_at: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          deadline: string
          frequency: Database["public"]["Enums"]["payment_frequency"]
          id?: string
          periods: number
          suggested_amount: number
          updated_at?: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          deadline?: string
          frequency?: Database["public"]["Enums"]["payment_frequency"]
          id?: string
          periods?: number
          suggested_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: true
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          birth_date: string
          created_at: string
          email: string
          full_name: string
          id: string
          terms_accepted_at: string | null
          updated_at: string
          whatsapp: string
          whatsapp_consent: boolean
        }
        Insert: {
          address: string
          birth_date: string
          created_at?: string
          email: string
          full_name: string
          id: string
          terms_accepted_at?: string | null
          updated_at?: string
          whatsapp: string
          whatsapp_consent?: boolean
        }
        Update: {
          address?: string
          birth_date?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          terms_accepted_at?: string | null
          updated_at?: string
          whatsapp?: string
          whatsapp_consent?: boolean
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          created_at: string
          hijri_year: number
          id: string
          iduladha_date: string
          name: string
          payment_deadline: string
          status: Database["public"]["Enums"]["program_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          hijri_year: number
          id?: string
          iduladha_date: string
          name: string
          payment_deadline: string
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          hijri_year?: number
          id?: string
          iduladha_date?: string
          name?: string
          payment_deadline?: string
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
        }
        Relationships: []
      }
      qurban_commitments: {
        Row: {
          animal_cost_snapshot: number
          animal_kind_snapshot: Database["public"]["Enums"]["animal_kind"]
          animal_label: string | null
          category_id: string
          category_name_snapshot: string
          code: string
          created_at: string
          execution_status: Database["public"]["Enums"]["execution_status"]
          id: string
          operational_cost_snapshot: number
          payment_status: string | null
          price_id: string
          price_per_share_snapshot: number
          program_id: string
          rounding_adjustment: number
          shares: number
          total_amount: number
          updated_at: string
          user_id: string
          verified_paid_amount: number
        }
        Insert: {
          animal_cost_snapshot: number
          animal_kind_snapshot: Database["public"]["Enums"]["animal_kind"]
          animal_label?: string | null
          category_id: string
          category_name_snapshot: string
          code: string
          created_at?: string
          execution_status?: Database["public"]["Enums"]["execution_status"]
          id?: string
          operational_cost_snapshot: number
          payment_status?: string | null
          price_id: string
          price_per_share_snapshot: number
          program_id: string
          rounding_adjustment?: number
          shares: number
          total_amount: number
          updated_at?: string
          user_id: string
          verified_paid_amount?: number
        }
        Update: {
          animal_cost_snapshot?: number
          animal_kind_snapshot?: Database["public"]["Enums"]["animal_kind"]
          animal_label?: string | null
          category_id?: string
          category_name_snapshot?: string
          code?: string
          created_at?: string
          execution_status?: Database["public"]["Enums"]["execution_status"]
          id?: string
          operational_cost_snapshot?: number
          payment_status?: string | null
          price_id?: string
          price_per_share_snapshot?: number
          program_id?: string
          rounding_adjustment?: number
          shares?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
          verified_paid_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "qurban_commitments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qurban_commitments_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "animal_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qurban_commitments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      qurban_shares: {
        Row: {
          commitment_id: string
          created_at: string
          id: string
          position: number
          shahibul_name: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          id?: string
          position: number
          shahibul_name: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          id?: string
          position?: number
          shahibul_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "qurban_shares_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_periods: {
        Args: {
          _freq: Database["public"]["Enums"]["payment_frequency"]
          _from: string
          _to: string
        }
        Returns: number
      }
      create_commitment: {
        Args: {
          p_category_id: string
          p_consents: Json
          p_frequency: Database["public"]["Enums"]["payment_frequency"]
          p_publication: Database["public"]["Enums"]["publication_preference"]
          p_shahibul: string[]
          p_shares: number
          p_user_agent?: string
        }
        Returns: {
          code: string
          id: string
        }[]
      }
      current_price: {
        Args: { _category_id: string }
        Returns: {
          animal_cost: number
          category_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_final: boolean
          note: string | null
          operational_cost: number
        }
        SetofOptions: {
          from: "*"
          to: "animal_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      price_per_share: {
        Args: { _full: number; _max_shares: number }
        Returns: number
      }
    }
    Enums: {
      animal_kind: "sapi" | "kambing"
      app_role: "admin" | "participant"
      consent_decision: "accepted" | "declined"
      contract_status: "draft" | "approved" | "retired"
      execution_status:
        | "menunggu"
        | "dialokasikan"
        | "disembelih"
        | "didistribusikan"
        | "selesai"
        | "dibatalkan"
      payment_frequency: "harian" | "mingguan" | "bulanan" | "fleksibel"
      program_status: "draft" | "open" | "closed" | "completed"
      publication_preference: "full" | "masked" | "private"
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
  public: {
    Enums: {
      animal_kind: ["sapi", "kambing"],
      app_role: ["admin", "participant"],
      consent_decision: ["accepted", "declined"],
      contract_status: ["draft", "approved", "retired"],
      execution_status: [
        "menunggu",
        "dialokasikan",
        "disembelih",
        "didistribusikan",
        "selesai",
        "dibatalkan",
      ],
      payment_frequency: ["harian", "mingguan", "bulanan", "fleksibel"],
      program_status: ["draft", "open", "closed", "completed"],
      publication_preference: ["full", "masked", "private"],
    },
  },
} as const

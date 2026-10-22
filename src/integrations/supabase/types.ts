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
      access_group_permissions: {
        Row: {
          group_id: string
          permission: string
        }
        Insert: {
          group_id: string
          permission: string
        }
        Update: {
          group_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      access_groups: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          role: Database["public"]["Enums"]["admin_role"] | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          role?: Database["public"]["Enums"]["admin_role"] | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          role?: Database["public"]["Enums"]["admin_role"] | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_members: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          is_active?: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          commitment_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          shares: number
          unit_id: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          shares: number
          unit_id: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          shares?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "animal_units"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_available: boolean
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
          is_available?: boolean
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
          is_available?: boolean
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
      animal_units: {
        Row: {
          category_id: string
          code: string
          created_at: string
          created_by: string | null
          details: string | null
          estimated_weight: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          program_id: string
          status: Database["public"]["Enums"]["unit_status"]
          updated_at: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          estimated_weight?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          program_id: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          estimated_weight?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          program_id?: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_units_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "animal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_units_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          program_id: string
          published_at: string | null
          published_by: string | null
          scheduled_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
          unlocked_warning: number
          updated_at: string
          version: number
          withdrawn_at: string | null
          withdrawn_reason: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          program_id: string
          published_at?: string | null
          published_by?: string | null
          scheduled_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
          unlocked_warning?: number
          updated_at?: string
          version: number
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          program_id?: string
          published_at?: string | null
          published_by?: string | null
          scheduled_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
          unlocked_warning?: number
          updated_at?: string
          version?: number
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          result: string
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          result?: string
          source?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          result?: string
          source?: string
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
          approved_by: string | null
          body: string
          contract_code: string
          contract_type: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          legal_reviewer: string | null
          program_id: string
          requires_reconsent: boolean
          review_notes: string | null
          sharia_reviewer: string | null
          status: Database["public"]["Enums"]["contract_status"]
          summary: string
          title: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          contract_code: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          legal_reviewer?: string | null
          program_id: string
          requires_reconsent?: boolean
          review_notes?: string | null
          sharia_reviewer?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          summary: string
          title: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          contract_code?: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          legal_reviewer?: string | null
          program_id?: string
          requires_reconsent?: boolean
          review_notes?: string | null
          sharia_reviewer?: string | null
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
      documents: {
        Row: {
          category: Database["public"]["Enums"]["doc_category"]
          created_at: string
          id: string
          mime_type: string
          privacy_confirmed: boolean
          program_id: string
          published_at: string | null
          published_by: string | null
          size_bytes: number
          stage: number | null
          storage_path: string
          title: string
          uploaded_by: string
          visibility: string
        }
        Insert: {
          category: Database["public"]["Enums"]["doc_category"]
          created_at?: string
          id?: string
          mime_type: string
          privacy_confirmed: boolean
          program_id: string
          published_at?: string | null
          published_by?: string | null
          size_bytes: number
          stage?: number | null
          storage_path: string
          title: string
          uploaded_by: string
          visibility?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["doc_category"]
          created_at?: string
          id?: string
          mime_type?: string
          privacy_confirmed?: boolean
          program_id?: string
          published_at?: string | null
          published_by?: string | null
          size_bytes?: number
          stage?: number | null
          storage_path?: string
          title?: string
          uploaded_by?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stages: {
        Row: {
          created_at: string
          id: string
          location: string | null
          notes: string | null
          program_id: string
          responsible_id: string | null
          stage: number
          stage_date: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          program_id: string
          responsible_id?: string | null
          stage: number
          stage_date?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          program_id?: string
          responsible_id?: string | null
          stage?: number
          stage_date?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_stages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          actor_id: string | null
          amount: number
          basis: string
          commitment_id: string | null
          created_at: string
          dest_account: Database["public"]["Enums"]["ledger_account"]
          id: string
          idempotency_key: string
          is_fixture: boolean
          program_id: string | null
          reference: string
          reverses_id: string | null
          source_account: Database["public"]["Enums"]["ledger_account"]
          system_source: string | null
        }
        Insert: {
          actor_id?: string | null
          amount: number
          basis: string
          commitment_id?: string | null
          created_at?: string
          dest_account: Database["public"]["Enums"]["ledger_account"]
          id?: string
          idempotency_key: string
          is_fixture?: boolean
          program_id?: string | null
          reference: string
          reverses_id?: string | null
          source_account: Database["public"]["Enums"]["ledger_account"]
          system_source?: string | null
        }
        Update: {
          actor_id?: string | null
          amount?: number
          basis?: string
          commitment_id?: string | null
          created_at?: string
          dest_account?: Database["public"]["Enums"]["ledger_account"]
          id?: string
          idempotency_key?: string
          is_fixture?: boolean
          program_id?: string | null
          reference?: string
          reverses_id?: string | null
          source_account?: Database["public"]["Enums"]["ledger_account"]
          system_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "qurban_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
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
          announcement_days: number
          code: string
          created_at: string
          date_status: string
          hijri_year: number
          id: string
          iduladha_date: string
          minimum_payment: number
          name: string
          payment_deadline: string
          registration_opens_at: string | null
          status: Database["public"]["Enums"]["program_status"]
          updated_at: string
        }
        Insert: {
          announcement_days?: number
          code: string
          created_at?: string
          date_status?: string
          hijri_year: number
          id?: string
          iduladha_date: string
          minimum_payment?: number
          name: string
          payment_deadline: string
          registration_opens_at?: string | null
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
        }
        Update: {
          announcement_days?: number
          code?: string
          created_at?: string
          date_status?: string
          hijri_year?: number
          id?: string
          iduladha_date?: string
          minimum_payment?: number
          name?: string
          payment_deadline?: string
          registration_opens_at?: string | null
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
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["admin_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["admin_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Relationships: []
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
      admin_add_price: {
        Args: {
          p_animal_cost: number
          p_category_id: string
          p_is_final: boolean
          p_note: string
          p_operational_cost: number
        }
        Returns: string
      }
      admin_allocate: {
        Args: { p_commitment_id: string; p_unit_id: string }
        Returns: string
      }
      admin_announcement_transition: {
        Args: {
          p_id: string
          p_reason?: string
          p_scheduled_at?: string
          p_to: Database["public"]["Enums"]["announcement_status"]
        }
        Returns: undefined
      }
      admin_approve_contract: {
        Args: {
          p_id: string
          p_legal_reviewer: string
          p_notes: string
          p_sharia_reviewer: string
        }
        Returns: undefined
      }
      admin_correct_profile: {
        Args: { p_changes: Json; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_correct_shahibul: {
        Args: { p_name: string; p_reason: string; p_share_id: string }
        Returns: undefined
      }
      admin_create_unit: {
        Args: {
          p_category_id: string
          p_code: string
          p_details: string
          p_program_id: string
          p_weight: string
        }
        Returns: string
      }
      admin_dashboard: { Args: { p_program_id?: string }; Returns: Json }
      admin_delete_group: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_duplicate_group: {
        Args: { p_id: string; p_reason: string }
        Returns: string
      }
      admin_generate_announcement: {
        Args: { p_program_id: string; p_title: string }
        Returns: string
      }
      admin_ledger_balances: {
        Args: { p_program_id?: string }
        Returns: {
          account: Database["public"]["Enums"]["ledger_account"]
          balance: number
          entries: number
        }[]
      }
      admin_list_audit: {
        Args: {
          p_entity?: string
          p_from?: string
          p_group?: string
          p_limit?: number
          p_offset?: number
          p_result?: string
          p_search?: string
          p_source?: string
          p_to?: string
          p_user?: string
        }
        Returns: Json
      }
      admin_list_groups: { Args: never; Returns: Json }
      admin_list_users: {
        Args: {
          p_group?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_lock_unit: { Args: { p_unit_id: string }; Returns: undefined }
      admin_participants: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_program_id?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_reconsent_candidates: {
        Args: { p_program_id: string }
        Returns: {
          active_version: string
          affected_commitments: number
          contract_code: string
          requires_reconsent: boolean
        }[]
      }
      admin_register_document: {
        Args: {
          p_category: Database["public"]["Enums"]["doc_category"]
          p_mime: string
          p_path: string
          p_privacy: boolean
          p_program_id: string
          p_size: number
          p_stage: number
          p_title: string
        }
        Returns: string
      }
      admin_remove_allocation: {
        Args: { p_allocation_id: string; p_reason: string }
        Returns: undefined
      }
      admin_report: {
        Args: { p_export?: boolean; p_kind: string; p_program_id?: string }
        Returns: Json
      }
      admin_reverse_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: string
      }
      admin_save_category: {
        Args: { p: Json; p_id: string; p_reason?: string }
        Returns: string
      }
      admin_save_contract_draft: {
        Args: { p: Json; p_id: string }
        Returns: string
      }
      admin_save_group: {
        Args: { p: Json; p_id: string; p_reason: string }
        Returns: string
      }
      admin_save_program: {
        Args: { p: Json; p_id: string; p_reason?: string }
        Returns: string
      }
      admin_set_document_visibility: {
        Args: { p_id: string; p_reason?: string; p_visibility: string }
        Returns: undefined
      }
      admin_set_member: {
        Args: {
          p_active: boolean
          p_email: string
          p_reason: string
          p_role: Database["public"]["Enums"]["admin_role"]
        }
        Returns: undefined
      }
      admin_set_program_status: {
        Args: {
          p_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["program_status"]
        }
        Returns: undefined
      }
      admin_set_setting: {
        Args: { p_key: string; p_reason?: string; p_value: Json }
        Returns: undefined
      }
      admin_set_unit_status: {
        Args: {
          p_reason: string
          p_status: Database["public"]["Enums"]["unit_status"]
          p_unit_id: string
        }
        Returns: undefined
      }
      admin_update_user: {
        Args: {
          p_active: boolean
          p_full_name: string
          p_group_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_user_activity: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      admin_verify_stage: {
        Args: {
          p_date: string
          p_location: string
          p_notes: string
          p_program_id: string
          p_stage: number
        }
        Returns: undefined
      }
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
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      known_permissions: { Args: never; Returns: string[] }
      mask_name: { Args: { _n: string }; Returns: string }
      my_admin_access: { Args: never; Returns: Json }
      notify_admins: {
        Args: {
          _body: string
          _kind: string
          _link?: string
          _perm: string
          _title: string
        }
        Returns: undefined
      }
      post_ledger: {
        Args: {
          _amount: number
          _basis: string
          _commitment: string
          _dst: Database["public"]["Enums"]["ledger_account"]
          _key: string
          _reference: string
          _reverses?: string
          _src: Database["public"]["Enums"]["ledger_account"]
          _system?: string
        }
        Returns: string
      }
      price_per_share: {
        Args: { _full: number; _max_shares: number }
        Returns: number
      }
      require_perm: { Args: { _perm: string }; Returns: undefined }
      share_component: {
        Args: { _cost: number; _max: number; _shares: number }
        Returns: number
      }
      write_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _meta?: Json
          _new: Json
          _old: Json
          _reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      admin_role:
        | "superadmin"
        | "finance"
        | "program"
        | "field_officer"
        | "auditor"
        | "content"
      animal_kind: "sapi" | "kambing"
      announcement_status:
        | "draft"
        | "approved"
        | "scheduled"
        | "published"
        | "withdrawn"
      app_role: "admin" | "participant"
      consent_decision: "accepted" | "declined"
      contract_status: "draft" | "approved" | "retired"
      doc_category:
        | "animal_photo"
        | "preparation"
        | "slaughter"
        | "distribution"
        | "beneficiaries"
        | "supporting"
        | "impact_report"
      execution_status:
        | "menunggu"
        | "dialokasikan"
        | "disembelih"
        | "didistribusikan"
        | "selesai"
        | "dibatalkan"
      ledger_account:
        | "EXTERNAL"
        | "COMMITMENT"
        | "ANIMAL"
        | "OPERATIONAL"
        | "SEDEKAH"
        | "EXCESS"
        | "KUASA"
        | "REFUND"
        | "CANCEL_COST"
        | "USED"
      payment_frequency: "harian" | "mingguan" | "bulanan" | "fleksibel"
      program_status: "draft" | "open" | "closed" | "completed"
      publication_preference: "full" | "masked" | "private"
      unit_status: "draft" | "final" | "locked"
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
      admin_role: [
        "superadmin",
        "finance",
        "program",
        "field_officer",
        "auditor",
        "content",
      ],
      animal_kind: ["sapi", "kambing"],
      announcement_status: [
        "draft",
        "approved",
        "scheduled",
        "published",
        "withdrawn",
      ],
      app_role: ["admin", "participant"],
      consent_decision: ["accepted", "declined"],
      contract_status: ["draft", "approved", "retired"],
      doc_category: [
        "animal_photo",
        "preparation",
        "slaughter",
        "distribution",
        "beneficiaries",
        "supporting",
        "impact_report",
      ],
      execution_status: [
        "menunggu",
        "dialokasikan",
        "disembelih",
        "didistribusikan",
        "selesai",
        "dibatalkan",
      ],
      ledger_account: [
        "EXTERNAL",
        "COMMITMENT",
        "ANIMAL",
        "OPERATIONAL",
        "SEDEKAH",
        "EXCESS",
        "KUASA",
        "REFUND",
        "CANCEL_COST",
        "USED",
      ],
      payment_frequency: ["harian", "mingguan", "bulanan", "fleksibel"],
      program_status: ["draft", "open", "closed", "completed"],
      publication_preference: ["full", "masked", "private"],
      unit_status: ["draft", "final", "locked"],
    },
  },
} as const

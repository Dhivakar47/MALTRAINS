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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          related_plan_id: string | null
          related_trainset_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          related_plan_id?: string | null
          related_trainset_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          related_plan_id?: string | null
          related_trainset_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_related_plan_id_fkey"
            columns: ["related_plan_id"]
            isOneToOne: false
            referencedRelation: "induction_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_related_trainset_id_fkey"
            columns: ["related_trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_slots: {
        Row: {
          created_at: string
          depot_id: string
          id: string
          slot_date: string
          slot_time_end: string
          slot_time_start: string
          slot_type: string | null
          status: Database["public"]["Enums"]["cleaning_status"]
          trainset_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          depot_id: string
          id?: string
          slot_date: string
          slot_time_end: string
          slot_time_start: string
          slot_type?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          trainset_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          depot_id?: string
          id?: string
          slot_date?: string
          slot_time_end?: string
          slot_time_start?: string
          slot_type?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          trainset_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_slots_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_slots_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_audit_log: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string | null
          created_at: string
          decision_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          plan_id: string | null
          trainset_id: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          plan_id?: string | null
          trainset_id?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          plan_id?: string | null
          trainset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_audit_log_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "induction_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_audit_log_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "induction_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_audit_log_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      depots: {
        Row: {
          code: string
          created_at: string
          id: string
          location: string | null
          name: string
          total_bays: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
          total_bays?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          total_bays?: number
          updated_at?: string
        }
        Relationships: []
      }
      fitness_certificates: {
        Row: {
          certificate_number: string | null
          certificate_type: Database["public"]["Enums"]["certificate_type"]
          created_at: string
          expiry_date: string
          id: string
          issue_date: string
          issuing_authority: string | null
          notes: string | null
          trainset_id: string
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          certificate_type: Database["public"]["Enums"]["certificate_type"]
          created_at?: string
          expiry_date: string
          id?: string
          issue_date: string
          issuing_authority?: string | null
          notes?: string | null
          trainset_id: string
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          certificate_type?: Database["public"]["Enums"]["certificate_type"]
          created_at?: string
          expiry_date?: string
          id?: string
          issue_date?: string
          issuing_authority?: string | null
          notes?: string | null
          trainset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_certificates_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      induction_decisions: {
        Row: {
          assigned_bay_id: string | null
          assigned_route: string | null
          branding_consideration: Json | null
          cleaning_status: Json | null
          confidence_score: number | null
          created_at: string
          decision: Database["public"]["Enums"]["induction_decision"]
          explanation_text: string | null
          fitness_compliance: Json | null
          id: string
          is_override: boolean | null
          maintenance_status: Json | null
          mileage_rationale: Json | null
          original_decision:
          | Database["public"]["Enums"]["induction_decision"]
          | null
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          plan_id: string
          rank_order: number | null
          stabling_impact: Json | null
          trainset_id: string
          updated_at: string
        }
        Insert: {
          assigned_bay_id?: string | null
          assigned_route?: string | null
          branding_consideration?: Json | null
          cleaning_status?: Json | null
          confidence_score?: number | null
          created_at?: string
          decision: Database["public"]["Enums"]["induction_decision"]
          explanation_text?: string | null
          fitness_compliance?: Json | null
          id?: string
          is_override?: boolean | null
          maintenance_status?: Json | null
          mileage_rationale?: Json | null
          original_decision?:
          | Database["public"]["Enums"]["induction_decision"]
          | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          plan_id: string
          rank_order?: number | null
          stabling_impact?: Json | null
          trainset_id: string
          updated_at?: string
        }
        Update: {
          assigned_bay_id?: string | null
          assigned_route?: string | null
          branding_consideration?: Json | null
          cleaning_status?: Json | null
          confidence_score?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["induction_decision"]
          explanation_text?: string | null
          fitness_compliance?: Json | null
          id?: string
          is_override?: boolean | null
          maintenance_status?: Json | null
          mileage_rationale?: Json | null
          original_decision?:
          | Database["public"]["Enums"]["induction_decision"]
          | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          plan_id?: string
          rank_order?: number | null
          stabling_impact?: Json | null
          trainset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "induction_decisions_assigned_bay_id_fkey"
            columns: ["assigned_bay_id"]
            isOneToOne: false
            referencedRelation: "stabling_bays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "induction_decisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "induction_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "induction_decisions_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      induction_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          execution_time: string
          id: string
          is_nightly_run: boolean | null
          notes: string | null
          optimizer_score: number | null
          plan_date: string
          status: string
          total_trains_ibl: number | null
          total_trains_inducted: number | null
          total_trains_standby: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          execution_time?: string
          id?: string
          is_nightly_run?: boolean | null
          notes?: string | null
          optimizer_score?: number | null
          plan_date: string
          status?: string
          total_trains_ibl?: number | null
          total_trains_inducted?: number | null
          total_trains_standby?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          execution_time?: string
          id?: string
          is_nightly_run?: boolean | null
          notes?: string | null
          optimizer_score?: number | null
          plan_date?: string
          status?: string
          total_trains_ibl?: number | null
          total_trains_inducted?: number | null
          total_trains_standby?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      job_cards: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          criticality: Database["public"]["Enums"]["job_criticality"]
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          maximo_job_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          trainset_id: string
          updated_at: string
          work_type: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["job_criticality"]
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          maximo_job_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          trainset_id: string
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["job_criticality"]
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          maximo_job_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          trainset_id?: string
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_history: {
        Row: {
          created_at: string
          id: string
          mileage_km: number
          recorded_by: string | null
          recorded_date: string
          route: string | null
          trainset_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mileage_km: number
          recorded_by?: string | null
          recorded_date: string
          route?: string | null
          trainset_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mileage_km?: number
          recorded_by?: string | null
          recorded_date?: string
          route?: string | null
          trainset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_history_trainset_id_fkey"
            columns: ["trainset_id"]
            isOneToOne: false
            referencedRelation: "trainsets"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          base_plan_id: string | null
          comparison_metrics: Json | null
          created_at: string
          created_by: string | null
          id: string
          parameters: Json
          results: Json | null
          simulation_name: string
        }
        Insert: {
          base_plan_id?: string | null
          comparison_metrics?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          parameters: Json
          results?: Json | null
          simulation_name: string
        }
        Update: {
          base_plan_id?: string | null
          comparison_metrics?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          parameters?: Json
          results?: Json | null
          simulation_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_base_plan_id_fkey"
            columns: ["base_plan_id"]
            isOneToOne: false
            referencedRelation: "induction_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      stabling_bays: {
        Row: {
          adjacent_bays: string[] | null
          bay_number: string
          bay_type: string | null
          capacity: number | null
          created_at: string
          current_occupancy: number | null
          depot_id: string
          geometry_order: number | null
          id: string
          is_available: boolean | null
          is_ibl: boolean | null
          updated_at: string
        }
        Insert: {
          adjacent_bays?: string[] | null
          bay_number: string
          bay_type?: string | null
          capacity?: number | null
          created_at?: string
          current_occupancy?: number | null
          depot_id: string
          geometry_order?: number | null
          id?: string
          is_available?: boolean | null
          is_ibl?: boolean | null
          updated_at?: string
        }
        Update: {
          adjacent_bays?: string[] | null
          bay_number?: string
          bay_type?: string | null
          capacity?: number | null
          created_at?: string
          current_occupancy?: number | null
          depot_id?: string
          geometry_order?: number | null
          id?: string
          is_available?: boolean | null
          is_ibl?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stabling_bays_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          depot_id: string | null
          employee_id: string | null
          id: string
          role: string | null
          staff_name: string
          status: string | null
          reason: string | null
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          depot_id?: string | null
          employee_id?: string | null
          id?: string
          role?: string | null
          staff_name: string
          status?: string | null
          reason?: string | null
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          depot_id?: string | null
          employee_id?: string | null
          id?: string
          role?: string | null
          staff_name?: string
          status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      trainsets: {
        Row: {
          branding_client: string | null
          branding_exposure_hours: number | null
          branding_priority: number | null
          branding_sla_hours_required: number | null
          car_count: number
          created_at: string
          current_bay: string | null
          current_status: Database["public"]["Enums"]["trainset_status"]
          depot_id: string | null
          id: string
          last_service_date: string | null
          next_scheduled_maintenance: string | null
          rake_id: string
          route: string | null
          total_mileage_km: number
          updated_at: string
        }
        Insert: {
          branding_client?: string | null
          branding_exposure_hours?: number | null
          branding_priority?: number | null
          branding_sla_hours_required?: number | null
          car_count?: number
          created_at?: string
          current_bay?: string | null
          current_status?: Database["public"]["Enums"]["trainset_status"]
          depot_id?: string | null
          id?: string
          last_service_date?: string | null
          next_scheduled_maintenance?: string | null
          rake_id: string
          route?: string | null
          total_mileage_km?: number
          updated_at?: string
        }
        Update: {
          branding_client?: string | null
          branding_exposure_hours?: number | null
          branding_priority?: number | null
          branding_sla_hours_required?: number | null
          car_count?: number
          created_at?: string
          current_bay?: string | null
          current_status?: Database["public"]["Enums"]["trainset_status"]
          depot_id?: string | null
          id?: string
          last_service_date?: string | null
          next_scheduled_maintenance?: string | null
          rake_id?: string
          route?: string | null
          total_mileage_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainsets_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          identifier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_certificate_valid: {
        Args: { cert_expiry_date: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "planner" | "user"
      certificate_type: "rolling_stock" | "signalling" | "telecom"
      cleaning_status: "available" | "booked" | "completed" | "cancelled"
      induction_decision: "inducted" | "standby" | "ibl_routed" | "held"
      job_criticality: "critical" | "high" | "medium" | "low"
      job_status: "open" | "in_progress" | "closed" | "deferred"
      trainset_status:
      | "service_ready"
      | "standby"
      | "maintenance"
      | "ibl_routed"
      | "out_of_service"
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
      app_role: ["admin", "supervisor", "planner", "user"],
      certificate_type: ["rolling_stock", "signalling", "telecom"],
      cleaning_status: ["available", "booked", "completed", "cancelled"],
      induction_decision: ["inducted", "standby", "ibl_routed", "held"],
      job_criticality: ["critical", "high", "medium", "low"],
      job_status: ["open", "in_progress", "closed", "deferred"],
      trainset_status: [
        "service_ready",
        "standby",
        "maintenance",
        "ibl_routed",
        "out_of_service",
      ],
    },
  },
} as const

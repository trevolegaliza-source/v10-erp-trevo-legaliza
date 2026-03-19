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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          apelido: string | null
          cnpj: string | null
          codigo_identificador: string
          contrato_url: string | null
          created_at: string | null
          desconto_progressivo: number | null
          dia_cobranca: number | null
          dia_vencimento_mensal: number | null
          email: string | null
          id: string
          is_archived: boolean | null
          mensalidade: number | null
          momento_faturamento: string | null
          nome: string
          nome_contador: string | null
          observacoes: string | null
          qtd_processos: number | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto: string | null
          updated_at: string | null
          valor_base: number | null
          valor_limite_desconto: number | null
          vencimento: number | null
        }
        Insert: {
          apelido?: string | null
          cnpj?: string | null
          codigo_identificador: string
          contrato_url?: string | null
          created_at?: string | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome: string
          nome_contador?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto?: string | null
          updated_at?: string | null
          valor_base?: number | null
          valor_limite_desconto?: number | null
          vencimento?: number | null
        }
        Update: {
          apelido?: string | null
          cnpj?: string | null
          codigo_identificador?: string
          contrato_url?: string | null
          created_at?: string | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome?: string
          nome_contador?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto?: string | null
          updated_at?: string | null
          valor_base?: number | null
          valor_limite_desconto?: number | null
          vencimento?: number | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          processo_id: string
          status: string
          tipo_documento: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          processo_id: string
          status?: string
          tipo_documento: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          processo_id?: string
          status?: string
          tipo_documento?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          boleto_url: string | null
          categoria: string | null
          cliente_id: string | null
          cobranca_encaminhada: boolean | null
          comprovante_url: string | null
          confirmado_recebimento: boolean | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          etapa_financeiro: string
          honorario_extra: number | null
          id: string
          is_taxa_reembolsavel: boolean | null
          observacoes_financeiro: string | null
          processo_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string | null
          url_comprovante: string | null
          url_recibo_taxa: string | null
          valor: number
        }
        Insert: {
          boleto_url?: string | null
          categoria?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          etapa_financeiro?: string
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor: number
        }
        Update: {
          boleto_url?: string | null
          categoria?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          etapa_financeiro?: string
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_tiers: {
        Row: {
          descricao: string | null
          id: string
          tier: number
          tipo_processo: Database["public"]["Enums"]["tipo_processo"]
          valor: number
        }
        Insert: {
          descricao?: string | null
          id?: string
          tier?: number
          tipo_processo: Database["public"]["Enums"]["tipo_processo"]
          valor: number
        }
        Update: {
          descricao?: string | null
          id?: string
          tier?: number
          tipo_processo?: Database["public"]["Enums"]["tipo_processo"]
          valor?: number
        }
        Relationships: []
      }
      processos: {
        Row: {
          cliente_id: string
          created_at: string | null
          etapa: string
          id: string
          is_archived: boolean | null
          notas: string | null
          prioridade: string
          razao_social: string
          responsavel: string | null
          tipo: Database["public"]["Enums"]["tipo_processo"]
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          etapa?: string
          id?: string
          is_archived?: boolean | null
          notas?: string | null
          prioridade?: string
          razao_social: string
          responsavel?: string | null
          tipo: Database["public"]["Enums"]["tipo_processo"]
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          etapa?: string
          id?: string
          is_archived?: boolean | null
          notas?: string | null
          prioridade?: string
          razao_social?: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["tipo_processo"]
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      valores_adicionais: {
        Row: {
          anexo_url: string | null
          comprovante_url: string | null
          created_at: string | null
          descricao: string
          id: string
          processo_id: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          processo_id: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          anexo_url?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          processo_id?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "valores_adicionais_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_preco_processo: {
        Args: {
          p_cliente_id: string
          p_tipo: Database["public"]["Enums"]["tipo_processo"]
        }
        Returns: number
      }
      calcular_vencimento: { Args: { p_cliente_id: string }; Returns: string }
    }
    Enums: {
      status_financeiro: "pendente" | "pago" | "atrasado" | "cancelado"
      tipo_cliente: "MENSALISTA" | "AVULSO_4D"
      tipo_lancamento: "receber" | "pagar"
      tipo_processo:
        | "abertura"
        | "alteracao"
        | "transformacao"
        | "baixa"
        | "avulso"
        | "orcamento"
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
      status_financeiro: ["pendente", "pago", "atrasado", "cancelado"],
      tipo_cliente: ["MENSALISTA", "AVULSO_4D"],
      tipo_lancamento: ["receber", "pagar"],
      tipo_processo: [
        "abertura",
        "alteracao",
        "transformacao",
        "baixa",
        "avulso",
        "orcamento",
      ],
    },
  },
} as const

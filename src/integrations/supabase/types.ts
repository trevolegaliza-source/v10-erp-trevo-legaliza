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
          data_ultima_recarga: string | null
          desconto_boas_vindas_aplicado: boolean | null
          desconto_progressivo: number | null
          dia_cobranca: number | null
          dia_vencimento_mensal: number | null
          email: string | null
          franquia_processos: number | null
          id: string
          is_archived: boolean | null
          mensalidade: number | null
          momento_faturamento: string | null
          nome: string
          nome_contador: string | null
          observacoes: string | null
          qtd_processos: number | null
          saldo_prepago: number | null
          saldo_ultima_recarga: number | null
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
          data_ultima_recarga?: string | null
          desconto_boas_vindas_aplicado?: boolean | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          franquia_processos?: number | null
          id?: string
          is_archived?: boolean | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome: string
          nome_contador?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          saldo_prepago?: number | null
          saldo_ultima_recarga?: number | null
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
          data_ultima_recarga?: string | null
          desconto_boas_vindas_aplicado?: boolean | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          franquia_processos?: number | null
          id?: string
          is_archived?: boolean | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome?: string
          nome_contador?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          saldo_prepago?: number | null
          saldo_ultima_recarga?: number | null
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
      colaborador_avaliacoes: {
        Row: {
          ano: number
          colaborador_id: string
          conclusao_trimestral: string | null
          created_at: string | null
          feedback: string | null
          id: string
          mes: number
          updated_at: string | null
        }
        Insert: {
          ano: number
          colaborador_id: string
          conclusao_trimestral?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          mes: number
          updated_at?: string | null
        }
        Update: {
          ano?: number
          colaborador_id?: string
          conclusao_trimestral?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          mes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_avaliacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          adiantamento_tipo: string
          adiantamento_valor: number
          aniversario: string | null
          aumento_previsto_data: string | null
          aumento_previsto_valor: number | null
          created_at: string | null
          data_inicio: string | null
          dia_adiantamento: number | null
          dia_das: number | null
          dia_pagamento_integral: number | null
          dia_salario: number | null
          dia_vt_vr: number | null
          email: string | null
          fgts_percentual: number | null
          id: string
          inss_patronal_percentual: number | null
          nome: string
          observacoes_pagamento: string | null
          pix_chave: string | null
          pix_tipo: string | null
          possui_adiantamento: boolean
          provisionar_13: boolean | null
          provisionar_ferias: boolean | null
          regime: string
          salario_base: number
          status: string
          updated_at: string | null
          valor_das: number
          vr_diario: number
          vt_diario: number
        }
        Insert: {
          adiantamento_tipo?: string
          adiantamento_valor?: number
          aniversario?: string | null
          aumento_previsto_data?: string | null
          aumento_previsto_valor?: number | null
          created_at?: string | null
          data_inicio?: string | null
          dia_adiantamento?: number | null
          dia_das?: number | null
          dia_pagamento_integral?: number | null
          dia_salario?: number | null
          dia_vt_vr?: number | null
          email?: string | null
          fgts_percentual?: number | null
          id?: string
          inss_patronal_percentual?: number | null
          nome: string
          observacoes_pagamento?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          possui_adiantamento?: boolean
          provisionar_13?: boolean | null
          provisionar_ferias?: boolean | null
          regime?: string
          salario_base?: number
          status?: string
          updated_at?: string | null
          valor_das?: number
          vr_diario?: number
          vt_diario?: number
        }
        Update: {
          adiantamento_tipo?: string
          adiantamento_valor?: number
          aniversario?: string | null
          aumento_previsto_data?: string | null
          aumento_previsto_valor?: number | null
          created_at?: string | null
          data_inicio?: string | null
          dia_adiantamento?: number | null
          dia_das?: number | null
          dia_pagamento_integral?: number | null
          dia_salario?: number | null
          dia_vt_vr?: number | null
          email?: string | null
          fgts_percentual?: number | null
          id?: string
          inss_patronal_percentual?: number | null
          nome?: string
          observacoes_pagamento?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          possui_adiantamento?: boolean
          provisionar_13?: boolean | null
          provisionar_ferias?: boolean | null
          regime?: string
          salario_base?: number
          status?: string
          updated_at?: string | null
          valor_das?: number
          vr_diario?: number
          vt_diario?: number
        }
        Relationships: []
      }
      despesas_recorrentes: {
        Row: {
          ativo: boolean
          categoria: string
          colaborador_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          fornecedor: string | null
          id: string
          observacoes: string | null
          subcategoria: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          colaborador_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao: string
          dia_vencimento?: number
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          colaborador_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_recorrentes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
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
          colaborador_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          comprovante_url: string | null
          confirmado_recebimento: boolean | null
          created_at: string | null
          data_pagamento: string | null
          data_ultimo_contato: string | null
          data_vencimento: string
          descricao: string
          despesa_recorrente_id: string | null
          etapa_financeiro: string
          fornecedor: string | null
          honorario_extra: number | null
          id: string
          is_taxa_reembolsavel: boolean | null
          notas_cobranca: string | null
          observacoes_financeiro: string | null
          processo_id: string | null
          recibo_assinado_url: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          subcategoria: string | null
          tentativas_cobranca: number | null
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
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          created_at?: string | null
          data_pagamento?: string | null
          data_ultimo_contato?: string | null
          data_vencimento: string
          descricao: string
          despesa_recorrente_id?: string | null
          etapa_financeiro?: string
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          subcategoria?: string | null
          tentativas_cobranca?: number | null
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
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          created_at?: string | null
          data_pagamento?: string | null
          data_ultimo_contato?: string | null
          data_vencimento?: string
          descricao?: string
          despesa_recorrente_id?: string | null
          etapa_financeiro?: string
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          subcategoria?: string | null
          tentativas_cobranca?: number | null
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
            foreignKeyName: "lancamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_despesa_recorrente_id_fkey"
            columns: ["despesa_recorrente_id"]
            isOneToOne: false
            referencedRelation: "despesas_recorrentes"
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
      prepago_movimentacoes: {
        Row: {
          cliente_id: string
          created_at: string | null
          descricao: string
          id: string
          processo_id: string | null
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descricao: string
          id?: string
          processo_id?: string | null
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          processo_id?: string | null
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prepago_movimentacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepago_movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
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
      service_negotiations: {
        Row: {
          billing_trigger: string
          cliente_id: string
          created_at: string | null
          fixed_price: number
          id: string
          is_custom: boolean
          observacoes: string | null
          service_name: string
          trigger_days: number | null
          updated_at: string | null
          valor_prepago: number | null
        }
        Insert: {
          billing_trigger?: string
          cliente_id: string
          created_at?: string | null
          fixed_price?: number
          id?: string
          is_custom?: boolean
          observacoes?: string | null
          service_name: string
          trigger_days?: number | null
          updated_at?: string | null
          valor_prepago?: number | null
        }
        Update: {
          billing_trigger?: string
          cliente_id?: string
          created_at?: string | null
          fixed_price?: number
          id?: string
          is_custom?: boolean
          observacoes?: string | null
          service_name?: string
          trigger_days?: number | null
          updated_at?: string | null
          valor_prepago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_negotiations_cliente_id_fkey"
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
      webhook_configs: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
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
      tipo_cliente: "MENSALISTA" | "AVULSO_4D" | "PRE_PAGO"
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
      tipo_cliente: ["MENSALISTA", "AVULSO_4D", "PRE_PAGO"],
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

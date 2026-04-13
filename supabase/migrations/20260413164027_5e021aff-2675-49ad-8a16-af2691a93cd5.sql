-- Add audit columns
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS auditado boolean DEFAULT false;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS auditado_por uuid REFERENCES profiles(id);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS auditado_em timestamptz;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS valor_original numeric;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS valor_alterado_por uuid REFERENCES profiles(id);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS valor_alterado_em timestamptz;

COMMENT ON COLUMN lancamentos.auditado IS 'Se true, processo foi validado e pode ser cobrado';
COMMENT ON COLUMN lancamentos.auditado_por IS 'Quem auditou (profile id)';
COMMENT ON COLUMN lancamentos.auditado_em IS 'Quando foi auditado';
COMMENT ON COLUMN lancamentos.valor_original IS 'Valor antes de qualquer alteração manual';
COMMENT ON COLUMN lancamentos.valor_alterado_por IS 'Quem alterou o valor por último';
COMMENT ON COLUMN lancamentos.valor_alterado_em IS 'Quando o valor foi alterado por último';

-- Mark already-paid as audited
UPDATE lancamentos SET auditado = true WHERE status = 'pago';

-- Mark lancamentos with extrato_id as audited
UPDATE lancamentos SET auditado = true WHERE extrato_id IS NOT NULL;

-- Mark lancamentos in later stages as audited
UPDATE lancamentos SET auditado = true WHERE etapa_financeiro IN ('cobranca_enviada', 'honorario_pago', 'honorario_vencido');
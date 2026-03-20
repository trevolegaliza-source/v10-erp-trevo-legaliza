
-- Retroactive cleanup: standardize lancamento descriptions to [NOME] - [TIPO] format
UPDATE lancamentos l
SET descricao = c.nome || ' - ' || 
  CASE 
    WHEN l.descricao ILIKE '%50% Salário 2%' OR l.descricao ILIKE '%50%% Salário 2%' THEN '50% Salário 2ª parcela'
    WHEN l.descricao ILIKE '%50% Salário%' OR l.descricao ILIKE '%50%% Salário%' THEN '50% Salário'
    WHEN l.descricao ILIKE '%Salário Integral%' THEN 'Salário Integral'
    WHEN l.descricao ILIKE '%VT/VR%' OR l.descricao ILIKE '%Benefício%' THEN 'VT/VR'
    WHEN l.descricao ILIKE '%DAS%' THEN 'Guia DAS'
    ELSE regexp_replace(l.descricao, '^.*? - ', '')
  END || 
  COALESCE(
    ' (' || (regexp_match(l.descricao, '\(([a-zçã]+ de \d{4})\)'))[1] || ')',
    ''
  )
FROM colaboradores c
WHERE l.colaborador_id = c.id
  AND l.tipo = 'pagar'
  AND l.colaborador_id IS NOT NULL;

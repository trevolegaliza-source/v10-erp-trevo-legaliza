ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS contexto text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS ordem_execucao text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pacotes jsonb DEFAULT '[]';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS secoes jsonb DEFAULT '[]';
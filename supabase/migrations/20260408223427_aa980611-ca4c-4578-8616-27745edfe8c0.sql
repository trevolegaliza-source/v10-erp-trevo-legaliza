ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS destinatario text DEFAULT 'contador';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orcamentos_destinatario_check' 
    AND table_name = 'orcamentos'
  ) THEN
    ALTER TABLE public.orcamentos 
    ADD CONSTRAINT orcamentos_destinatario_check 
    CHECK (destinatario IN ('contador', 'cliente_via_contador', 'cliente_direto'));
  END IF;
END $$;
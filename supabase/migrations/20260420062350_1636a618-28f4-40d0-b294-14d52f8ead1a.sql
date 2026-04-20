ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS trello_board_id TEXT,
  ADD COLUMN IF NOT EXISTS trello_board_url TEXT,
  ADD COLUMN IF NOT EXISTS trello_provisionado_em TIMESTAMPTZ;
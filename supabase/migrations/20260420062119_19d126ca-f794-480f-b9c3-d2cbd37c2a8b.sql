ALTER TABLE public.colaboradores 
  ADD COLUMN IF NOT EXISTS trello_username TEXT;

CREATE INDEX IF NOT EXISTS idx_colaboradores_trello 
  ON public.colaboradores(trello_username) 
  WHERE trello_username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  fixed_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_trigger TEXT NOT NULL DEFAULT 'request',
  trigger_days INTEGER DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_negotiations_authenticated_all"
ON public.service_negotiations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

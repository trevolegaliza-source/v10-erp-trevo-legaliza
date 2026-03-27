import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Abre um arquivo do Supabase Storage via Blob URL,
 * evitando bloqueio do Chrome (ERR_BLOCKED_BY_CLIENT).
 */
export async function abrirArquivoStorage(bucket: string, path: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error('Erro download storage:', error);
      toast.error('Erro ao abrir o arquivo.');
      return;
    }

    const blobUrl = URL.createObjectURL(data);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error('Erro storage:', err);
    toast.error('Erro ao abrir o arquivo.');
  }
}

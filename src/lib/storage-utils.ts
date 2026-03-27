import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Faz download de um arquivo do Storage e retorna Blob URL local.
 * Não utiliza URL pública direta, evitando bloqueios do navegador.
 */
export async function downloadStorageFile(bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error('Storage download error:', error);
      return null;
    }

    return URL.createObjectURL(data);
  } catch (err) {
    console.error('Storage download exception:', err);
    return null;
  }
}

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

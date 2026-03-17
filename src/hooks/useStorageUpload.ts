import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET = 'documentos';

export async function uploadFile(
  file: File,
  folder: string,
  processoId: string,
): Promise<string> {
  const ext = file.name.split('.').pop();
  const storagePath = `${folder}/${processoId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true });

  if (error) {
    toast.error('Erro no upload: ' + error.message);
    throw error;
  }

  return storagePath;
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) {
    toast.error('Erro ao gerar URL: ' + error.message);
    throw error;
  }
  return data.signedUrl;
}

export async function viewFile(storagePath: string) {
  const url = await getSignedUrl(storagePath);
  window.open(url, '_blank');
}

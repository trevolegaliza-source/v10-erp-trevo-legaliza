import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import { toast } from 'sonner';

interface Props {
  lancamento: any | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string, dataPagamento: string, comprovanteUrl?: string) => void;
}

export default function MarcarPagoModal({ lancamento, open, onClose, onConfirm }: Props) {
  const [dataPag, setDataPag] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleConfirm = async () => {
    if (!lancamento) return;
    setUploading(true);
    try {
      let url: string | undefined;
      if (file) {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const path = await empresaPath(`comprovantes/${lancamento.id}.${ext}`);
        const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file, { upsert: true });
        if (error) throw error;
        url = path;
      }
      onConfirm(lancamento.id, dataPag, url);
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'Desconhecido'));
    }
    setUploading(false);
  };

  if (!lancamento) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{lancamento.descricao}</p>
          <p className="text-lg font-bold">{Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          <div className="grid gap-2">
            <Label>Data de Pagamento</Label>
            <Input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Comprovante (opcional)</Label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{file ? file.name : 'Selecionar arquivo...'}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={uploading}>
            {uploading ? 'Enviando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

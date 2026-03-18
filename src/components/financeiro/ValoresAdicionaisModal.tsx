import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, Paperclip, CheckCircle2, Pencil, X, Check, Upload, Eye, Download,
} from 'lucide-react';
import {
  useValoresAdicionais, useAddValorAdicional, useUpdateValorAdicional, useDeleteValorAdicional,
} from '@/hooks/useValoresAdicionais';
import { uploadFile, viewFile, getSignedUrl } from '@/hooks/useStorageUpload';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { toast } from 'sonner';

interface ValoresAdicionaisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  clienteApelido: string;
}

export default function ValoresAdicionaisModal({
  open, onOpenChange, processoId, clienteApelido,
}: ValoresAdicionaisModalProps) {
  const { data: items = [], isLoading } = useValoresAdicionais(processoId);
  const addMut = useAddValorAdicional();
  const updateMut = useUpdateValorAdicional();
  const deleteMut = useDeleteValorAdicional();

  const [newDesc, setNewDesc] = useState('');
  const [newValor, setNewValor] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editValor, setEditValor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const guiaRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadField, setUploadField] = useState<'anexo_url' | 'comprovante_url'>('anexo_url');

  const subtotal = items.reduce((s, i) => s + Number(i.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleAdd = () => {
    const valor = parseFloat(newValor.replace(',', '.')) || 0;
    if (!newDesc.trim() || valor <= 0) return;
    addMut.mutate({ processo_id: processoId, descricao: newDesc.trim(), valor });
    setNewDesc('');
    setNewValor('');
  };

  const handleSaveEdit = (id: string) => {
    const valor = parseFloat(editValor.replace(',', '.')) || 0;
    updateMut.mutate({
      id, processo_id: processoId,
      updates: { descricao: editDesc.trim(), valor },
    });
    setEditId(null);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget({ id });
    setPasswordOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMut.mutate({ id: deleteTarget.id, processo_id: processoId });
      setDeleteTarget(null);
    }
  };

  const startEdit = (item: { id: string; descricao: string; valor: number }) => {
    setEditId(item.id);
    setEditDesc(item.descricao);
    setEditValor(String(item.valor));
  };

  const handleFileUpload = async (itemId: string, file: File, field: 'anexo_url' | 'comprovante_url') => {
    try {
      setUploading(`${itemId}_${field}`);
      const folder = field === 'anexo_url' ? 'guias' : 'comprovantes_adicionais';
      const path = await uploadFile(file, folder, processoId);
      updateMut.mutate({
        id: itemId, processo_id: processoId,
        updates: { [field]: path },
      });
      toast.success(field === 'anexo_url' ? 'Guia/DARE anexada' : 'Comprovante anexado');
    } catch {
      // handled
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = (itemId: string, field: 'anexo_url' | 'comprovante_url') => {
    updateMut.mutate({
      id: itemId, processo_id: processoId,
      updates: { [field]: null },
    });
    toast.success('Arquivo removido');
  };

  const handleDownload = async (storagePath: string) => {
    const url = await getSignedUrl(storagePath);
    const a = document.createElement('a');
    a.href = url;
    a.download = storagePath.split('/').pop() || 'arquivo';
    a.target = '_blank';
    a.click();
  };

  const triggerUpload = (itemId: string, field: 'anexo_url' | 'comprovante_url') => {
    setUploadTargetId(itemId);
    setUploadField(field);
    const ref = field === 'anexo_url' ? guiaRef : comprovanteRef;
    setTimeout(() => ref.current?.click(), 0);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && uploadTargetId) handleFileUpload(uploadTargetId, f, uploadField);
    e.target.value = '';
  };

  const FileActions = ({ storagePath, itemId, field, label }: {
    storagePath: string | null | undefined;
    itemId: string;
    field: 'anexo_url' | 'comprovante_url';
    label: string;
  }) => {
    const isUploading = uploading === `${itemId}_${field}`;
    if (storagePath) {
      return (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => viewFile(storagePath)}
            title={`Visualizar ${label}`}
            className="text-info hover:text-info/80 p-0.5"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleDownload(storagePath)}
            title={`Download ${label}`}
            className="text-primary hover:text-primary/80 p-0.5"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleRemoveFile(itemId, field)}
            title={`Remover ${label}`}
            className="text-destructive hover:text-destructive/80 p-0.5"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => triggerUpload(itemId, field)}
        title={`Anexar ${label}`}
        disabled={isUploading}
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
      >
        {isUploading ? (
          <Upload className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Valores Adicionais</DialogTitle>
            <DialogDescription>
              Gerencie honorários extras, taxas e reembolsos para{' '}
              <span className="font-semibold text-foreground">{clienteApelido}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Add new */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-muted-foreground">Descrição</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Ex: DARE, Taxa TFE..."
                className="h-8 text-xs"
              />
            </div>
            <div className="w-28 space-y-1">
              <label className="text-[11px] text-muted-foreground">Valor R$</label>
              <Input
                value={newValor}
                onChange={(e) => setNewValor(e.target.value)}
                placeholder="0,00"
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={addMut.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <Separator />

          {/* Hidden file inputs */}
          <input ref={guiaRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFileChange} />
          <input ref={comprovanteRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFileChange} />

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_70px_70px_60px_30px] gap-1 px-3 text-[10px] font-semibold text-muted-foreground uppercase">
            <span>Descrição</span>
            <span className="text-right">Valor</span>
            <span className="text-center">Guia</span>
            <span className="text-center">Comprov.</span>
            <span className="text-center">Editar</span>
            <span></span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[100px]">
            {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
            {!isLoading && items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum valor adicional cadastrado
              </p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_70px_70px_60px_30px] gap-1 items-center rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                {editId === item.id ? (
                  <>
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-7 text-xs" />
                    <Input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="h-7 text-xs" />
                    <div />
                    <div />
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => handleSaveEdit(item.id)} className="text-success hover:text-success/80">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div />
                  </>
                ) : (
                  <>
                    <span className="text-xs truncate">{item.descricao}</span>
                    <span className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {fmt(Number(item.valor))}
                    </span>
                    <div className="flex justify-center">
                      <FileActions storagePath={item.anexo_url} itemId={item.id} field="anexo_url" label="Guia/DARE" />
                    </div>
                    <div className="flex justify-center">
                      <FileActions storagePath={item.comprovante_url} itemId={item.id} field="comprovante_url" label="Comprovante" />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleDeleteRequest(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Subtotal */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm font-semibold">Subtotal de Adicionais</span>
            <span className="text-sm font-bold text-primary">{fmt(subtotal)}</span>
          </div>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Valor Adicional"
        description="Confirme a senha de administração para excluir este item."
      />
    </>
  );
}

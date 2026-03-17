import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Paperclip, CheckCircle2, Pencil, X, Check, Upload, Download } from 'lucide-react';
import {
  useValoresAdicionais, useAddValorAdicional, useUpdateValorAdicional, useDeleteValorAdicional,
} from '@/hooks/useValoresAdicionais';
import { uploadFile, viewFile } from '@/hooks/useStorageUpload';
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

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

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

  const handleFileUpload = async (itemId: string, file: File) => {
    try {
      setUploading(itemId);
      const path = await uploadFile(file, 'valores_adicionais', processoId);
      updateMut.mutate({
        id: itemId, processo_id: processoId,
        updates: { anexo_url: path },
      });
      toast.success('Guia/Recibo anexado');
    } catch {
      // handled
    } finally {
      setUploading(null);
    }
  };

  const triggerUpload = (itemId: string) => {
    setUploadTargetId(itemId);
    setTimeout(() => fileRef.current?.click(), 0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
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

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && uploadTargetId) handleFileUpload(uploadTargetId, f);
              e.target.value = '';
            }}
          />

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
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                {editId === item.id ? (
                  <>
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-7 text-xs flex-1" />
                    <Input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="h-7 text-xs w-24" />
                    <button onClick={() => handleSaveEdit(item.id)} className="text-success hover:text-success/80">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs flex-1 truncate">{item.descricao}</span>
                    <span className="text-xs font-semibold text-primary whitespace-nowrap">
                      {fmt(Number(item.valor))}
                    </span>
                    {/* Attach guia/recibo */}
                    {item.anexo_url ? (
                      <button
                        onClick={() => viewFile(item.anexo_url!)}
                        title="Ver Guia/Recibo"
                        className="text-success hover:text-success/80"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerUpload(item.id)}
                        title="Anexar Guia/Recibo"
                        disabled={uploading === item.id}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {uploading === item.id ? (
                          <Upload className="h-3.5 w-3.5 animate-pulse" />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

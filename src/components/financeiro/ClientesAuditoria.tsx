import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, Check, Pencil, Receipt, X, AlertTriangle, Phone } from 'lucide-react';
import type { ClienteFinanceiro, LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useAuditarLancamento, useAuditarTodosCliente, useAlterarValorLancamento } from '@/hooks/useFinanceiroClientes';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { clienteTemContatoCobranca } from '@/lib/contato-cobranca';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function tipoLabel(c: ClienteFinanceiro): string {
  if (c.cliente_momento_faturamento === 'no_deferimento') return 'No deferimento';
  if (c.cliente_tipo === 'MENSALISTA') return `Mensalista`;
  if (c.cliente_tipo === 'PRE_PAGO') return 'Pré-Pago';
  if (c.cliente_dia_cobranca && c.cliente_dia_cobranca > 0) return `Avulso D+${c.cliente_dia_cobranca}`;
  return 'Avulso';
}

export function ClientesAuditoria({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="font-semibold text-emerald-400">Tudo auditado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhum processo aguardando auditoria. A aba Cobrar está pronta.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalProcessos = clientes.reduce((s, c) => s + c.qtd_nao_auditados, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clientes.length} clientes · {totalProcessos} processos aguardando
        </p>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {clientes.map(c => <AuditoriaItem key={c.cliente_id} cliente={c} />)}
      </Accordion>
    </div>
  );
}

function AuditoriaItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const auditarMut = useAuditarLancamento();
  const auditarTodosMut = useAuditarTodosCliente();
  const qc = useQueryClient();
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [taxaProcessoId, setTaxaProcessoId] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAction, setContactAction] = useState<'single' | 'all'>('single');
  const [pendingAuditId, setPendingAuditId] = useState('');

  const lancNaoAuditados = cliente.lancamentos.filter(l => !l.auditado && l.status !== 'pago');
  const totalNaoAuditado = lancNaoAuditados.reduce((s, l) => s + l.valor, 0);

  const temMetodoTrevo = lancNaoAuditados.some(l => l.tem_etiqueta_metodo_trevo);
  const temPrioridade = lancNaoAuditados.some(l => l.tem_etiqueta_prioridade);

  // Check if client has contact info for billing
  const temContato = clienteTemContatoCobranca({
    telefone: cliente.cliente_telefone,
    telefone_financeiro: cliente.cliente_telefone_financeiro,
    nome_contador: cliente.cliente_nome_contador,
    nome_contato_financeiro: cliente.cliente_nome_contato_financeiro,
  });

  // Determine which fields are missing
  const temNome = !!(cliente.cliente_nome_contato_financeiro || cliente.cliente_nome_contador);
  const temTelefone = !!(cliente.cliente_telefone_financeiro || cliente.cliente_telefone);

  const executarAuditarTodos = () => {
    const ids = lancNaoAuditados.map(l => l.id);
    auditarTodosMut.mutate({ lancamentoIds: ids }, {
      onSuccess: () => toast.success(`${ids.length} processos auditados ✅ — movidos para Cobrar`),
    });
  };

  const executarAuditarUm = (lancamentoId: string) => {
    auditarMut.mutate({ lancamentoId, auditado: true }, {
      onSuccess: () => toast.success('Processo auditado ✅ — movido para Cobrar'),
    });
  };

  const openContactModal = (action: 'single' | 'all', lancamentoId?: string) => {
    setContactAction(action);
    setPendingAuditId(lancamentoId || '');
    // Pre-fill name with nome_contador if available
    setContactName(cliente.cliente_nome_contador || '');
    setContactPhone('');
    setContactModalOpen(true);
  };

  const handleAuditarTodos = () => {
    if (!temContato) {
      openContactModal('all');
      return;
    }
    executarAuditarTodos();
  };

  const handleAuditarUm = (lancamentoId: string) => {
    if (!temContato) {
      openContactModal('single', lancamentoId);
      return;
    }
    executarAuditarUm(lancamentoId);
  };

  const handleContactSave = async () => {
    const digits = contactPhone.replace(/\D/g, '');
    if (contactPhone && (digits.length < 10 || digits.length > 11)) {
      toast.error('Telefone inválido. Use (XX) XXXXX-XXXX');
      return;
    }
    try {
      const updates: Record<string, any> = {};
      if (contactName) updates.nome_contato_financeiro = contactName;
      if (contactPhone) {
        updates.telefone_financeiro = contactPhone;
        // Also set main phone if empty
        if (!cliente.cliente_telefone) updates.telefone = contactPhone;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clientes').update(updates).eq('id', cliente.cliente_id);
        qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
        toast.success('Contato salvo!');
      }
    } catch {
      toast.error('Erro ao salvar contato');
    }
    setContactModalOpen(false);
    if (contactAction === 'all') executarAuditarTodos();
    else executarAuditarUm(pendingAuditId);
  };

  const handleContactSkip = () => {
    setContactModalOpen(false);
    if (contactAction === 'all') executarAuditarTodos();
    else executarAuditarUm(pendingAuditId);
  };

  const handlePhoneInput = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.slice(0, 11);
    if (digits.length <= 2) setContactPhone(digits.length > 0 ? `(${digits}` : '');
    else if (digits.length <= 7) setContactPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    else setContactPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
  };

  // Decide what to show in the modal
  const needsName = !temNome;
  const needsPhone = !temTelefone;

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 sm:gap-3 flex-1 text-left min-w-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {lancNaoAuditados.length} proc. · {fmt(totalNaoAuditado)} · {tipoLabel(cliente)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              {temMetodoTrevo && (
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                  🍀 Método Trevo
                </Badge>
              )}
              {temPrioridade && (
                <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                  🔴 Prioridade
                </Badge>
              )}
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] sm:text-xs whitespace-nowrap">
                <span className="sm:hidden">{lancNaoAuditados.length} pend.</span>
                <span className="hidden sm:inline">{lancNaoAuditados.length} não auditados</span>
              </Badge>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-9 w-9 sm:h-7 sm:w-auto sm:px-3 p-0 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); handleAuditarTodos(); }}
                disabled={auditarTodosMut.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">Auditar Todos</span>
              </Button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3">
            {lancNaoAuditados.map(l => (
              <AuditoriaFicha
                key={l.id}
                lancamento={l}
                clienteApelido={cliente.cliente_apelido || cliente.cliente_nome}
                onOpenTaxa={(processoId) => {
                  setTaxaProcessoId(processoId);
                  setTaxaModalOpen(true);
                }}
                onAuditar={() => handleAuditarUm(l.id)}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
      {taxaProcessoId && (
        <ValoresAdicionaisModal
          open={taxaModalOpen}
          onOpenChange={setTaxaModalOpen}
          processoId={taxaProcessoId}
          clienteApelido={cliente.cliente_apelido || cliente.cliente_nome}
        />
      )}
      {/* Contact Modal for Billing */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Contato para cobrança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong>{cliente.cliente_apelido || cliente.cliente_nome}</strong> não tem {!temTelefone ? 'telefone' : 'contato completo'} cadastrado para cobrança.
            </p>
            <p className="text-xs text-muted-foreground">
              Para quem a Carolina deve enviar a cobrança?
            </p>
            {needsName && (
              <div className="space-y-1.5">
                <Label className="text-sm">Nome do responsável</Label>
                <Input
                  type="text"
                  placeholder="Ex: Fernando Barbosa"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="h-10"
                  style={{ fontSize: 16 }}
                />
              </div>
            )}
            {needsPhone && (
              <div className="space-y-1.5">
                <Label className="text-sm">Telefone (WhatsApp)</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={contactPhone}
                  onChange={e => handlePhoneInput(e.target.value)}
                  className="h-10"
                  style={{ fontSize: 16 }}
                  autoFocus={!needsName}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleContactSkip} className="text-muted-foreground">
              Pular
            </Button>
            <Button onClick={handleContactSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar e Auditar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AuditoriaFicha({
  lancamento: l,
  clienteApelido,
  onOpenTaxa,
  onAuditar,
}: {
  lancamento: LancamentoFinanceiro;
  clienteApelido: string;
  onOpenTaxa: (processoId: string) => void;
  onAuditar: () => void;
}) {
  const auditarMut = useAuditarLancamento();
  const alterarValorMut = useAlterarValorLancamento();
  const [editingValor, setEditingValor] = useState(false);
  const [novoValor, setNovoValor] = useState('');

  const alertaTaxas = (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0;

  const handleDesmarcar = () => {
    auditarMut.mutate({ lancamentoId: l.id, auditado: false }, {
      onSuccess: () => toast.success('Auditoria removida'),
    });
  };

  const handleSalvarValor = () => {
    const valor = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { toast.error('Valor inválido'); return; }
    alterarValorMut.mutate({
      lancamentoId: l.id,
      novoValor: valor,
      valorAtual: l.valor,
    }, {
      onSuccess: () => setEditingValor(false),
    });
  };

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      l.auditado ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20"
    )}>
      {/* Header */}
      <div>
        <p className="text-sm font-semibold truncate">{l.processo_razao_social}</p>
        <p className="text-xs text-muted-foreground truncate">
          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo}
          {l.processo_etapa && ` · ${l.processo_etapa}`}
        </p>
      </div>

      {/* Etiquetas */}
      <div className="flex gap-1 flex-wrap">
        {l.tem_etiqueta_metodo_trevo && (
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
            🍀 Método Trevo
          </Badge>
        )}
        {l.tem_etiqueta_prioridade && (
          <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
            🔴 Prioridade
          </Badge>
        )}
      </div>

      {/* Valor + Vencimento */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-primary">{fmt(l.valor)}</span>
          {l.valor_original != null && l.valor_original !== l.valor && (
            <span className="text-[10px] text-muted-foreground line-through">
              {fmt(l.valor_original)}
            </span>
          )}
          {l.valor_alterado_em && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-500/30">
              ✏️ Alterado
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">Vence {fmtDate(l.data_vencimento)}</span>
      </div>

      {/* Taxas adicionais */}
      <div className="text-xs text-muted-foreground">
        Taxas adicionais: {l.total_valores_adicionais > 0 ? fmt(l.total_valores_adicionais) : 'R$ 0,00'}
      </div>

      {/* Alerta de taxas */}
      {alertaTaxas && (
        <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-600 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Este processo tem etiqueta especial mas não tem taxas adicionais cadastradas. Verificar antes de auditar.</span>
        </div>
      )}

      {/* Edição de valor inline */}
      {editingValor && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={novoValor}
            onChange={e => setNovoValor(e.target.value)}
            placeholder="Novo valor"
            className="h-8 text-sm w-32"
            style={{ fontSize: 16 }}
            autoFocus
          />
          <Button size="sm" variant="ghost" className="h-8 text-emerald-600" onClick={handleSalvarValor} disabled={alterarValorMut.isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setEditingValor(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Observações */}
      {l.observacoes_financeiro && (
        <p className="text-xs text-muted-foreground italic">Obs: {l.observacoes_financeiro}</p>
      )}
      {l.processo_notas && (
        <p className="text-xs text-muted-foreground italic">Notas: {l.processo_notas}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => { setNovoValor(String(l.valor)); setEditingValor(true); }}
        >
          <Pencil className="h-3 w-3 mr-1" /> Editar Valor
        </Button>
        {l.processo_id && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => onOpenTaxa(l.processo_id)}
          >
            <Receipt className="h-3 w-3 mr-1" /> Add Taxa
          </Button>
        )}
        <Button
          size="sm"
          className={cn(
            "text-xs h-7",
            l.auditado
              ? "bg-emerald-600/20 text-emerald-600 hover:bg-emerald-600/30 border border-emerald-600/30"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
          onClick={l.auditado ? handleDesmarcar : onAuditar}
          disabled={auditarMut.isPending}
        >
          <Check className="h-3 w-3 mr-1" /> {l.auditado ? 'Auditado ✅' : 'Auditar'}
        </Button>
      </div>
    </div>
  );
}

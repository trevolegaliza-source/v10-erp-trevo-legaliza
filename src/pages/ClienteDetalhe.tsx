import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Building2, User, Settings, FileText, DollarSign, Download, Trash2, Upload, Edit2, Save, X, Plus, FileBarChart, Receipt, Archive, ArchiveRestore, ExternalLink, Eye, Pencil, List } from 'lucide-react';
import { formatCNPJ, maskCNPJ, isValidCNPJ, maskCodigo } from '@/lib/cnpj';
import { formatCEP, buscarCEP, buscarCoordenadas } from '@/lib/cep';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUpsertServiceNegotiations } from '@/hooks/useServiceNegotiations';
import HonorariosInlineRepeater, { type InlineNegotiationRow, emptyNegotiationRow } from '@/components/clientes/HonorariosInlineRepeater';
import ServicosPreAcordados from '@/components/clientes/ServicosPreAcordados';
import PrepagoTab from '@/components/clientes/PrepagoTab';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useUpdateCliente, useCreateProcesso, useDeleteCliente, useArchiveCliente, useUnarchiveCliente } from '@/hooks/useFinanceiro';
import { KANBAN_STAGES } from '@/types/process';
import { STATUS_LABELS, STATUS_STYLES, TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ClienteDB, ProcessoDB, Lancamento, StatusFinanceiro, TipoProcesso, TipoCliente } from '@/types/financial';
import { cn } from '@/lib/utils';
import { UFS_BRASIL } from '@/constants/estados-brasil';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { STORAGE_BUCKETS } from '@/constants/storage';
import ContractDropzone from '@/components/contratos/ContractDropzone';
import ContractPreviewModal from '@/components/contratos/ContractPreviewModal';
import { useServiceNegotiations } from '@/hooks/useServiceNegotiations';
import ProcessoEditModal from '@/components/financeiro/ProcessoEditModal';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeferimentoAlertData {
  clienteNome: string;
  naoDeferidos: ProcessoDB[];
  todosSelecionados: ProcessoDB[];
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<ClienteDB | null>(null);
  const [processos, setProcessos] = useState<ProcessoDB[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contracts, setContracts] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});
  const [uploadingContract, setUploadingContract] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);
  const [showEditCadastro, setShowEditCadastro] = useState(false);
  const [editCadastroForm, setEditCadastroForm] = useState<Record<string, any>>({});
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [editHonorariosRows, setEditHonorariosRows] = useState<InlineNegotiationRow[]>([]);
  const upsertNegotiations = useUpsertServiceNegotiations();
  const updateCliente = useUpdateCliente();
  const createProcesso = useCreateProcesso();
  const { data: negotiations } = useServiceNegotiations(id);
  const deleteCliente = useDeleteCliente();
  const archiveCliente = useArchiveCliente();
  const unarchiveCliente = useUnarchiveCliente();

  // Action dialogs
  const [showArchivePassword, setShowArchivePassword] = useState(false);
  const [showDeleteClientePassword, setShowDeleteClientePassword] = useState(false);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [showCobrancaDialog, setShowCobrancaDialog] = useState(false);
  const [selectedRelatorioProcessos, setSelectedRelatorioProcessos] = useState<Set<string>>(new Set());
  const [selectedCobrancaProcessos, setSelectedCobrancaProcessos] = useState<Set<string>>(new Set());
  const [selectedProcessosTab, setSelectedProcessosTab] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);
  const [generatingExtrato, setGeneratingExtrato] = useState(false);
  const [showMarkFaturadoDialog, setShowMarkFaturadoDialog] = useState(false);
  const [showDeferimentoAlert, setShowDeferimentoAlert] = useState(false);
  const [deferimentoAlertData, setDeferimentoAlertData] = useState<DeferimentoAlertData | null>(null);

  // Boas-vindas (1º processo) — alert antes de abrir o formulário
  const [showBoasVindasAlert, setShowBoasVindasAlert] = useState(false);
  const [boasVindasPct, setBoasVindasPct] = useState('50');

  const [showNovoProcesso, setShowNovoProcesso] = useState(false);
  const [processoForm, setProcessoForm] = useState({
    razao_social: '',
    tipo: 'abertura' as string,
    prioridade: 'normal',
    responsavel: '',
    valor_manual: '',
    definir_manual: false,
    negotiated_service_id: '' as string,
    mudanca_uf: false,
    boas_vindas: false,
    boas_vindas_pct: '50',
  });
  const isManualPrice = processoForm.definir_manual;
  const isNegotiatedService = !!processoForm.negotiated_service_id;
  const isArchived = !!(cliente as any)?.is_archived;

  const handleClickNovoProcesso = () => {
    if (!cliente) return;

    // Verificar se é primeiro processo
    const isFirst = processos.length === 0 && !(cliente as any).desconto_boas_vindas_aplicado;
    if (isFirst) {
      setBoasVindasPct('50');
      setShowBoasVindasAlert(true);
      return;
    }

    setShowNovoProcesso(true);
  };

  async function gerarExtratoClienteDetalhe(procsToGenerate: ProcessoDB[]) {
    if (!cliente) return;
    setGeneratingExtrato(true);
    try {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', cliente.id)
        .single();

      if (clienteData?.dia_vencimento_mensal && clienteData.dia_vencimento_mensal > 0 && !clienteData.dia_cobranca) {
        toast.info(`Atenção: o cliente ${clienteData.apelido || clienteData.nome} tem vencimento fixo no dia ${clienteData.dia_vencimento_mensal} de cada mês.`);
      }
      const processosFin: ProcessoFinanceiro[] = procsToGenerate.map(p => ({
        ...p,
        etapa_financeiro: 'gerar_cobranca' as const,
        lancamento: lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber') || null,
      }));
      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(procsToGenerate.map(p => p.id)),
        fetchCompetenciaProcessos(cliente.id),
      ]);
      const doc = await gerarExtratoPDF({
        processos: processosFin,
        allCompetencia,
        valoresAdicionais,
        cliente: clienteData as any,
      });
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clienteName = clienteData?.apelido || clienteData?.nome || 'extrato';
      a.download = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Extrato gerado com sucesso!');
      setShowMarkFaturadoDialog(true);
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGeneratingExtrato(false);
    }
  }

  const handleCreateProcesso = async () => {
    if (!cliente || !processoForm.razao_social.trim()) {
      toast.error('Preencha a Razão Social');
      return;
    }
    // Determine valor: negotiated service uses fixed_price, otherwise normal flow
    const negotiatedService = negotiations?.find(n => n.id === processoForm.negotiated_service_id);
    let valorManualFinal = negotiatedService
      ? negotiatedService.fixed_price
      : (isManualPrice && processoForm.valor_manual ? Number(processoForm.valor_manual) : undefined);

    let notas = '';

    // Mudança de UF
    if (processoForm.mudanca_uf) {
      notas += 'Mudança de UF (2 Processos)';
    }

    // Boas-vindas: pass percentage to useCreateProcesso which handles discount calculation
    const boasVindasPctToSend = processoForm.boas_vindas
      ? Number(boasVindasPct || processoForm.boas_vindas_pct) || 50
      : undefined;

    createProcesso.mutate(
      {
        cliente_id: cliente.id,
        razao_social: processoForm.razao_social.trim(),
        tipo: (isNegotiatedService ? 'avulso' : processoForm.tipo) as TipoProcesso,
        prioridade: processoForm.prioridade,
        responsavel: processoForm.responsavel || undefined,
        valor_manual: valorManualFinal,
        notas: notas || undefined,
        mudanca_uf: processoForm.mudanca_uf,
        desconto_boas_vindas: boasVindasPctToSend,
      },
      {
        onSuccess: async () => {
          // Mark boas-vindas applied
          if (processoForm.boas_vindas) {
            await supabase.from('clientes').update({ desconto_boas_vindas_aplicado: true }).eq('id', cliente.id);
          }
          setShowNovoProcesso(false);
          setProcessoForm({ razao_social: '', tipo: 'abertura', prioridade: 'normal', responsavel: '', valor_manual: '', definir_manual: false, negotiated_service_id: '', mudanca_uf: false, boas_vindas: false, boas_vindas_pct: '50' });
          loadAll(cliente.id);
        },
      }
    );
  };

  useEffect(() => {
    if (!id) return;
    loadAll(id);
  }, [id]);

  const loadAll = async (clienteId: string) => {
    setLoading(true);
    const [cRes, pRes, lRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      supabase.from('processos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('lancamentos').select('*').eq('cliente_id', clienteId).order('data_vencimento', { ascending: false }),
    ]);
    if (cRes.data) { setCliente(cRes.data as ClienteDB); setEditForm(cRes.data as ClienteDB); }
    setProcessos((pRes.data || []) as ProcessoDB[]);
    setLancamentos((lRes.data || []) as Lancamento[]);
    loadContracts(clienteId);
    setLoading(false);
  };

  const loadContracts = async (clienteId: string) => {
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(clienteId);
    setContracts((data || []).map(f => ({ name: f.name })));
  };

  const handleSaveParams = () => {
    if (!cliente) return;
    const payload: Record<string, any> = { id: cliente.id };
    const fields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'momento_faturamento', 'dia_vencimento_mensal', 'franquia_processos'] as const;
    for (const f of fields) {
      if ((editForm as any)[f] !== undefined) payload[f] = (editForm as any)[f];
    }
    updateCliente.mutate(payload as any, {
      onSuccess: () => { setEditing(false); loadAll(cliente.id); toast.success('Parâmetros atualizados!'); },
      onError: (err: any) => { toast.error('Erro ao salvar: ' + (err?.message || 'Erro desconhecido')); },
    });
  };

  // ── Edit Cadastro handlers ──
  const openEditCadastro = () => {
    if (!cliente) return;
    setEditCadastroForm({
      nome: cliente.nome || '',
      apelido: cliente.apelido || '',
      nome_contador: cliente.nome_contador || '',
      cnpj: maskCNPJ((cliente as any).cnpj || ''),
      codigo_identificador: cliente.codigo_identificador || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      tipo: cliente.tipo,
      estado: (cliente as any).estado || '',
      cidade: (cliente as any).cidade || '',
      cep: (cliente as any).cep || '',
      logradouro: (cliente as any).logradouro || '',
      numero: (cliente as any).numero || '',
      complemento: (cliente as any).complemento || '',
      bairro: (cliente as any).bairro || '',
      // Financial fields
      momento_faturamento: (cliente as any).momento_faturamento || 'na_solicitacao',
      forma_cobranca: Number((cliente as any).dia_vencimento_mensal) > 0 && !(cliente as any).dia_cobranca ? 'fatura_mensal' : 'por_processo',
      dia_cobranca: String((cliente as any).dia_cobranca ?? '4'),
      dia_vencimento_mensal: String((cliente as any).dia_vencimento_mensal ?? '15'),
      valor_base: String((cliente as any).valor_base ?? ''),
      desconto_progressivo: String((cliente as any).desconto_progressivo ?? ''),
      valor_limite_desconto: String((cliente as any).valor_limite_desconto ?? ''),
      mensalidade: String((cliente as any).mensalidade ?? ''),
      franquia_processos: String((cliente as any).franquia_processos ?? ''),
      saldo_prepago: String((cliente as any).saldo_prepago ?? ''),
    });
    // Load existing negotiations into inline rows
    setEditHonorariosRows(
      (negotiations || []).map(n => ({
        key: n.id,
        service_name: n.service_name,
        fixed_price: String(n.fixed_price),
        billing_trigger: n.billing_trigger as 'request' | 'approval',
        trigger_days: String(n.trigger_days),
      }))
    );
    setShowEditCadastro(true);
  };

  const handleCnpjEditChange = (value: string) => {
    const masked = maskCNPJ(value);
    const digits = value.replace(/\D/g, '');
    const codigo = digits.slice(0, 6);
    setEditCadastroForm(f => ({
      ...f,
      cnpj: masked,
      codigo_identificador: codigo || f.codigo_identificador,
    }));
  };

  const [savingCadastro, setSavingCadastro] = useState(false);
  const handleSaveCadastro = async () => {
    if (!cliente) return;
    const cnpjDigits = (editCadastroForm.cnpj || '').replace(/\D/g, '');
    if (cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
      toast.error('Erro ao validar CNPJ: deve conter 14 dígitos.');
      return;
    }
    setSavingCadastro(true);
    try {
      const isAvulso = editCadastroForm.tipo === 'AVULSO_4D';
      const isMensalistaEdit = editCadastroForm.tipo === 'MENSALISTA';
      const isPrePagoEdit = editCadastroForm.tipo === 'PRE_PAGO';
      const isFormaProcesso = editCadastroForm.forma_cobranca === 'por_processo';

      const payload: Record<string, any> = {
        id: cliente.id,
        nome: editCadastroForm.nome,
        apelido: editCadastroForm.apelido,
        nome_contador: editCadastroForm.nome_contador,
        cnpj: cnpjDigits || null,
        codigo_identificador: editCadastroForm.codigo_identificador?.replace(/\D/g, '') || cliente.codigo_identificador,
        email: editCadastroForm.email || null,
        telefone: editCadastroForm.telefone || null,
        tipo: editCadastroForm.tipo,
        estado: editCadastroForm.estado || null,
        cidade: editCadastroForm.cidade || null,
        cep: (editCadastroForm.cep || '').replace(/\D/g, '') || null,
        logradouro: editCadastroForm.logradouro || null,
        numero: editCadastroForm.numero || null,
        complemento: editCadastroForm.complemento || null,
        bairro: editCadastroForm.bairro || null,
        // Financial fields
        momento_faturamento: isAvulso ? editCadastroForm.momento_faturamento : isMensalistaEdit ? 'na_solicitacao' : null,
        dia_vencimento_mensal: isAvulso ? (isFormaProcesso ? null : (Number(editCadastroForm.dia_vencimento_mensal) || 15)) : isMensalistaEdit ? (Number(editCadastroForm.dia_vencimento_mensal) || 10) : null,
        dia_cobranca: isAvulso && isFormaProcesso ? (Number(editCadastroForm.dia_cobranca) || 4) : null,
        valor_base: (isAvulso || isMensalistaEdit || isPrePagoEdit) && editCadastroForm.valor_base ? Number(editCadastroForm.valor_base) : null,
        desconto_progressivo: (isAvulso || isMensalistaEdit) && editCadastroForm.desconto_progressivo ? Number(editCadastroForm.desconto_progressivo) : null,
        valor_limite_desconto: (isAvulso || isMensalistaEdit) && editCadastroForm.valor_limite_desconto ? Number(editCadastroForm.valor_limite_desconto) : null,
        mensalidade: isMensalistaEdit && editCadastroForm.mensalidade ? Number(editCadastroForm.mensalidade) : null,
        franquia_processos: isMensalistaEdit && editCadastroForm.franquia_processos ? Number(editCadastroForm.franquia_processos) : 0,
        saldo_prepago: isPrePagoEdit && editCadastroForm.saldo_prepago ? Number(editCadastroForm.saldo_prepago) : undefined,
      };
      // Fetch coordinates in background
      if (editCadastroForm.cidade && editCadastroForm.estado) {
        const coords = await buscarCoordenadas(editCadastroForm.logradouro || '', editCadastroForm.cidade, editCadastroForm.estado);
        if (coords) {
          payload.latitude = coords.lat;
          payload.longitude = coords.lng;
        }
      }
      await new Promise<void>((resolve, reject) => {
        updateCliente.mutate(payload as any, {
          onSuccess: () => resolve(),
          onError: (err: any) => reject(err),
        });
      });
      // Upsert honorários
      const validRows = editHonorariosRows.filter(r => r.service_name.trim() && r.fixed_price);
      await upsertNegotiations.mutateAsync({
        clienteId: cliente.id,
        negotiations: validRows.map(r => ({
          service_name: r.service_name.trim(),
          fixed_price: Number(r.fixed_price),
          billing_trigger: r.billing_trigger,
          trigger_days: Number(r.trigger_days) || 0,
          is_custom: true as const,
        })),
      });
      toast.success('Dados cadastrais e honorários atualizados!');
      setShowEditCadastro(false);
      loadAll(cliente.id);
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Desconhecido'));
    } finally {
      setSavingCadastro(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!cliente) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) { toast.error('Formato inválido. Aceitos: PDF, PNG, JPG'); throw new Error('invalid'); }
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 10MB'); throw new Error('too large'); }
    setUploadingContract(true);
    const path = `${cliente.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file);
    if (error) { toast.error('Erro no upload: ' + error.message); setUploadingContract(false); throw error; }
    toast.success('Contrato anexado!');
    loadContracts(cliente.id);
    setUploadingContract(false);
  };

  const handleDownload = async (fileName: string) => {
    if (!cliente) return;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).download(`${cliente.id}/${fileName}`);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewContract = async (fileName: string) => {
    if (!cliente) return;
    const storagePath = `${cliente.id}/${fileName}`;
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast.error('Erro: Arquivo antigo incompatível, por favor re-anexe');
    }
  };

  const handleDeleteContract = (fileName: string) => {
    if (!cliente) return;
    setPendingDeleteAction(() => async () => {
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).remove([`${cliente.id}/${fileName}`]);
      if (error) toast.error('Erro ao excluir');
      else { toast.success('Removido'); loadContracts(cliente.id); }
    });
    setShowDeletePassword(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="link" asChild><Link to="/clientes">Voltar</Link></Button>
      </div>
    );
  }

  const isMensalista = cliente.tipo === 'MENSALISTA';
  const isPrePago = cliente.tipo === 'PRE_PAGO';
  const momentoFat = (cliente as any).momento_faturamento || 'na_solicitacao';
  const isDeferimento = momentoFat === 'no_deferimento';
  const totalProcessos = processos.length;
  const processosAtivos = processos.filter(p => p.etapa !== 'finalizados' && p.etapa !== 'arquivo').length;
  const totalFaturado = lancamentos.filter(l => l.tipo === 'receber').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const formatCurrencyOrZero = (value: number | null | undefined) =>
    Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatValueOrZero = (value: number | null | undefined) =>
    value == null ? '0,00' : String(value);

  const DEFERIMENTO_STAGES = ['registro', 'finalizados'];
  const billedProcessIds = new Set(lancamentos.filter(l => l.tipo === 'receber' && l.processo_id).map(l => l.processo_id));
  const aguardandoDeferimento = isDeferimento
    ? processos.filter(p => !DEFERIMENTO_STAGES.includes(p.etapa) && p.etapa !== 'arquivo' && !billedProcessIds.has(p.id))
    : [];

  // CNPJ display - field is cnpj (14 digits), codigo_identificador is 6 digits
  const cnpjInfo = formatCNPJ((cliente as any).cnpj);
  const codigoDisplay = cliente.codigo_identificador || '—';

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1" asChild>
          <Link to="/clientes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{cliente.apelido || cliente.nome}</h1>
            <Badge className={cn('text-xs', isMensalista ? 'bg-primary/10 text-primary border-primary/30' : isPrePago ? 'bg-info/10 text-info border-info/30' : 'bg-warning/10 text-warning border-warning/30')} variant="outline">
              {isMensalista ? 'Mensalista' : isPrePago ? 'Pré-Pago' : 'Avulso'}
            </Badge>
            {isDeferimento && (
              <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                Fatura no Deferimento
              </Badge>
            )}
            {isArchived && (
              <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                Arquivado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{cliente.nome}</span>
            {(cliente as any).cnpj && (
              <span className={`text-xs font-mono ${!cnpjInfo.valid ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                CNPJ: {cnpjInfo.formatted}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Código: {maskCodigo(codigoDisplay)}</span>
            {cliente.nome_contador && <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" />{cliente.nome_contador}</span>}
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={openEditCadastro}>
            <Pencil className="h-3.5 w-3.5" /> Editar Cadastro
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={() => { setSelectedRelatorioProcessos(new Set()); setShowRelatorioDialog(true); }}>
            <FileBarChart className="h-3.5 w-3.5" /> Gerar Relatório
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-foreground" onClick={() => { setSelectedCobrancaProcessos(new Set()); setShowCobrancaDialog(true); }}>
            <Receipt className="h-3.5 w-3.5" /> Gerar Cobrança
          </Button>
          {isArchived ? (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary" onClick={() => setShowArchivePassword(true)}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Desarquivar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-warning" onClick={() => setShowArchivePassword(true)}>
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive" onClick={() => setShowDeleteClientePassword(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Processos</p>
            <p className="text-2xl font-bold">{totalProcessos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-primary">{processosAtivos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturado</p>
            <p className="text-2xl font-bold">{totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold text-warning">{totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financeiro-config" className="space-y-4">
        <TabsList className={cn("grid w-full", isPrePago ? "grid-cols-7" : "grid-cols-6")}>
          <TabsTrigger value="financeiro-config" className="text-xs gap-1"><Settings className="h-3.5 w-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="honorarios" className="text-xs gap-1"><List className="h-3.5 w-3.5" />Serviços</TabsTrigger>
          <TabsTrigger value="processos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Processos</TabsTrigger>
          <TabsTrigger value="faturas" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Faturas</TabsTrigger>
          <TabsTrigger value="contratos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Contratos</TabsTrigger>
          {isPrePago && <TabsTrigger value="prepago" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Pré-Pago</TabsTrigger>}
          <TabsTrigger value="observacoes" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Obs.</TabsTrigger>
        </TabsList>

        {/* ── Config Financeira ── */}
        <TabsContent value="financeiro-config">
          <Card className="border-border/60">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Parâmetros Financeiros</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3.5 w-3.5" /> Editar Parâmetros
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(cliente); }}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                  <Button size="sm" className="gap-1.5" onClick={handleSaveParams} disabled={updateCliente.isPending}><Save className="h-3.5 w-3.5" />Salvar</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de Cliente</Label>
                  <p className="font-medium">{isMensalista ? 'Mensalista' : isPrePago ? 'Pré-Pago' : 'Avulso'}</p>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Momento do Faturamento</Label>
                  {editing ? (
                    <Select value={(editForm as any).momento_faturamento || 'na_solicitacao'} onValueChange={(v) => setEditForm(f => ({ ...f, momento_faturamento: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                        <SelectItem value="no_deferimento">No Deferimento</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{isDeferimento ? 'No Deferimento' : 'Na Solicitação'}</p>
                  )}
                </div>
                {isMensalista ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor da Mensalidade</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).mensalidade ?? ''} onChange={e => setEditForm(f => ({ ...f, mensalidade: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).mensalidade)}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Franquia de Processos/mês</Label>
                      {editing ? (
                        <Input type="number" min={0} value={(editForm as any).franquia_processos ?? ''} onChange={e => setEditForm(f => ({ ...f, franquia_processos: e.target.value ? Number(e.target.value) : 0 }))} placeholder="0" />
                      ) : (
                        <p className="font-medium">{(cliente as any).franquia_processos ?? 0} processos</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Vencimento</Label>
                      {editing ? (
                        <Input type="number" min={1} max={31} value={(editForm as any).vencimento ?? (editForm as any).dia_vencimento_mensal ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setEditForm(f => ({ ...f, vencimento: v, dia_vencimento_mensal: v ?? undefined })); }} />
                      ) : (
                        <p className="font-medium">Dia {(cliente as any).vencimento ?? cliente.dia_vencimento_mensal ?? 0}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor Base (proc. excedente)</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).valor_base)}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Desc. Progressivo % (excedente)</Label>
                      {editing ? (
                        <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => setEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                      ) : (
                        <p className="font-medium">{formatValueOrZero((cliente as any).desconto_progressivo)}%</p>
                      )}
                    </div>
                    <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                      <p className="text-xs text-muted-foreground">
                        Processos dentro da franquia: R$ 0,00. Processos excedentes usam valor base com desconto progressivo configurado acima.
                      </p>
                    </div>
                  </>
                ) : isPrePago ? (
                  <>
                    <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <p className="text-xs text-muted-foreground">Saldo Atual</p>
                      <p className={`text-2xl font-bold ${Number((cliente as any).saldo_prepago ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrencyOrZero((cliente as any).saldo_prepago)}
                      </p>
                      {(cliente as any).data_ultima_recarga && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última recarga: {formatCurrencyOrZero((cliente as any).saldo_ultima_recarga)} em {new Date((cliente as any).data_ultima_recarga).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                      <p className="text-xs text-muted-foreground">
                        Para clientes pré-pagos, o valor de cada processo é definido nos Serviços Pré-Acordados. O saldo é debitado automaticamente ao cadastrar o processo.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-1.5 col-span-2">
                      <Label className="text-xs text-muted-foreground">Forma de Cobrança</Label>
                      {editing ? (
                        <RadioGroup
                          value={Number((editForm as any).dia_vencimento_mensal) > 0 ? 'fatura_mensal' : 'por_processo'}
                          onValueChange={(v) => {
                            if (v === 'por_processo') {
                              setEditForm(f => ({ ...f, dia_vencimento_mensal: null, dia_cobranca: (f as any).dia_cobranca ?? 4 }));
                            } else {
                              setEditForm(f => ({ ...f, dia_vencimento_mensal: 15, dia_cobranca: null }));
                            }
                          }}
                          className="flex gap-4"
                        >
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="por_processo" id="edit-fc-processo" />
                            <Label htmlFor="edit-fc-processo" className="text-xs cursor-pointer">Por processo (D+X dias)</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="fatura_mensal" id="edit-fc-mensal" />
                            <Label htmlFor="edit-fc-mensal" className="text-xs cursor-pointer">Fatura mensal (dia fixo)</Label>
                          </div>
                        </RadioGroup>
                      ) : (
                        <p className="font-medium">
                          {Number(cliente.dia_vencimento_mensal) > 0 ? `Fatura mensal — dia ${cliente.dia_vencimento_mensal}` : `Por processo — D+${(cliente as any).dia_cobranca ?? 4}`}
                        </p>
                      )}
                    </div>
                    {editing && Number((editForm as any).dia_vencimento_mensal) > 0 ? (
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Dia de vencimento da fatura</Label>
                        <Input type="number" min={1} max={31} value={(editForm as any).dia_vencimento_mensal ?? ''} onChange={e => setEditForm(f => ({ ...f, dia_vencimento_mensal: e.target.value ? Number(e.target.value) : null }))} placeholder="15" />
                      </div>
                    ) : editing ? (
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Vencimento após solicitação</Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">D+</span>
                          <Input type="number" min={1} max={60} value={(editForm as any).dia_cobranca ?? ''} onChange={e => setEditForm(f => ({ ...f, dia_cobranca: e.target.value ? Number(e.target.value) : null }))} placeholder="4" className="w-20" />
                          <span className="text-xs text-muted-foreground">dias</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor Base</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).valor_base)}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Desconto Progressivo (%)</Label>
                      {editing ? (
                        <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => setEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                      ) : (
                        <p className="font-medium">{formatValueOrZero((cliente as any).desconto_progressivo)}%</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor Limite de Desconto</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).valor_limite_desconto ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_limite_desconto: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).valor_limite_desconto)}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Serviços Pré-Acordados ── */}
        <TabsContent value="honorarios">
          <ServicosPreAcordados clienteId={cliente.id} isPrePago={isPrePago} />
        </TabsContent>

        {/* ── Processos ── */}
        <TabsContent value="processos">
          {aguardandoDeferimento.length > 0 && (
            <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <p className="text-xs font-semibold text-warning mb-2">⏳ Aguardando Deferimento para Cobrança ({aguardandoDeferimento.length})</p>
              <div className="space-y-1">
                {aguardandoDeferimento.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.razao_social}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card className="border-border/60">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Histórico de Processos ({totalProcessos})</CardTitle>
              <div className="flex items-center gap-2">
                {selectedProcessosTab.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    disabled={generatingExtrato}
                    onClick={async () => {
                      if (!cliente) return;
                      const selectedProcs = processos.filter(p => selectedProcessosTab.has(p.id));
                      if (selectedProcs.length === 0) return;

                      const clienteId = selectedProcs[0].cliente_id;
                      const { data: clienteCheck } = await supabase
                        .from('clientes')
                        .select('momento_faturamento, nome')
                        .eq('id', clienteId)
                        .single();

                      if (clienteCheck?.momento_faturamento === 'no_deferimento') {
                        const DEFER_STAGES = ['registro', 'finalizados'];
                        const naoDeferidos = selectedProcs.filter(p => !DEFER_STAGES.includes(p.etapa));

                        if (naoDeferidos.length > 0) {
                          setDeferimentoAlertData({
                            clienteNome: clienteCheck.nome || cliente.nome,
                            naoDeferidos,
                            todosSelecionados: selectedProcs,
                          });
                          setShowDeferimentoAlert(true);
                          return;
                        }
                      }

                      gerarExtratoClienteDetalhe(selectedProcs);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {generatingExtrato ? 'Gerando...' : `Gerar Extrato (${selectedProcessosTab.size})`}
                  </Button>
                )}
                <Button size="sm" className="gap-1.5" onClick={handleClickNovoProcesso}>
                  <Plus className="h-3.5 w-3.5" /> Novo Processo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {processos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={processos.length > 0 && selectedProcessosTab.size === processos.length}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedProcessosTab(new Set(processos.map(p => p.id)));
                            else setSelectedProcessosTab(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processos.map(p => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onDoubleClick={() => {
                          const fin: ProcessoFinanceiro = {
                            ...p,
                            etapa_financeiro: 'solicitacao_criada' as const,
                            lancamento: lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber') || null,
                          };
                          setEditProcesso(fin);
                          setEditModalOpen(true);
                        }}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedProcessosTab.has(p.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedProcessosTab);
                              if (checked) next.add(p.id); else next.delete(p.id);
                              setSelectedProcessosTab(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{p.razao_social}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}</TableCell>
                        <TableCell>
                          {p.prioridade === 'urgente'
                            ? <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                            : <span className="text-xs text-muted-foreground">Normal</span>}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum processo registrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Financeiro ── */}
        <TabsContent value="faturas">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Faturas e Fechamentos</CardTitle>
                <div className="flex gap-2 text-xs">
                  <Badge className="bg-success/10 text-success border-0">Pago: {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                  <Badge className="bg-warning/10 text-warning border-0">Pendente: {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isMensalista && (
                <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium">Próximo Fechamento (Avulso)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cobrança prevista para D+{cliente.dia_vencimento_mensal || 4} após a última solicitação
                  </p>
                </div>
              )}
              {lancamentos.filter(l => l.tipo === 'receber').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.filter(l => l.tipo === 'receber').map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-sm">{l.descricao}</TableCell>
                        <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px] border-0', STATUS_STYLES[l.status as StatusFinanceiro] || '')}>
                            {STATUS_LABELS[l.status as StatusFinanceiro] || l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma fatura registrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contratos ── */}
        <TabsContent value="contratos">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contratos Anexados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contracts.length > 0 ? (
                <div className="space-y-2">
                  {contracts.map(c => {
                    const handlePreview = async () => {
                      const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).createSignedUrl(`${cliente.id}/${c.name}`, 3600);
                      if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewFileName(c.name); }
                    };
                    return (
                      <div key={c.name} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm truncate">{c.name}</span>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handlePreview}>
                          <Eye className="h-3 w-3" /> Visualizar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleViewContract(c.name)}>
                          <ExternalLink className="h-3 w-3" /> Nova aba
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleDownload(c.name)}>
                          <Download className="h-3 w-3" /> Baixar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleDeleteContract(c.name)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">Nenhum contrato anexado</p>
              )}
              <ContractDropzone uploading={uploadingContract} onUpload={handleUpload} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pré-Pago ── */}
        {isPrePago && (
          <TabsContent value="prepago">
            <PrepagoTab cliente={cliente} onReload={() => loadAll(cliente.id)} />
          </TabsContent>
        )}

        {/* ── Observações ── */}
        <TabsContent value="observacoes">
          <Card className="border-border/60">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Observações Adicionais</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3.5 w-3.5" /> Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(cliente); }}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                  <Button size="sm" className="gap-1.5" onClick={() => {
                    if (!cliente) return;
                    const payload: any = { id: cliente.id, observacoes: (editForm as any).observacoes || null };
                    updateCliente.mutate(payload, {
                      onSuccess: () => { setEditing(false); loadAll(cliente.id); toast.success('Observações salvas!'); },
                    });
                  }} disabled={updateCliente.isPending}><Save className="h-3.5 w-3.5" />Salvar</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <textarea
                  className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="Observações sobre o cliente, condições especiais, etc."
                  value={(editForm as any).observacoes || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{(cliente as any).observacoes || 'Nenhuma observação registrada.'}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Cadastro Dialog */}
      <Dialog open={showEditCadastro} onOpenChange={setShowEditCadastro}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cadastro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Nome da Contabilidade *</Label>
                <Input value={editCadastroForm.nome || ''} onChange={e => setEditCadastroForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Apelido</Label>
                <Input value={editCadastroForm.apelido || ''} onChange={e => setEditCadastroForm(f => ({ ...f, apelido: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Nome do Contador</Label>
                <Input value={editCadastroForm.nome_contador || ''} onChange={e => setEditCadastroForm(f => ({ ...f, nome_contador: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">CNPJ</Label>
                <Input
                  value={editCadastroForm.cnpj || ''}
                  onChange={e => handleCnpjEditChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {editCadastroForm.cnpj && editCadastroForm.cnpj.replace(/\D/g, '').length > 0 && !isValidCNPJ(editCadastroForm.cnpj) && (
                  <p className="text-[10px] text-destructive">CNPJ deve conter 14 dígitos</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Código do Cliente</Label>
                <Input
                  value={maskCodigo(editCadastroForm.codigo_identificador || '')}
                  onChange={e => setEditCadastroForm(f => ({ ...f, codigo_identificador: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="000.000 (auto)"
                  maxLength={7}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input value={editCadastroForm.email || ''} onChange={e => setEditCadastroForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">CEP</Label>
                <div className="relative">
                  <Input
                    value={formatCEP(editCadastroForm.cep || '')}
                    onChange={async (e) => {
                      const masked = formatCEP(e.target.value);
                      setEditCadastroForm(f => ({ ...f, cep: masked }));
                      const digits = masked.replace(/\D/g, '');
                      if (digits.length === 8) {
                        setBuscandoCep(true);
                        const result = await buscarCEP(digits);
                        setBuscandoCep(false);
                        if (result) {
                          setEditCadastroForm(f => ({ ...f, logradouro: result.logradouro, bairro: result.bairro, cidade: result.cidade, estado: result.estado }));
                        } else {
                          toast.info('CEP não encontrado na base. Preencha os campos manualmente.');
                        }
                      }
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {buscandoCep && <span className="absolute right-2 top-2.5 text-xs text-muted-foreground animate-pulse">...</span>}
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Estado (UF)</Label>
                <Select value={editCadastroForm.estado || ''} onValueChange={(v) => setEditCadastroForm(f => ({ ...f, estado: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UFS_BRASIL.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Cidade</Label>
                <Input value={editCadastroForm.cidade || ''} onChange={e => setEditCadastroForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: São Paulo" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Logradouro</Label>
              <Input value={editCadastroForm.logradouro || ''} onChange={e => setEditCadastroForm(f => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Número</Label>
                <Input value={editCadastroForm.numero || ''} onChange={e => setEditCadastroForm(f => ({ ...f, numero: e.target.value }))} placeholder="Nº" />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Complemento</Label>
                <Input value={editCadastroForm.complemento || ''} onChange={e => setEditCadastroForm(f => ({ ...f, complemento: e.target.value }))} placeholder="Sala, Andar..." />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Bairro</Label>
                <Input value={editCadastroForm.bairro || ''} onChange={e => setEditCadastroForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Telefone</Label>
              <Input value={editCadastroForm.telefone || ''} onChange={e => setEditCadastroForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Modalidade do Cliente</Label>
              <Select value={editCadastroForm.tipo} onValueChange={(v) => setEditCadastroForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                  <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                  <SelectItem value="PRE_PAGO">Pré-Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ═══ Financial fields by modality ═══ */}
            {editCadastroForm.tipo === 'AVULSO_4D' && (
              <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Faturamento</Label>
                    <Select value={editCadastroForm.momento_faturamento || 'na_solicitacao'} onValueChange={v => setEditCadastroForm(f => ({ ...f, momento_faturamento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                        <SelectItem value="no_deferimento">No Deferimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Forma de Cobrança</Label>
                  <RadioGroup
                    value={editCadastroForm.forma_cobranca || 'por_processo'}
                    onValueChange={(v: string) => setEditCadastroForm(f => ({ ...f, forma_cobranca: v }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="por_processo" id="ec-fc-processo" />
                      <Label htmlFor="ec-fc-processo" className="text-xs cursor-pointer">Por processo (D+X dias)</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="fatura_mensal" id="ec-fc-mensal" />
                      <Label htmlFor="ec-fc-mensal" className="text-xs cursor-pointer">Fatura mensal (dia fixo)</Label>
                    </div>
                  </RadioGroup>
                </div>
                {editCadastroForm.forma_cobranca === 'por_processo' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Vencimento após solicitação</Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">D+</span>
                        <Input type="number" min={1} max={60} value={editCadastroForm.dia_cobranca || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_cobranca: e.target.value }))} placeholder="4" className="w-20" />
                        <span className="text-xs text-muted-foreground">dias</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Dia de vencimento da fatura</Label>
                      <Input type="number" min={1} max={31} value={editCadastroForm.dia_vencimento_mensal || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="15" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Base (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desc. Progr. (%)</Label>
                    <Input type="number" step="0.1" value={editCadastroForm.desconto_progressivo || ''} onChange={e => setEditCadastroForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Limite/Piso (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.valor_limite_desconto || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {editCadastroForm.tipo === 'MENSALISTA' && (
              <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Mensalidade (R$) *</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.mensalidade || ''} onChange={e => setEditCadastroForm(f => ({ ...f, mensalidade: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Franquia Processos *</Label>
                    <Input type="number" min={0} value={editCadastroForm.franquia_processos || ''} onChange={e => setEditCadastroForm(f => ({ ...f, franquia_processos: e.target.value }))} placeholder="Qtd inclusos" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dia Vencimento</Label>
                    <Input type="number" min={1} max={31} value={editCadastroForm.dia_vencimento_mensal || ''} onChange={e => setEditCadastroForm(f => ({ ...f, dia_vencimento_mensal: e.target.value }))} placeholder="10" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex-1 border-t border-border/40" />
                  <span>Processos Excedentes</span>
                  <span className="flex-1 border-t border-border/40" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Base Excedente (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desc. Progr. Exc. (%)</Label>
                    <Input type="number" step="0.1" value={editCadastroForm.desconto_progressivo || ''} onChange={e => setEditCadastroForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Limite/Piso Exc. (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.valor_limite_desconto || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {editCadastroForm.tipo === 'PRE_PAGO' && (
              <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Saldo Atual (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.saldo_prepago || ''} onChange={e => setEditCadastroForm(f => ({ ...f, saldo_prepago: e.target.value }))} placeholder="Valor depositado" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor por Processo (R$)</Label>
                    <Input type="number" step="0.01" value={editCadastroForm.valor_base || ''} onChange={e => setEditCadastroForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="Cobrado do saldo" />
                  </div>
                </div>
              </div>
            )}

            {/* Honorários Específicos inline */}
            <div className="pt-3 border-t border-border/40">
              <HonorariosInlineRepeater rows={editHonorariosRows} onChange={setEditHonorariosRows} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCadastro(false)}>Cancelar</Button>
            <Button onClick={handleSaveCadastro} disabled={savingCadastro}>
              {savingCadastro ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Salvando...
                </span>
              ) : 'Salvar Cadastro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContractPreviewModal
        open={!!previewUrl}
        onOpenChange={(o) => { if (!o) { setPreviewUrl(null); setPreviewFileName(''); } }}
        url={previewUrl}
        fileName={previewFileName}
        clienteName={cliente?.nome || ''}
      />

      <PasswordConfirmDialog
        open={showDeletePassword}
        onOpenChange={setShowDeletePassword}
        onConfirm={() => { pendingDeleteAction?.(); setPendingDeleteAction(null); }}
      />

      {/* Boas-vindas (1º processo) — AlertDialog antes do formulário */}
      <AlertDialog open={showBoasVindasAlert} onOpenChange={setShowBoasVindasAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>🎉 Primeiro processo deste cliente!</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aplicar desconto de boas-vindas antes de continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">Percentual (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={boasVindasPct}
                onChange={(e) => setBoasVindasPct(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowBoasVindasAlert(false);
                setProcessoForm((f) => ({
                  ...f,
                  boas_vindas: false,
                  boas_vindas_pct: boasVindasPct || '50',
                }));
                setShowNovoProcesso(true);
              }}
            >
              Não cobrar normal
            </Button>
            <AlertDialogAction
              onClick={() => {
                setShowBoasVindasAlert(false);
                setProcessoForm((f) => ({
                  ...f,
                  boas_vindas: true,
                  boas_vindas_pct: boasVindasPct || '50',
                }));
                setShowNovoProcesso(true);
              }}
            >
              Sim aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Novo Processo */}
      <Dialog open={showNovoProcesso} onOpenChange={setShowNovoProcesso}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Processo — {cliente.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Razão Social *</Label>
              <Input value={processoForm.razao_social} onChange={e => setProcessoForm(f => ({ ...f, razao_social: e.target.value }))} placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Tipo de Serviço</Label>
                <Select
                  value={processoForm.negotiated_service_id || processoForm.tipo}
                  onValueChange={v => {
                    const neg = negotiations?.find(n => n.id === v);
                    if (neg) {
                      setProcessoForm(f => ({
                        ...f,
                        negotiated_service_id: neg.id,
                        tipo: 'avulso',
                        definir_manual: true,
                        valor_manual: String(neg.fixed_price),
                      }));
                    } else {
                      setProcessoForm(f => ({
                        ...f,
                        negotiated_service_id: '',
                        tipo: v,
                        definir_manual: false,
                        valor_manual: '',
                      }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value="__header_std" className="text-[10px] font-semibold text-muted-foreground">— Serviços Padrão —</SelectItem>
                    {Object.entries(TIPO_PROCESSO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                    {negotiations && negotiations.length > 0 && (
                      <>
                        <SelectItem disabled value="__header_neg" className="text-[10px] font-semibold text-muted-foreground">— Serviços Negociados —</SelectItem>
                        {negotiations.map(n => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.service_name} — {Number(n.fixed_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {isNegotiatedService && (
                  <p className="text-[10px] text-primary">Valor fixo negociado aplicado. Desconto progressivo bloqueado.</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Prioridade</Label>
                <Select value={processoForm.prioridade} onValueChange={v => setProcessoForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente (+50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Responsável</Label>
              <Input value={processoForm.responsavel} onChange={e => setProcessoForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <Label className="text-sm font-medium">Definir Valor Manualmente</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {processoForm.definir_manual ? 'Valor digitado abaixo será usado.' : 'Sistema calcula pela Metodologia de Cobrança.'}
                </p>
              </div>
              <Switch
                checked={processoForm.definir_manual}
                onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, definir_manual: checked }))}
              />
            </div>
            {isManualPrice && (
              <div className="grid gap-1.5">
                <Label>Valor Manual (R$)</Label>
                <Input type="number" step="0.01" value={processoForm.valor_manual} onChange={e => setProcessoForm(f => ({ ...f, valor_manual: e.target.value }))} placeholder="0,00" />
              </div>
            )}
            {/* Mudança de UF checkbox */}
            {(processoForm.tipo === 'alteracao' || processoForm.tipo === 'transformacao') && (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Checkbox
                  id="mudanca_uf"
                  checked={processoForm.mudanca_uf}
                  onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, mudanca_uf: !!checked }))}
                />
                <div>
                  <Label htmlFor="mudanca_uf" className="text-sm font-medium cursor-pointer">Mudança de UF</Label>
                  <p className="text-[10px] text-muted-foreground">Consome 2 slots, cobra 2 processos</p>
                </div>
              </div>
            )}
            {/* Boas-vindas */}
            {processos.length === 0 && !(cliente as any).desconto_boas_vindas_aplicado && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">🎉 Primeiro processo deste cliente!</p>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="boas_vindas"
                    checked={processoForm.boas_vindas}
                    onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, boas_vindas: !!checked }))}
                  />
                  <Label htmlFor="boas_vindas" className="text-sm cursor-pointer">Aplicar desconto de boas-vindas</Label>
                  {processoForm.boas_vindas && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-16 h-7 text-xs"
                        value={processoForm.boas_vindas_pct}
                        onChange={e => setProcessoForm(f => ({ ...f, boas_vindas_pct: e.target.value }))}
                        min={1}
                        max={100}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoProcesso(false)}>Cancelar</Button>
            <Button onClick={handleCreateProcesso} disabled={createProcesso.isPending}>
              {createProcesso.isPending ? 'Criando...' : 'Criar Processo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Password Dialog */}
      <PasswordConfirmDialog
        open={showArchivePassword}
        onOpenChange={setShowArchivePassword}
        title={isArchived ? 'Desarquivar Cliente' : 'Arquivar Cliente'}
        description={isArchived ? 'Digite a senha para desarquivar este cliente e seus processos.' : 'Digite a senha para arquivar este cliente e seus processos. Eles ficarão ocultos mas não serão excluídos.'}
        onConfirm={() => {
          if (!cliente) return;
          if (isArchived) {
            unarchiveCliente.mutate(cliente.id, { onSuccess: () => loadAll(cliente.id) });
          } else {
            archiveCliente.mutate(cliente.id, { onSuccess: () => loadAll(cliente.id) });
          }
        }}
      />

      {/* Delete Cliente Password Dialog */}
      <PasswordConfirmDialog
        open={showDeleteClientePassword}
        onOpenChange={setShowDeleteClientePassword}
        title="Excluir Cliente"
        description={`Tem certeza? Isso excluirá permanentemente "${cliente.nome}" e todos os seus ${processos.length} processos e lançamentos.`}
        onConfirm={() => {
          if (!cliente) return;
          deleteCliente.mutate(cliente.id, { onSuccess: () => navigate('/clientes') });
        }}
      />

      {/* Gerar Relatório Dialog */}
      <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Gerar Relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione os processos que deseja incluir no relatório:</p>
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedRelatorioProcessos(new Set(processos.map(p => p.id)))}>Selecionar Todos</Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedRelatorioProcessos(new Set())}>Limpar</Button>
            </div>
            {processos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum processo encontrado.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                {processos.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedRelatorioProcessos.has(p.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedRelatorioProcessos);
                        if (checked) next.add(p.id); else next.delete(p.id);
                        setSelectedRelatorioProcessos(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.razao_social}</p>
                      <p className="text-xs text-muted-foreground">{TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} · {KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}</p>
                    </div>
                    <span className="text-xs font-medium">{Number(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRelatorioDialog(false)}>Cancelar</Button>
            <Button
              disabled={selectedRelatorioProcessos.size === 0}
              onClick={() => {
                const selected = processos.filter(p => selectedRelatorioProcessos.has(p.id));
                const lines = [
                  `RELATÓRIO - ${cliente.nome}`,
                  `Data: ${new Date().toLocaleDateString('pt-BR')}`,
                  `Código: ${cliente.codigo_identificador}`,
                  '',
                  'PROCESSOS:',
                  ...selected.map((p, i) => `${i + 1}. ${p.razao_social} | ${TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo} | ${Number(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Etapa: ${KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}`),
                  '',
                  `TOTAL: ${selected.reduce((s, p) => s + Number(p.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                ];
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `relatorio_${cliente.codigo_identificador}_${Date.now()}.txt`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Relatório gerado com ${selected.length} processo(s)`);
                setShowRelatorioDialog(false);
              }}
            >
              Gerar Relatório ({selectedRelatorioProcessos.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerar Cobrança Dialog */}
      <Dialog open={showCobrancaDialog} onOpenChange={setShowCobrancaDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Gerar Cobrança</DialogTitle>
          </DialogHeader>
          {(() => {
            const pendentes = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente');
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Processos com cobrança pendente para envio de boleto:</p>
                {pendentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma cobrança pendente.</p>
                ) : (
                  <>
                    <div className="flex gap-2 mb-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedCobrancaProcessos(new Set(pendentes.map(l => l.id)))}>Selecionar Todos</Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelectedCobrancaProcessos(new Set())}>Limpar</Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                      {pendentes.map(l => (
                        <label key={l.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedCobrancaProcessos.has(l.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedCobrancaProcessos);
                              if (checked) next.add(l.id); else next.delete(l.id);
                              setSelectedCobrancaProcessos(next);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{l.descricao}</p>
                            <p className="text-xs text-muted-foreground">Venc: {l.data_vencimento ? new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                          </div>
                          <span className="text-sm font-semibold text-warning">{Number(l.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCobrancaDialog(false)}>Cancelar</Button>
                  <Button
                    disabled={selectedCobrancaProcessos.size === 0}
                    onClick={() => {
                      const selected = pendentes.filter(l => selectedCobrancaProcessos.has(l.id));
                      const totalCobranca = selected.reduce((s, l) => s + Number(l.valor), 0);
                      const lines = [
                        `COBRANÇA - ${cliente.nome}`,
                        `Data: ${new Date().toLocaleDateString('pt-BR')}`,
                        `Código: ${cliente.codigo_identificador}`,
                        '',
                        'ITENS:',
                        ...selected.map((l, i) => `${i + 1}. ${l.descricao} | Venc: ${l.data_vencimento ? new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} | ${Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`),
                        '',
                        `TOTAL: ${totalCobranca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                      ];
                      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `cobranca_${cliente.codigo_identificador}_${Date.now()}.txt`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Cobrança gerada: ${totalCobranca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
                      setShowCobrancaDialog(false);
                    }}
                  >
                    Gerar Cobrança ({selectedCobrancaProcessos.size})
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Process Modal (double-click) */}
      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={editProcesso}
      />

      {/* Mark as Faturado after extrato */}
      <AlertDialog open={showMarkFaturadoDialog} onOpenChange={setShowMarkFaturadoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extrato gerado com sucesso!</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar os {selectedProcessosTab.size} processo(s) selecionado(s) como "Faturado"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const selectedProcs = processos.filter(p => selectedProcessosTab.has(p.id));
              const now = new Date().toISOString();
              const dateStr = new Date().toLocaleDateString('pt-BR');
              try {
                for (const p of selectedProcs) {
                  const lanc = lancamentos.find(l => l.processo_id === p.id && l.tipo === 'receber');
                  if (lanc) {
                    await supabase
                      .from('lancamentos')
                      .update({
                        etapa_financeiro: 'cobranca_gerada',
                        observacoes_financeiro: `Extrato emitido em ${dateStr}`,
                        updated_at: now,
                      })
                      .eq('id', lanc.id);
                  }
                }
                toast.success('Processos marcados como faturados!');
                setSelectedProcessosTab(new Set());
                loadAll(cliente!.id);
              } catch (err: any) {
                toast.error('Erro: ' + err.message);
              }
              setShowMarkFaturadoDialog(false);
            }}>
              Marcar como Faturado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Deferimento Alert */}
      <AlertDialog open={showDeferimentoAlert} onOpenChange={setShowDeferimentoAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              ⚠️ Cliente com Faturamento no Deferimento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  O cliente <strong>{deferimentoAlertData?.clienteNome}</strong> está configurado para faturar apenas no deferimento.
                </p>
                <p className="font-medium text-foreground">Processos ainda NÃO deferidos:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {deferimentoAlertData?.naoDeferidos.map(p => (
                    <li key={p.id}>
                      {TIPO_PROCESSO_LABELS[p.tipo] || p.tipo} — {p.razao_social}{' '}
                      <span className="text-muted-foreground">(Etapa: {p.etapa})</span>
                    </li>
                  ))}
                </ul>
                <p>Deseja gerar o extrato mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                const deferidos = deferimentoAlertData?.todosSelecionados.filter(p => ['registro', 'finalizados'].includes(p.etapa)) || [];
                setShowDeferimentoAlert(false);
                if (deferidos.length > 0) {
                  gerarExtratoClienteDetalhe(deferidos);
                } else {
                  toast.warning('Nenhum processo deferido para gerar extrato.');
                }
              }}
            >
              Gerar Apenas Deferidos
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (!deferimentoAlertData) return;
                setShowDeferimentoAlert(false);
                gerarExtratoClienteDetalhe(deferimentoAlertData.todosSelecionados);
              }}
            >
              Gerar Todos Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

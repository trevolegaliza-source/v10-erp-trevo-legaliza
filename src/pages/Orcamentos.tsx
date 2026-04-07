import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoKPIs, useDeleteOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { normalizeItem, DEFAULT_SECOES } from '@/components/orcamentos/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, Send, CheckCircle, TrendingUp, MoreHorizontal,
  Copy, Download, Trash2, Pencil, Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', color: 'bg-blue-500/10 text-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-primary/10 text-primary' },
  recusado: { label: 'Recusado', color: 'bg-destructive/10 text-destructive' },
  expirado: { label: 'Expirado', color: 'bg-amber-500/10 text-amber-500' },
  convertido: { label: 'Convertido', color: 'bg-primary/10 text-primary' },
};

export default function Orcamentos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todos');
  const { data: orcamentos, isLoading } = useOrcamentos(tab);
  const { data: kpis } = useOrcamentoKPIs();
  const deleteMutation = useDeleteOrcamento();

  // Ctrl+O shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        navigate('/orcamentos/novo');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  function formFromOrcamento(orc: Orcamento) {
    let itens: any[] = [];
    try {
      const raw = orc.servicos as any;
      if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && 'descricao' in raw[0]) {
        itens = raw;
      }
    } catch { /* ignore */ }
    return { itens, desconto_pct: orc.desconto_pct };
  }

  async function handleDownloadPDF(orc: Orcamento) {
    try {
      const f = formFromOrcamento(orc);
      const itens = f.itens.map(normalizeItem);
      const sub = itens.reduce((s: number, i: any) => s + (Number(i.honorario) || Number(i.valor) || 0) * (Number(i.quantidade) || 1), 0);
      const desc = sub * (f.desconto_pct / 100);
      const hasDetailed = itens.some((i: any) => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const orcAny = orc as any;
      const doc = await gerarOrcamentoPDF({
        modo: hasDetailed || orcAny.contexto ? 'detalhado' : 'simples',
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj,
        itens,
        pacotes: Array.isArray(orcAny.pacotes) ? orcAny.pacotes : [],
        secoes: Array.isArray(orcAny.secoes) && orcAny.secoes.length > 0 ? orcAny.secoes : [...DEFAULT_SECOES],
        contexto: orcAny.contexto || '',
        ordem_execucao: orcAny.ordem_execucao || '',
        desconto_pct: f.desconto_pct,
        subtotal: sub,
        total: sub - desc,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento,
        observacoes: orc.observacoes,
        numero: orc.numero,
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
      });
      const clienteName = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
      const filename = `Proposta_${clienteName}_${new Date().toISOString().split('T')[0]}.pdf`;
      const { downloadBlob } = await import('@/lib/orcamento-pdf');
      downloadBlob(doc, filename);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    }
  }

  function handleCopyLink(orc: Orcamento) {
    const url = `${window.location.origin}/orcamento/${orc.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Propostas comerciais personalizadas</p>
        </div>
        <Button onClick={() => navigate('/orcamentos/novo')} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: kpis?.total ?? 0, icon: FileText, color: 'text-foreground' },
          { label: 'Enviados', value: kpis?.enviados ?? 0, icon: Send, color: 'text-blue-500' },
          { label: 'Aprovados', value: kpis?.aprovados ?? 0, icon: CheckCircle, color: 'text-primary' },
          { label: 'Taxa Conversão', value: `${kpis?.taxa ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
              <k.icon className={`h-5 w-5 ${k.color} opacity-50`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="rascunho">Rascunhos</TabsTrigger>
          <TabsTrigger value="enviado">Enviados</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="convertido">Convertidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : !orcamentos?.length ? (
            <Card className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado</p>
              <Button variant="outline" className="mt-3" onClick={() => navigate('/orcamentos/novo')}>
                Criar primeiro orçamento
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => {
                const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
                const itemCount = Array.isArray(orc.servicos) ? orc.servicos.length : 0;
                return (
                  <Card key={orc.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/orcamentos/novo?id=${orc.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">#{String(orc.numero).padStart(3, '0')}</span>
                        <div>
                          <p className="text-sm font-semibold">{orc.prospect_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {new Date(orc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-bold">{fmt(orc.valor_final)}</p>
                        <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/orcamentos/novo?id=${orc.id}`)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              navigate(`/orcamentos/novo?duplicate=${orc.id}`);
                            }}>
                              <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(orc)}>
                              <LinkIcon className="h-3.5 w-3.5 mr-2" />Copiar Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(orc)}>
                              <Download className="h-3.5 w-3.5 mr-2" />Baixar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(orc.id)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

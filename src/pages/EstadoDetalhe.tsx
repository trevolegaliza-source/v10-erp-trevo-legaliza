import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UF_NOMES } from '@/constants/estados-brasil';
import {
  useEstadoDetalhe, useSalvarContato, useRemoverContato,
  useSalvarNotaEstado, useMunicipiosIBGE,
  type ContatoEstado,
} from '@/hooks/useInteligenciaGeografica';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Plus, Trash2, ExternalLink, Users, MapPin, Building, Phone,
  Mail, Globe, BookOpen, DollarSign,
} from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS: Record<string, string> = {
  junta_comercial: 'Junta Comercial',
  cartorio: 'Cartório',
  conselho: 'Conselho de Classe',
  prefeitura: 'Prefeitura',
  outro: 'Outro Órgão',
};

const TIPO_ICONS: Record<string, typeof Building> = {
  junta_comercial: Building,
  cartorio: BookOpen,
  conselho: Users,
  prefeitura: MapPin,
  outro: Globe,
};

const emptyForm = (): Partial<ContatoEstado> => ({
  tipo: 'junta_comercial', nome: '', municipio: null, site_url: null,
  telefone: null, email: null, contato_interno: null, endereco: null, observacoes: null,
});

export default function EstadoDetalhe() {
  const { uf = '' } = useParams<{ uf: string }>();
  const navigate = useNavigate();
  const ufUpper = uf.toUpperCase();
  const nomeEstado = UF_NOMES[ufUpper] || ufUpper;

  const { data, isLoading } = useEstadoDetalhe(ufUpper);
  const { data: municipios } = useMunicipiosIBGE(ufUpper);
  const salvarContato = useSalvarContato();
  const removerContato = useRemoverContato();
  const salvarNota = useSalvarNotaEstado();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<ContatoEstado>>(emptyForm());
  const [nota, setNota] = useState('');
  const [notaId, setNotaId] = useState<string | null>(null);
  const [buscaMunicipio, setBuscaMunicipio] = useState('');

  useEffect(() => {
    if (data) {
      setNota(data.nota);
      setNotaId(data.notaId);
    }
  }, [data]);

  // Auto-save notes with debounce
  const [notaDirty, setNotaDirty] = useState(false);
  useEffect(() => {
    if (!notaDirty) return;
    const t = setTimeout(() => {
      salvarNota.mutate({ uf: ufUpper, conteudo: nota, notaId });
      setNotaDirty(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [nota, notaDirty]);

  const openNew = (tipo?: string, municipio?: string) => {
    setForm({ ...emptyForm(), tipo: tipo || 'junta_comercial', municipio: municipio || null });
    setModalOpen(true);
  };

  const openEdit = (c: ContatoEstado) => {
    setForm(c);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.nome || !form.tipo) return;
    salvarContato.mutate({ ...form, uf: ufUpper, nome: form.nome!, tipo: form.tipo! } as any, {
      onSuccess: () => setModalOpen(false),
    });
  };

  const contatosByTipo = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, ContatoEstado[]> = {};
    data.contatos.forEach(c => {
      if (!grouped[c.tipo]) grouped[c.tipo] = [];
      grouped[c.tipo].push(c);
    });
    return grouped;
  }, [data]);

  const municipiosFiltrados = useMemo(() => {
    if (!municipios) return [];
    const q = buscaMunicipio.toLowerCase();
    const filtered = q ? municipios.filter(m => m.nome.toLowerCase().includes(q)) : municipios;
    // Show municipalities with contacts first
    const contatosMunicipais = data?.contatos.filter(c => c.municipio) || [];
    const comInfo = new Set(contatosMunicipais.map(c => c.municipio));
    return filtered.sort((a, b) => {
      const aHas = comInfo.has(a.nome) ? 0 : 1;
      const bHas = comInfo.has(b.nome) ? 0 : 1;
      return aHas - bHas || a.nome.localeCompare(b.nome);
    });
  }, [municipios, buscaMunicipio, data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const qtdClientes = data?.clientes.length || 0;
  const qtdProcessos = data?.clientes.reduce((s, c) => s + c.processos, 0) || 0;
  const receita = data?.clientes.reduce((s, c) => s + c.receita, 0) || 0;
  const qtdContatos = data?.contatos.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inteligencia-geografica')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{nomeEstado}</h1>
          <p className="text-sm text-muted-foreground">
            {ufUpper} · {qtdClientes} clientes · {qtdProcessos} processos · {fmt(receita)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes', value: qtdClientes, icon: Users, color: 'text-blue-500' },
          { label: 'Processos', value: qtdProcessos, icon: MapPin, color: 'text-amber-500' },
          { label: 'Receita', value: fmt(receita), icon: DollarSign, color: 'text-primary' },
          { label: 'Contatos', value: qtdContatos, icon: Phone, color: 'text-purple-500' },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-2xl font-bold">{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orgaos">
        <TabsList>
          <TabsTrigger value="orgaos">Órgãos e Contatos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="municipios">Municípios</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        {/* Tab: Órgãos e Contatos */}
        <TabsContent value="orgaos" className="space-y-4 mt-4">
          {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
            const Icon = TIPO_ICONS[tipo] || Globe;
            const contatos = contatosByTipo[tipo] || [];
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {label}
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => openNew(tipo)}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {contatos.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">Nenhum contato cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {contatos.map(c => (
                      <Card key={c.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{c.nome} {c.municipio && <span className="text-xs text-muted-foreground">· {c.municipio}</span>}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>}
                              {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                              {c.site_url && (
                                <a href={c.site_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" />{new URL(c.site_url).hostname}
                                </a>
                              )}
                            </div>
                            {c.contato_interno && <p className="text-xs text-muted-foreground">Contato: {c.contato_interno}</p>}
                            {c.observacoes && <p className="text-xs text-muted-foreground italic">{c.observacoes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Globe className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="clientes" className="mt-4">
          {data?.clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente neste estado</p>
          ) : (
            <div className="space-y-2">
              {data?.clientes.map(c => (
                <Card key={c.id} className="p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/clientes/${c.id}`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.apelido || c.nome}</p>
                      <p className="text-xs text-muted-foreground">{c.cnpj} · {c.processos} processos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmt(c.receita)}</p>
                      <p className="text-xs text-muted-foreground">{fmt(c.pago)} recebido</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Municípios */}
        <TabsContent value="municipios" className="space-y-3 mt-4">
          <Input
            placeholder="Buscar município..."
            value={buscaMunicipio}
            onChange={e => setBuscaMunicipio(e.target.value)}
            className="max-w-sm"
          />
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {municipiosFiltrados.slice(0, 100).map(m => {
              const contatosMun = data?.contatos.filter(c => c.municipio === m.nome) || [];
              const temInfo = contatosMun.length > 0;
              return (
                <div key={m.id} className={`rounded-lg p-2 ${temInfo ? 'bg-primary/5 border border-primary/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${temInfo ? 'font-medium' : 'text-muted-foreground'}`}>{m.nome}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openNew('prefeitura', m.nome)}>
                      <Plus className="h-3 w-3 mr-1" /> Info
                    </Button>
                  </div>
                  {contatosMun.map(c => (
                    <div key={c.id} className="pl-4 mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.nome} {c.telefone && `· ${c.telefone}`}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(c)}>
                          <Globe className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {municipiosFiltrados.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Mostrando 100 de {municipiosFiltrados.length} municípios. Refine a busca.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab: Notas */}
        <TabsContent value="notas" className="mt-4">
          <Card className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Observações gerais — {nomeEstado}
            </h3>
            <Textarea
              value={nota}
              onChange={e => { setNota(e.target.value); setNotaDirty(true); }}
              rows={10}
              placeholder={`Observações operacionais sobre ${nomeEstado}... (salva automaticamente)`}
            />
            <p className="text-xs text-muted-foreground mt-2">Salva automaticamente após parar de digitar</p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de contato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar' : 'Adicionar'} Contato — {ufUpper}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo || 'outro'} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.tipo === 'prefeitura' || form.tipo === 'cartorio') && (
              <div>
                <Label>Município</Label>
                <Input value={form.municipio || ''} onChange={e => setForm(p => ({ ...p, municipio: e.target.value || null }))} placeholder="Nome do município" />
              </div>
            )}
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome || ''} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do órgão" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Site</Label>
                <Input value={form.site_url || ''} onChange={e => setForm(p => ({ ...p, site_url: e.target.value || null }))} placeholder="https://..." />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value || null }))} placeholder="(11) 3100-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value || null }))} placeholder="email@orgao.gov.br" />
              </div>
              <div>
                <Label>Contato interno</Label>
                <Input value={form.contato_interno || ''} onChange={e => setForm(p => ({ ...p, contato_interno: e.target.value || null }))} placeholder="Nome da pessoa" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.endereco || ''} onChange={e => setForm(p => ({ ...p, endereco: e.target.value || null }))} placeholder="Rua, número, bairro" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ''} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value || null }))} rows={3} placeholder="Dicas operacionais, horários, contatos..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.nome}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapaEstadoMunicipios } from '@/components/mapa/MapaEstadoMunicipios';
import { toast } from 'sonner';
import { UF_NOMES } from '@/constants/estados-brasil';
import {
  useEstadoDetalhe, useSalvarContato, useRemoverContato,
  useSalvarNotaEstado, useMunicipiosIBGE,
  type ContatoEstado,
} from '@/hooks/useInteligenciaGeografica';
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
  Mail, Globe, BookOpen, DollarSign, Pencil,
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

const GREEN = '#22c55e';
const GREEN_GLOW = 'rgba(34, 197, 94, 0.15)';

// Dark input style
const inputStyle: React.CSSProperties = {
  background: '#0b0e14', border: '1px solid #30363d', color: '#e6edf3',
};

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

  // Clients grouped by municipality for the map
  const { data: clientesMunicipio } = useQuery({
    queryKey: ['clientes_municipio_mapa', ufUpper],
    queryFn: async () => {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('cidade')
        .eq('estado', ufUpper)
        .eq('is_archived', false);
      const map: Record<string, number> = {};
      (clientes || []).forEach((c: any) => {
        if (c.cidade) {
          const key = c.cidade.toUpperCase();
          map[key] = (map[key] || 0) + 1;
        }
      });
      return map;
    },
    enabled: !!ufUpper,
  });

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
      <div className="geo-container min-h-screen p-6 space-y-6">
        <Skeleton className="h-8 w-64" style={{ background: '#161b22' }} />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" style={{ background: '#161b22' }} />)}</div>
        <Skeleton className="h-64 rounded-xl" style={{ background: '#161b22' }} />
      </div>
    );
  }

  const qtdClientes = data?.clientes.length || 0;
  const qtdProcessos = data?.clientes.reduce((s, c) => s + c.processos, 0) || 0;
  const receita = data?.clientes.reduce((s, c) => s + c.receita, 0) || 0;
  const qtdContatos = data?.contatos.length || 0;

  const kpis = [
    { label: 'Clientes', value: qtdClientes, Icon: Users },
    { label: 'Processos', value: qtdProcessos, Icon: MapPin },
    { label: 'Receita', value: fmt(receita), Icon: DollarSign },
    { label: 'Contatos', value: qtdContatos, Icon: Phone },
  ];

  return (
    <div className="geo-container min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/inteligencia-geografica')}
          className="geo-card p-2 transition-colors"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = GREEN)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363d')}
        >
          <ArrowLeft className="h-5 w-5" style={{ color: '#8b949e' }} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: '#e6edf3' }}>{nomeEstado}</h1>
          <p className="text-sm" style={{ color: '#8b949e' }}>
            {ufUpper} · {qtdClientes} clientes · {qtdProcessos} processos · {fmt(receita)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="geo-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.Icon className="h-4 w-4 geo-accent" />
              <span className="text-xs font-bold uppercase tracking-wider geo-muted">{k.label}</span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: '#e6edf3' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mapa" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="geo-card border-none mb-4" style={{ background: '#161b22' }}>
          {['mapa', 'orgaos', 'clientes', 'municipios', 'notas'].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
              style={{ color: '#8b949e' }}
            >
              {tab === 'mapa' ? 'Mapa' : tab === 'orgaos' ? 'Órgãos e Contatos' : tab === 'clientes' ? 'Clientes' : tab === 'municipios' ? 'Municípios' : 'Notas'}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab: Mapa */}
        <TabsContent value="mapa" className="mt-2">
          <MapaEstadoMunicipios
            uf={ufUpper}
            clientesPorMunicipio={clientesMunicipio || {}}
            onMunicipioClick={(nome) => {
              toast.info(`${nome} — veja a tab Municípios para detalhes`);
            }}
          />
        </TabsContent>

        {/* Tab: Órgãos e Contatos */}
        <TabsContent value="orgaos" className="space-y-4 mt-2">
          {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
            const Icon = TIPO_ICONS[tipo] || Globe;
            const contatos = contatosByTipo[tipo] || [];
            return (
              <div key={tipo} className="geo-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 geo-accent" />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#e6edf3' }}>{label}</span>
                  </div>
                  <button
                    onClick={() => openNew(tipo)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{ border: '1px solid rgba(34,197,94,0.3)', color: GREEN, background: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>

                {contatos.length === 0 ? (
                  <p className="text-sm" style={{ color: '#484f58' }}>Nenhum contato cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {contatos.map(c => (
                      <div key={c.id} className="p-3 rounded-lg" style={{ background: '#0b0e14' }}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-bold text-sm" style={{ color: '#e6edf3' }}>
                              {c.nome}
                              {c.municipio && <span className="font-normal text-xs ml-2" style={{ color: '#8b949e' }}>· {c.municipio}</span>}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#8b949e' }}>
                              {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>}
                              {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                              {c.site_url && (
                                <a href={c.site_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: GREEN }}>
                                  <ExternalLink className="h-3 w-3" />{(() => { try { return new URL(c.site_url).hostname; } catch { return c.site_url; } })()}
                                </a>
                              )}
                            </div>
                            {c.contato_interno && <p className="text-xs" style={{ color: '#8b949e' }}>👤 {c.contato_interno}</p>}
                            {c.observacoes && <p className="text-xs mt-1 italic" style={{ color: '#8b949e' }}>{c.observacoes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-md transition-colors hover:bg-white/5">
                              <Pencil className="h-3 w-3" style={{ color: '#8b949e' }} />
                            </button>
                            <button onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })} className="p-1.5 rounded-md transition-colors hover:bg-red-500/10">
                              <Trash2 className="h-3 w-3" style={{ color: '#f87171' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Tab: Clientes */}
        <TabsContent value="clientes" className="mt-2">
          {data?.clientes.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#484f58' }}>Nenhum cliente neste estado</p>
          ) : (
            <div className="space-y-2">
              {data?.clientes.map(c => (
                <div
                  key={c.id}
                  className="geo-card p-3 cursor-pointer transition-colors"
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = GREEN)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363d')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#e6edf3' }}>{c.apelido || c.nome}</p>
                      <p className="text-xs" style={{ color: '#8b949e' }}>{c.cnpj} · {c.processos} processos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: GREEN }}>{fmt(c.receita)}</p>
                      <p className="text-xs" style={{ color: '#8b949e' }}>{fmt(c.pago)} recebido</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Municípios */}
        <TabsContent value="municipios" className="space-y-3 mt-2">
          <input
            placeholder="Buscar município..."
            value={buscaMunicipio}
            onChange={e => setBuscaMunicipio(e.target.value)}
            className="max-w-sm w-full px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = '#30363d')}
          />
          <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin">
            {municipiosFiltrados.slice(0, 100).map(m => {
              const contatosMun = data?.contatos.filter(c => c.municipio === m.nome) || [];
              const temInfo = contatosMun.length > 0;
              return (
                <div key={m.id} className="rounded-lg p-2" style={{
                  background: temInfo ? 'rgba(34,197,94,0.05)' : 'transparent',
                  border: temInfo ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
                }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: temInfo ? '#e6edf3' : '#8b949e', fontWeight: temInfo ? 600 : 400 }}>{m.nome}</p>
                    <button
                      onClick={() => openNew('prefeitura', m.nome)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                      style={{ color: '#8b949e' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}
                    >
                      <Plus className="h-3 w-3" /> Info
                    </button>
                  </div>
                  {contatosMun.map(c => (
                    <div key={c.id} className="pl-4 mt-1 flex items-center justify-between text-xs" style={{ color: '#8b949e' }}>
                      <span>{c.nome} {c.telefone && `· ${c.telefone}`}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-white/5">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => removerContato.mutate({ id: c.id, uf: ufUpper })} className="p-1 rounded hover:bg-red-500/10">
                          <Trash2 className="h-3 w-3" style={{ color: '#f87171' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {municipiosFiltrados.length > 100 && (
              <p className="text-xs text-center py-2" style={{ color: '#8b949e' }}>
                Mostrando 100 de {municipiosFiltrados.length} municípios. Refine a busca.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab: Notas */}
        <TabsContent value="notas" className="mt-2">
          <div className="geo-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider geo-muted mb-3">
              Observações gerais — {nomeEstado}
            </h3>
            <textarea
              value={nota}
              onChange={e => { setNota(e.target.value); setNotaDirty(true); }}
              rows={10}
              placeholder={`Observações operacionais sobre ${nomeEstado}... (salva automaticamente)`}
              className="w-full rounded-lg p-3 text-sm resize-none"
              style={{ ...inputStyle, outline: 'none' }}
              onFocus={(e) => (e.target.style.borderColor = GREEN)}
              onBlur={(e) => (e.target.style.borderColor = '#30363d')}
            />
            <p className="text-xs mt-2" style={{ color: '#484f58' }}>Salva automaticamente após parar de digitar</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de contato — DARK THEMED */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ background: '#161b22', borderColor: '#30363d', color: '#e6edf3' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#e6edf3' }}>{form.id ? 'Editar' : 'Adicionar'} Contato — {ufUpper}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label style={{ color: '#8b949e' }}>Tipo</Label>
              <Select value={form.tipo || 'outro'} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#161b22', borderColor: '#30363d' }}>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} style={{ color: '#e6edf3' }}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.tipo === 'prefeitura' || form.tipo === 'cartorio') && (
              <div>
                <Label style={{ color: '#8b949e' }}>Município</Label>
                <Input value={form.municipio || ''} onChange={e => setForm(p => ({ ...p, municipio: e.target.value || null }))} placeholder="Nome do município" style={inputStyle} />
              </div>
            )}
            <div>
              <Label style={{ color: '#8b949e' }}>Nome *</Label>
              <Input value={form.nome || ''} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do órgão" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#8b949e' }}>Site</Label>
                <Input value={form.site_url || ''} onChange={e => setForm(p => ({ ...p, site_url: e.target.value || null }))} placeholder="https://..." style={inputStyle} />
              </div>
              <div>
                <Label style={{ color: '#8b949e' }}>Telefone</Label>
                <Input value={form.telefone || ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value || null }))} placeholder="(11) 3100-0000" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: '#8b949e' }}>Email</Label>
                <Input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value || null }))} placeholder="email@orgao.gov.br" style={inputStyle} />
              </div>
              <div>
                <Label style={{ color: '#8b949e' }}>Contato interno</Label>
                <Input value={form.contato_interno || ''} onChange={e => setForm(p => ({ ...p, contato_interno: e.target.value || null }))} placeholder="Nome da pessoa" style={inputStyle} />
              </div>
            </div>
            <div>
              <Label style={{ color: '#8b949e' }}>Endereço</Label>
              <Input value={form.endereco || ''} onChange={e => setForm(p => ({ ...p, endereco: e.target.value || null }))} placeholder="Rua, número, bairro" style={inputStyle} />
            </div>
            <div>
              <Label style={{ color: '#8b949e' }}>Observações</Label>
              <textarea
                value={form.observacoes || ''}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value || null }))}
                rows={3}
                placeholder="Dicas operacionais, horários, contatos..."
                className="w-full rounded-lg p-3 text-sm resize-none"
                style={{ ...inputStyle, outline: 'none' }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid #30363d', color: '#8b949e', background: 'transparent' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.nome}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
                style={{ background: GREEN, color: '#0b0e14', border: 'none' }}
              >
                Salvar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import * as XLSX from 'xlsx';

export interface ProcessoImportRow {
  rowIndex: number;
  tipo: string | null;
  tipoLabel: string;
  razaoSocial: string;
  cnpj: string;
  uf: string;
  codigoCliente: string;
  nomeContabilidade: string;
  clienteId: string | null;
  clienteNome: string | null;
  status: 'ready' | 'no_client';
  createdAt: string;
  raw: Record<string, any>;
}

const TIPO_MAP: Record<string, string> = {
  'Abertura de empresa': 'abertura',
  'Abertura de Empresa': 'abertura',
  'Alteração de Empresa': 'alteracao',
  'Alteração de empresa': 'alteracao',
  'Transformação de Empresa': 'transformacao',
  'Transformação de empresa': 'transformacao',
  'Encerramento de Empresa': 'baixa',
  'Encerramento de empresa': 'baixa',
  'Processos Avulsos': 'avulso',
};

const TIPO_LABELS: Record<string, string> = {
  abertura: 'ABT',
  alteracao: 'ALT',
  transformacao: 'TRF',
  baixa: 'BAX',
  avulso: 'AVU',
};

function findCol(row: Record<string, any>, ...candidates: string[]): string {
  for (const c of candidates) {
    const trimmed = c.trim();
    for (const key of Object.keys(row)) {
      if (key.trim() === trimmed && row[key] != null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
  }
  return '';
}

function extractTipo(row: Record<string, any>): { tipo: string | null; tipoLabel: string } {
  const raw = findCol(row, 'Pergunta sem título', 'Tipo de Processo', 'Tipo');
  const mapped = TIPO_MAP[raw] || null;
  return { tipo: mapped, tipoLabel: mapped ? TIPO_LABELS[mapped] || mapped : raw || '?' };
}

function extractUF(row: Record<string, any>): string {
  const val = findCol(row, 'Informe o estado que seu processo será realizado', 'Estado', 'UF');
  const match = val.match(/^([A-Z]{2})\s/);
  if (match) return match[1];
  if (/^[A-Z]{2}$/.test(val)) return val;
  return val.slice(0, 2).toUpperCase() || '';
}

function extractRazaoSocial(row: Record<string, any>): string {
  return findCol(
    row,
    'Razão Social desejada',
    'Razão Social atual',
    'Razão Social da empresa',
    'Razão Social da empresa ',
  ) || 'Não informada';
}

function extractCNPJ(row: Record<string, any>): string {
  return findCol(
    row,
    'Inscrição CNPJ:',
    'CNPJ da empresa a ser transformada  ',
    '❓  CNPJ da empresa a ser encerrada  ',
    'CNPJ da empresa  ',
    'CNPJ da empresa',
    'CNPJ',
  );
}

function extractCodigoCliente(row: Record<string, any>): string {
  return findCol(row, 'Código do cliente', 'Código do Cliente', 'Codigo do cliente', 'codigo_cliente');
}

function extractNomeContabilidade(row: Record<string, any>): string {
  return findCol(row, 'Nome da Contabilidade', 'Contabilidade', 'nome_contabilidade');
}

function extractCreatedAt(row: Record<string, any>): string {
  const val = findCol(row, 'Carimbo de data/hora', 'Timestamp', 'Data');
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function parseFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export interface ClienteLookup {
  id: string;
  nome: string;
  codigo_identificador: string;
  valor_base: number | null;
}

export function mapRows(
  rows: Record<string, any>[],
  clientes: ClienteLookup[]
): ProcessoImportRow[] {
  const byCode = new Map<string, ClienteLookup>();
  const byName = new Map<string, ClienteLookup>();
  clientes.forEach(c => {
    if (c.codigo_identificador) byCode.set(c.codigo_identificador.toUpperCase(), c);
    byName.set(c.nome.toUpperCase(), c);
  });

  return rows.map((raw, i) => {
    const { tipo, tipoLabel } = extractTipo(raw);
    const codigoCliente = extractCodigoCliente(raw);
    const nomeContab = extractNomeContabilidade(raw);

    let cliente: ClienteLookup | undefined;
    if (codigoCliente) cliente = byCode.get(codigoCliente.toUpperCase());
    if (!cliente && nomeContab) {
      cliente = clientes.find(c =>
        c.nome.toUpperCase().includes(nomeContab.toUpperCase()) ||
        nomeContab.toUpperCase().includes(c.nome.toUpperCase())
      );
    }

    return {
      rowIndex: i,
      tipo,
      tipoLabel,
      razaoSocial: extractRazaoSocial(raw),
      cnpj: extractCNPJ(raw),
      uf: extractUF(raw),
      codigoCliente,
      nomeContabilidade: nomeContab,
      clienteId: cliente?.id || null,
      clienteNome: cliente?.nome || null,
      status: cliente ? 'ready' as const : 'no_client' as const,
      createdAt: extractCreatedAt(raw),
      raw,
    };
  });
}

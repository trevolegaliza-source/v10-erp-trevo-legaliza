// =============================================
// AUTOMAÇÃO TREVO LEGALIZA 🍀
// Google Forms → Drive → Trello + Secretária Dani
// v7.8.0 — 25/04/2026 — DANI v1.0 — Refactor + Adequações
//   • BUCKETS POR LISTA: matriz lista×bucket, permite relatório por etapa
//     (handlerEtiqueta salva {ts,lista}, getPrazosDani retorna por_lista+total,
//      mostrarPrazosCard formata como tabela, reconstruir rastreia mudança lista)
//   • MODELO DINÂMICO Haiku/Sonnet: ~70% economia. Haiku pra G2/G8
//     (classificação alta freq), Sonnet pra G4 (decisão crítica).
//   • HEARTBEAT 1h: alerta Thales se Claude API cair (3 falhas consecutivas)
//   • LIMPEZA AUTOMÁTICA: limparPropertiesOrfas() no cron diário (cards
//     arquivados/deletados deixam de acumular state)
//   • dani_indice(): lista organizada de funções (USO/SETUP/MANUTENÇÃO/TESTE)
//   • SEGURANÇA: statusDani avisa quando DANI_FORCAR_CLIENTE setado
//   • Fix v7.7.1 mantido: G2 timing 4h (etiqueta+email imediato; comentário
//     no card só após 4h sem resposta)
// v7.7.0 — 25/04/2026 — DANI ONDA 4 COMPLETA — G3 + Dashboard
//   • v7.7.0 G3: EM ANDAMENTO automática via keyword detection
//     (16 padrões regex: "iniciando", "começando", "vou redigir",
//      "redigindo", "preparando", etc). Roda ANTES da classificação
//     Claude — barato, determinístico. Aplica EM ANDAMENTO + remove
//     PRONTO PARA SER FEITO.
//   • v7.7.0 G2 SOLICITA_*: agora também REMOVE EM ANDAMENTO e
//     PRONTO PARA SER FEITO antes de aplicar pendência. "Bola tá com
//     cliente" — limpa etiquetas Trevo.
//   • v7.7.0 gerarDashboardDani(): cria/atualiza aba DANI_DASHBOARD
//     com status, métricas do dia, cards com lembretes em curso,
//     top cards mais demorados em cada bucket.
// v7.6.1 — 25/04/2026 — Onda 4 + G9 (notificação periódica análise órgão)
//   • v7.6.1 G9: cron 9h30 — pra cada card com EM ANÁLISE NO ÓRGÃO há ≥1d,
//     envia email pro cliente "permanece em análise". Anti-spam: 1x/dia.
//     Texto contextual com nome do solicitante + nome do órgão inferido
//     pela lista atual (Junta/Receita/Prefeitura).
//     Reusa bucket_inicio_<cardId>_EM ANÁLISE NO ÓRGÃO da Onda 4.
// v7.6.0 — 25/04/2026 — DANI ONDA 4 (cálculo dos 3 buckets de prazo)
//   • v7.6.0 handlerEtiquetaAdd registra timestamp de início em property
//   • v7.6.0 handlerEtiquetaRemove calcula tempo decorrido e soma no
//     bucket correspondente (TREVO/CLIENTE/ORGAO)
//   • v7.6.0 DANI_ETIQUETA_BUCKET — mapa etiqueta → bucket
//   • v7.6.0 getPrazosDani(cardId) → {trevo, cliente, orgao} em segundos
//     incluindo tempo "em curso" das etiquetas atualmente aplicadas
//   • v7.6.0 reconstruirBucketsCard(cardId) — popula histórico via
//     /actions do Trello pra cards já existentes (limite 1000 actions)
//   • v7.6.0 mostrarPrazosCard(cardId) — utility de debug (Logger)
// v7.5.0 — 25/04/2026 — DANI ONDA 3 (regras especiais por lista)
//   • v7.5.0 G10: chegada em ALVARÁS E LICENÇAS → oferece orçamento ao cliente
//                 (mensagem premium + email + comentário; salva data pra G11)
//   • v7.5.0 G11: cron 9h30 — ALVARÁS sem retorno em 5d → move pra
//                 PROCESSOS FINALIZADOS + email cliente
//   • v7.5.0 G12: chegada em MAT → lembra contador (aplica RESPOSTA PENDENTE,
//                 explica importância da escolha tributária)
//   • v7.5.0 G13: cron 9h30 — ARQUIVO MENSAL +30d → email LGPD cliente +
//                 deleta anexos do card
//   • v7.5.0 G14: cron 9h30 — BLOQUEADOS 15d → pergunta se mantém
//   • v7.5.0 G15: cron 9h30 — BLOQUEADOS 30d → deleta anexos (não o card)
//   • v7.5.0 setupTriggersDani agora cria trigger rotinasDiariasDani (9h30)
//                 (idempotente — Thales precisa re-rodar 1 vez no editor)
// v7.4.0 — 25/04/2026 — DANI ONDA 1.C + ONDA 2 (lembretes refinados + email órgão)
//   • v7.4.0 ONDA 1.C: lembretes refinados (G6)
//     - 5 max por etapa (lista + etiquetas pendência)
//     - Reset quando muda de etapa
//     - Texto gentil progressivo (5º = "último lembrete por aqui")
//     - Comentário no card a cada lembrete + email
//     - Caso AGUARDANDO PAGAMENTO JUNTA: 1º imediato, 2º 4h depois, depois 1x/dia
//     - _calcularChaveEtapa(card) detecta mudança de fase
//   • v7.4.0 ONDA 2: email do órgão (G8)
//     - interpretarEmailOrgao retorna veredito DEFERIDO/INDEFERIDO/SEM_MOVIMENTACAO/OUTRO
//     - DEFERIDO: comenta @board + email cliente + remove EM ANÁLISE NO ÓRGÃO
//     - INDEFERIDO: DISCRETO — comentário marcando @leticiatonelli3 + @trevolegaliza
//                   + email interno (cliente NÃO sabe — regra do Thales)
//     - SEM_MOVIMENTACAO: registra (G9 cron 9h cuida de avisar cliente — Onda 3)
//     - OUTRO: registra como pendência manual
// v7.3.0 — 25/04/2026 — DANI ONDA 1.B — G4 (cliente responde) + G5 (anexa)
//   • v7.3.0: _classificarAutorTrello — usa fullName + username pra detectar
//             override DANI_FORCAR_CLIENTE corretamente (bug v7.2.x:
//             Carolina entrava como Trevo porque DANI_FORCAR_CLIENTE tinha
//             username "carolinaguirado7" mas fullName é "Carolina Guirado")
//   • v7.3.0: G4 — cliente comenta em card com etiqueta de pendência →
//             Claude avalia se cumpriu (CUMPRIU/NAO_CUMPRIU/PARCIAL) →
//             remove DOCUMENTO/RESPOSTA PENDENTE + aplica PRONTO PARA SER FEITO,
//             ou mantém + comenta pedindo o que falta
//   • v7.3.0: G5 — cliente anexa arquivo → roda G4 com texto sintético
//             "[Cliente anexou arquivo: NOME]" → mesma lógica
//   • v7.3.0: handlerAnexo agora usa _daniLog (estava sem persistência)
// v7.2.6 — 25/04/2026 — DANI ONDA 1.A — fix Claude JSON parsing
//   • v7.2.6: chamarClaudeJson com fallback (regex extrai 1º {...}) +
//             prompt apertado com instrução crítica de formato +
//             log da resposta bruta no CLAUDE_PARSE_FAIL pra debug
// v7.2.5 — 25/04/2026 — DANI ONDA 1.A + LOG PERSISTENTE
//   • v7.2.5: aba DANI_LOG persiste cada passo do fluxo G2 na planilha
//             (Logger.log às vezes não persiste em deploys publicados).
//             Loop guard agora usa string explícita "Dani — Secretária Virtual".
//             Try/catch em todas as etapas → erro é registrado em DANI_LOG.
// v7.2.3 — 24/04/2026 — DANI ONDA 1.A — G2 (FUNCIONÁRIO PEDE)
//   • v7.2.3: filtra "Declaração de ciência" / LGPD do card
//             + filtra Feedback default ("Achei muito bom 💓") —
//             feedback REAL do cliente continua aparecendo
//   • v7.2.2: setupTesteDani tolerante a UI ausente +
//             setupTesteDani_Carolina (shortcut pro teste atual) +
//             setForcarCliente() helper
//   • v7.2.1: DANI_FORCAR_CLIENTE pra simular cliente em teste sem
//             remover usuário da aba EQUIPE
//   • v7.2.0: Onda 1.A — handlerComentario chama Claude e age
//   • Trava de segurança DANI_ATIVA (default false → dry-run)
//   • ativarDani() / desativarDani() / daniAtiva()
//   • Idempotência por action.id (cache 24h)
//   • Helpers Trello: aplicar/remover etiqueta por nome, comentar como Dani
//   • Email cliente HTML reaproveitando estilo do lembrete
//   • Claude classifica em SOLICITA_DOC, SOLICITA_RESPOSTA, ATUALIZA_STATUS, OUTRO
//   • Aplica DOCUMENTO PENDENTE / RESPOSTA DE COMENTÁRIO PENDENTE
//   • chamarClaude(p, maxTokens) parametrizável
//   • Loop guard: ignora comentários da própria Dani
// v7.1 — 24/04/2026 — DANI ONDA 0 + AUTOMAÇÃO DE GROWTH
//   • v7.1: aba EQUIPE — fonte da verdade pros funcionários internos
//           (adicionar/remover via planilha, sem editar código)
//   • v7.1: MapearEquipeInterna() popula aba inicial
//   • v7.1: setupTriggersDani() — trigger diário 8h que sincroniza
//           boards novos + cria webhooks automaticamente
//   • v7.1: sincronizarBoardsETrevoDani() — handler do trigger
// v7.0 — 24/04/2026 — DANI ARQUITETURA v1.0 — ONDA 0 (INFRAESTRUTURA)
//   • v6.3: zero duplicação + fallback Google Forms naming (mantido)
//   • v7.0: doPost expandido pra aceitar webhook nativo Trello
//           (commentCard, addLabelToCard, removeLabelToCard, updateCard,
//            addAttachmentToCard) — em tempo real, sem polling
//   • v7.0: doGet 200 OK pra HEAD/GET do Trello (verificação de URL)
//   • v7.0: token de auth obrigatório em todos os webhooks
//   • v7.0: skip hard de board "🍀 CENTRAL DE PROCESSO" (Placker)
//   • v7.0: setupDaniProperties() — wizard de config inicial
//   • v7.0: garantirWebhooksTodosBoards() — cria webhooks em massa
//   • v7.0: listarWebhooks() / removerTodosWebhooks() — debug/rollback
//   • Onda 0: handlers stub (logam apenas). Onda 1+ implementa ações.
// =============================================

function getProps() { return PropertiesService.getScriptProperties(); }
function prop(key) {
  const v = getProps().getProperty(key);
  if (!v) throw new Error("Property '" + key + "' não configurada. Rode setupProperties() uma vez.");
  return v;
}

// ===== CONSTANTES =====
const TRELLO_LIST_ID_PADRAO = "69e107569c0cbec9277ffc46";
const PASTA_CLIENTES_ATIVOS_ID = "1jD3F_eTZMNlI_e2aS2DJYKI0EkUdr91_";
const EMAIL_ALERTA_ERRO = "thales.burger@trevolegaliza.com.br";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929"; // legacy — fallback default
const CLAUDE_MODEL_SONNET = "claude-sonnet-4-5-20250929"; // decisões críticas
const CLAUDE_MODEL_HAIKU  = "claude-haiku-4-5-20251001"; // classificação alta freq (4x mais barato)
const ASSINATURA_DANI = "\n\n---\n🍀 *Dani — Secretária Virtual da Trevo Legaliza*\n_Mensagem gerada por inteligência artificial._";

// URLs de imagens hospedadas (Trevo usa subdomínio próprio)
const LOGO_TREVO_URL = "https://cobranca.trevolegaliza.com/logo-trevo.png";
const LOGO_DANI_URL = "https://cobranca.trevolegaliza.com/logo-dani.png";

// Etiquetas que disparam lembrete automático
const ETIQUETAS_LEMBRETE = ["DOCUMENTO PENDENTE", "RESPOSTA DE COMENTÁRIO PENDENTE"];

// Lista DEFAULT de equipe interna. Usada como fallback se aba EQUIPE não existir.
// Pra adicionar/remover funcionário sem mexer no código, edite a aba EQUIPE
// (rode MapearEquipeInterna() pra criar a aba populada).
const EQUIPE_INTERNA = [
  "trevo legaliza", "trevolegaliza", "abner maliq",
  "amanda cristovao", "arthur-trevo", "arthur trevo", "leticia tonelli"
];

const CAMPOS_JA_USADOS = new Set([
  "Carimbo de data/hora", "Endereço de e-mail", "  Código do cliente", "Código do cliente",
  "Nome do solicitante", "Nome da Contabilidade", "Pergunta sem título",
  "Informe o estado que seu processo será realizado:",
  "Onde deseja protocolar o processo para análise?",
  "Qual a urgência para a preparação e protocolo do processo? ",
  "Qual a urgência para a preparação e protocolo do processo?",
  "Velocidade de Preparação (SLA Trevo) 🍀",
  "🕰️ Local de Protocolo e Análise (SLA do Órgão Público)"
]);

// =============================================
// SETUP INICIAL
// =============================================
function setupProperties() {
  const ui = SpreadsheetApp.getUi();
  const keys = ["TRELLO_KEY", "TRELLO_TOKEN", "CLAUDE_API_KEY"];
  const props = getProps();
  keys.forEach(k => {
    const atual = props.getProperty(k) ? "(já configurado — deixe em branco pra manter)" : "(vazio)";
    const resp = ui.prompt("Configurar " + k, atual, ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    const valor = resp.getResponseText().trim();
    if (valor) props.setProperty(k, valor);
  });
  ui.alert("✅ Configuração salva.");
}

// =============================================
// HELPERS DE REDE
// =============================================
function fetchRetry(url, options, tentativas) {
  tentativas = tentativas || 3;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const opts = Object.assign({ muteHttpExceptions: true }, options || {});
      const r = UrlFetchApp.fetch(url, opts);
      const code = r.getResponseCode();
      if (code >= 200 && code < 300) return r;
      if (code === 429 || code >= 500) { Utilities.sleep(1500 * i); continue; }
      return r;
    } catch (e) {
      if (i === tentativas) throw e;
      Utilities.sleep(1500 * i);
    }
  }
}
function trelloGet(path, params) {
  const p = Object.assign({ key: prop("TRELLO_KEY"), token: prop("TRELLO_TOKEN") }, params || {});
  const qs = Object.keys(p)
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(p[k]))
    .join("&");
  const url = "https://api.trello.com" + path + "?" + qs;
  return fetchRetry(url, { method: "get" });
}
function trelloPost(path, payload) {
  const u = "https://api.trello.com" + path + "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
  return fetchRetry(u, { method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
}
function trelloPut(path, payload) {
  const u = "https://api.trello.com" + path + "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
  return fetchRetry(u, { method: "put", contentType: "application/json", payload: JSON.stringify(payload) });
}

// =============================================
// HELPER UNIVERSAL — busca valor por nome com fallback tolerante
// v6.3 (24/04/2026): registra chave efetivamente usada em __chavesUsadasDescricao
// pra montarCamposNaoMapeados pular sem precisar checar o valor.
// Resolve duplicação de valores curtos ("Não"/"SIM") nos campos adicionais.
// =============================================
var __chavesUsadasDescricao = null;  // inicializado em aoEnviarFormulario

function campo(respostas, nomes) {
  // 1) Match exato primeiro
  for (let i = 0; i < nomes.length; i++) {
    const chaveTentativa = nomes[i];
    const val = respostas[chaveTentativa];
    if (val && val[0] && String(val[0]).trim() !== "") {
      if (__chavesUsadasDescricao) __chavesUsadasDescricao.add(chaveTentativa);
      return String(val[0]).trim();
    }
  }
  // 2) Fallback tolerante: normaliza nome antes de comparar
  const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
  const alvos = nomes.map(norm);
  for (const chave in respostas) {
    if (alvos.indexOf(norm(chave)) !== -1) {
      const val = respostas[chave];
      if (val && val[0] && String(val[0]).trim() !== "") {
        if (__chavesUsadasDescricao) __chavesUsadasDescricao.add(chave);
        return String(val[0]).trim();
      }
    }
  }
  return "";
}

function extrairIdDrive(url) {
  const m = url.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

function validarEmail(e) {
  return !!(e && String(e).match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
}

function notificarErro(origem, erro) {
  try {
    MailApp.sendEmail(EMAIL_ALERTA_ERRO, "🚨 Erro Trevo — " + origem,
      "Origem: " + origem + "\n\nErro: " + erro.toString() + "\n\nStack:\n" + (erro.stack || "(sem stack)"));
  } catch (e) { Logger.log("Falha notificar: " + e.message); }
  incMetrica("erros");
}

// =============================================
// VALIDAÇÃO DO CLIENTE — com cache 1h
// =============================================
function validarCodigoCliente(codCliente) {
  if (!codCliente || String(codCliente).trim() === "") return { valido: false };
  const cod = String(codCliente).trim();
  const cache = CacheService.getScriptCache();
  const key = "cliente_v2_" + cod;
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("CLIENTES");
    if (!aba) return { valido: false };
    const dados = aba.getDataRange().getValues();
    const headers = dados[0].map(h => String(h).trim().toUpperCase());
    const idxCodigo = headers.indexOf("CÓDIGO CLIENTE");
    const idxLista = headers.indexOf("ID DA LISTA");
    const idxBoard = headers.indexOf("ID DO QUADRO");
    const idxEmailLembretes = headers.indexOf("EMAIL_LEMBRETES");
    const idxEmailBloqueado = headers.indexOf("EMAIL_BLOQUEADO");

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][idxCodigo]).trim() === cod) {
        const resultado = {
          valido: true,
          listaId: String(dados[i][idxLista] || "").trim() || TRELLO_LIST_ID_PADRAO,
          boardId: String(dados[i][idxBoard] || "").trim(),
          emailsLembretes: idxEmailLembretes >= 0 ? String(dados[i][idxEmailLembretes] || "").trim() : "",
          emailBloqueado: idxEmailBloqueado >= 0 ? String(dados[i][idxEmailBloqueado] || "").trim() : "",
        };
        cache.put(key, JSON.stringify(resultado), 3600);
        return resultado;
      }
    }
    return { valido: false };
  } catch (e) {
    Logger.log("⚠️ Erro validarCodigoCliente: " + e.message);
    return { valido: false };
  }
}

function limparCacheClientes() {
  // Chamar manualmente após editar aba CLIENTES
  CacheService.getScriptCache().removeAll([]);
  Logger.log("Cache de clientes limpo.");
}

function avisarClienteCodigoErrado(emailSolicitante, nomeSolicitante, codigoErrado) {
  if (!validarEmail(emailSolicitante)) return;
  const assunto = "⚠️ Código de cliente inválido — Trevo Legaliza";
  const corpo =
    "Olá " + (nomeSolicitante || "") + ",\n\n" +
    "Recebemos sua solicitação, porém o código de cliente informado (" + codigoErrado + ") não foi encontrado.\n\n" +
    "Por favor, verifique com o responsável na Trevo Legaliza e reenvie.\n\n" +
    "🍀 Equipe Trevo Legaliza";
  try { MailApp.sendEmail(emailSolicitante, assunto, corpo, { cc: EMAIL_ALERTA_ERRO }); }
  catch (e) { Logger.log("Falha ao avisar cliente: " + e.message); }
}

// =============================================
// MÉTRICAS — contadores simples em aba dedicada
// =============================================
function incMetrica(chave, n) {
  n = n || 1;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName("MÉTRICAS");
    if (!aba) {
      aba = ss.insertSheet("MÉTRICAS");
      aba.getRange(1, 1, 1, 3).setValues([["DATA", "CHAVE", "VALOR"]]);
      aba.getRange(1, 1, 1, 3).setFontWeight("bold");
      aba.setFrozenRows(1);
    }
    const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const dados = aba.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]) === hoje && String(dados[i][1]) === chave) {
        aba.getRange(i + 1, 3).setValue(Number(dados[i][2] || 0) + n);
        return;
      }
    }
    aba.appendRow([hoje, chave, n]);
  } catch (e) { Logger.log("Falha incMetrica " + chave + ": " + e.message); }
}

// =============================================
// DEDUP por FORM ID (evita cartão duplicado em resubmit)
// =============================================
function jaProcessado(chaveDedup) {
  const cache = CacheService.getScriptCache();
  if (cache.get(chaveDedup)) return true;
  cache.put(chaveDedup, "1", 21600); // 6h
  return false;
}

// =============================================
// TRIGGER: onFormSubmit
// =============================================
function aoEnviarFormulario(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) {
    notificarErro("aoEnviarFormulario", new Error("Timeout aguardando lock — form duplicado ou travado"));
    return;
  }

  try {
    const r = e.namedValues;
    // v6.3: reseta o tracking de chaves consumidas pra esta execução
    __chavesUsadasDescricao = new Set();
    const codCliente = campo(r, ["  Código do cliente", "Código do cliente"]);
    const emailSolicitante = campo(r, ["Endereço de e-mail"]);
    const solicitante = campo(r, ["Nome do solicitante"]);
    const carimbo = campo(r, ["Carimbo de data/hora"]) || new Date().toISOString();

    // Dedup por carimbo + codigo + email
    const dedupKey = "form_" + carimbo + "_" + codCliente + "_" + emailSolicitante;
    if (jaProcessado(dedupKey)) {
      Logger.log("⚠️ Form duplicado ignorado: " + dedupKey);
      return;
    }

    // Validação código
    const validacao = validarCodigoCliente(codCliente);
    if (!validacao.valido) {
      avisarClienteCodigoErrado(emailSolicitante, solicitante, codCliente);
      incMetrica("form_codigo_invalido");
      return;
    }

    const tipoProcesso = campo(r, ["Pergunta sem título"]);
    const estado = campo(r, ["Informe o estado que seu processo será realizado:"]);
    const protocolo = campo(r, ["Onde deseja protocolar o processo para análise?"]);
    const urgencia = campo(r, ["Qual a urgência para a preparação e protocolo do processo? ","Qual a urgência para a preparação e protocolo do processo?"]);
    const contabilidade = campo(r, ["Nome da Contabilidade"]);
    const slaTrevo = campo(r, ["Velocidade de Preparação (SLA Trevo) 🍀"]);
    const localProtocolo = campo(r, ["🕰️ Local de Protocolo e Análise (SLA do Órgão Público)"]);

    const listaDestino = validacao.listaId;
    const boardId = validacao.boardId;
    const nomeEmpresa = definirNomeEmpresa(r, tipoProcesso);
    const nomeCartao = definirNomeCartao(r, codCliente, tipoProcesso);
    const pastaInfo = criarPastasDrive(r, codCliente, nomeEmpresa, emailSolicitante);
    const linkPastaDrive = pastaInfo.url;
    const avisoArquivos = pastaInfo.totalArquivos > 0
      ? "📎 **" + pastaInfo.totalArquivos + " arquivo(s) anexado(s) na pasta**"
      : "📎 **Nenhum arquivo anexado** (cliente pode não ter feito upload)";
    const avisoFalhaArquivos = pastaInfo.falhas > 0
      ? "\n⚠️ **ATENÇÃO: " + pastaInfo.falhas + " arquivo(s) com erro ao mover — verificar logs!**"
      : "";

    const spec = buildSpecPorTipo(r, tipoProcesso);
    const isPrioridadeMaxima = slaTrevo.toLowerCase().includes("prioridade máxima");
    const viaAnalise = detectarViaAnalise(localProtocolo);
    const infoVia = viaAnaliseInfo(viaAnalise);
    const destaquePrioridade = isPrioridadeMaxima ? "\n\n⚡ **PRIORIDADE MÁXIMA TREVO (+50% de acréscimo)** ⚡\n" : "";
    const destaqueVia = "\n\n" + infoVia.destaque + "\n";

    const cabecalhoComum =
      "🏢 **" + codCliente + " — " + contabilidade + "**\n" +
      destaquePrioridade + destaqueVia + "\n" +
      "📂 **LINK DA PASTA:** " + linkPastaDrive + "\n" +
      avisoArquivos + avisoFalhaArquivos + "\n\n" +
      "📋 SOLICITANTE: " + solicitante + "\n" +
      "🏢 CONTABILIDADE: " + contabilidade + "\n" +
      "📧 E-MAIL: " + emailSolicitante + "\n" +
      "🗺️ ESTADO: " + estado + "\n" +
      "📬 PROTOCOLO: " + protocolo + "\n" +
      "⏰ URGÊNCIA: " + urgencia + "\n" +
      "🍀 SLA TREVO: " + slaTrevo + "\n" +
      "🕰️ VIA DE ANÁLISE: " + infoVia.label + "\n" +
      "📝 FORM ID: " + new Date().toISOString() + "\n" +
      "───────────────────────────\n\n";

    const descricaoFinal = cabecalhoComum + spec.descricao + montarCamposNaoMapeados(r, spec.descricao);
    const dueDate = calcularDueDate(urgencia, isPrioridadeMaxima);

    const cardData = criarCardTrello(nomeCartao, descricaoFinal, listaDestino, dueDate);
    if (!cardData) {
      notificarErro("aoEnviarFormulario", new Error("Falha ao criar card Trello para " + nomeCartao));
      avisarFalhaCriacao(emailSolicitante, solicitante, nomeEmpresa);
      return;
    }

    const cardId = cardData.id;
    criarChecklistTrello(cardId, spec.nomeChecklist, spec.itensChecklist);
    definirCapaCartao(cardId, spec.cor);

    const etiquetasParaAplicar = [];
    if (isPrioridadeMaxima) etiquetasParaAplicar.push("PRIORIDADE");
    // Etiqueta da via (sempre aplica — facilita triagem visual no Trello)
    if (infoVia.etiqueta) etiquetasParaAplicar.push(infoVia.etiqueta);
    if (etiquetasParaAplicar.length > 0) aplicarEtiquetasNoCartao(cardId, boardId, etiquetasParaAplicar);

    adicionarMembrosDoBoardAoCartao(cardId, boardId);
    enviarEmailConfirmacaoCliente(emailSolicitante, solicitante, nomeEmpresa, tipoProcesso, cardData.shortUrl || cardData.url);

    incMetrica("form_cartao_criado");
    Logger.log("✅ Cartão criado: " + nomeCartao);
  } catch (erro) {
    Logger.log("❌ ERRO: " + erro.toString());
    Logger.log("Stack: " + erro.stack);
    notificarErro("aoEnviarFormulario", erro);
  } finally {
    lock.releaseLock();
  }
}

function avisarFalhaCriacao(emailSolicitante, nomeSolicitante, nomeEmpresa) {
  if (!validarEmail(emailSolicitante)) return;
  const corpo =
    "Olá " + (nomeSolicitante || "") + ",\n\n" +
    "Recebemos sua solicitação para " + (nomeEmpresa || "a empresa") + ", porém tivemos uma falha técnica ao registrá-la no nosso sistema.\n\n" +
    "Nossa equipe já foi notificada e vai processar manualmente. Você será contatado em breve.\n\n" +
    "🍀 Equipe Trevo Legaliza";
  try { MailApp.sendEmail(emailSolicitante, "⚠️ Solicitação recebida — processando manualmente", corpo, { cc: EMAIL_ALERTA_ERRO }); }
  catch (e) { Logger.log(e.message); }
}

// =============================================
// CAMPOS NÃO MAPEADOS — v6.2 (23/04/2026)
// Agora NADA se perde: se um campo preenchido não apareceu na descrição
// principal, ele entra como "CAMPO ADICIONAL" automaticamente.
//
// Antes: usava blacklist de chaves mapeadas → se a função do tipo não
// renderizasse (if que não entrou, chave com variação no Google Forms),
// o dado sumia. Ex.: Digochat Alteração com "Descrição do objeto social 2"
// preenchido mas não aparecendo no card.
//
// Agora: olha o VALOR — se o texto já está na descrição, pula;
// caso contrário, adiciona em "Campos adicionais". Sem blacklist.
// =============================================
// Chaves que NUNCA aparecem em "Campos Adicionais" — declarações de ciência,
// LGPD, pesquisa de satisfação. Elas existem só pra tracking, não fazem parte
// das informações operacionais do processo.
const CAMPOS_IGNORAR_SEMPRE = [
  /declara[çc][ãa]o\s+de\s+ci[êe]ncia/i,
  /li\s+e\s+aceito/i,
  /aceito\s+os\s+termos/i,
  /lgpd/i,
];

// Pares (regex chave, regexes valores default).
// Se chave casa E valor bate com algum default, ignora.
// Se cliente ESCREVEU algo diferente (ex.: feedback real), aparece normalmente.
const CAMPOS_IGNORAR_SE_DEFAULT = [
  {
    chave: /fe?ed?back/i,
    valoresDefault: [
      /^achei\s+muito\s+bom/i,
      /^agora\s+n[ãa]o/i,
      /^sem\s+feedback/i,
      /^nada\s+a\s+declarar/i,
    ],
  },
];

function montarCamposNaoMapeados(r, descricaoAtual) {
  let out = "\n\n═══════════════════════════\n📋 **CAMPOS ADICIONAIS DO FORMULÁRIO**\n═══════════════════════════\n\n";
  let teveAlgo = false;
  const descLower = String(descricaoAtual || "").toLowerCase();

  for (const chave in r) {
    if (CAMPOS_JA_USADOS.has(chave)) continue;
    if (__chavesUsadasDescricao && __chavesUsadasDescricao.has(chave)) continue;

    // 🔇 Declarações de ciência / LGPD: ignora SEMPRE
    if (CAMPOS_IGNORAR_SEMPRE.some(rx => rx.test(chave))) continue;

    const valor = (r[chave] || [""])[0];
    if (!valor || String(valor).trim() === "") continue;
    if (String(valor).includes("drive.google.com")) continue;

    const valorLimpo = String(valor).trim();

    // 🔇 Feedback com valor default: ignora.
    // Feedback real (cliente escreveu algo diferente) aparece normalmente.
    const regraDefault = CAMPOS_IGNORAR_SE_DEFAULT.find(c => c.chave.test(chave));
    if (regraDefault && regraDefault.valoresDefault.some(rx => rx.test(valorLimpo))) continue;

    // Check secundário: se valor já está na descrição, pula
    const amostra = valorLimpo.substring(0, 60).toLowerCase();
    if (amostra.length >= 15 && descLower.includes(amostra)) continue;

    out += "**" + chave.trim() + ":**\n" + valorLimpo + "\n\n";
    teveAlgo = true;
  }
  return teveAlgo ? out : "";
}

function coletarChavesMapeadas() {
  return new Set([
    "Razão Social desejada","Razão Social opção 2","Nome fantasia",
    "  Selecione o porte/enquadramento da empresa.  ","Selecione o porte/enquadramento da empresa.",
    "Natureza Jurídica:","A empresa será estabelecida?","Qula a forma de atuação?",
    "CNAE Principal","CNAE Secundário(s)","Descrição do objeto social",
    "Capital Social em R$","Capital Social em Quotas",
    "Endereço da Pessoa Jurídica completo com CEP.:","Outras informações que achar pertinente",
    "Quantidade de sócios:","Informe a Quantidade de Sócios:",
    "  👤 SÓCIO 01","👤 SÓCIO 01","Responsável pela RFB?",
    "⚖️ Administração da Sociedade ","⚖️ Administração da Sociedade",
    "💰💳 Forma de Integralização no Capital Social ","💰💳 Forma de Integralização no Capital Social",
    "Integralização total no ato ","Integralização total no ato",
    "  📝  INFORMAÇÕES COMPLETAS DOS SÓCIOS ","📝  INFORMAÇÕES COMPLETAS DOS SÓCIOS",
    "💰💳 INTEGRALIZAÇÃO DO CAPITAL SOCIAL E FORMA DE INTEGRALIZAÇÃO ","💰💳 INTEGRALIZAÇÃO DO CAPITAL SOCIAL E FORMA DE INTEGRALIZAÇÃO",
    "📄 RESPONSÁVEL PELA RFB ","📄 RESPONSÁVEL PELA RFB",
    "⚖️ ADMINISTRAÇÃO DA SOCIEDADE  ","⚖️ ADMINISTRAÇÃO DA SOCIEDADE",
    "Inscrição CNPJ:","  Razão Social atual","Razão Social atual",
    "🔄 Informe se deseja alterar a razão social ou o nome fantasia da empresa.  ","🔄 Informe se deseja alterar a razão social ou o nome fantasia da empresa.",
    "Nova Razão Social  — 1ª opção  ","Nova Razão Social — 1ª opção",
    "Nova Razão Social — 2ª opção  ","Nova Razão Social — 2ª opção",
    "Nome Fantasia (opcional)  ","Nome Fantasia (opcional)",
    "Deseja alterar o enquadramento da empresa?  ","Deseja alterar o enquadramento da empresa?",
    " Novo Enquadramento  ","Novo Enquadramento","Observações gerais",
    "Alteração de Objeto Social / CNAE?  ","Alteração de Objeto Social / CNAE?",
    "CNAE(s) principal e secundário(s)  ","CNAE(s) principal e secundário(s)",
    "Descrição do objeto social 2","Com a alteração, precisamos saber se a atividade será:",
    "Está se mudando?","Será troca de UF?","Endereço completo com CEP:",
    "A atividade nesse novo endereço será estabelecida?","É local de residência do sócio?","Mátricula do imóvel IPTU:",
    "Mudança no QSA","  👥 Informações completas dos sócios  ","👥 Informações completas dos sócios",
    "💰 Integralização do Capital Social e Forma de Integralização  ","💰 Integralização do Capital Social e Forma de Integralização",
    "⚖️ Administração da Sociedade  ","🦁 Responsável pela Receita Federal",
    "Precisa alterar dados simples na Receita Federal, como e-mail, telefone, contabilista responsável e afins?",
    "Telefone principal (opcional) ","Telefone principal (opcional)",
    "E-mail principal (opcional)  ","E-mail principal (opcional)",
    "Endereço para correspondência (opcional)  ","Endereço para correspondência (opcional)",
    "Endereço completo e dados de contato do novo contabilista","Informar novo contabilista","Descreva:",
    "CNPJ da empresa a ser transformada  ","CNPJ da empresa a ser transformada",
    "Natureza Jurídica atual  ","Natureza Jurídica atual",
    "Nova natureza jurídica pretendida  ","Nova natureza jurídica pretendida",
    "🔁 Razão Social e Nome Fantasia após transformação  - 1ª opção","🔁 Razão Social e Nome Fantasia após transformação - 1ª opção",
    "🔁  2ª Opção de Razão Social  ","🔁 2ª Opção de Razão Social",
    "📃 Nome Fantasia (opcional)   ","📃 Nome Fantasia (opcional)",
    "Novo Enquadramento após transformação ","Novo Enquadramento após transformação","Observações gerais 2",
    "Informações completas dos sócios:  ","Informações completas dos sócios:",
    "Administração caberá a quem?","Responsável pela RFB  ","Responsável pela RFB",
    "❓As atividades (CNAEs) e objeto socialvão mudar?  ","❓As atividades (CNAEs) e objeto socialvão mudar?",
    "Dreva as atividades novas respeitando o modelo abaixo.",
    "Haverá alteração de endereço da empresa após a transformação? ","Haverá alteração de endereço da empresa após a transformação?",
    "Será troca de UF? 2","Novo endereço completo com CEP:",
    "É local de residência do sócio? 2","A atividade nesse endereço será estabelecida?",
    "Qual a forma de atuação da empresa?","😊 Algo a mais que queira informar?",
    "❓  CNPJ da empresa a ser encerrada  ","CNPJ da empresa a ser encerrada",
    "📃 Razão Social da empresa  ","📃 Razão Social da empresa","Razão Social da empresa",
    "🤔 Motivo do encerramento",
    "⚠️ Quem será o responsável perante a Receita Federal no encerramento?  ","⚠️ Quem será o responsável perante a Receita Federal no encerramento?",
    "⚠️ Quem será o responsável perante a Receita Federal no encerramento?   2",
    "📝 Observações finais (opcional)  ","📝 Observações finais (opcional)",
    "🤔 Qual o tipo de processo avulso que você deseja solicitar?  ","🤔 Qual o tipo de processo avulso que você deseja solicitar?",
    "Descreva detalhadamente o que precisa ser feito ","Descreva detalhadamente o que precisa ser feito",
    "CNPJ da empresa  ","CNPJ da empresa","Razão Social da empresa ",
    "  📝 Observações sobre os documentos (opcional)  ","📝 Observações sobre os documentos (opcional)"
  ].map(s => s.trim()));
}

// =============================================
// VIA DE ANÁLISE — Matriz / Regional / Método Trevo
// =============================================
// Detecta a via escolhida pelo cliente no form, baseado no texto
// do campo "🕰️ Local de Protocolo e Análise".
// Retorna: 'matriz' | 'regional' | 'metodo_trevo'
function detectarViaAnalise(localProtocolo) {
  const t = String(localProtocolo || "").toLowerCase();
  // Método Trevo tem preferência (string contém 🍀 ou "método trevo" ou "concierge")
  if (t.includes("🍀") || t.includes("método trevo") || t.includes("metodo trevo") || t.includes("concierge")) {
    return "metodo_trevo";
  }
  // Regional
  if (t.includes("regional") || t.includes("escritório regional") || t.includes("escritorio regional") || t.includes("agilidade")) {
    return "regional";
  }
  // Default é matriz (padrão, sem custo adicional)
  return "matriz";
}

// Info visual da via: label pro cabeçalho, destaque em bloco, etiqueta no Trello.
function viaAnaliseInfo(via) {
  switch (via) {
    case "metodo_trevo":
      return {
        label: "🟢🚀 Método Trevo / Concierge",
        destaque: "🟢🚀 **MÉTODO TREVO / CONCIERGE** — DARE + Taxa de Balcão + Honorário Trevo",
        etiqueta: "MÉTODO TREVO 🍀",
      };
    case "regional":
      return {
        label: "🟡 Escritório Regional",
        destaque: "🟡 **ESCRITÓRIO REGIONAL** — DARE + Taxa de Balcão (R$ 189-231). Análise até 72h úteis.",
        etiqueta: "REGIONAL",
      };
    case "matriz":
    default:
      return {
        label: "⚪ Junta Comercial Matriz",
        destaque: "⚪ **JUNTA COMERCIAL MATRIZ** — somente DARE. Prazo indefinido.",
        etiqueta: "MATRIZ",
      };
  }
}

// =============================================
// DUE DATE + ETIQUETAS + MEMBROS
// =============================================
function calcularDueDate(urgencia, isPrioridadeMaxima) {
  const agora = new Date();
  let dias = 7;
  if (isPrioridadeMaxima) dias = 1;
  else {
    const u = (urgencia || "").toLowerCase();
    if (u.includes("urgente")) dias = 3;
    else if (u.includes("normal")) dias = 7;
  }
  agora.setDate(agora.getDate() + dias);
  return agora.toISOString();
}

function aplicarEtiquetasNoCartao(cardId, boardId, nomesEtiquetas) {
  try {
    const r = trelloGet("/1/boards/" + boardId + "/labels", { fields: "name,color,id", limit: "1000" });
    if (r.getResponseCode() !== 200) return;
    const labels = JSON.parse(r.getContentText());
    for (const nomeBuscado of nomesEtiquetas) {
      const label = labels.find(l => (l.name || "").trim() === nomeBuscado.trim());
      if (label) trelloPost("/1/cards/" + cardId + "/idLabels", { value: label.id });
      else Logger.log("⚠️ Etiqueta '" + nomeBuscado + "' não encontrada no board " + boardId);
    }
  } catch (e) { Logger.log("⚠️ Erro etiquetas: " + e.message); }
}

function adicionarMembrosDoBoardAoCartao(cardId, boardId) {
  try {
    const r = trelloGet("/1/boards/" + boardId + "/members", { fields: "id,username" });
    if (r.getResponseCode() !== 200) return;
    const members = JSON.parse(r.getContentText());
    for (const m of members) {
      try { trelloPost("/1/cards/" + cardId + "/idMembers", { value: m.id }); }
      catch (e) { Logger.log("⚠️ Não adicionou @" + m.username + ": " + e.message); }
    }
  } catch (e) { Logger.log("⚠️ Erro membros: " + e.message); }
}

// =============================================
// DEFINIR NOME EMPRESA / CARTÃO (idêntico v5.1)
// =============================================
function buildSpecPorTipo(r, tipoProcesso) {
  switch (tipoProcesso) {
    case "Abertura de empresa":
      return { cor: "green", nomeChecklist: "CHECKLIST - ABERTURA 🍀",
        itensChecklist: ["FORMULÁRIO PREENCHIDO","DOCUMENTO DOS SÓCIOS","COMPROVANTE DE ENDEREÇO DOS SÓCIOS","INSCRIÇÃO IMOBILIÁRIA (IPTU)","CONTRATO SOCIAL","VIABILIDADE","DBE","VRE","AGUARDANDO PAGAMENTO TAXAS","PROCESSO EM ANALISE","PROCESSO DEFERIDO","INSCRIÇÃO MUNICIPAL","INSCRIÇÃO ESTADUAL","ENQUADRAMENTO SIMPLES NACIONAL (SE OPTANTE)","CONSELHO DE CLASSE (SE HOUVER)","HONORÁRIO PAGO"],
        descricao: montarDescricaoAbertura(r) };
    case "Alteração de Empresa": {
      const trocaUF = campo(r, ["Será troca de UF?"]);
      const isUF = trocaUF.toLowerCase() === "sim";
      return { cor: "purple", nomeChecklist: isUF ? "CHECKLIST - ALTERAÇÃO DE U.F.🍀" : "CHECKLIST - ALTERAÇÃO 🍀",
        itensChecklist: isUF
          ? ["* INFORMAÇÕES NOVO ENDEREÇO: VERIFICAR SE HAVERÁ ESPAÇO FÍSICO","VIABILIDADE DE ALTERAÇÃO ( SEDE ANTIGA )","VIABILIDADE DE ALTERAÇÃO * SEDE NOVA","DBE","VRE ( SEDE ANTIGA )","DAE ENCAMINHADA ( SEDE ANTIGA )","PROCESSO EM ANALISE ( SEDE ANTIGA )","PROCESSO REGISTRADO ( SEDE ANTIGA )","SOLICITAR BAIXA INSCRIÇÃO MUNICIPAL (SEDE ANTIGA)","INSCRIÇÃO MUNCIPAL BAIXADA ( SEDE ANTIGA )","VRE ***SEDE NOVA","DAE ENCAMINHADA ***SEDE NOVA","PROCESSO EM ANALISE ***SEDE NOVA","PROCESSO REGISTRADO ***SEDE NOVA","PEDIDO DE INSCRIÇÃO MUNICIPAL ***SEDE NOVA","HONORÁRIO PAGO"]
          : ["FORMULÁRIO PREENCHIDO","DOCUMENTO DOS SÓCIOS (FOTO SIMPLES)","INSCRIÇÃO IMOBILIÁRIA","MINUTA - ALTERAÇÃO CONTRATUAL","VIABILIDADE","DBE","VRE","AGUARDANDO PAGAMENTO TAXAS","PROCESSO EM ANALISE","PROCESSO DEFERIDO","ATUALIZAÇÃO PREFEITURA","CONSELHO DE CLASSE","EMISSÃO DE LICENÇAS","HONORÁRIO PAGO"],
        descricao: montarDescricaoAlteracao(r, trocaUF) };
    }
    case "Transformação de Empresa":
      return { cor: "orange", nomeChecklist: "CHECKLIST - TRANSFORMAÇÃO🍀",
        itensChecklist: ["FORMULÁRIO PREENCHIDO","CHECAGEM DE DOCUMENTOS","DESENQUADRAMENTO - MEI","INFORMAR DÉBITOS - MEI (NOS COMENTÁRIOS)","VIABILIDADE - TRANSFORMAÇÃO","DBE","VRE","MINUTA - TRANSFORMAÇÃO CONTRATUAL","AGUARDANDO PAGAMENTO TAXAS","PROCESSO EM ANALISE","PROCESSO DEFERIDO","ATUALIZAÇÃO PREFEITURA","CONSELHO DE CLASSE","EMISSÃO DE LICENÇAS","HONORÁRIO PAGO"],
        descricao: montarDescricaoTransformacao(r) };
    case "Encerramento de Empresa":
      return { cor: "red", nomeChecklist: "Documentação Pendente",
        itensChecklist: ["CNPJ","Contrato Social registrado","eCPF","HONORÁRIO PAGO"],
        descricao: montarDescricaoEncerramento(r) };
    case "Processos Avulsos":
      return { cor: "black", nomeChecklist: "DOCUMENTOS NECESSÁRIOS",
        itensChecklist: ["CONTRATO SOCIAL / ESTATUTO","COMPROVANTE DE ENDEREÇO COMERCIAL","INSCRIÇÃO IMOBILIÁRIA (IPTU)","HONORÁRIO PAGO"],
        descricao: montarDescricaoAvulso(r) };
    default:
      return { cor: "blue", nomeChecklist: "CHECKLIST GERAL",
        itensChecklist: ["FORMULÁRIO PREENCHIDO","HONORÁRIO PAGO"],
        descricao: "Tipo de processo não identificado.\n\nVerifique o formulário." };
  }
}

function definirNomeCartao(r, codCliente, tipoProcesso) {
  let razao = "";
  switch (tipoProcesso) {
    case "Abertura de empresa": razao = campo(r, ["Razão Social desejada"]); break;
    case "Alteração de Empresa": razao = campo(r, ["  Razão Social atual","Razão Social atual"]); break;
    case "Transformação de Empresa": razao = campo(r, ["🔁 Razão Social e Nome Fantasia após transformação  - 1ª opção","🔁 Razão Social e Nome Fantasia após transformação - 1ª opção"]); break;
    case "Encerramento de Empresa": razao = campo(r, ["📃 Razão Social da empresa  ","📃 Razão Social da empresa","Razão Social da empresa"]); break;
    case "Processos Avulsos": razao = campo(r, ["Razão Social da empresa ","Razão Social da empresa"]); break;
  }
  if (!razao || razao.trim() === "") razao = (tipoProcesso || "PROCESSO").toUpperCase();
  return (codCliente + " - " + razao.trim()).toUpperCase();
}

function definirNomeEmpresa(r, tipo) {
  let nome = "";
  switch (tipo) {
    case "Abertura de empresa": nome = campo(r, ["Razão Social desejada"]); break;
    case "Alteração de Empresa": {
      const alteraRazao = campo(r, ["🔄 Informe se deseja alterar a razão social ou o nome fantasia da empresa.  "]);
      const novaRazao = campo(r, ["Nova Razão Social  — 1ª opção  ","Nova Razão Social — 1ª opção"]);
      const razaoAtual = campo(r, ["  Razão Social atual","Razão Social atual"]);
      nome = (alteraRazao.toLowerCase().includes("sim") && novaRazao) ? novaRazao : razaoAtual; break;
    }
    case "Transformação de Empresa": nome = campo(r, ["🔁 Razão Social e Nome Fantasia após transformação  - 1ª opção","🔁 Razão Social e Nome Fantasia após transformação - 1ª opção"]); break;
    case "Encerramento de Empresa": nome = campo(r, ["📃 Razão Social da empresa  ","📃 Razão Social da empresa","Razão Social da empresa"]); break;
    case "Processos Avulsos": nome = campo(r, ["Razão Social da empresa ","Razão Social da empresa"]); break;
  }
  if (!nome || nome.trim() === "") nome = "PROCESSO - " + campo(r, ["  Código do cliente","Código do cliente"]);
  return nome.trim();
}

// =============================================
// DESCRIÇÕES POR TIPO
// =============================================
function montarDescricaoAbertura(r) {
  const q = campo(r, ["Quantidade de sócios:"]);
  let d = "**DADOS PARA ABERTURA DE EMPRESA ____________**\n\n";
  d += "RAZÃO SOCIAL: " + campo(r, ["Razão Social desejada"]) + "\n\n";
  d += "2ª OPÇÃO: " + campo(r, ["Razão Social opção 2"]) + "\n\n";
  d += "FANTASIA: " + campo(r, ["Nome fantasia"]) + "\n\n";
  d += "PORTE: " + campo(r, ["  Selecione o porte/enquadramento da empresa.  ","Selecione o porte/enquadramento da empresa."]) + "\n\n";
  d += "NATUREZA: " + campo(r, ["Natureza Jurídica:"]) + "\n\n";
  d += "ESTABELECIDA: " + campo(r, ["A empresa será estabelecida?"]) + "\n\n";
  d += "ATUAÇÃO: " + campo(r, ["Qula a forma de atuação?"]) + "\n\n";
  d += "CNAE PRINCIPAL: " + campo(r, ["CNAE Principal"]) + "\n\n";
  d += "CNAE SECUNDÁRIO: " + campo(r, ["CNAE Secundário(s)"]) + "\n\n";
  d += "**OBJETO SOCIAL**\n" + campo(r, ["Descrição do objeto social"]) + "\n\n";
  d += "CAPITAL SOCIAL R$: " + campo(r, ["Capital Social em R$"]) + "\n\n";
  d += "CAPITAL EM QUOTAS: " + campo(r, ["Capital Social em Quotas"]) + "\n\n";
  d += "ENDEREÇO PJ: " + campo(r, ["Endereço da Pessoa Jurídica completo com CEP.:"]) + "\n\n";
  const outras = campo(r, ["Outras informações que achar pertinente"]);
  if (outras) d += "OUTRAS INFORMAÇÕES: " + outras + "\n\n";
  d += "───────────────────────────\n\n";
  if (q === "Somente um sócio") {
    d += "**A) DADOS EMPRESA**\n\nSERÁ ESTABELECIDA: " + campo(r, ["A empresa será estabelecida?"]) + "\n\n";
    d += "ENDEREÇO SEDE: " + campo(r, ["Endereço da Pessoa Jurídica completo com CEP.:"]) + "\n\n";
    d += "**B) DADOS SÓCIOS**\n\nQUANTIDADE DE SÓCIOS: " + q + "\n\n";
    d += "👤 SÓCIO 01: " + campo(r, ["  👤 SÓCIO 01","👤 SÓCIO 01"]) + "\n\n";
    d += "RESPONSÁVEL NA RECEITA: " + campo(r, ["Responsável pela RFB?"]) + "\n\n";
    d += "ADMINISTRAÇÃO: " + campo(r, ["⚖️ Administração da Sociedade ","⚖️ Administração da Sociedade"]) + "\n\n";
    d += "INTEGRALIZAÇÃO: " + campo(r, ["💰💳 Forma de Integralização no Capital Social ","💰💳 Forma de Integralização no Capital Social"]) + "\n\n";
    d += "TOTAL NO ATO: " + campo(r, ["Integralização total no ato ","Integralização total no ato"]) + "\n\n";
  } else {
    d += "**A) DADOS EMPRESA**\n\nSERÁ ESTABELECIDA: " + campo(r, ["A empresa será estabelecida?"]) + "\n\n";
    d += "ENDEREÇO SEDE: " + campo(r, ["Endereço da Pessoa Jurídica completo com CEP.:"]) + "\n\n";
    d += "**B) DADOS SÓCIOS**\n\nQTD SÓCIOS: " + campo(r, ["Informe a Quantidade de Sócios:"]) + "\n\n";
    d += "📝 INFORMAÇÕES COMPLETAS:\n" + campo(r, ["  📝  INFORMAÇÕES COMPLETAS DOS SÓCIOS ","📝  INFORMAÇÕES COMPLETAS DOS SÓCIOS"]) + "\n\n";
    d += "💰 INTEGRALIZAÇÃO:\n" + campo(r, ["💰💳 INTEGRALIZAÇÃO DO CAPITAL SOCIAL E FORMA DE INTEGRALIZAÇÃO ","💰💳 INTEGRALIZAÇÃO DO CAPITAL SOCIAL E FORMA DE INTEGRALIZAÇÃO"]) + "\n\n";
    d += "RESPONSÁVEL RFB: " + campo(r, ["📄 RESPONSÁVEL PELA RFB ","📄 RESPONSÁVEL PELA RFB"]) + "\n\n";
    d += "ADMINISTRAÇÃO: " + campo(r, ["⚖️ ADMINISTRAÇÃO DA SOCIEDADE  ","⚖️ ADMINISTRAÇÃO DA SOCIEDADE"]) + "\n\n";
  }
  return d;
}

function montarDescricaoAlteracao(r, trocaUF) {
  let d = "**DADOS PARA ALTERAÇÃO____________**\n\n";
  d += "CNPJ: " + campo(r, ["Inscrição CNPJ:"]) + "\n\n";
  d += "RAZÃO SOCIAL ATUAL: " + campo(r, ["  Razão Social atual","Razão Social atual"]) + "\n\n";
  const alteraRazao = campo(r, ["🔄 Informe se deseja alterar a razão social ou o nome fantasia da empresa.  ","🔄 Informe se deseja alterar a razão social ou o nome fantasia da empresa."]);
  d += "ALTERA RAZÃO? " + alteraRazao + "\n\n";
  if (alteraRazao.toLowerCase().includes("sim")) {
    d += "NOVA 1ª: " + campo(r, ["Nova Razão Social  — 1ª opção  ","Nova Razão Social — 1ª opção"]) + "\n\n";
    d += "NOVA 2ª: " + campo(r, ["Nova Razão Social — 2ª opção  ","Nova Razão Social — 2ª opção"]) + "\n\n";
    d += "FANTASIA: " + campo(r, ["Nome Fantasia (opcional)  ","Nome Fantasia (opcional)"]) + "\n\n";
  }
  const alteraEnq = campo(r, ["Deseja alterar o enquadramento da empresa?  ","Deseja alterar o enquadramento da empresa?"]);
  d += "ALTERA ENQUADRAMENTO? " + alteraEnq + "\n\n";
  if (alteraEnq.toLowerCase().includes("sim")) d += "NOVO: " + campo(r, [" Novo Enquadramento  ","Novo Enquadramento"]) + "\n\n";
  const obs = campo(r, ["Observações gerais"]);
  if (obs) d += "OBSERVAÇÕES: " + obs + "\n\n";
  const alteraCnae = campo(r, ["Alteração de Objeto Social / CNAE?  ","Alteração de Objeto Social / CNAE?"]);
  d += "ALTERA CNAE? " + alteraCnae + "\n\n";
  if (alteraCnae.toLowerCase().includes("sim")) {
    d += "CNAE(s): " + campo(r, ["CNAE(s) principal e secundário(s)  ","CNAE(s) principal e secundário(s)"]) + "\n\n";
    // v6.3: Google Forms namedValues mantém o título original da pergunta,
    // mas a planilha renomeia com " 2" quando há duplicata. Então tentamos
    // COM e SEM o "2" — funciona em ambos os casos.
    d += "**OBJETO SOCIAL:**\n" + campo(r, ["Descrição do objeto social 2", "Descrição do objeto social"]) + "\n\n";
    d += "ATIVIDADE SERÁ: " + campo(r, ["Com a alteração, precisamos saber se a atividade será:"]) + "\n\n";
  }
  const mudando = campo(r, ["Está se mudando?"]);
  d += "───────────────────────────\n\nESTÁ SE MUDANDO? " + mudando + "\n\n";
  if (mudando.toUpperCase() === "SIM") {
    // v6.3: trocaUF pode vir vazio se Google Forms mudou a chave.
    // Tenta re-buscar com fallbacks antes de exibir.
    const trocaUFEfetiva = trocaUF || campo(r, ["Será troca de UF?  ", "Será troca de UF?", "Troca de UF?", "Mudança de UF?"]) || "Não informado";
    d += "TROCA DE UF? " + trocaUFEfetiva + "\n\n";
    d += "NOVO END: " + campo(r, ["Endereço completo com CEP:","Endereço completo com CEP"]) + "\n\n";
    d += "ESTABELECIDA NOVO END? " + campo(r, ["A atividade nesse novo endereço será estabelecida?"]) + "\n\n";
    d += "RESIDÊNCIA SÓCIO? " + (campo(r, ["É local de residência do sócio?", "É local de residência do sócio? ", "E local de residencia do socio?"]) || "Não informado") + "\n\n";
    d += "IPTU: " + campo(r, ["Mátricula do imóvel IPTU:", "Matricula do imovel IPTU:", "Matrícula do imóvel IPTU:"]) + "\n\n";
  }
  const mudaQSA = campo(r, ["Mudança no QSA"]);
  d += "───────────────────────────\n\nMUDANÇA NO QSA? " + mudaQSA + "\n\n";
  if (mudaQSA.toLowerCase().includes("sim")) {
    d += "👥 SÓCIOS:\n" + campo(r, ["  👥 Informações completas dos sócios  ","👥 Informações completas dos sócios"]) + "\n\n";
    d += "💰 INTEGRALIZAÇÃO:\n" + campo(r, ["💰 Integralização do Capital Social e Forma de Integralização  ","💰 Integralização do Capital Social e Forma de Integralização"]) + "\n\n";
    d += "ADMINISTRAÇÃO: " + campo(r, ["⚖️ Administração da Sociedade  "]) + "\n\n";
    d += "RESPONSÁVEL RFB: " + campo(r, ["🦁 Responsável pela Receita Federal"]) + "\n\n";
  }
  const dadosSimples = campo(r, ["Precisa alterar dados simples na Receita Federal, como e-mail, telefone, contabilista responsável e afins?"]);
  d += "ALTERA DADOS SIMPLES RFB? " + dadosSimples + "\n\n";
  if (dadosSimples.toLowerCase().includes("sim")) {
    d += "TELEFONE: " + campo(r, ["Telefone principal (opcional) ","Telefone principal (opcional)"]) + "\n\n";
    d += "E-MAIL: " + campo(r, ["E-mail principal (opcional)  ","E-mail principal (opcional)"]) + "\n\n";
    d += "CORRESPONDÊNCIA: " + campo(r, ["Endereço para correspondência (opcional)  ","Endereço para correspondência (opcional)"]) + "\n\n";
    d += "NOVO CONTABILISTA: " + campo(r, ["Endereço completo e dados de contato do novo contabilista"]) + "\n\n";
    d += "INFORMAR: " + campo(r, ["Informar novo contabilista"]) + "\n\n";
  }
  const descExtra = campo(r, ["Descreva:"]);
  if (descExtra) d += "DESCRIÇÃO EXTRA: " + descExtra + "\n\n";
  d += "\n*OBS: HAVENDO ALTERAÇÃO DE RESPONSÁVEL NA RECEITA, SERÁ NECESSÁRIO EMITIR NOVO CERTIFICADO DIGITAL (E-CNPJ).*";
  return d;
}

function montarDescricaoTransformacao(r) {
  let d = "**INFORMAÇÕES PARA TRANSFORMAÇÃO______________**\n\n";
  d += "CNPJ: " + campo(r, ["CNPJ da empresa a ser transformada  ","CNPJ da empresa a ser transformada"]) + "\n\n";
  d += "NATUREZA ATUAL: " + campo(r, ["Natureza Jurídica atual  ","Natureza Jurídica atual"]) + "\n\n";
  d += "NOVA NATUREZA: " + campo(r, ["Nova natureza jurídica pretendida  ","Nova natureza jurídica pretendida"]) + "\n\n";
  d += "1ª OPÇÃO: " + campo(r, ["🔁 Razão Social e Nome Fantasia após transformação  - 1ª opção","🔁 Razão Social e Nome Fantasia após transformação - 1ª opção"]) + "\n\n";
  d += "2ª OPÇÃO: " + campo(r, ["🔁  2ª Opção de Razão Social  ","🔁 2ª Opção de Razão Social"]) + "\n\n";
  d += "FANTASIA: " + campo(r, ["📃 Nome Fantasia (opcional)   ","📃 Nome Fantasia (opcional)"]) + "\n\n";
  d += "NOVO ENQUADRAMENTO: " + campo(r, ["Novo Enquadramento após transformação ","Novo Enquadramento após transformação"]) + "\n\n";
  const obs = campo(r, ["Observações gerais 2"]);
  if (obs) d += "OBSERVAÇÕES: " + obs + "\n\n";
  d += "───────────────────────────\n\n*VERIFICAR SE HAVERÁ ALTERAÇÃO DE:*\n1. CAPITAL SOCIAL\n2. RAZÃO SOCIAL\n3. QTD SÓCIOS\n4. ESTADO CIVIL\n5. ADMINISTRAÇÃO\n6. RESPONSÁVEL RFB\n\n";
  d += "👥 SÓCIOS:\n" + campo(r, ["Informações completas dos sócios:  ","Informações completas dos sócios:"]) + "\n\n";
  d += "ADMINISTRAÇÃO: " + campo(r, ["Administração caberá a quem?"]) + "\n\n";
  d += "RESPONSÁVEL RFB: " + campo(r, ["Responsável pela RFB  ","Responsável pela RFB"]) + "\n\n";
  const alteraCnae = campo(r, ["❓As atividades (CNAEs) e objeto socialvão mudar?  ","❓As atividades (CNAEs) e objeto socialvão mudar?"]);
  d += "───────────────────────────\n\nALTERA CNAE? " + alteraCnae + "\n\n";
  if (alteraCnae.toLowerCase().includes("sim")) d += "NOVAS ATIVIDADES:\n" + campo(r, ["Dreva as atividades novas respeitando o modelo abaixo."]) + "\n\n";
  const alteraEnd = campo(r, ["Haverá alteração de endereço da empresa após a transformação? ","Haverá alteração de endereço da empresa após a transformação?"]);
  d += "ALTERA END? " + alteraEnd + "\n\n";
  if (alteraEnd.toLowerCase().includes("sim")) {
    // v6.3: fallback com e sem " 2" (Google Forms vs planilha)
    d += "TROCA UF? " + (campo(r, ["Será troca de UF? 2", "Será troca de UF?"]) || "Não informado") + "\n\n";
    d += "NOVO END: " + campo(r, ["Novo endereço completo com CEP:"]) + "\n\n";
  }
  d += "RESIDÊNCIA SÓCIO? " + (campo(r, ["É local de residência do sócio? 2", "É local de residência do sócio?"]) || "Não informado") + "\n\n";
  d += "ESTABELECIDA? " + campo(r, ["A atividade nesse endereço será estabelecida?"]) + "\n\n";
  d += "ATUAÇÃO: " + campo(r, ["Qual a forma de atuação da empresa?"]) + "\n\n";
  const algoMais = campo(r, ["😊 Algo a mais que queira informar?"]);
  if (algoMais) d += "ALGO MAIS: " + algoMais + "\n\n";
  d += "\n*OBS: RECOMENDAMOS EMISSÃO DE NOVO CERTIFICADO DIGITAL AO FINAL.*";
  return d;
}

function montarDescricaoEncerramento(r) {
  let d = "**DADOS PARA ENCERRAMENTO____________**\n\n";
  d += "CNPJ: " + campo(r, ["❓  CNPJ da empresa a ser encerrada  ","CNPJ da empresa a ser encerrada"]) + "\n\n";
  d += "RAZÃO SOCIAL: " + campo(r, ["📃 Razão Social da empresa  ","📃 Razão Social da empresa","Razão Social da empresa"]) + "\n\n";
  d += "MOTIVO: " + campo(r, ["🤔 Motivo do encerramento"]) + "\n\n";
  const resp = campo(r, ["⚠️ Quem será o responsável perante a Receita Federal no encerramento?  ","⚠️ Quem será o responsável perante a Receita Federal no encerramento?","⚠️ Quem será o responsável perante a Receita Federal no encerramento?   2"]);
  if (resp) d += "RESPONSÁVEL RF: " + resp + "\n\n";
  const obs = campo(r, ["📝 Observações finais (opcional)  ","📝 Observações finais (opcional)"]);
  if (obs) d += "*OBSERVAÇÕES:* " + obs + "\n\n";
  return d;
}

function montarDescricaoAvulso(r) {
  let d = "**PROCESSO A SER EFETUADO____________**\n\n";
  d += "TIPO: " + campo(r, ["🤔 Qual o tipo de processo avulso que você deseja solicitar?  ","🤔 Qual o tipo de processo avulso que você deseja solicitar?"]) + "\n\n";
  d += "**INFORMAÇÕES:**\n" + campo(r, ["Descreva detalhadamente o que precisa ser feito ","Descreva detalhadamente o que precisa ser feito"]) + "\n\n";
  d += "CNPJ: " + campo(r, ["CNPJ da empresa  ","CNPJ da empresa"]) + "\n\n";
  d += "RAZÃO SOCIAL: " + campo(r, ["Razão Social da empresa ","Razão Social da empresa"]) + "\n\n";
  const obsDocs = campo(r, ["  📝 Observações sobre os documentos (opcional)  ","📝 Observações sobre os documentos (opcional)"]);
  if (obsDocs) d += "OBSERVAÇÕES DOCS: " + obsDocs + "\n\n";
  return d;
}

// =============================================
// DRIVE — PASTAS + ANEXOS + COMPARTILHAR LEITOR
// v6.2: retorna objeto com contagem de arquivos (pra cabeçalho mostrar)
//       + alerta pro Thales se algum mover falhar.
// =============================================
function criarPastasDrive(r, codCliente, nomeEmpresa, emailSolicitante) {
  const raiz = DriveApp.getFolderById(PASTA_CLIENTES_ATIVOS_ID);
  let pastaCliente;
  const bc = raiz.searchFolders("title contains '" + codCliente + "'");
  if (bc.hasNext()) pastaCliente = bc.next();
  else pastaCliente = raiz.createFolder("CLIENTE NOVO - " + codCliente);

  let pastaProcessos;
  const bp = pastaCliente.searchFolders("title = 'PROCESSOS' OR title = 'processos'");
  if (bp.hasNext()) pastaProcessos = bp.next();
  else pastaProcessos = pastaCliente.createFolder("PROCESSOS");

  const pastaEmpresa = buscarOuCriarPastaEmpresa(pastaProcessos, nomeEmpresa);

  // Move arquivos com tracking — qualquer falha é escalada pro Thales
  let totalTentativas = 0;
  let totalSucesso = 0;
  const falhas = [];

  for (const chave in r) {
    const valor = (r[chave] || [""])[0];
    if (!valor || !String(valor).includes("drive.google.com")) continue;
    const urls = String(valor).split(",");
    urls.forEach(url => {
      const id = extrairIdDrive(url.trim());
      if (!id) return;
      totalTentativas++;
      try {
        DriveApp.getFileById(id).moveTo(pastaEmpresa);
        totalSucesso++;
      } catch (e) {
        falhas.push({ campo: chave, id: id, erro: e.message });
        Logger.log("⚠️ Não moveu " + id + " (campo '" + chave + "'): " + e.message);
      }
    });
  }

  if (falhas.length > 0) {
    notificarErro("criarPastasDrive",
      new Error(totalSucesso + "/" + totalTentativas + " arquivos movidos. Falhas:\n" +
        falhas.map(f => "  • [" + f.campo + "] " + f.id + " → " + f.erro).join("\n")));
  }

  compartilharComoLeitor(pastaEmpresa, emailSolicitante);

  return {
    url: pastaEmpresa.getUrl(),
    totalArquivos: totalSucesso,
    totalTentativas: totalTentativas,
    falhas: falhas.length,
  };
}

function compartilharComoLeitor(pasta, email) {
  if (!validarEmail(email)) return;
  try {
    pasta.addViewer(email);
    Logger.log("✅ Pasta compartilhada com " + email);
  } catch (e) {
    Logger.log("⚠️ Falha ao compartilhar com " + email + ": " + e.message);
  }
}

function buscarOuCriarPastaEmpresa(pastaProcessos, nomeEmpresa) {
  const lim = Date.now() - 10 * 60 * 1000;
  const iter = pastaProcessos.searchFolders("title = '" + nomeEmpresa.replace(/'/g, "\\'") + "'");
  while (iter.hasNext()) {
    const p = iter.next();
    if (p.getDateCreated().getTime() > lim) return p;
  }
  return pastaProcessos.createFolder(nomeEmpresa);
}

function moverArquivosDoCampo(r, nomeCampo, pastaDestino) {
  const valor = (r[nomeCampo] || [""])[0];
  if (!valor || !valor.includes("drive.google.com")) return;
  const urls = valor.split(",");
  urls.forEach(url => {
    const id = extrairIdDrive(url.trim());
    if (id) {
      try { DriveApp.getFileById(id).moveTo(pastaDestino); }
      catch (e) {
        Logger.log("⚠️ Não moveu " + id + ": " + e.message);
        notificarErro("moverArquivos", new Error("id=" + id + " erro=" + e.message));
      }
    }
  });
}

// =============================================
// TRELLO — CARD / CAPA / CHECKLIST
// =============================================
function criarCardTrello(nome, descricao, listId, dueDate) {
  const payload = { name: nome, desc: descricao, idList: listId };
  if (dueDate) payload.due = dueDate;
  const r = trelloPost("/1/cards", payload);
  if (r.getResponseCode() === 200) {
    const c = JSON.parse(r.getContentText());
    Logger.log("✅ Card criado: " + c.id + " — " + nome);
    return c;
  }
  Logger.log("❌ Erro criar card: " + r.getContentText());
  return null;
}

function definirCapaCartao(cardId, cor) {
  const r = trelloPut("/1/cards/" + cardId, { cover: { color: cor, brightness: "dark", size: "normal" } });
  if (r.getResponseCode() !== 200) Logger.log("⚠️ Erro capa: " + r.getContentText());
}

function criarChecklistTrello(cardId, nomeChecklist, itens) {
  const rc = trelloPost("/1/checklists", { idCard: cardId, name: nomeChecklist });
  if (rc.getResponseCode() !== 200) { Logger.log("❌ Erro checklist: " + rc.getContentText()); return; }
  const checklistId = JSON.parse(rc.getContentText()).id;
  itens.forEach(item => trelloPost("/1/checklists/" + checklistId + "/checkItems", { name: item }));
}

// Busca email de comentário do card (pra resposta automática virar comentário)
function getEmailDoCard(cardId) {
  try {
    const r = trelloGet("/1/cards/" + cardId, { fields: "email" });
    if (r.getResponseCode() !== 200) return null;
    const data = JSON.parse(r.getContentText());
    return data.email || null;
  } catch (e) { return null; }
}

// =============================================
// MapearClientes — EXECUÇÃO MANUAL
// =============================================
function MapearClientes() {
  const IGNORAR = ["AUTOMAÇÃO DE NOVOS PROCESSOS","AUTOMACAO","CENTRAL DE PROCESSO","CONTROLE DE COBRANÇA","CONTROLE DE COBRANCA","PROCESOS DR","PROCESSOS DR","INTERNO","MODELO","GRAVAÇÃO","GRAVACAO","SUA ÁREA DE TRABALHO"];
  const rb = trelloGet("/1/members/me/boards", { fields: "name,id,closed" });
  if (rb.getResponseCode() !== 200) { Logger.log("❌ Erro: " + rb.getContentText()); return; }
  const quadros = JSON.parse(rb.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName("CLIENTES");
  if (!aba) {
    aba = ss.insertSheet("CLIENTES");
  }

  // Preserva colunas extras se já existem (EMAIL_LEMBRETES, EMAIL_BLOQUEADO)
  const dadosExistentes = aba.getDataRange().getValues();
  const mapaExtras = {};
  if (dadosExistentes.length > 1) {
    const headers = dadosExistentes[0].map(h => String(h).trim().toUpperCase());
    const idxCodigo = headers.indexOf("CÓDIGO CLIENTE");
    const idxEmailLembretes = headers.indexOf("EMAIL_LEMBRETES");
    const idxEmailBloqueado = headers.indexOf("EMAIL_BLOQUEADO");
    if (idxCodigo >= 0) {
      for (let i = 1; i < dadosExistentes.length; i++) {
        const cod = String(dadosExistentes[i][idxCodigo]).trim();
        if (!cod) continue;
        mapaExtras[cod] = {
          emailLembretes: idxEmailLembretes >= 0 ? dadosExistentes[i][idxEmailLembretes] : "",
          emailBloqueado: idxEmailBloqueado >= 0 ? dadosExistentes[i][idxEmailBloqueado] : "",
        };
      }
    }
  }

  aba.clear();
  aba.getRange(1, 1, 1, 6).setValues([["CÓDIGO CLIENTE","NOME DO QUADRO","ID DA LISTA","ID DO QUADRO","EMAIL_LEMBRETES","EMAIL_BLOQUEADO"]]);
  aba.getRange(1, 1, 1, 6).setFontWeight("bold");

  let linha = 2, mapeados = 0, ignorados = 0;
  for (const q of quadros) {
    if (q.closed) continue;
    const up = q.name.toUpperCase();
    if (IGNORAR.some(ig => up.includes(ig.toUpperCase()))) { ignorados++; continue; }
    let codigo = "";
    let m = q.name.match(/(\d{3,})\s*$/);
    if (m) codigo = m[1];
    else { m = q.name.match(/COD(?:\s+CLIENTE)?\s*[:\-]?\s*(\d{3,})/i); if (m) codigo = m[1]; else { m = q.name.match(/(\d{5,})/); if (m) codigo = m[1]; } }
    if (!codigo) continue;
    const rl = trelloGet("/1/boards/" + q.id + "/lists", { fields: "name,id" });
    if (rl.getResponseCode() !== 200) continue;
    const listas = JSON.parse(rl.getContentText());
    const primeira = listas.find(l => /RECÉM CHEGADOS|RECEM CHEGADOS/i.test(l.name));
    if (!primeira) continue;
    const extras = mapaExtras[codigo] || { emailLembretes: "", emailBloqueado: "" };
    aba.getRange(linha, 1, 1, 6).setValues([[codigo, q.name, primeira.id, q.id, extras.emailLembretes, extras.emailBloqueado]]);
    linha++; mapeados++;
  }
  aba.autoResizeColumns(1, 6);
  limparCacheClientes();
  Logger.log("✅ " + mapeados + " mapeados | " + ignorados + " ignorados");
}

// =============================================
// TestedoCartao — EXECUÇÃO MANUAL (único)
// =============================================
function TestedoCartao() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastCol = planilha.getLastColumn();
  const lastRow = planilha.getLastRow();
  if (lastRow < 2) { Logger.log("❌ Planilha precisa ter pelo menos 2 linhas."); return; }

  const cabecalhos = planilha.getRange(1, 1, 1, lastCol).getValues()[0];
  const valores = planilha.getRange(2, 1, 1, lastCol).getValues()[0];
  const namedValues = {};
  for (let i = 0; i < cabecalhos.length; i++) {
    namedValues[String(cabecalhos[i])] = [valores[i] != null ? String(valores[i]) : ""];
  }

  Logger.log("🧪 TESTE — Código: " + (namedValues["  Código do cliente"] || namedValues["Código do cliente"] || [""])[0]);
  Logger.log("🧪 Tipo: " + (namedValues["Pergunta sem título"] || [""])[0]);

  try {
    aoEnviarFormulario({ namedValues: namedValues });
    Logger.log("✅ TESTE CONCLUÍDO");
  } catch (e) {
    Logger.log("❌ ERRO: " + e.toString());
  }
}

// ═══════════════════════════════════════════════════════════════
// LEMBRETES DE PENDÊNCIAS — cron diário 9h + disparo imediato
// ═══════════════════════════════════════════════════════════════

/**
 * Trigger diário 9h. Varre TODOS os cards com etiquetas de pendência
 * e manda email pra quem precisa, respeitando escalonamento 1-5/6-10/11+.
 */
function LembretesPendencias() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) { Logger.log("⚠️ LembretesPendencias: lock ocupado"); return; }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaClientes = ss.getSheetByName("CLIENTES");
    if (!abaClientes) { Logger.log("Sem aba CLIENTES"); return; }
    const dados = abaClientes.getDataRange().getValues();
    const headers = dados[0].map(h => String(h).trim().toUpperCase());
    const idxCodigo = headers.indexOf("CÓDIGO CLIENTE");
    const idxBoard = headers.indexOf("ID DO QUADRO");
    const idxEmailLembretes = headers.indexOf("EMAIL_LEMBRETES");
    const idxEmailBloqueado = headers.indexOf("EMAIL_BLOQUEADO");

    let processados = 0;
    let enviados = 0;

    for (let i = 1; i < dados.length; i++) {
      const boardId = String(dados[i][idxBoard] || "").trim();
      if (!boardId) continue;
      const codigo = String(dados[i][idxCodigo] || "").trim();
      const emailsLembretes = idxEmailLembretes >= 0 ? String(dados[i][idxEmailLembretes] || "").trim() : "";
      const emailBloqueado = idxEmailBloqueado >= 0 ? String(dados[i][idxEmailBloqueado] || "").trim() : "";

      try {
        const cards = buscarCardsComEtiquetaLembrete(boardId);
        for (const card of cards) {
          processados++;
          const enviou = processarLembreteCard(card, codigo, emailsLembretes, emailBloqueado);
          if (enviou) enviados++;
        }
      } catch (e) {
        Logger.log("⚠️ Erro board " + boardId + ": " + e.message);
      }
    }

    incMetrica("lembretes_processados", processados);
    incMetrica("lembretes_enviados", enviados);
    Logger.log("✅ Lembretes: " + enviados + " enviados de " + processados + " cards verificados");
  } catch (e) {
    notificarErro("LembretesPendencias", e);
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 DANI v1.0 — INFRAESTRUTURA WEBHOOK (Onda 0 — 24/04/2026)
// ────────────────────────────────────────────────────────────────────────────
// Aceita 2 tipos de payload:
//   (a) PAYLOAD INTERNO — { card_id, label_name } (legado, ERP/Edge Function
//       chamava pra forçar lembrete imediato).
//   (b) WEBHOOK NATIVO TRELLO — { action: { type, data, memberCreator } }
//       Disparado em tempo real pelo Trello quando algo acontece num board
//       monitorado.
//
// SEGURANÇA:
//   Toda chamada precisa de ?token=XXX na query string OU campo "token" no
//   body. Token armazenado em property WEBHOOK_TOKEN. Sem token = 401.
//
// ROTEAMENTO POR TIPO DE EVENTO:
//   commentCard         → handlerComentario(action) — funcionário ou cliente comenta
//   addLabelToCard      → handlerEtiquetaAdd(action)
//   removeLabelToCard   → handlerEtiquetaRemove(action)
//   updateCard:idList   → handlerCardMovido(action)
//   addAttachmentToCard → handlerAnexo(action)
//
// Onda 0: handlers fazem só LOG + dispatch. Onda 1+ implementa as ações.
// ════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  // Trello faz HEAD inicial pra verificar URL ao criar webhook.
  // Apps Script Web App responde HEAD via doGet. Retornar 200 OK basta.
  return ContentService.createTextOutput("Dani webhook online")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    // ── 1. Auth: token obrigatório (param OU body) ───────────────────────
    const tokenEsperado = getProps().getProperty("WEBHOOK_TOKEN");
    if (tokenEsperado) {
      const tokenRecebido =
        (e.parameter && e.parameter.token) ||
        (e.postData && e.postData.contents && (() => {
          try { return JSON.parse(e.postData.contents).token; } catch (_) { return null; }
        })());
      if (tokenRecebido !== tokenEsperado) {
        Logger.log("⚠️ doPost auth fail — token recebido: " + (tokenRecebido ? "[set]" : "[vazio]"));
        return _respJson({ ok: false, error: "auth_fail" }, 401);
      }
    }

    // ── 2. Parse do body ─────────────────────────────────────────────────
    const payload = JSON.parse(e.postData.contents || "{}");

    // ── 3. Roteamento (a) payload interno legado ─────────────────────────
    if (payload.card_id) return _doPostLegadoLembrete(payload);

    // ── 4. Roteamento (b) webhook nativo Trello ──────────────────────────
    if (payload.action && payload.action.type) {
      return _doPostWebhookTrello(payload.action);
    }

    return _respJson({ ok: false, error: "payload_desconhecido" }, 400);
  } catch (err) {
    notificarErro("doPost", err);
    return _respJson({ ok: false, error: String(err) }, 500);
  }
}

// Helper de resposta JSON
function _respJson(obj, status) {
  // Apps Script não permite setar status code customizado em ContentService.
  // O status é informativo no body (clientes podem ler). Status HTTP sempre 200.
  obj.__status = status || 200;
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Payload interno legado (mantém compat com Edge Function existente) ────
function _doPostLegadoLembrete(payload) {
  const cardId = payload.card_id;
  if (!cardId) return _respJson({ ok: false, error: "card_id obrigatório" }, 400);

  const r = trelloGet("/1/cards/" + cardId, { fields: "name,idBoard,shortUrl,desc,labels", labels: "true" });
  if (r.getResponseCode() !== 200) {
    return _respJson({ ok: false, error: "card não encontrado" }, 404);
  }
  const card = JSON.parse(r.getContentText());
  const labelsLembrete = (card.labels || []).filter(l => ETIQUETAS_LEMBRETE.indexOf((l.name || "").trim()) !== -1);
  if (labelsLembrete.length === 0) {
    return _respJson({ ok: true, skipped: "sem etiqueta de lembrete" });
  }
  card.labels = labelsLembrete;

  const { codigo, emailsLembretes, emailBloqueado } = resolverClientePorBoard(card.idBoard);
  if (!codigo) {
    return _respJson({ ok: false, error: "cliente não mapeado pra board " + card.idBoard }, 404);
  }

  const enviou = processarLembreteCard(card, codigo, emailsLembretes, emailBloqueado, /* forcarPrimeiro */ true);
  incMetrica("lembretes_imediatos");
  return _respJson({ ok: true, enviou: enviou });
}

// ─── Roteador de webhook nativo Trello ─────────────────────────────────────
function _doPostWebhookTrello(action) {
  const tipo = action.type;
  const idBoard = (action.data && action.data.board && action.data.board.id) || "";
  const idCard  = (action.data && action.data.card  && action.data.card.id)  || "";
  const autor   = (action.memberCreator && action.memberCreator.fullName) || "?";

  // 🛡️ Hard skip: nunca agir no board CENTRAL DE PROCESSO (espelhamento Placker)
  if (idBoard) {
    const bn = (action.data.board.name || "").toUpperCase();
    if (bn.indexOf("CENTRAL DE PROCESSO") !== -1 || bn.indexOf("CENTRAL DE PORCESSO") !== -1) {
      return _respJson({ ok: true, skipped: "board excluído (CENTRAL DE PROCESSO)" });
    }
  }

  // Cliente do board precisa estar mapeado em CLIENTES — caso contrário ignora.
  // (Boards internos da Trevo não têm código de cliente e devem ser ignorados.)
  const cli = resolverClientePorBoard(idBoard);
  if (!cli || !cli.codigo) {
    return _respJson({ ok: true, skipped: "board não mapeado em CLIENTES: " + idBoard });
  }

  Logger.log("📥 Webhook recebido: " + tipo + " | board=" + idBoard + " | card=" + idCard + " | autor=" + autor);
  incMetrica("webhook_" + tipo);

  // Dispatch — Onda 1+ implementa cada handler. Por enquanto só loga.
  switch (tipo) {
    case "commentCard":         return handlerComentario(action, cli);
    case "addLabelToCard":      return handlerEtiquetaAdd(action, cli);
    case "removeLabelToCard":   return handlerEtiquetaRemove(action, cli);
    case "updateCard":          return handlerCardAtualizado(action, cli);
    case "addAttachmentToCard": return handlerAnexo(action, cli);
    default:
      return _respJson({ ok: true, ignored: tipo });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 DANI v1.0 — INTELIGÊNCIA (Onda 1.A — 24/04/2026)
// ────────────────────────────────────────────────────────────────────────────
// Implementa G2: funcionário interno comenta no card pedindo doc/info ou
// atualizando status. Dani classifica via Claude e age:
//   • SOLICITA_DOC      → aplica DOCUMENTO PENDENTE + email cliente
//   • SOLICITA_RESPOSTA → aplica RESPOSTA DE COMENTÁRIO PENDENTE + email
//   • ATUALIZA_STATUS   → email cliente com a atualização (sem etiqueta)
//   • OUTRO             → não age (ex: fofoca interna, anotação)
//
// 🔒 Trava de segurança:
//   Property DANI_ATIVA. Se "false" (default), Dani só LOGA o que faria,
//   sem chamar Claude API e sem aplicar etiquetas/email/comentários.
//   Use ativarDani() / desativarDani() pra ligar/desligar.
//
// Idempotência:
//   Cada action.id do Trello é cacheado por 24h. Webhook duplicado é skip.
// ════════════════════════════════════════════════════════════════════════════

const DANI_NIVELS = ["SOLICITA_DOC", "SOLICITA_RESPOSTA", "ATUALIZA_STATUS", "OUTRO"];
const DANI_ETIQUETA_DOC = "DOCUMENTO PENDENTE";
const DANI_ETIQUETA_RESP = "RESPOSTA DE COMENTÁRIO PENDENTE";
const DANI_ETIQUETA_PRONTO = "PRONTO PARA SER FEITO";

/**
 * Liga a Dani: passa a chamar Claude e a aplicar ações reais.
 * Sem isso, ela só loga.
 */
function ativarDani() {
  getProps().setProperty("DANI_ATIVA", "true");
  Logger.log("✅ Dani ATIVA — vai chamar Claude e aplicar etiquetas/emails/comentários.");
}

function desativarDani() {
  getProps().setProperty("DANI_ATIVA", "false");
  Logger.log("⏸️ Dani DESATIVADA — só loga o que faria (modo dry-run).");
}

/**
 * Prepara ambiente de teste: roda MapearClientes + garantirWebhooks +
 * pede usuário Trello que vai simular cliente.
 *
 * Tolerante a UI ausente: se rodar direto do editor (sem planilha aberta),
 * faz as 2 primeiras etapas e instrui Thales a setar manualmente.
 */
function setupTesteDani() {
  // 1) Mapeia boards (pega novos)
  Logger.log("🔄 [1/3] Mapeando clientes...");
  try { MapearClientes(); } catch (e) { Logger.log("⚠️ MapearClientes: " + e.message); }

  // 2) Cria webhooks pros novos
  Logger.log("🔗 [2/3] Garantindo webhooks...");
  try { garantirWebhooksTodosBoards(); } catch (e) { Logger.log("⚠️ garantirWebhooks: " + e.message); }

  // 3) Tenta UI; se falhar, instrui setup manual
  Logger.log("🧪 [3/3] Configurando DANI_FORCAR_CLIENTE...");
  let ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    const atual = getProps().getProperty("DANI_FORCAR_CLIENTE") || "(vazio)";
    Logger.log("⚠️ UI não disponível (rode da planilha pra ter prompt).");
    Logger.log("ℹ️ DANI_FORCAR_CLIENTE atual: " + atual);
    Logger.log("ℹ️ Pra setar manualmente, rode: setForcarCliente('carolinaguirado7')");
    Logger.log("ℹ️ Pra limpar, rode: setForcarCliente('')");
    return;
  }

  const atualForcar = getProps().getProperty("DANI_FORCAR_CLIENTE") || "";
  const resp = ui.prompt(
    "🧪 Setup teste Dani",
    "Username Trello (sem @) que vai simular CLIENTE no board de teste.\n" +
    "Mesmo se estiver na aba EQUIPE, será tratado como cliente.\n\n" +
    "Múltiplos? Separe com vírgula.\n\n" +
    "Atual: " + (atualForcar || "(vazio)") + "\n\n" +
    "Deixe em branco pra limpar.",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    const valor = resp.getResponseText().trim();
    setForcarCliente(valor);
    if (valor) {
      ui.alert("✅ Setup teste concluído.\n\nForçando como cliente: " + valor + "\n\nProx passos:\n1) Ativa Dani: ativarDani()\n2) Cria card no board com desc contendo:\n📧 E-MAIL: seu-email@aqui.com\n3) Comente no card como funcionário interno (ex: Letícia)");
    } else {
      ui.alert("✅ DANI_FORCAR_CLIENTE limpo. Comportamento padrão.");
    }
  }
}

/**
 * Atalho não-UI: seta DANI_FORCAR_CLIENTE direto. Rodar do editor.
 * Use string vazia pra limpar.
 */
function setForcarCliente(usernames) {
  if (usernames && String(usernames).trim()) {
    getProps().setProperty("DANI_FORCAR_CLIENTE", String(usernames).trim());
    Logger.log("✅ DANI_FORCAR_CLIENTE = " + usernames);
  } else {
    getProps().deleteProperty("DANI_FORCAR_CLIENTE");
    Logger.log("✅ DANI_FORCAR_CLIENTE limpo.");
  }
  __equipeInternaCache = null;
}

/**
 * Shortcut hardcoded pro teste atual: força Carolina como cliente fake.
 * Rode UMA VEZ no editor depois de colar a v7.2.1.
 */
function setupTesteDani_Carolina() {
  Logger.log("🧪 Configurando teste Dani com Carolina como cliente fake...");
  try { MapearClientes(); Logger.log("✅ MapearClientes OK"); }
  catch (e) { Logger.log("⚠️ MapearClientes: " + e.message); }
  try { garantirWebhooksTodosBoards(); Logger.log("✅ garantirWebhooks OK"); }
  catch (e) { Logger.log("⚠️ garantirWebhooks: " + e.message); }
  setForcarCliente("carolinaguirado7");
  Logger.log("");
  Logger.log("═══════════════════════════════════════");
  Logger.log("✅ Setup teste pronto. Próximos passos:");
  Logger.log("  1. Roda ativarDani() no editor");
  Logger.log("  2. Cria card no board TESTE DANI com 📧 E-MAIL: na desc");
  Logger.log("  3. Letícia comenta @card pedindo doc");
  Logger.log("  4. Verifica etiqueta + email + comentário Dani");
  Logger.log("═══════════════════════════════════════");
}

function daniAtiva() {
  return getProps().getProperty("DANI_ATIVA") === "true";
}

/**
 * Log persistente em aba DANI_LOG da planilha. Usar em fluxo de webhook
 * onde Logger.log às vezes não aparece no painel Execuções (deploys).
 * Mantém últimos 500 registros (rotaciona).
 */
function _daniLog(nivel, mensagem, dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName("DANI_LOG");
    if (!aba) {
      aba = ss.insertSheet("DANI_LOG");
      aba.getRange(1, 1, 1, 4).setValues([["TIMESTAMP", "NÍVEL", "MENSAGEM", "DADOS"]]);
      aba.getRange(1, 1, 1, 4).setFontWeight("bold");
      aba.setFrozenRows(1);
      aba.setColumnWidth(1, 180);
      aba.setColumnWidth(3, 500);
      aba.setColumnWidth(4, 600);
    }
    const dadosStr = dados ? (typeof dados === "string" ? dados : JSON.stringify(dados).substring(0, 1000)) : "";
    aba.insertRowAfter(1);
    aba.getRange(2, 1, 1, 4).setValues([[new Date(), nivel, mensagem, dadosStr]]);
    // Rotação: mantém últimos 500
    if (aba.getLastRow() > 502) {
      aba.deleteRows(502, aba.getLastRow() - 501);
    }
  } catch (e) {
    Logger.log("⚠️ _daniLog falhou: " + e.message);
  }
  // Também loga em Logger pra ter nos 2 lugares
  Logger.log("[" + nivel + "] " + mensagem + (dados ? " | " + JSON.stringify(dados).substring(0, 200) : ""));
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 ÍNDICE DA DANI — função de orientação (rode no editor)
// ────────────────────────────────────────────────────────────────────────────
// Roda dani_indice() pra ver lista organizada das funções disponíveis.
// ════════════════════════════════════════════════════════════════════════════

function dani_indice() {
  Logger.log("══════════ 🤖 ÍNDICE DANI v7.8 ══════════");
  Logger.log("");
  Logger.log("📍 USO FREQUENTE (operação do dia-a-dia):");
  Logger.log("  statusDani()                   — diagnóstico geral");
  Logger.log("  ativarDani() / desativarDani() — liga/desliga IA");
  Logger.log("  gerarDashboardDani()           — atualiza aba DANI_DASHBOARD");
  Logger.log("  mostrarPrazosCard('<id>')      — matriz lista×bucket de um card");
  Logger.log("  setForcarCliente('user')       — força usuário Trello como cliente (testes)");
  Logger.log("  setForcarCliente('')           — limpa override de teste");
  Logger.log("");
  Logger.log("⚙️ SETUP (executar 1x ou eventualmente):");
  Logger.log("  setupDaniProperties()          — wizard config (URL, token, emails)");
  Logger.log("  setupTriggersDani()            — cria/atualiza 3 triggers (8h/9h30/1h)");
  Logger.log("  setupTesteDani_Carolina()      — atalho pro setup de teste com Carolina");
  Logger.log("  garantirWebhooksTodosBoards()  — cria webhook em cada board CLIENTES");
  Logger.log("");
  Logger.log("🔧 MANUTENÇÃO (eventual / debug):");
  Logger.log("  MapearClientes()               — atualiza aba CLIENTES (cron 8h faz auto)");
  Logger.log("  MapearEquipeInterna()          — cria aba EQUIPE inicial");
  Logger.log("  reconstruirBucketsCard('<id>') — popula buckets via histórico Trello");
  Logger.log("  limparPropertiesOrfas()        — limpa props de cards arquivados");
  Logger.log("  listarWebhooks()               — debug, lista webhooks ativos");
  Logger.log("  removerTodosWebhooks()         — ⚠️ ROLLBACK total (cuidado!)");
  Logger.log("  heartbeatDani()                — testa Claude API (cron 1h faz auto)");
  Logger.log("");
  Logger.log("🧪 TESTE MANUAL (rodar pendência específica):");
  Logger.log("  TestedoCartao()                — simula form na linha 2 da planilha");
  Logger.log("  TestarVarredura()              — força VarrerEmails");
  Logger.log("  rotinasDiariasDani()           — força G11/G13/G14/G15/G9");
  Logger.log("  rotinaG2FollowUp4h()           — força follow-up 4h");
  Logger.log("");
  Logger.log("══ ABAS DA PLANILHA (onde olhar) ══");
  Logger.log("  CLIENTES        — boards mapeados (auto-update 8h)");
  Logger.log("  EQUIPE          — funcionários internos (você edita)");
  Logger.log("  DANI_LOG        — log persistente (último 500)");
  Logger.log("  DANI_DASHBOARD  — visão geral (gerar manual)");
  Logger.log("  MÉTRICAS        — contadores diários");
  Logger.log("  LEMBRETES       — histórico de cada lembrete");
  Logger.log("  PENDÊNCIAS      — comentários classificados pela Dani");
}

/**
 * Diagnóstico completo da Dani. Roda no editor pra ver estado atual.
 */
function statusDani() {
  const props = getProps();
  const dani = props.getProperty("DANI_ATIVA");
  const webappUrl = props.getProperty("WEBAPP_URL") || "(não configurado)";
  const tokenSet = !!props.getProperty("WEBHOOK_TOKEN");
  const forcarCliente = props.getProperty("DANI_FORCAR_CLIENTE") || "(vazio)";
  const claudeKeySet = !!props.getProperty("CLAUDE_API_KEY");
  const trelloKeySet = !!props.getProperty("TRELLO_KEY");

  // Conta webhooks ativos
  let totalWebhooks = "?";
  try {
    const r = trelloGet("/1/tokens/" + prop("TRELLO_TOKEN") + "/webhooks", {});
    if (r.getResponseCode() === 200) {
      const lista = JSON.parse(r.getContentText());
      totalWebhooks = lista.filter(w => w.active).length + " ativos / " + lista.length + " total";
    }
  } catch (e) { totalWebhooks = "erro: " + e.message; }

  // Conta linhas de aba EQUIPE
  let totalEquipe = "?";
  try {
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("EQUIPE");
    totalEquipe = aba ? (aba.getLastRow() - 1) + " funcionários" : "aba não existe";
  } catch (e) { totalEquipe = "erro: " + e.message; }

  Logger.log("══════ STATUS DANI ══════");
  Logger.log("DANI_ATIVA: " + (dani || "(não setado, default false)"));
  Logger.log("  → " + (daniAtiva() ? "🟢 LIGADA — vai chamar Claude e agir" : "🔴 DESLIGADA (dry-run) — só loga, não age"));
  Logger.log("");
  Logger.log("WEBAPP_URL: " + webappUrl);
  Logger.log("WEBHOOK_TOKEN configurado: " + tokenSet);
  Logger.log("CLAUDE_API_KEY configurado: " + claudeKeySet);
  Logger.log("TRELLO_KEY configurado: " + trelloKeySet);
  Logger.log("");
  Logger.log("DANI_FORCAR_CLIENTE: " + forcarCliente);
  if (forcarCliente !== "(vazio)") {
    Logger.log("  ⚠️  ATENÇÃO: usuário " + forcarCliente + " está sendo tratado");
    Logger.log("  como cliente em TODOS os boards. Isso é seguro só pra teste.");
    Logger.log("  Em produção, rode: setForcarCliente('')");
  }
  Logger.log("");
  Logger.log("Webhooks Trello: " + totalWebhooks);
  Logger.log("Equipe interna: " + totalEquipe);
  Logger.log("");
  if (!daniAtiva()) {
    Logger.log("⚠️ Pra Dani agir, rode: ativarDani()");
  }
  Logger.log("");
  Logger.log("ℹ️ Pra ver lista de funções disponíveis: dani_indice()");
  Logger.log("═══════════════════════════");
}

/**
 * Idempotência: ignora action.id já processada (Trello pode reentregar).
 * Cache 24h.
 */
function _jaProcessadoAcao(actionId) {
  if (!actionId) return false;
  const cache = CacheService.getScriptCache();
  const k = "dani_action_" + actionId;
  if (cache.get(k)) return true;
  cache.put(k, "1", 86400);
  return false;
}

/**
 * Wrapper sobre chamarClaude que retorna JSON parseado ou null.
 * Tolerante a respostas com markdown wrap, prefixo/sufixo em prosa, etc.
 */
function chamarClaudeJson(prompt, maxTokens, modelo) {
  let txt = "";
  try {
    txt = chamarClaude(prompt, maxTokens || 600, modelo);
    // Tenta parsear direto
    return JSON.parse(txt);
  } catch (e1) {
    // Fallback: extrai PRIMEIRO objeto JSON ({...}) na resposta
    try {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e2) {}
    _daniLog("CLAUDE_PARSE_FAIL", "Claude não retornou JSON válido", {
      erro: String(e1),
      resposta_bruta: txt.substring(0, 800),
    });
    return null;
  }
}

// ─── Trello helpers da Dani ────────────────────────────────────────────────

function _danigetCardCompleto(cardId) {
  const r = trelloGet("/1/cards/" + cardId, {
    fields: "name,idBoard,idList,shortUrl,desc,labels,closed",
    labels: "true",
  });
  if (r.getResponseCode() !== 200) return null;
  return JSON.parse(r.getContentText());
}

function _danigetNomeLista(idList) {
  const r = trelloGet("/1/lists/" + idList, { fields: "name" });
  if (r.getResponseCode() !== 200) return "?";
  return JSON.parse(r.getContentText()).name || "?";
}

function _danigetUltimosComentarios(cardId, limite) {
  const r = trelloGet("/1/cards/" + cardId + "/actions", {
    filter: "commentCard",
    limit: String(limite || 5),
  });
  if (r.getResponseCode() !== 200) return [];
  const acoes = JSON.parse(r.getContentText());
  return acoes.map(a => ({
    autor: (a.memberCreator && a.memberCreator.fullName) || "?",
    texto: (a.data && a.data.text) || "",
    data: a.date || "",
  }));
}

/**
 * Aplica etiqueta no card POR NOME. Auto-cria se não existir no board.
 * Reusa aplicarEtiquetasNoCartao() existente.
 */
function _daniAplicarEtiqueta(cardId, boardId, nomeEtiqueta) {
  if (!nomeEtiqueta) return;
  // Verifica se já tem (evita request desnecessário)
  const card = _danigetCardCompleto(cardId);
  if (card && (card.labels || []).some(l => (l.name || "").trim() === nomeEtiqueta)) {
    Logger.log("    ✓ etiqueta '" + nomeEtiqueta + "' já existe no card");
    return;
  }
  aplicarEtiquetasNoCartao(cardId, boardId, [nomeEtiqueta]);
  Logger.log("    ✅ etiqueta '" + nomeEtiqueta + "' aplicada");
}

/**
 * Remove etiqueta do card POR NOME.
 */
function _daniRemoverEtiqueta(cardId, boardId, nomeEtiqueta) {
  if (!nomeEtiqueta) return;
  const card = _danigetCardCompleto(cardId);
  if (!card) return;
  const label = (card.labels || []).find(l => (l.name || "").trim() === nomeEtiqueta);
  if (!label) {
    Logger.log("    ✓ etiqueta '" + nomeEtiqueta + "' não estava no card");
    return;
  }
  const u = "https://api.trello.com/1/cards/" + cardId + "/idLabels/" + label.id +
    "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
  const r = fetchRetry(u, { method: "delete" });
  if (r.getResponseCode() === 200) Logger.log("    ✅ etiqueta '" + nomeEtiqueta + "' removida");
  else Logger.log("    ⚠️ falha ao remover etiqueta: " + r.getContentText());
}

/**
 * Posta comentário no card identificado como Dani (com assinatura).
 * Marca @board pra notificar todo mundo (cliente + equipe estão no board).
 */
function _daniComentar(cardId, texto, marcarBoard) {
  const sufixo = marcarBoard ? "\n\n@board" : "";
  const textoFinal = texto + sufixo + ASSINATURA_DANI;
  return postarComentarioNoCard(cardId, textoFinal);
}

/**
 * Envia email pro cliente do card. Email vem da descrição (campo 📧 E-MAIL).
 * Retorna true/false.
 */
function _daniEnviarEmailCliente(card, assunto, html, textoPlano) {
  const email = extrairEmailDoCardDesc(card.desc || "");
  if (!email) {
    Logger.log("    ⚠️ sem email do cliente no card — não envio");
    return false;
  }
  try {
    MailApp.sendEmail({
      to: email,
      subject: assunto,
      htmlBody: html,
      body: textoPlano,
      name: "Dani 🍀 Trevo Legaliza",
    });
    Logger.log("    📧 email enviado pra " + email);
    return true;
  } catch (e) {
    Logger.log("    ⚠️ falha email: " + e.message);
    return false;
  }
}

/**
 * Template de email da Dani (HTML bonito reaproveitando o estilo dos lembretes).
 */
function _daniMontarEmailHTML(opts) {
  // opts: { titulo, mensagem, cardNome, cardUrl, etiquetaPendencia (opcional) }
  const blocoEtiqueta = opts.etiquetaPendencia
    ? '<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:4px;">' +
        '<p style="margin:0 0 6px;color:#92400e;font-size:12px;text-transform:uppercase;font-weight:700;">Pendência registrada</p>' +
        '<p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600;">' + opts.etiquetaPendencia + '</p>' +
      '</div>'
    : '';
  return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0d1310;color:#f2f2f2;">' +
      '<div style="background:linear-gradient(135deg,#0d1310 0%,#1a3d26 100%);padding:32px 28px;text-align:center;">' +
        '<img src="' + LOGO_TREVO_URL + '" alt="Trevo Legaliza" style="height:56px;margin-bottom:12px;" />' +
        '<h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:0.3px;">' + opts.titulo + '</h1>' +
      '</div>' +
      '<div style="background:#fff;color:#2d2d2d;padding:32px 28px;">' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 18px;">' + opts.mensagem + '</p>' +
        blocoEtiqueta +
        '<div style="background:#f0f7f2;border-left:4px solid #2d5a3d;padding:16px 20px;margin:20px 0;border-radius:4px;">' +
          '<p style="margin:0 0 6px;color:#1a1a1a;font-size:12px;text-transform:uppercase;font-weight:700;">Processo</p>' +
          '<p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600;">' + opts.cardNome + '</p>' +
        '</div>' +
        '<div style="text-align:center;margin:28px 0;">' +
          '<a href="' + opts.cardUrl + '" style="display:inline-block;background:#2d5a3d;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">🔗 Acessar o processo</a>' +
        '</div>' +
        '<p style="font-size:13px;color:#4a4a4a;line-height:1.6;margin:20px 0 0;">' +
          'Você pode <strong>responder este email direto</strong> — sua resposta entra no processo automaticamente.' +
        '</p>' +
      '</div>' +
      '<div style="background:#0d1310;padding:20px 28px;text-align:center;">' +
        '<img src="' + LOGO_DANI_URL + '" alt="Dani by Trevo" style="height:40px;margin-bottom:8px;" />' +
        '<p style="color:#a8d5b8;font-size:12px;margin:6px 0 0;font-weight:600;">Dani · IA da Trevo Legaliza</p>' +
      '</div>' +
    '</div>';
}

// ─── G2: funcionário interno comenta ───────────────────────────────────────

/**
 * Classifica comentário de funcionário via Claude.
 * Retorna { acao, resumo, mensagemCliente } ou null em erro.
 */
function _classificarComentarioFuncionario(textoComentario, contexto) {
  const prompt =
    'Você é a Dani, IA da Trevo Legaliza (assessoria societária B2B).\n' +
    'Funcionário interno comentou num card do Trello. Classifique a intenção.\n\n' +
    'CONTEXTO:\n' +
    '  Card: ' + (contexto.cardNome || "?") + '\n' +
    '  Lista: ' + (contexto.listaNome || "?") + '\n' +
    '  Etiquetas: ' + (contexto.etiquetas.join(", ") || "(nenhuma)") + '\n\n' +
    'COMENTÁRIO de ' + (contexto.autor || "?") + ':\n' +
    '"' + (textoComentario || "").substring(0, 1500) + '"\n\n' +
    'AÇÕES POSSÍVEIS (escolha exatamente uma):\n' +
    '  SOLICITA_DOC      = funcionário pediu documento/arquivo ao cliente\n' +
    '  SOLICITA_RESPOSTA = funcionário pediu confirmação/info ao cliente (sem doc)\n' +
    '  ATUALIZA_STATUS   = funcionário só atualizou andamento (ex: viabilidade transmitida)\n' +
    '  OUTRO             = anotação interna sem ação pro cliente\n\n' +
    'COMPONHA mensagemCliente (gentil, profissional, breve, sempre se identifique como "dani.ai"):\n' +
    '  - Se SOLICITA_*: peça com clareza\n' +
    '  - Se ATUALIZA_STATUS: traduza a atualização pra cliente\n' +
    '  - Se OUTRO: deixe vazio\n\n' +
    'INSTRUÇÃO CRÍTICA DE FORMATO:\n' +
    'Sua resposta DEVE ser exclusivamente um objeto JSON válido, começando com { e terminando com }.\n' +
    'NÃO escreva nada antes ou depois. NÃO use blocos de código (```). NÃO comente.\n\n' +
    'Schema exato:\n' +
    '{"acao":"<uma das 4 acoes>","resumo":"<frase curta>","mensagemCliente":"<texto ou vazio>"}';

  // G2 = classificação simples + composição de mensagem → Haiku (4x mais barato)
  const j = chamarClaudeJson(prompt, 800, CLAUDE_MODEL_HAIKU);
  if (!j) {
    _daniLog("CLAUDE_FAIL", "_classificarComentarioFuncionario: chamarClaudeJson retornou null");
    return null;
  }
  if (DANI_NIVELS.indexOf(j.acao) === -1) {
    _daniLog("CLAUDE_FAIL", "_classificarComentarioFuncionario: acao inválida", { acao_recebida: j.acao, json: j });
    return null;
  }
  return j;
}

/**
 * Handler do webhook commentCard. G2 (funcionário) implementado.
 * Cliente (G4) fica como stub — Onda 1.B implementa.
 */
function handlerComentario(action, cli) {
  const texto = (action.data && action.data.text) || "";
  const autor = (action.memberCreator && action.memberCreator.fullName) || "?";
  const username = (action.memberCreator && action.memberCreator.username) || "";
  const cardId = (action.data && action.data.card && action.data.card.id) || "";
  const tipoAutor = _classificarAutorTrello(action);

  _daniLog("WEBHOOK", "comentário recebido", {
    autor: autor, username: username, tipoAutor: tipoAutor, cardId: cardId,
    texto: texto.substring(0, 150), actionId: action.id,
  });

  // Skip: comentário da própria Dani (loop guard)
  // Match pela hashtag explícita pra evitar problema de surrogate pair em emoji
  if (texto.indexOf("Dani — Secretária Virtual") !== -1) {
    _daniLog("SKIP", "self_comment (loop guard)");
    return _respJson({ ok: true, ignored: "self_comment" });
  }

  // Idempotência
  if (_jaProcessadoAcao(action.id)) {
    _daniLog("SKIP", "ja_processado (cache 24h)", { actionId: action.id });
    return _respJson({ ok: true, ignored: "ja_processado" });
  }

  if (!cardId) {
    _daniLog("ERRO", "card_id ausente");
    return _respJson({ ok: false, error: "card_id ausente" });
  }

  // ── G2: funcionário comenta ──────────────────────────────────────────
  if (tipoAutor === "trevo") {
    return _danihandlerG2(action, cli, texto, autor, cardId);
  }

  // ── G4: cliente comenta ──────────────────────────────────────────────
  return _danihandlerG4(action, cli, texto, autor, cardId);
}

// G3 — EM ANDAMENTO automática (keyword detection)
// Detecta se funcionário sinalizou que começou a trabalhar.
// Roda ANTES da classificação Claude — barato, determinístico.
const DANI_KEYWORDS_INICIO = [
  /\biniciando\b/i, /\binicio\b/i, /\binício\b/i,
  /\bcome[çc]ando\b/i, /\bcome[çc]o\b/i, /\bvou come[çc]ar\b/i,
  /\bvou trabalhar\b/i, /\btrabalhando agora\b/i, /\bem andamento\b/i,
  /\bjá em an[áa]lise\b/i, /\bj[áa] estou\b.*\b(redigindo|preparando|montando|fazendo)\b/i,
  /\bvou redigir\b/i, /\bvou preparar\b/i, /\bvou montar\b/i,
  /\bredigindo\b/i, /\bpreparando\b/i, /\bmontando\b/i,
  /\btomei (esse|este) processo\b/i, /\bpegando esse processo\b/i,
];

function _detectarInicioTrabalho(texto) {
  const t = String(texto || "");
  return DANI_KEYWORDS_INICIO.some(rx => rx.test(t));
}

function _aplicarEmAndamento(cardId, boardId) {
  // Remove PRONTO PARA SER FEITO (se tiver) e aplica EM ANDAMENTO
  _daniRemoverEtiqueta(cardId, boardId, DANI_ETIQUETA_PRONTO);
  _daniAplicarEtiqueta(cardId, boardId, "EM ANDAMENTO");
  incMetrica("dani_g3_em_andamento_aplicada");
  _daniLog("G3", "EM ANDAMENTO aplicada (keyword detect)", { cardId: cardId });
}

function _danihandlerG2(action, cli, texto, autor, cardId) {
  _daniLog("G2", "iniciado", { cardId: cardId, autor: autor });

  // Busca contexto completo do card
  const card = _danigetCardCompleto(cardId);
  if (!card) {
    _daniLog("ERRO", "G2: card não encontrado via API Trello", { cardId: cardId });
    return _respJson({ ok: false, error: "card não encontrado" });
  }
  const listaNome = _danigetNomeLista(card.idList);
  const etiquetas = (card.labels || []).map(l => (l.name || "").trim()).filter(Boolean);

  const contexto = {
    cardNome: card.name,
    listaNome: listaNome,
    etiquetas: etiquetas,
    autor: autor,
  };

  _daniLog("G2", "contexto montado", contexto);

  // G3 — Detecção de início de trabalho (keyword, sem IA)
  if (_detectarInicioTrabalho(texto) && daniAtiva()) {
    _aplicarEmAndamento(cardId, card.idBoard);
  }

  // Modo dry-run: só loga o que faria
  if (!daniAtiva()) {
    _daniLog("DRY-RUN", "DANI_ATIVA=false. Não chamo Claude nem ajo.", contexto);
    return _respJson({ ok: true, dry_run: true, contexto: contexto });
  }

  // Classifica via Claude
  _daniLog("G2", "chamando Claude pra classificar...");
  let cls;
  try {
    cls = _classificarComentarioFuncionario(texto, contexto);
  } catch (e) {
    _daniLog("ERRO", "G2: exceção em Claude", { erro: String(e), stack: (e.stack || "").substring(0, 500) });
    return _respJson({ ok: false, error: "classificacao_excecao" });
  }
  if (!cls) {
    _daniLog("ERRO", "G2: Claude retornou null (JSON inválido ou modelo recusou)");
    incMetrica("dani_classificacao_falha");
    return _respJson({ ok: false, error: "classificacao_falha" });
  }

  _daniLog("G2", "Claude classificou", {
    acao: cls.acao, resumo: cls.resumo, msg_len: (cls.mensagemCliente || "").length,
  });
  incMetrica("dani_classificou_" + cls.acao);

  const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);

  // ── Aplica ação conforme classificação ────────────────────────────────
  try {
    if (cls.acao === "SOLICITA_DOC" || cls.acao === "SOLICITA_RESPOSTA") {
      const isDoc = cls.acao === "SOLICITA_DOC";
      const etiqueta = isDoc ? DANI_ETIQUETA_DOC : DANI_ETIQUETA_RESP;
      const titulo = isDoc ? "Pendência no seu processo 🍀" : "Precisamos de uma resposta sua 🍀";
      const assuntoBase = cls.resumo || (isDoc ? "Documento pendente" : "Resposta pendente");

      _daniLog("G2", "aplicando " + cls.acao + " (sem comentário no card — segue regra 4h)");
      // Bola tá com cliente — remove etiquetas Trevo
      _daniRemoverEtiqueta(cardId, card.idBoard, "EM ANDAMENTO");
      _daniRemoverEtiqueta(cardId, card.idBoard, DANI_ETIQUETA_PRONTO);
      _daniAplicarEtiqueta(cardId, card.idBoard, etiqueta);

      let emailOk = false;
      if (cls.mensagemCliente) {
        const html = _daniMontarEmailHTML({
          titulo: titulo, mensagem: cls.mensagemCliente,
          cardNome: card.name, cardUrl: cardUrl, etiquetaPendencia: etiqueta,
        });
        emailOk = _daniEnviarEmailCliente(card, "🍀 " + assuntoBase + " — " + card.name, html, cls.mensagemCliente);
      }

      // Salva pendência pra _rotinaG2FollowUp4h verificar daqui 4h
      const propsR = getProps();
      const chavePend = "g2_pendencia_" + cardId + "_" + etiqueta;
      propsR.setProperty(chavePend, JSON.stringify({
        timestamp_inicio: new Date().toISOString(),
        mensagem_cliente: cls.mensagemCliente || "",
        resumo: cls.resumo || "",
        etiqueta: etiqueta,
        follow_up_enviado: false,
      }));

      _daniLog("G2", cls.acao + " concluída — aguardando 4h pra follow-up", { emailEnviado: emailOk });
      return _respJson({ ok: true, acao: cls.acao, etiqueta: etiqueta, email: emailOk, comentario: false, aguardando_4h: true });
    }

    if (cls.acao === "ATUALIZA_STATUS") {
      _daniLog("G2", "aplicando ATUALIZA_STATUS...");
      let emailOk = false;
      if (cls.mensagemCliente) {
        const html = _daniMontarEmailHTML({
          titulo: "Atualização do seu processo 🍀",
          mensagem: cls.mensagemCliente,
          cardNome: card.name,
          cardUrl: cardUrl,
        });
        emailOk = _daniEnviarEmailCliente(card, "🍀 Atualização — " + card.name, html, cls.mensagemCliente);
      }
      _daniLog("G2", "ATUALIZA_STATUS concluída", { emailEnviado: emailOk });
      return _respJson({ ok: true, acao: cls.acao, email: emailOk });
    }

    _daniLog("G2", "OUTRO — Dani fica em silêncio");
    return _respJson({ ok: true, acao: "OUTRO", silencio: true });
  } catch (e) {
    _daniLog("ERRO", "G2: exceção ao aplicar ação", { acao: cls.acao, erro: String(e), stack: (e.stack || "").substring(0, 500) });
    return _respJson({ ok: false, error: "execucao_acao_excecao", acao: cls.acao });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 G4 — Cliente responde no card
// ────────────────────────────────────────────────────────────────────────────
// Quando o cliente comenta num card que está com etiqueta de pendência
// (DOCUMENTO PENDENTE ou RESPOSTA DE COMENTÁRIO PENDENTE), Dani avalia
// via Claude se o cliente CUMPRIU a pendência:
//   • CUMPRIU       → remove etiqueta + aplica PRONTO PARA SER FEITO
//                     + comentário Dani agradecendo
//   • NAO_CUMPRIU   → mantém etiqueta + comentário Dani pedindo o que falta
//                     (cliente "respondeu" mas com info irrelevante/recusa)
//   • PARCIAL       → trata como CUMPRIU mas registra pra equipe revisar
//
// Se o card NÃO tem etiqueta de pendência ativa, Dani não age (cliente
// só comentou algo solto, sem responder a um pedido específico).
// ════════════════════════════════════════════════════════════════════════════

const DANI_ETIQUETAS_PENDENCIA = [
  "DOCUMENTO PENDENTE",
  "RESPOSTA DE COMENTÁRIO PENDENTE",
];

function _danihandlerG4(action, cli, texto, autor, cardId) {
  _daniLog("G4", "iniciado", { cardId: cardId, autor: autor });

  const card = _danigetCardCompleto(cardId);
  if (!card) {
    _daniLog("ERRO", "G4: card não encontrado", { cardId: cardId });
    return _respJson({ ok: false, error: "card_nao_encontrado" });
  }

  // 1. Verifica se há etiqueta de pendência ativa
  const etiquetasAtuais = (card.labels || []).map(l => (l.name || "").trim()).filter(Boolean);
  const pendenciasAtivas = etiquetasAtuais.filter(e => DANI_ETIQUETAS_PENDENCIA.indexOf(e) !== -1);

  if (pendenciasAtivas.length === 0) {
    _daniLog("G4", "sem pendência ativa — Dani fica em silêncio", { etiquetas: etiquetasAtuais });
    return _respJson({ ok: true, acao: "SEM_PENDENCIA", silencio: true });
  }

  _daniLog("G4", "pendência ativa detectada", { pendencias: pendenciasAtivas });

  // 2. Busca último pedido feito pela equipe Trevo (pra dar contexto à IA)
  let ultimoPedidoTrevo = "";
  try {
    const comentarios = _danigetUltimosComentarios(cardId, 10);
    // Última mensagem com texto não-vazio ANTES da resposta atual,
    // de autor = equipe interna (Dani ou funcionário)
    for (const c of comentarios) {
      if (c.texto && c.texto !== texto && ehEquipeInterna(c.autor)) {
        ultimoPedidoTrevo = c.texto;
        break;
      }
    }
  } catch (e) {
    _daniLog("AVISO", "G4: falha ao buscar último pedido", { erro: String(e) });
  }

  // 3. Modo dry-run
  if (!daniAtiva()) {
    _daniLog("DRY-RUN", "DANI_ATIVA=false. Não chamo Claude nem ajo.");
    return _respJson({ ok: true, dry_run: true });
  }

  // 4. Avalia via Claude se cumpriu
  _daniLog("G4", "chamando Claude pra avaliar cumprimento...");
  let aval;
  try {
    aval = _avaliarRespostaCliente(texto, ultimoPedidoTrevo, pendenciasAtivas, card);
  } catch (e) {
    _daniLog("ERRO", "G4: exceção em Claude", { erro: String(e), stack: (e.stack || "").substring(0, 500) });
    return _respJson({ ok: false, error: "avaliacao_excecao" });
  }
  if (!aval) {
    _daniLog("ERRO", "G4: Claude retornou null");
    return _respJson({ ok: false, error: "avaliacao_falha" });
  }

  _daniLog("G4", "Claude avaliou", { veredito: aval.veredito, confianca: aval.confianca, msg_len: (aval.mensagemCliente || "").length });
  incMetrica("dani_g4_" + aval.veredito);

  // 5. Aplica decisão
  try {
    if (aval.veredito === "CUMPRIU" || aval.veredito === "PARCIAL") {
      // Remove TODAS as etiquetas de pendência ativas + aplica PRONTO PARA SER FEITO
      pendenciasAtivas.forEach(et => {
        _daniRemoverEtiqueta(cardId, card.idBoard, et);
        // Limpa pendência G2 pra _rotinaG2FollowUp4h não disparar
        getProps().deleteProperty("g2_pendencia_" + cardId + "_" + et);
      });
      _daniAplicarEtiqueta(cardId, card.idBoard, DANI_ETIQUETA_PRONTO);

      const comentTexto = (aval.veredito === "PARCIAL")
        ? "✅ " + (aval.mensagemCliente || "Recebido! Equipe vai revisar e pode pedir mais detalhes em breve.")
        : "✅ " + (aval.mensagemCliente || "Recebido, obrigada! Vamos seguir com a análise.");
      const comentOk = _daniComentar(cardId, comentTexto, /* marcarBoard */ false);

      _daniLog("G4", "veredito " + aval.veredito + " aplicado", {
        etiquetas_removidas: pendenciasAtivas, etiqueta_aplicada: DANI_ETIQUETA_PRONTO, comentarioPostado: comentOk,
      });
      return _respJson({ ok: true, veredito: aval.veredito, etiquetas_removidas: pendenciasAtivas });
    }

    if (aval.veredito === "NAO_CUMPRIU") {
      // Mantém etiquetas. Comenta pedindo o que falta.
      const texto = "ℹ️ " + (aval.mensagemCliente || "Obrigada pela mensagem, mas ainda preciso do que foi solicitado pra prosseguir. Pode revisar?");
      const comentOk = _daniComentar(cardId, texto, /* marcarBoard */ true);
      _daniLog("G4", "NAO_CUMPRIU — pendência mantida", { comentarioPostado: comentOk });
      return _respJson({ ok: true, veredito: "NAO_CUMPRIU" });
    }

    _daniLog("G4", "veredito desconhecido — silêncio", { veredito: aval.veredito });
    return _respJson({ ok: true, veredito: "DESCONHECIDO", silencio: true });
  } catch (e) {
    _daniLog("ERRO", "G4: exceção ao aplicar decisão", { erro: String(e), stack: (e.stack || "").substring(0, 500) });
    return _respJson({ ok: false, error: "aplicacao_excecao" });
  }
}

/**
 * Avalia via Claude se o cliente cumpriu a pendência.
 * Retorna { veredito: CUMPRIU|NAO_CUMPRIU|PARCIAL, confianca: 0-100, mensagemCliente: "..." }
 */
function _avaliarRespostaCliente(textoCliente, ultimoPedidoTrevo, pendenciasAtivas, card) {
  const houveAnexo = textoCliente.toLowerCase().indexOf("anex") !== -1 || textoCliente.toLowerCase().indexOf("segue") !== -1;
  const prompt =
    'Você é a Dani, IA da Trevo Legaliza. Cliente acabou de comentar num card\n' +
    'que está com etiqueta de pendência ativa. Avalie se a resposta dele\n' +
    'CUMPRIU o que foi pedido pela equipe.\n\n' +
    'CONTEXTO:\n' +
    '  Card: ' + card.name + '\n' +
    '  Pendências ativas: ' + pendenciasAtivas.join(", ") + '\n\n' +
    'ÚLTIMO PEDIDO DA EQUIPE TREVO (contexto pra avaliar):\n' +
    '"' + (ultimoPedidoTrevo || "(não encontrado — avalie pela pendência ativa)").substring(0, 1000) + '"\n\n' +
    'RESPOSTA DO CLIENTE:\n' +
    '"' + (textoCliente || "").substring(0, 1500) + '"\n\n' +
    'CRITÉRIOS:\n' +
    '  CUMPRIU      = cliente forneceu o que foi pedido (info clara, anexo coerente, confirmação direta).\n' +
    '                 Em caso de DOCUMENTO PENDENTE: cliente menciona ter enviado/anexado.\n' +
    '                 Em caso de RESPOSTA PENDENTE: cliente respondeu objetivamente o que foi perguntado.\n' +
    '  NAO_CUMPRIU  = cliente respondeu mas SEM atender (recusou, pediu esclarecimento, fugiu do tema,\n' +
    '                 disse que nunca precisou fornecer aquilo, deu resposta vaga sem conteúdo útil).\n' +
    '  PARCIAL      = cliente cumpriu em parte (ex: enviou só 1 de 2 documentos solicitados).\n\n' +
    'COMPONHA mensagemCliente (curta, gentil, identifique-se "dani.ai"):\n' +
    '  - CUMPRIU: agradeça brevemente.\n' +
    '  - NAO_CUMPRIU: peça novamente com clareza o que falta. Tom paciente.\n' +
    '  - PARCIAL: agradeça + sinalize que equipe vai revisar.\n\n' +
    'Considere também: cliente teve anexo no comentário? ' + (houveAnexo ? "TALVEZ (texto sugere)" : "DESCONHECIDO") + '\n\n' +
    'INSTRUÇÃO CRÍTICA DE FORMATO:\n' +
    'Sua resposta DEVE ser exclusivamente JSON válido, começando com { e terminando com }.\n' +
    'NÃO escreva nada antes ou depois. NÃO use blocos de código (```). NÃO comente.\n\n' +
    'Schema:\n' +
    '{"veredito":"CUMPRIU|NAO_CUMPRIU|PARCIAL","confianca":<0-100>,"mensagemCliente":"<texto curto>"}';

  // G4 = decisão crítica (cumpriu vs não cumpriu) → Sonnet
  const j = chamarClaudeJson(prompt, 600, CLAUDE_MODEL_SONNET);
  if (!j) return null;
  if (["CUMPRIU", "NAO_CUMPRIU", "PARCIAL"].indexOf(j.veredito) === -1) {
    _daniLog("CLAUDE_FAIL", "_avaliarRespostaCliente: veredito inválido", j);
    return null;
  }
  return j;
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 G5 — Cliente anexa documento (sem comentar OU com comentário curto)
// ────────────────────────────────────────────────────────────────────────────
// Quando cliente adiciona anexo num card com etiqueta DOCUMENTO PENDENTE,
// Dani assume que provavelmente é o documento esperado e dispara G4 com
// texto sintético "[anexou: NOME_DO_ARQUIVO]" — IA avalia se faz sentido.
//
// Se o autor é equipe interna anexando, ignora (Dani não age em anexos
// internos).
// ════════════════════════════════════════════════════════════════════════════

function _danihandlerG5(action, cli) {
  const cardId = (action.data && action.data.card && action.data.card.id) || "";
  const autor = (action.memberCreator && action.memberCreator.fullName) || "?";
  const username = (action.memberCreator && action.memberCreator.username) || "";
  const tipoAutor = _classificarAutorTrello(action);
  const att = action.data && action.data.attachment;
  const nomeArquivo = (att && att.name) || "";

  _daniLog("WEBHOOK", "anexo adicionado", {
    autor: autor, username: username, tipoAutor: tipoAutor,
    cardId: cardId, arquivo: nomeArquivo, actionId: action.id,
  });

  if (_jaProcessadoAcao(action.id)) {
    _daniLog("SKIP", "anexo: ja_processado");
    return _respJson({ ok: true, ignored: "ja_processado" });
  }

  // Equipe interna anexando: Dani não age
  if (tipoAutor === "trevo") {
    _daniLog("G5", "anexo da equipe interna — Dani não age");
    return _respJson({ ok: true, handler: "anexo_interno", silencio: true });
  }

  if (!cardId) return _respJson({ ok: false, error: "card_id ausente" });

  // Cliente anexando: roda G4 com texto sintético
  const textoSintetico = "[Cliente anexou arquivo: " + nomeArquivo + "]";
  return _danihandlerG4(action, cli, textoSintetico, autor, cardId);
}

// ─── Outros handlers (stubs) — implementação em ondas seguintes ────────────

// ════════════════════════════════════════════════════════════════════════════
// 🤖 Onda 4 — CÁLCULO DOS 3 BUCKETS DE PRAZO
// ────────────────────────────────────────────────────────────────────────────
// Cada etiqueta de status do Trello mapeia pra um bucket de prazo:
//   • TREVO     — trabalho conosco (PRONTO PARA SER FEITO, EM ANDAMENTO,
//                 EXIGÊNCIA)
//   • CLIENTE   — espera pelo cliente (DOCUMENTO PENDENTE, RESPOSTA DE
//                 COMENTÁRIO PENDENTE, AGUARDANDO ASSINATURAS)
//   • ORGAO     — espera pelo órgão (EM ANÁLISE NO ÓRGÃO, CHAMADO ABERTO)
//
// Quando etiqueta é APLICADA: salvamos timestamp_inicio em property.
// Quando etiqueta é REMOVIDA: calculamos tempo decorrido e somamos no total
// daquele bucket pro card.
//
// Properties:
//   "bucket_inicio_<cardId>_<etiqueta>" — timestamp ISO do início (limpa ao remover)
//   "bucket_total_<cardId>_<TREVO|CLIENTE|ORGAO>" — segundos acumulados
//
// Pra acessar relatório: getPrazosDani(cardId) retorna {trevo, cliente, orgao}
// em segundos. Conversão pra dias/horas é responsabilidade do consumidor.
// ════════════════════════════════════════════════════════════════════════════

const DANI_ETIQUETA_BUCKET = {
  // Etiquetas Trevo (trabalho nosso)
  "PRONTO PARA SER FEITO":              "TREVO",
  "EM ANDAMENTO":                       "TREVO",
  "EXIGÊNCIA":                          "TREVO",
  // Etiquetas Cliente (espera deles)
  "DOCUMENTO PENDENTE":                 "CLIENTE",
  "RESPOSTA DE COMENTÁRIO PENDENTE":    "CLIENTE",
  "AGUARDANDO ASSINATURAS":             "CLIENTE",
  // Etiquetas Órgão (espera deles)
  "EM ANÁLISE NO ÓRGÃO":                "ORGAO",
  "CHAMADO ABERTO":                     "ORGAO",
};

function _bucketDaEtiqueta(nomeEtiqueta) {
  return DANI_ETIQUETA_BUCKET[(nomeEtiqueta || "").trim()] || null;
}

// v7.8.0: Buckets agora granulares POR LISTA — cada (lista, bucket) tem
// seu próprio acumulado, permitindo relatório por etapa do processo.
// Property keys:
//   bucket_inicio_<cardId>_<etiqueta> = JSON {ts, lista}
//   bucket_total_<cardId>__<lista>__<bucket> = segundos (sep '__' duplo)

function _normLista(nome) {
  return String(nome || "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .toUpperCase()
    .replace(/^_+|_+$/g, "")
    .substring(0, 60);
}

function handlerEtiquetaAdd(action, cli) {
  const label = (action.data && action.data.label && action.data.label.name) || "";
  const cardId = (action.data && action.data.card && action.data.card.id) || "";
  const bucket = _bucketDaEtiqueta(label);

  _daniLog("ETIQUETA+", label, { cardId: cardId, bucket: bucket });

  if (_jaProcessadoAcao(action.id)) return _respJson({ ok: true, ignored: "ja_processado" });
  if (!bucket || !cardId) return _respJson({ ok: true, ignored: "sem_bucket_ou_card" });

  // Pega lista atual do card pra granularidade por etapa
  let listaNorm = "DESCONHECIDA", listaOriginal = "";
  try {
    const card = _danigetCardCompleto(cardId);
    if (card) {
      listaOriginal = _danigetNomeLista(card.idList);
      listaNorm = _normLista(listaOriginal) || "DESCONHECIDA";
    }
  } catch (e) {}

  const props = getProps();
  const chaveInicio = "bucket_inicio_" + cardId + "_" + label;
  props.setProperty(chaveInicio, JSON.stringify({
    ts: new Date().toISOString(),
    lista: listaNorm,
    listaOriginal: listaOriginal,
  }));

  return _respJson({ ok: true, bucket: bucket, lista: listaNorm, registrado: true });
}

function handlerEtiquetaRemove(action, cli) {
  const label = (action.data && action.data.label && action.data.label.name) || "";
  const cardId = (action.data && action.data.card && action.data.card.id) || "";
  const bucket = _bucketDaEtiqueta(label);

  _daniLog("ETIQUETA-", label, { cardId: cardId, bucket: bucket });

  if (_jaProcessadoAcao(action.id)) return _respJson({ ok: true, ignored: "ja_processado" });
  if (!bucket || !cardId) return _respJson({ ok: true, ignored: "sem_bucket_ou_card" });

  const props = getProps();
  const chaveInicio = "bucket_inicio_" + cardId + "_" + label;
  const inicioRaw = props.getProperty(chaveInicio);

  if (!inicioRaw) {
    _daniLog("BUCKET", "remove sem inicio registrado — ignorando", { cardId: cardId, label: label });
    return _respJson({ ok: true, ignored: "sem_inicio" });
  }

  // Tenta JSON novo (v7.8+); fallback string ISO (compat v7.7.x)
  let inicio, listaNorm = "DESCONHECIDA";
  try {
    const obj = JSON.parse(inicioRaw);
    if (obj && obj.ts) {
      inicio = new Date(obj.ts);
      listaNorm = obj.lista || "DESCONHECIDA";
    } else throw new Error("legacy");
  } catch (e) {
    inicio = new Date(inicioRaw);
  }

  const fim = new Date();
  const segundos = Math.max(0, Math.floor((fim - inicio) / 1000));

  // Acumulado granular: bucket_total_<cardId>__<lista>__<bucket>
  const chaveTotal = "bucket_total_" + cardId + "__" + listaNorm + "__" + bucket;
  const totalAtual = parseInt(props.getProperty(chaveTotal) || "0", 10);
  props.setProperty(chaveTotal, String(totalAtual + segundos));
  props.deleteProperty(chaveInicio);

  _daniLog("BUCKET", "tempo somado", {
    cardId: cardId, etiqueta: label, bucket: bucket, lista: listaNorm,
    segundos: segundos, total_lista_bucket: totalAtual + segundos,
  });

  return _respJson({
    ok: true, bucket: bucket, lista: listaNorm,
    segundos_adicionados: segundos, total: totalAtual + segundos,
  });
}

/**
 * v7.8.0: Retorna matriz lista × bucket.
 * Estrutura:
 *   {
 *     por_lista: {
 *       "VIABILIDADE": { trevo, cliente, orgao, _dias }
 *     },
 *     total: { trevo, cliente, orgao, _dias }
 *   }
 * Inclui tempo em curso das etiquetas ativas. Compat retro com properties
 * v7.7.x (tempo sem lista vai pra "DESCONHECIDA").
 */
function getPrazosDani(cardId) {
  const props = getProps();
  const todas = props.getProperties();
  const porLista = {};
  const garantir = (l) => {
    if (!porLista[l]) porLista[l] = { TREVO: 0, CLIENTE: 0, ORGAO: 0 };
  };

  // 1) Acumulados granulares: bucket_total_<cardId>__<lista>__<bucket>
  const prefixGran = "bucket_total_" + cardId + "__";
  Object.keys(todas).forEach(k => {
    if (k.indexOf(prefixGran) !== 0) return;
    const resto = k.substring(prefixGran.length);
    const idx = resto.lastIndexOf("__");
    if (idx === -1) return;
    const lista = resto.substring(0, idx);
    const bucket = resto.substring(idx + 2);
    if (["TREVO","CLIENTE","ORGAO"].indexOf(bucket) === -1) return;
    garantir(lista);
    porLista[lista][bucket] += parseInt(todas[k], 10);
  });

  // 1b) Compat: properties antigas sem lista (v7.7.x) → "DESCONHECIDA"
  Object.keys(todas).forEach(k => {
    if (k.indexOf(prefixGran) === 0) return;
    const m = k.match(/^bucket_total_(.+?)_(TREVO|CLIENTE|ORGAO)$/);
    if (m && m[1] === cardId) {
      garantir("DESCONHECIDA");
      porLista["DESCONHECIDA"][m[2]] += parseInt(todas[k], 10);
    }
  });

  // 2) Em curso: etiquetas atualmente ativas (lê JSON com ts+lista)
  const agora = new Date();
  Object.keys(todas).forEach(k => {
    const prefix = "bucket_inicio_" + cardId + "_";
    if (k.indexOf(prefix) !== 0) return;
    const etiqueta = k.replace(prefix, "");
    const bucket = _bucketDaEtiqueta(etiqueta);
    if (!bucket) return;
    let inicio, lista;
    try {
      const obj = JSON.parse(todas[k]);
      inicio = new Date(obj.ts || todas[k]);
      lista = obj.lista || "DESCONHECIDA";
    } catch (e) {
      inicio = new Date(todas[k]);
      lista = "DESCONHECIDA";
    }
    const segundos = Math.max(0, Math.floor((agora - inicio) / 1000));
    garantir(lista);
    porLista[lista][bucket] += segundos;
  });

  // Formata + agrega total
  const formatado = {};
  let totalT = 0, totalC = 0, totalO = 0;
  Object.keys(porLista).forEach(lista => {
    const v = porLista[lista];
    formatado[lista] = {
      trevo: v.TREVO, cliente: v.CLIENTE, orgao: v.ORGAO,
      trevo_dias: Math.round(v.TREVO / 86400 * 10) / 10,
      cliente_dias: Math.round(v.CLIENTE / 86400 * 10) / 10,
      orgao_dias: Math.round(v.ORGAO / 86400 * 10) / 10,
    };
    totalT += v.TREVO; totalC += v.CLIENTE; totalO += v.ORGAO;
  });

  return {
    por_lista: formatado,
    total: {
      trevo: totalT, cliente: totalC, orgao: totalO,
      trevo_dias: Math.round(totalT / 86400 * 10) / 10,
      cliente_dias: Math.round(totalC / 86400 * 10) / 10,
      orgao_dias: Math.round(totalO / 86400 * 10) / 10,
    },
  };
}

/**
 * Reconstrói buckets de um card percorrendo o histórico completo de actions
 * do Trello (commentCard, addLabelToCard, removeLabelToCard). Útil pra
 * popular cards já existentes que não tiveram webhook ativo desde a criação.
 *
 * Custo: 1 chamada API por card (limite 1000 actions).
 */
/**
 * v7.8.0: Reconstrói buckets POR LISTA percorrendo histórico do card,
 * rastreando mudanças de lista (updateCard:idList) pra atribuir cada
 * intervalo de etiqueta à lista correta no momento.
 */
function reconstruirBucketsCardTeste() {
  reconstruirBucketsCard("69ec2d293f4d7941bdcd603e");
}

function reconstruirBucketsCard(cardId) {
  if (!cardId) {
    Logger.log("⚠️ Sem cardId. Roda reconstruirBucketsCardTeste() pra card de teste.");
    return;
  }
  Logger.log("🔁 Reconstruindo buckets POR LISTA do card " + cardId + "...");
  const r = trelloGet("/1/cards/" + cardId + "/actions", {
    filter: "addLabelToCard,removeLabelToCard,updateCard:idList,createCard,copyCard",
    limit: "1000",
  });
  if (r.getResponseCode() !== 200) {
    Logger.log("❌ Erro: " + r.getContentText());
    return;
  }
  const acoes = JSON.parse(r.getContentText()).reverse(); // ASC
  const props = getProps();

  // Limpa estado anterior (granular E v7.7.x)
  Object.keys(props.getProperties()).forEach(k => {
    if (k.indexOf("bucket_inicio_" + cardId + "_") === 0 ||
        k.indexOf("bucket_total_" + cardId + "_") === 0) {
      props.deleteProperty(k);
    }
  });

  // Lista atual como ponto de partida (caso histórico não tenha createCard)
  let listaAtual = "DESCONHECIDA";
  try {
    const card = _danigetCardCompleto(cardId);
    if (card) listaAtual = _normLista(_danigetNomeLista(card.idList));
  } catch (e) {}

  // Tenta inferir lista inicial pela primeira ação
  for (let i = 0; i < acoes.length; i++) {
    const a = acoes[i];
    if ((a.type === "createCard" || a.type === "copyCard") &&
        a.data && a.data.list && a.data.list.name) {
      listaAtual = _normLista(a.data.list.name);
      break;
    }
  }

  let totalEventos = 0;
  acoes.forEach(a => {
    if (a.type === "updateCard" && a.data && a.data.listAfter) {
      listaAtual = _normLista(a.data.listAfter.name || "");
      return;
    }
    const label = (a.data && a.data.label && a.data.label.name) || "";
    const bucket = _bucketDaEtiqueta(label);
    if (!bucket) return;

    if (a.type === "addLabelToCard") {
      props.setProperty("bucket_inicio_" + cardId + "_" + label, JSON.stringify({
        ts: a.date, lista: listaAtual,
      }));
      totalEventos++;
    } else if (a.type === "removeLabelToCard") {
      const chaveInicio = "bucket_inicio_" + cardId + "_" + label;
      const inicioRaw = props.getProperty(chaveInicio);
      if (!inicioRaw) return;
      let inicio, listaOrigem;
      try {
        const obj = JSON.parse(inicioRaw);
        inicio = new Date(obj.ts);
        listaOrigem = obj.lista || listaAtual;
      } catch (e) {
        inicio = new Date(inicioRaw);
        listaOrigem = listaAtual;
      }
      const segundos = Math.max(0, Math.floor((new Date(a.date) - inicio) / 1000));
      const chaveTotal = "bucket_total_" + cardId + "__" + listaOrigem + "__" + bucket;
      const totalAtual = parseInt(props.getProperty(chaveTotal) || "0", 10);
      props.setProperty(chaveTotal, String(totalAtual + segundos));
      props.deleteProperty(chaveInicio);
      totalEventos++;
    }
  });

  const prazos = getPrazosDani(cardId);
  Logger.log("✅ Reconstruído. " + totalEventos + " eventos.");
  Logger.log("Total: Trevo " + prazos.total.trevo_dias + "d / Cliente " +
    prazos.total.cliente_dias + "d / Órgão " + prazos.total.orgao_dias + "d");
  return prazos;
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 DANI DASHBOARD — visão geral em 1 aba (Onda 4 final)
// ────────────────────────────────────────────────────────────────────────────
// Cria/atualiza aba "DANI_DASHBOARD" da planilha com:
//   • Status atual (DANI_ATIVA, total webhooks, total cards monitorados)
//   • Métricas de hoje (de aba MÉTRICAS — chamadas Claude, ações tomadas)
//   • Top 10 cards com mais lembretes ativos
//   • Top 10 cards mais demorados em cada bucket
//
// Roda manualmente do editor: gerarDashboardDani()
// ════════════════════════════════════════════════════════════════════════════

function gerarDashboardDani() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName("DANI_DASHBOARD");
  if (!aba) {
    aba = ss.insertSheet("DANI_DASHBOARD");
  }
  aba.clear();

  const props = getProps();
  const todasProps = props.getProperties();
  const agora = new Date();
  const hoje = Utilities.formatDate(agora, Session.getScriptTimeZone(), "yyyy-MM-dd");

  let linha = 1;
  const escrever = (col, valor, bold) => {
    aba.getRange(linha, col).setValue(valor);
    if (bold) aba.getRange(linha, col).setFontWeight("bold");
  };
  const titulo = (txt) => {
    aba.getRange(linha, 1).setValue(txt).setFontWeight("bold").setFontSize(14).setBackground("#1a3d26").setFontColor("#ffffff");
    linha++;
  };
  const sub = (txt) => {
    aba.getRange(linha, 1).setValue(txt).setFontWeight("bold").setBackground("#f0f7f2");
    linha++;
  };

  // ─── 1. STATUS ATUAL ──
  titulo("🤖 DANI v1.0 — Dashboard");
  escrever(1, "Atualizado em:", true); escrever(2, agora);
  linha++;

  sub("⚙️ Status");
  escrever(1, "DANI_ATIVA:"); escrever(2, daniAtiva() ? "🟢 LIGADA" : "🔴 DESLIGADA"); linha++;
  escrever(1, "WEBAPP_URL:"); escrever(2, props.getProperty("WEBAPP_URL") || "(vazio)"); linha++;
  escrever(1, "DANI_FORCAR_CLIENTE:"); escrever(2, props.getProperty("DANI_FORCAR_CLIENTE") || "(vazio)"); linha++;

  // Webhooks
  let totalWebhooks = "?";
  try {
    const r = trelloGet("/1/tokens/" + prop("TRELLO_TOKEN") + "/webhooks", {});
    if (r.getResponseCode() === 200) {
      const lista = JSON.parse(r.getContentText());
      totalWebhooks = lista.filter(w => w.active).length + " ativos";
    }
  } catch (e) {}
  escrever(1, "Webhooks Trello:"); escrever(2, totalWebhooks); linha++;
  linha++;

  // ─── 2. MÉTRICAS DE HOJE ──
  sub("📊 Métricas de hoje (" + hoje + ")");
  try {
    const abaMetricas = ss.getSheetByName("MÉTRICAS");
    if (abaMetricas) {
      const dados = abaMetricas.getDataRange().getValues();
      let temAlguma = false;
      escrever(1, "Métrica", true); escrever(2, "Valor", true); linha++;
      for (let i = 1; i < dados.length; i++) {
        if (Utilities.formatDate(new Date(dados[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd") === hoje) {
          escrever(1, dados[i][1]); escrever(2, dados[i][2]); linha++;
          temAlguma = true;
        }
      }
      if (!temAlguma) { escrever(1, "(nenhuma ação Dani hoje ainda)"); linha++; }
    } else {
      escrever(1, "(aba MÉTRICAS não existe ainda)"); linha++;
    }
  } catch (e) { escrever(1, "Erro: " + e.message); linha++; }
  linha++;

  // ─── 3. CARDS COM PENDÊNCIAS / LEMBRETES ──
  sub("🔔 Cards com lembretes em curso");
  escrever(1, "Card ID", true); escrever(2, "Etapa", true); escrever(3, "Tentativas", true);
  escrever(4, "Último envio", true); escrever(5, "Finalizado?", true); linha++;

  let cardsLembrete = [];
  Object.keys(todasProps).forEach(k => {
    if (k.indexOf("lembrete_") !== 0) return;
    try {
      const partes = k.replace("lembrete_", "").split("_");
      const cardId = partes[0];
      const estado = JSON.parse(todasProps[k]);
      cardsLembrete.push({ cardId: cardId, etapa: partes.slice(1).join("_"), estado: estado });
    } catch (e) {}
  });
  cardsLembrete.sort((a, b) => (b.estado.tentativas || 0) - (a.estado.tentativas || 0));
  cardsLembrete.slice(0, 15).forEach(c => {
    escrever(1, c.cardId);
    escrever(2, (c.etapa || "").substring(0, 50));
    escrever(3, c.estado.tentativas || 0);
    escrever(4, c.estado.ultimoEnvio || "-");
    escrever(5, c.estado.finalizado ? "✅" : "");
    linha++;
  });
  if (cardsLembrete.length === 0) { escrever(1, "(nenhum card em sequência de lembretes)"); linha++; }
  linha++;

  // ─── 4. TOP CARDS POR BUCKET ──
  sub("⏱️ Cards mais demorados por bucket (acumulado)");
  escrever(1, "Card ID", true); escrever(2, "Bucket", true); escrever(3, "Dias", true); linha++;

  const buckets = {};
  Object.keys(todasProps).forEach(k => {
    const m = k.match(/^bucket_total_(.+?)_(TREVO|CLIENTE|ORGAO)$/);
    if (!m) return;
    const segundos = parseInt(todasProps[k], 10);
    if (segundos < 86400) return; // só mostra ≥1 dia
    if (!buckets[m[2]]) buckets[m[2]] = [];
    buckets[m[2]].push({ cardId: m[1], segundos: segundos });
  });

  ["TREVO", "CLIENTE", "ORGAO"].forEach(b => {
    const lista = (buckets[b] || []).sort((x, y) => y.segundos - x.segundos).slice(0, 5);
    lista.forEach(item => {
      escrever(1, item.cardId);
      escrever(2, b);
      escrever(3, (item.segundos / 86400).toFixed(1));
      linha++;
    });
  });
  if (Object.keys(buckets).length === 0) { escrever(1, "(buckets ainda sendo populados — entre 1-7 dias)"); linha++; }

  // Auto-fit
  for (let c = 1; c <= 5; c++) aba.autoResizeColumn(c);

  Logger.log("✅ Dashboard gerado em DANI_DASHBOARD (linha " + linha + ")");
}

/**
 * Mostra prazos de um card. Roda do editor.
 */
/**
 * Atalho pra ver prazos do card de teste atual (TESTE DANI - 010101).
 * Rode esse direto no editor — não precisa passar argumento.
 */
function mostrarPrazosCardTeste() {
  mostrarPrazosCard("69ec2d293f4d7941bdcd603e");
}

/**
 * Versão com UI prompt — pede o cardId via janela popup. Precisa
 * planilha aberta. Use se quiser ver outro card sem editar código.
 */
function mostrarPrazosCardComPrompt() {
  let cardId = null;
  try {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt(
      "🤖 Mostrar prazos",
      "Cole o ID do card do Trello (24 caracteres hex):",
      ui.ButtonSet.OK_CANCEL
    );
    if (resp.getSelectedButton() === ui.Button.OK) {
      cardId = resp.getResponseText().trim();
    }
  } catch (e) {
    Logger.log("⚠️ UI não disponível. Rode da planilha (não do editor).");
    Logger.log("OU edite mostrarPrazosCardTeste() pra ter outro cardId.");
    return;
  }
  if (cardId) mostrarPrazosCard(cardId);
}

function mostrarPrazosCard(cardId) {
  if (!cardId) {
    Logger.log("⚠️ Apps Script editor não aceita argumentos.");
    Logger.log("Opções:");
    Logger.log("  1) Roda mostrarPrazosCardTeste() — atalho pro card de teste");
    Logger.log("  2) Roda mostrarPrazosCardComPrompt() (precisa planilha aberta)");
    Logger.log("  3) Edita esta função e cola o cardId direto:");
    Logger.log("     mostrarPrazosCard('SEU_CARD_ID_AQUI')");
    return;
  }
  const p = getPrazosDani(cardId);
  Logger.log("══════════ Prazos do card " + cardId + " ══════════");
  Logger.log("");
  Logger.log("  Lista                          | Trevo  | Cliente | Órgão");
  Logger.log("  -------------------------------|--------|---------|-------");
  const fmt = (d) => (d > 0 ? d.toFixed(1) + "d" : "-").padEnd(6);
  Object.keys(p.por_lista).sort().forEach(lista => {
    const v = p.por_lista[lista];
    Logger.log("  " + lista.substring(0, 30).padEnd(31) + "| " +
      fmt(v.trevo_dias) + " | " + fmt(v.cliente_dias) + "  | " + fmt(v.orgao_dias));
  });
  Logger.log("  -------------------------------|--------|---------|-------");
  Logger.log("  TOTAL                          | " +
    fmt(p.total.trevo_dias) + " | " + fmt(p.total.cliente_dias) + "  | " + fmt(p.total.orgao_dias));
  Logger.log("  Total processo: " + (p.total.trevo_dias + p.total.cliente_dias + p.total.orgao_dias).toFixed(1) + "d");
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 Onda 3 — Regras especiais por lista de destino
// ────────────────────────────────────────────────────────────────────────────
// Quando card muda de lista, alguns destinos disparam ações específicas:
//   • 🍀 ALVARÁS E LICENÇAS  → G10: oferece orçamento ao cliente (1x/dia, 5d)
//   • 🍀 MAT                  → G12: lembra contador do MAT (cron 9h)
// Demais listas: só registra movimento. Outros disparos por lista (ex.:
// PENDENTE DE ASSINATURA, AGUARDANDO PAGAMENTO) usam G2 do funcionário.
// ════════════════════════════════════════════════════════════════════════════

function handlerCardAtualizado(action, cli) {
  const before = action.data.listBefore;
  const after  = action.data.listAfter;
  if (!before || !after) {
    return _respJson({ ok: true, ignored: "updateCard sem mudança de lista" });
  }

  const cardId = (action.data.card && action.data.card.id) || "";
  _daniLog("MOVIMENTO", "card movido", { cardId: cardId, de: before.name, para: after.name });

  if (_jaProcessadoAcao(action.id)) {
    return _respJson({ ok: true, ignored: "ja_processado" });
  }

  if (!daniAtiva()) {
    _daniLog("DRY-RUN", "card movido — não age (dry-run)");
    return _respJson({ ok: true, dry_run: true });
  }

  const nomeAfter = String(after.name || "").toLowerCase();

  // G10 — Chegou em ALVARÁS E LICENÇAS → oferta de orçamento
  if (nomeAfter.indexOf("alvar") !== -1 && nomeAfter.indexOf("licenc") !== -1) {
    return _g10AlvarasOferta(cardId);
  }

  // G12 — Chegou em MAT → lembra contador
  if (/\bmat\b/.test(nomeAfter)) {
    return _g12MatLembrar(cardId);
  }

  return _respJson({ ok: true, lista: after.name, sem_acao_especial: true });
}

function _g10AlvarasOferta(cardId) {
  _daniLog("G10", "ALVARÁS — oferecendo orçamento ao cliente", { cardId: cardId });
  const card = _danigetCardCompleto(cardId);
  if (!card) return _respJson({ ok: false, error: "card nao encontrado" });

  const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);
  const mensagemCliente =
    "Olá! Aqui é a dani.ai da Trevo Legaliza. Seu processo principal foi concluído com sucesso. " +
    "Agora chegamos na fase de **Alvarás e Licenças** — etapa em que muitas empresas ficam em risco " +
    "de operar irregularmente.\n\n" +
    "Somos especialistas neste tipo de regularização — nossos orçamentos são pensados pra dar uma " +
    "boa margem de lucro pro contador. Quer que a gente prepare um estudo personalizado pra esta empresa?\n\n" +
    "Se quiser, basta responder este email ou comentar aqui no card. Em 5 dias úteis, se não tivermos retorno, " +
    "concluímos o processo no estado atual.";

  // Email
  const html = _daniMontarEmailHTML({
    titulo: "Alvarás e Licenças — quer um orçamento? 🍀",
    mensagem: mensagemCliente,
    cardNome: card.name,
    cardUrl: cardUrl,
  });
  _daniEnviarEmailCliente(card, "🍀 Alvarás e Licenças — orçamento personalizado — " + card.name, html, mensagemCliente);

  // Comentário no card
  _daniComentar(cardId, mensagemCliente, /* marcarBoard */ true);

  // Salva data de chegada (cron G11 vai monitorar 5 dias)
  getProps().setProperty("alvaras_chegada_" + cardId, new Date().toISOString());

  incMetrica("dani_g10_alvaras_oferta");
  return _respJson({ ok: true, acao: "G10_alvaras_oferta", emailEnviado: true });
}

function _g12MatLembrar(cardId) {
  _daniLog("G12", "MAT — lembrando contador", { cardId: cardId });
  const card = _danigetCardCompleto(cardId);
  if (!card) return _respJson({ ok: false, error: "card nao encontrado" });

  const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);
  const mensagemCliente =
    "Olá! Aqui é a dani.ai da Trevo Legaliza. O processo de abertura foi deferido pela Junta Comercial 🎉\n\n" +
    "Agora precisamos do seu próximo passo: acessar o **MAT (Módulo de Administração Tributária)** " +
    "pra realizar a assinatura junto com os sócios e definir o regime tributário (Simples Nacional ou IBS/CBS).\n\n" +
    "**Atenção:** o regime tributário é definido AQUI, antes da emissão do CNPJ. Decisão importante.\n\n" +
    "Após você concluir o MAT no portal, anexe o CNPJ neste card pra darmos seguimento.";

  // Aplica RESPOSTA DE COMENTÁRIO PENDENTE (cliente precisa fazer ação)
  _daniAplicarEtiqueta(cardId, card.idBoard, DANI_ETIQUETA_RESP);

  const html = _daniMontarEmailHTML({
    titulo: "Próximo passo: MAT (Módulo Administrativo Tributário)",
    mensagem: mensagemCliente,
    cardNome: card.name,
    cardUrl: cardUrl,
    etiquetaPendencia: DANI_ETIQUETA_RESP,
  });
  _daniEnviarEmailCliente(card, "🍀 Próximo passo: MAT — " + card.name, html, mensagemCliente);
  _daniComentar(cardId, mensagemCliente, /* marcarBoard */ true);

  incMetrica("dani_g12_mat_lembrar");
  return _respJson({ ok: true, acao: "G12_mat_lembrar" });
}

function handlerAnexo(action, cli) {
  return _danihandlerG5(action, cli);
}

function resolverClientePorBoard(boardId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("CLIENTES");
  if (!aba) return {};
  const dados = aba.getDataRange().getValues();
  const headers = dados[0].map(h => String(h).trim().toUpperCase());
  const idxCodigo = headers.indexOf("CÓDIGO CLIENTE");
  const idxBoard = headers.indexOf("ID DO QUADRO");
  const idxEmailLembretes = headers.indexOf("EMAIL_LEMBRETES");
  const idxEmailBloqueado = headers.indexOf("EMAIL_BLOQUEADO");
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxBoard] || "").trim() === String(boardId).trim()) {
      return {
        codigo: String(dados[i][idxCodigo] || "").trim(),
        emailsLembretes: idxEmailLembretes >= 0 ? String(dados[i][idxEmailLembretes] || "").trim() : "",
        emailBloqueado: idxEmailBloqueado >= 0 ? String(dados[i][idxEmailBloqueado] || "").trim() : "",
      };
    }
  }
  return {};
}

function buscarCardsComEtiquetaLembrete(boardId) {
  const r = trelloGet("/1/boards/" + boardId + "/cards", { fields: "name,shortUrl,desc,labels,idBoard", labels: "true", limit: "1000" });
  if (r.getResponseCode() !== 200) return [];
  const all = JSON.parse(r.getContentText());
  return all.filter(c => {
    const nomes = (c.labels || []).map(l => (l.name || "").trim());
    return nomes.some(n => ETIQUETAS_LEMBRETE.indexOf(n) !== -1);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 🔔 LEMBRETES v7.3.1 — Onda 1.C
// ────────────────────────────────────────────────────────────────────────────
// Regras (do relatório do Thales):
//   • Máximo 5 lembretes POR ETAPA (lista + etiqueta principal)
//   • Reset do contador quando a ETAPA muda (cliente migrou de fase)
//   • 5º lembrete = texto gentil "não solicitarei mais por aqui"
//   • Cada lembrete = email + comentário no card (@card pra notificar cliente)
//
// Caso especial AGUARDANDO PAGAMENTO JUNTA COMERCIAL:
//   • 1º lembrete: imediato (forcarPrimeiro)
//   • 2º lembrete: 4h após o 1º (dentro do mesmo dia)
//   • 3º a 5º: 1x ao dia
//
// Estado por card+etapa: PropertiesService key "lembrete_{cardId}_{chaveEtapa}"
//   { primeiroEnvio, ultimoEnvio, tentativas, finalizado, etapaSig }
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calcula a "assinatura da etapa" (chave) do card pra rastrear lembretes.
 * Etapa = lista atual + etiquetas de pendência ativas.
 * Quando o card muda de lista OU as etiquetas mudam, a chave muda → reset.
 */
function _calcularChaveEtapa(card) {
  const lista = (card.idList || "").substring(0, 8); // 8 chars já bastam pra unicidade
  const etiquetas = (card.labels || [])
    .map(l => (l.name || "").trim())
    .filter(n => DANI_ETIQUETAS_PENDENCIA.indexOf(n) !== -1)
    .sort()
    .join(",");
  return lista + "|" + etiquetas;
}

/**
 * Detecta se o card está na lista AGUARDANDO PAGAMENTO JUNTA COMERCIAL.
 * Esta lista tem regra própria de cadência (1º imediato, 2º 4h depois, depois 1x/dia).
 */
function _ehListaAguardandoPagamento(nomeLista) {
  const n = String(nomeLista || "").toLowerCase();
  return n.indexOf("aguardando pagamento") !== -1 && n.indexOf("junta") !== -1;
}

/**
 * Decide se deve mandar lembrete agora pra este card.
 * Implementa regras Onda 1.C: 5 max por etapa, reset ao mudar etapa,
 * tom gentil no 5º. Caso especial AGUARDANDO PAGAMENTO JUNTA.
 */
function processarLembreteCard(card, codigoCliente, emailsLembretes, emailBloqueado, forcarPrimeiro) {
  const props = PropertiesService.getScriptProperties();
  const chaveEtapa = _calcularChaveEtapa(card);
  const chaveProp = "lembrete_" + card.id + "_" + chaveEtapa;
  const estadoRaw = props.getProperty(chaveProp);
  const estado = estadoRaw
    ? JSON.parse(estadoRaw)
    : { primeiroEnvio: null, ultimoEnvio: null, tentativas: 0, finalizado: false, etapaSig: chaveEtapa };

  if (estado.finalizado) {
    _daniLog("LEMBRETE", "etapa já finalizada (5 lembretes esgotados)", { cardId: card.id, etapa: chaveEtapa });
    return false;
  }

  const MAX_LEMBRETES = 5;
  const agora = new Date();
  const hojeISO = Utilities.formatDate(agora, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const tentativaAtual = (estado.tentativas || 0) + 1;

  // Busca nome da lista (pra detectar caso especial)
  let nomeLista = "";
  try { nomeLista = _danigetNomeLista(card.idList); } catch (e) {}
  const ehAguardandoPag = _ehListaAguardandoPagamento(nomeLista);

  // Decide se deve mandar AGORA
  let deveMandar = false;
  let motivo = "";

  if (forcarPrimeiro || !estado.primeiroEnvio) {
    deveMandar = true;
    motivo = "primeiro envio";
  } else if (ehAguardandoPag && tentativaAtual === 2) {
    // Caso especial: 2º lembrete da AGUARDANDO PAGAMENTO = 4h após 1º
    const ultimoEnvio = new Date(estado.ultimoEnvio + "T00:00:00");
    const horasDesdeUltimo = (agora.getTime() - ultimoEnvio.getTime()) / (1000 * 60 * 60);
    if (horasDesdeUltimo >= 4) {
      deveMandar = true;
      motivo = "2º lembrete pagamento (4h após 1º)";
    }
  } else if (estado.ultimoEnvio !== hojeISO) {
    // Regular: 1x ao dia (a partir do 2º — ou 3º no caso pagamento)
    deveMandar = true;
    motivo = "lembrete diário";
  }

  if (!deveMandar) {
    _daniLog("LEMBRETE", "ainda não é hora", { cardId: card.id, ultimoEnvio: estado.ultimoEnvio, tentativas: estado.tentativas });
    return false;
  }

  if (tentativaAtual > MAX_LEMBRETES) {
    estado.finalizado = true;
    props.setProperty(chaveProp, JSON.stringify(estado));
    _daniLog("LEMBRETE", "esgotou max — finalizado pra esta etapa", { cardId: card.id, tentativas: estado.tentativas });
    return false;
  }

  // Descobre destinatários (mesma lógica anterior)
  const destinatarios = [];
  if (emailsLembretes) {
    String(emailsLembretes).split(/[,;]/).map(s => s.trim()).filter(validarEmail).forEach(e => {
      if (String(emailBloqueado || "").split(/[,;]/).map(s => s.trim().toLowerCase()).indexOf(e.toLowerCase()) === -1) {
        destinatarios.push(e);
      }
    });
  }
  if (destinatarios.length === 0) {
    const emailCard = extrairEmailDoCardDesc(card.desc || "");
    if (emailCard && String(emailBloqueado).toLowerCase() !== emailCard.toLowerCase()) destinatarios.push(emailCard);
  }
  if (destinatarios.length === 0) {
    _daniLog("LEMBRETE", "sem destinatário — pulando", { cardId: card.id });
    return false;
  }

  const emailCardTrello = getEmailDoCard(card.id);
  const etiquetas = (card.labels || []).map(l => l.name).filter(Boolean);
  const ehUltimo = tentativaAtual === MAX_LEMBRETES;

  const enviouEmail = enviarEmailLembrete({
    destinatarios: destinatarios,
    emailCardTrello: emailCardTrello,
    cardNome: card.name,
    cardUrl: card.shortUrl,
    etiquetas: etiquetas,
    codigoCliente: codigoCliente,
    diaNumero: tentativaAtual,
    ehUltimo: ehUltimo,
  });

  // Comentário no card a cada lembrete (cliente também é notificado pelo @card)
  let comentouNoCard = false;
  try {
    const textoComent = ehUltimo
      ? "🔔 Último lembrete por aqui sobre este pendência. Quando puder, fala com a gente — estamos prontos pra seguir. ✨"
      : "🔔 Lembrete " + tentativaAtual + "/5: ainda aguardamos sua resposta sobre os itens pendentes. Pode dar uma olhadinha quando puder?";
    comentouNoCard = _daniComentar(card.id, textoComent, /* marcarBoard */ true);
  } catch (e) {
    _daniLog("AVISO", "lembrete: falha ao comentar no card", { erro: String(e) });
  }

  if (enviouEmail || comentouNoCard) {
    if (!estado.primeiroEnvio) estado.primeiroEnvio = hojeISO;
    estado.ultimoEnvio = hojeISO;
    estado.tentativas = tentativaAtual;
    if (ehUltimo) estado.finalizado = true;
    props.setProperty(chaveProp, JSON.stringify(estado));

    registrarLembrete({
      cardId: card.id, cardNome: card.name, cardUrl: card.shortUrl,
      codigo: codigoCliente, destinatarios: destinatarios.join(", "),
      tentativa: tentativaAtual, etiquetas: etiquetas.join(", "),
    });
    _daniLog("LEMBRETE", motivo + " enviado", {
      cardId: card.id, tentativa: tentativaAtual + "/" + MAX_LEMBRETES,
      etapa: nomeLista, ehUltimo: ehUltimo, destinatarios: destinatarios,
    });
    incMetrica("lembrete_enviado");
  }

  return enviouEmail || comentouNoCard;
}

function extrairEmailDoCardDesc(desc) {
  const m = String(desc || "").match(/📧\s*E-MAIL:\s*([^\s\n]+)/i);
  return m && validarEmail(m[1]) ? m[1] : null;
}

function avisarThalesAbandono(card, codigo, tentativas) {
  const corpo =
    "Cliente " + codigo + " não respondeu após " + tentativas + " tentativas de lembrete.\n\n" +
    "Card: " + card.name + "\n" +
    "Link: " + card.shortUrl + "\n\n" +
    "Dani parou de enviar lembretes automáticos. Avaliar ação manual.";
  try { MailApp.sendEmail(EMAIL_ALERTA_ERRO, "🚨 Cliente abandonou — " + codigo, corpo); }
  catch (e) { Logger.log(e.message); }
}

function registrarLembrete(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName("LEMBRETES");
  if (!aba) {
    aba = ss.insertSheet("LEMBRETES");
    aba.getRange(1, 1, 1, 7).setValues([["DATA/HORA","CÓDIGO","CARD","LINK","DESTINATÁRIOS","TENTATIVA","ETIQUETAS"]]);
    aba.getRange(1, 1, 1, 7).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  aba.insertRowAfter(1);
  aba.getRange(2, 1, 1, 7).setValues([[new Date(), d.codigo, d.cardNome, d.cardUrl, d.destinatarios, d.tentativa, d.etiquetas]]);
}

// =============================================
// EMAIL DE LEMBRETE — HTML bonito com logo
// =============================================
function enviarEmailLembrete(opts) {
  const etiquetaTxt = opts.etiquetas.join(" · ");
  const ehUltimo = opts.ehUltimo === true;
  const diaTxt = ehUltimo
    ? "Último lembrete"
    : (opts.diaNumero === 1 ? "Novo lembrete" : "Lembrete " + opts.diaNumero + "/5");
  const assunto = "🍀 " + diaTxt + " — Pendência no processo " + opts.cardNome;
  // Mensagem do corpo varia conforme tentativa (gentil progressivo, gentil no fim)
  const mensagemCorpo = ehUltimo
    ? 'Esse é o <strong>último lembrete</strong> que vou mandar por aqui sobre essa pendência. ' +
      'Não é cobrança! Só quero garantir que você não perdeu nossas mensagens. ' +
      'Quando puder, dá uma olhadinha pra gente seguir o processo. 💛'
    : 'Identifiquei que o processo abaixo está com uma ou mais <strong>pendências</strong> esperando ação. ' +
      'Quando puder, vai me ajudar muito pra darmos andamento.';

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0d1310;color:#f2f2f2;">' +
      '<div style="background:linear-gradient(135deg,#0d1310 0%,#1a3d26 100%);padding:32px 28px;text-align:center;">' +
        '<img src="' + LOGO_TREVO_URL + '" alt="Trevo Legaliza" style="height:56px;margin-bottom:12px;" />' +
        '<h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:0.3px;">Pendência no seu processo 🍀</h1>' +
      '</div>' +
      '<div style="background:#fff;color:#2d2d2d;padding:32px 28px;">' +
        '<p style="font-size:16px;margin:0 0 16px;">Olá! Aqui é a <strong>Dani</strong>, IA da Trevo Legaliza.</p>' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">' + mensagemCorpo + '</p>' +
        '<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:4px;">' +
          '<p style="margin:0 0 6px;color:#92400e;font-size:12px;text-transform:uppercase;font-weight:700;">Pendência(s)</p>' +
          '<p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600;">' + etiquetaTxt + '</p>' +
        '</div>' +
        '<div style="background:#f0f7f2;border-left:4px solid #2d5a3d;padding:16px 20px;margin:20px 0;border-radius:4px;">' +
          '<p style="margin:0 0 6px;color:#1a1a1a;font-size:12px;text-transform:uppercase;font-weight:700;">Processo</p>' +
          '<p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600;">' + opts.cardNome + '</p>' +
        '</div>' +
        '<div style="text-align:center;margin:28px 0;">' +
          '<a href="' + opts.cardUrl + '" style="display:inline-block;background:#2d5a3d;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">🔗 Acessar o processo</a>' +
        '</div>' +
        '<p style="font-size:14px;color:#4a4a4a;line-height:1.6;margin:20px 0;">' +
          '<strong>Como responder:</strong><br/>' +
          '• Você pode <strong>responder este email direto</strong> — sua resposta entra como comentário no processo automaticamente.<br/>' +
          '• Ou clique no botão acima pra ver o processo completo.' +
        '</p>' +
        '<div style="background:#faf8f3;border:1px solid #e8e3d5;border-radius:6px;padding:18px;margin:24px 0;">' +
          '<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1a1a1a;">🤖 Por que estou escrevendo</p>' +
          '<p style="margin:0;font-size:12px;line-height:1.5;color:#4a4a4a;">' +
            'Sou a inteligência artificial da Trevo. Acompanho os processos em tempo real e aciono o time humano quando necessário. ' +
            'Assim que a pendência for resolvida, eu paro automaticamente.' +
          '</p>' +
        '</div>' +
      '</div>' +
      '<div style="background:#0d1310;padding:20px 28px;text-align:center;">' +
        '<img src="' + LOGO_DANI_URL + '" alt="Dani by Trevo" style="height:40px;margin-bottom:8px;" />' +
        '<p style="color:#a8d5b8;font-size:12px;margin:6px 0 0;font-weight:600;">Dani · IA da Trevo Legaliza</p>' +
        '<p style="color:#888;font-size:11px;margin:6px 0 0;">Trevo Legaliza LTDA · 12 anos · 24+ estados · 100% digital</p>' +
      '</div>' +
    '</div>';

  const texto =
    "Olá!\n\nAqui é a Dani, IA da Trevo Legaliza.\n\n" +
    "Identifiquei pendência(s) no seu processo:\n\n" +
    "Pendência: " + etiquetaTxt + "\n" +
    "Processo: " + opts.cardNome + "\n\n" +
    "Acessar: " + opts.cardUrl + "\n\n" +
    "Você pode responder este email direto — sua resposta entra no processo automaticamente.\n\n" +
    "🍀 Dani — Trevo Legaliza";

  try {
    const opcoes = {
      htmlBody: html,
      body: texto,
      name: "Dani 🍀 Trevo Legaliza",
      replyTo: opts.emailCardTrello || EMAIL_ALERTA_ERRO,
    };
    if (opts.emailCardTrello) opcoes.cc = opts.emailCardTrello;

    MailApp.sendEmail({
      to: opts.destinatarios.join(","),
      subject: assunto,
      ...opcoes,
    });
    return true;
  } catch (e) {
    Logger.log("⚠️ Falha email lembrete: " + e.message);
    notificarErro("enviarEmailLembrete", e);
    return false;
  }
}

// =============================================
// EMAIL DE CONFIRMAÇÃO AO CLIENTE (após criar card)
// =============================================
function enviarEmailConfirmacaoCliente(emailCliente, nomeSolicitante, nomeEmpresa, tipoProcesso, cardUrl) {
  if (!validarEmail(emailCliente)) return;

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0d1310;color:#f2f2f2;">' +
      '<div style="background:linear-gradient(135deg,#0d1310 0%,#1a3d26 100%);padding:32px 28px;text-align:center;">' +
        '<img src="' + LOGO_TREVO_URL + '" alt="Trevo Legaliza" style="height:56px;margin-bottom:12px;" />' +
        '<h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.3px;">Processo cadastrado 🍀</h1>' +
      '</div>' +
      '<div style="background:#fff;color:#2d2d2d;padding:32px 28px;">' +
        '<p style="font-size:16px;margin:0 0 16px;">Olá, <strong>' + (nomeSolicitante || "") + '</strong>!</p>' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 18px;">' +
          'Aqui é a <strong>Dani</strong>, IA da Trevo Legaliza. Acabei de registrar sua solicitação ' +
          'e posicionei tudo no quadro de controle do seu cliente.' +
        '</p>' +
        '<div style="background:#f0f7f2;border-left:4px solid #2d5a3d;padding:16px 20px;margin:20px 0;border-radius:4px;">' +
          '<p style="margin:0 0 8px;color:#1a1a1a;font-size:12px;text-transform:uppercase;font-weight:700;">Resumo</p>' +
          '<p style="margin:4px 0;font-size:14px;"><strong>Tipo:</strong> ' + (tipoProcesso || "N/A") + '</p>' +
          '<p style="margin:4px 0;font-size:14px;"><strong>Empresa:</strong> ' + (nomeEmpresa || "N/A") + '</p>' +
        '</div>' +
        (cardUrl ?
          '<p style="font-size:14px;line-height:1.6;margin:16px 0;">Acompanhe o andamento em tempo real:</p>' +
          '<div style="text-align:center;margin:24px 0;">' +
            '<a href="' + cardUrl + '" style="display:inline-block;background:#2d5a3d;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">🔗 Acompanhar Processo</a>' +
          '</div>'
          : '') +
        '<div style="background:#faf8f3;border:1px solid #e8e3d5;border-radius:6px;padding:18px;margin:24px 0;">' +
          '<p style="margin:0 0 6px;font-size:13px;font-weight:700;">🤖 Tecnologia de ponta</p>' +
          '<p style="margin:0;font-size:12px;line-height:1.5;color:#4a4a4a;">' +
            'Uso IA pra triagem, acompanhamento de protocolos e resposta a comentários 24h. ' +
            'A Trevo é o próximo nível da assessoria societária B2B.' +
          '</p>' +
        '</div>' +
      '</div>' +
      '<div style="background:#0d1310;padding:20px 28px;text-align:center;">' +
        '<img src="' + LOGO_DANI_URL + '" alt="Dani by Trevo" style="height:40px;margin-bottom:8px;" />' +
        '<p style="color:#a8d5b8;font-size:12px;margin:6px 0 0;font-weight:600;">Dani · IA da Trevo Legaliza</p>' +
        '<p style="color:#888;font-size:11px;margin:6px 0 0;">12 anos · 24+ estados · 100% digital</p>' +
      '</div>' +
    '</div>';

  const texto =
    "Olá " + (nomeSolicitante || "") + "!\n\n" +
    "Aqui é a Dani, IA da Trevo Legaliza. Sua solicitação foi registrada.\n\n" +
    "Tipo: " + (tipoProcesso || "N/A") + "\n" +
    "Empresa: " + (nomeEmpresa || "N/A") + "\n" +
    (cardUrl ? "Acompanhe em: " + cardUrl + "\n" : "") +
    "\n🍀 Dani — Trevo Legaliza";

  try {
    MailApp.sendEmail({
      to: emailCliente,
      subject: "🍀 Processo cadastrado — Trevo Legaliza",
      htmlBody: html,
      body: texto,
      name: "Dani 🍀 Trevo Legaliza",
    });
  } catch (e) { Logger.log("⚠️ Falha email confirmação: " + e.message); }
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   🤖 DANI — WEBHOOK TRELLO (Onda 0)                                      ║
// ║   Gestão de webhooks + setup de Properties                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Setup das Properties da Dani.
 * Roda 1x antes de criar webhooks. Pede ao usuário:
 *   • WEBAPP_URL  — URL do deploy do Apps Script (Web App)
 *   • WEBHOOK_TOKEN — gera token aleatório se vazio (32 chars)
 *   • INDEFERIDO_NOTIFY_EMAILS — destinatários do alerta interno
 *
 * Idempotente: se já configurado, mostra valor atual e permite manter.
 */
function setupDaniProperties() {
  const ui = SpreadsheetApp.getUi();
  const props = getProps();

  // WEBAPP_URL
  const urlAtual = props.getProperty("WEBAPP_URL") || "";
  const respUrl = ui.prompt(
    "🤖 Dani — Setup 1/3: WEBAPP_URL",
    "URL do deploy do Apps Script como Web App (ex.: https://script.google.com/macros/s/.../exec)\n\nAtual: " + (urlAtual || "(vazio)") + "\n\nDeixe em branco pra manter o atual.",
    ui.ButtonSet.OK_CANCEL
  );
  if (respUrl.getSelectedButton() !== ui.Button.OK) return;
  const url = respUrl.getResponseText().trim();
  if (url) props.setProperty("WEBAPP_URL", url);

  // WEBHOOK_TOKEN — gera aleatório se vazio
  let token = props.getProperty("WEBHOOK_TOKEN") || "";
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
    props.setProperty("WEBHOOK_TOKEN", token);
    ui.alert("🔑 WEBHOOK_TOKEN gerado automaticamente:\n\n" + token + "\n\n(salve em local seguro — usado pra autenticar callbacks)");
  } else {
    ui.alert("🔑 WEBHOOK_TOKEN já configurado.\nSe precisar recriar, apague a property manualmente em Project Settings > Script Properties.");
  }

  // INDEFERIDO_NOTIFY_EMAILS
  const defaultEmails = "trevolegaliza@gmail.com,leticia.tonelli@trevolegaliza.com.br";
  const emailsAtuais = props.getProperty("INDEFERIDO_NOTIFY_EMAILS") || defaultEmails;
  const respEmails = ui.prompt(
    "🤖 Dani — Setup 3/3: Emails de alerta interno (INDEFERIMENTO)",
    "Lista separada por vírgulas. Recebe alerta SEMPRE que Dani detectar email de indeferimento de órgão.\n\nAtual: " + emailsAtuais + "\n\nDeixe em branco pra manter.",
    ui.ButtonSet.OK_CANCEL
  );
  if (respEmails.getSelectedButton() !== ui.Button.OK) return;
  const emails = respEmails.getResponseText().trim();
  if (emails) props.setProperty("INDEFERIDO_NOTIFY_EMAILS", emails);
  else if (!props.getProperty("INDEFERIDO_NOTIFY_EMAILS")) props.setProperty("INDEFERIDO_NOTIFY_EMAILS", defaultEmails);

  ui.alert("✅ Setup Dani concluído.\n\nPróximo passo: rode garantirWebhooksTodosBoards()");
}

/**
 * Cria webhook do Trello em TODOS os boards mapeados em CLIENTES.
 * Idempotente: pula boards que já têm webhook ativo apontando pro WEBAPP_URL.
 *
 * Trello faz HEAD inicial pra verificar URL. Apps Script Web App responde
 * 200 OK em GET (doGet), e Trello aceita isso como verificação.
 */
function garantirWebhooksTodosBoards() {
  const props = getProps();
  const url = props.getProperty("WEBAPP_URL");
  const token = props.getProperty("WEBHOOK_TOKEN");
  if (!url || !token) {
    Logger.log("❌ Rode setupDaniProperties() primeiro");
    return;
  }
  // Se for Edge Function do Supabase, NÃO adiciona token na URL pública
  // (o proxy adiciona internamente). Apenas Apps Script direto recebe token na URL.
  const isEdgeFunction = url.indexOf("supabase.co/functions/") !== -1;
  const callbackURL = isEdgeFunction
    ? url
    : url + (url.indexOf("?") === -1 ? "?" : "&") + "token=" + encodeURIComponent(token);
  Logger.log("🔗 Callback URL pros webhooks: " + callbackURL);
  Logger.log("    (modo " + (isEdgeFunction ? "Edge Function proxy" : "Apps Script direto") + ")");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("CLIENTES");
  if (!aba) { Logger.log("❌ Sem aba CLIENTES — rode MapearClientes() primeiro"); return; }
  const dados = aba.getDataRange().getValues();
  const headers = dados[0].map(h => String(h).trim().toUpperCase());
  const idxBoard = headers.indexOf("ID DO QUADRO");
  const idxNome  = headers.indexOf("NOME DO QUADRO");

  // 1) Lista webhooks já existentes do token (1 chamada)
  const rExistentes = trelloGet("/1/tokens/" + prop("TRELLO_TOKEN") + "/webhooks", {});
  let webhooksExistentes = [];
  if (rExistentes.getResponseCode() === 200) {
    webhooksExistentes = JSON.parse(rExistentes.getContentText());
  } else {
    Logger.log("⚠️ Não consegui listar webhooks existentes: " + rExistentes.getContentText());
  }
  const webhooksPorBoard = {};
  webhooksExistentes.forEach(w => {
    if (!webhooksPorBoard[w.idModel]) webhooksPorBoard[w.idModel] = [];
    webhooksPorBoard[w.idModel].push(w);
  });

  let totalCriados = 0, totalJaExistia = 0, totalErros = 0, boardsProcessados = 0;

  for (let i = 1; i < dados.length; i++) {
    const boardId = String(dados[i][idxBoard] || "").trim();
    if (!boardId) continue;
    const nomeBoard = idxNome >= 0 ? String(dados[i][idxNome] || "").trim() : boardId;
    boardsProcessados++;

    // Skip CENTRAL DE PROCESSO (espelhamento Placker)
    const upBoard = nomeBoard.toUpperCase();
    if (upBoard.indexOf("CENTRAL DE PROCESSO") !== -1 || upBoard.indexOf("CENTRAL DE PORCESSO") !== -1) {
      Logger.log("  ⏭️  Pulando '" + nomeBoard + "' (espelhamento Placker)");
      continue;
    }

    const existentes = (webhooksPorBoard[boardId] || []).filter(w => w.callbackURL === callbackURL && w.active);
    if (existentes.length > 0) {
      totalJaExistia++;
      continue;
    }

    // Cria webhook
    const r = trelloPost("/1/webhooks", {
      idModel: boardId,
      callbackURL: callbackURL,
      description: "Dani 🤖 — webhook automático do board " + nomeBoard,
    });
    if (r.getResponseCode() === 200) {
      totalCriados++;
      Logger.log("  ✅ Webhook criado em '" + nomeBoard + "'");
    } else {
      totalErros++;
      Logger.log("  ❌ Falha em '" + nomeBoard + "': " + r.getContentText());
    }
    Utilities.sleep(300); // rate limit Trello
  }

  Logger.log("═══════════════════════════════════");
  Logger.log("🤖 Webhooks Dani — varredura concluída em " + boardsProcessados + " boards:");
  Logger.log("   ✨ Criados:       " + totalCriados);
  Logger.log("   ♻️ Já existiam: " + totalJaExistia);
  Logger.log("   ⚠️ Erros:        " + totalErros);
  Logger.log("═══════════════════════════════════");
}

/**
 * Lista todos os webhooks do token atual (debug). Loga cada um.
 */
function listarWebhooks() {
  const r = trelloGet("/1/tokens/" + prop("TRELLO_TOKEN") + "/webhooks", {});
  if (r.getResponseCode() !== 200) { Logger.log("❌ " + r.getContentText()); return; }
  const lista = JSON.parse(r.getContentText());
  Logger.log("Total: " + lista.length + " webhooks");
  lista.forEach(w => {
    Logger.log("  • id=" + w.id + " | board=" + w.idModel + " | active=" + w.active + " | callback=" + w.callbackURL);
  });
}

/**
 * Cria/atualiza triggers agendados da Dani.
 * Idempotente: remove triggers existentes desses handlers antes de criar.
 *
 * Triggers criados:
 *   • sincronizarBoardsETrevoDani — diário 8h
 *     Roda MapearClientes() + garantirWebhooksTodosBoards() pra capturar
 *     boards novos automaticamente (sem intervenção manual).
 *   • LembretesPendencias — diário 9h (já existia, mantém)
 *   • VarrerEmails — a cada 15min (já existia, mantém)
 *
 * Roda 1 vez no editor após colar v7.0.x. Idempotente.
 */
function setupTriggersDani() {
  // Remove triggers existentes pros handlers nossos (evita duplicar)
  const handlers = ["sincronizarBoardsETrevoDani", "rotinasDiariasDani", "rotinaG2FollowUp4h"];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Trigger 1: sincronização de boards (8h)
  ScriptApp.newTrigger("sincronizarBoardsETrevoDani")
    .timeBased().everyDays(1).atHour(8).create();

  // Trigger 2: rotinas diárias da Dani (G11/G13/G14/G15/G9) — 9h30
  ScriptApp.newTrigger("rotinasDiariasDani")
    .timeBased().everyDays(1).atHour(9).nearMinute(30).create();

  // Trigger 3: G2 follow-up 4h — roda a cada 1h, dispara só quando ≥4h sem resposta
  ScriptApp.newTrigger("rotinaG2FollowUp4h")
    .timeBased().everyHours(1).create();

  Logger.log("✅ Triggers criados:");
  Logger.log("  • sincronizarBoardsETrevoDani — diário 8h");
  Logger.log("  • rotinasDiariasDani          — diário 9h30 (G11/G13/G14/G15/G9)");
  Logger.log("  • rotinaG2FollowUp4h          — a cada 1h (verifica ≥4h sem resposta)");
  Logger.log("ℹ️ Triggers existentes (LembretesPendencias 9h, VarrerEmails 15min) mantidos.");
}

/**
 * Handler do trigger diário. Mapeia boards novos + cria webhooks pra eles.
 * Tolerante a falhas: se uma etapa falhar, a outra ainda roda.
 */
function sincronizarBoardsETrevoDani() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300000)) { Logger.log("⚠️ sincronizarBoardsETrevoDani: lock ocupado"); return; }
  try {
    Logger.log("🔄 Sincronização diária Dani iniciada");
    try { MapearClientes(); } catch (e) { notificarErro("MapearClientes (diário)", e); }
    try { garantirWebhooksTodosBoards(); } catch (e) { notificarErro("garantirWebhooks (diário)", e); }
    Logger.log("✅ Sincronização diária Dani concluída");
    incMetrica("sync_diario");
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 ROTINAS DIÁRIAS DA DANI (Onda 3 — cron 9h)
// ────────────────────────────────────────────────────────────────────────────
// Trigger 'rotinasDiariasDani' roda toda manhã 9h e cuida de:
//   • G11: ALVARÁS sem resposta há 5 dias → move pra PROCESSOS FINALIZADOS
//   • G13: ARQUIVO MENSAL +30 dias → deleta anexos (LGPD)
//   • G14: BLOQUEADOS dia 15 → pergunta se permanece
//   • G15: BLOQUEADOS dia 30 → deleta anexos
//   • G9 (Onda 2): SEM_MOVIMENTACAO em EM ANÁLISE há ≥1 dia → notifica cliente
// ════════════════════════════════════════════════════════════════════════════

function rotinasDiariasDani() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(600000)) { Logger.log("⚠️ rotinasDiariasDani: lock ocupado"); return; }
  try {
    _daniLog("ROTINA", "rotinas diárias iniciadas");
    if (!daniAtiva()) {
      _daniLog("ROTINA", "DRY-RUN — rotinas diárias não rodam quando DANI_ATIVA=false");
      return;
    }
    try { _rotinaG11AlvarasTimeout(); } catch (e) { _daniLog("ERRO", "G11", { erro: String(e) }); }
    try { _rotinaG13ArquivoMensal(); } catch (e) { _daniLog("ERRO", "G13", { erro: String(e) }); }
    try { _rotinaG14G15Bloqueados(); } catch (e) { _daniLog("ERRO", "G14/G15", { erro: String(e) }); }
    try { _rotinaG9NotificarAnaliseOrgao(); } catch (e) { _daniLog("ERRO", "G9", { erro: String(e) }); }
    try { limparPropertiesOrfas(); } catch (e) { _daniLog("ERRO", "limparPropertiesOrfas", { erro: String(e) }); }
    _daniLog("ROTINA", "rotinas diárias concluídas");
  } finally {
    lock.releaseLock();
  }
}

// G11 — ALVARÁS: 5 dias sem resposta → move pra PROCESSOS FINALIZADOS
function _rotinaG11AlvarasTimeout() {
  const props = getProps();
  const todasProps = props.getProperties();
  const agora = new Date();

  Object.keys(todasProps).forEach(chave => {
    if (chave.indexOf("alvaras_chegada_") !== 0) return;
    const cardId = chave.replace("alvaras_chegada_", "");
    const dataChegada = new Date(todasProps[chave]);
    const dias = Math.floor((agora - dataChegada) / (1000 * 60 * 60 * 24));

    if (dias < 5) return;

    _daniLog("G11", "ALVARÁS timeout 5d — finalizando", { cardId: cardId, dias: dias });
    const card = _danigetCardCompleto(cardId);
    if (!card) {
      props.deleteProperty(chave);
      return;
    }

    // Move pra PROCESSOS FINALIZADOS — busca lista do board
    try {
      const r = trelloGet("/1/boards/" + card.idBoard + "/lists", { fields: "name,id" });
      if (r.getResponseCode() === 200) {
        const listas = JSON.parse(r.getContentText());
        const finalizados = listas.find(l => /processos\s+finalizados/i.test(l.name || ""));
        if (finalizados) {
          trelloPut("/1/cards/" + cardId, { idList: finalizados.id });
          const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);
          const msg = "Olá! Aqui é a dani.ai da Trevo Legaliza. Como não recebemos retorno sobre " +
            "o orçamento de Alvarás e Licenças nos últimos 5 dias, fechamos esta solicitação como " +
            "concluída. Se precisar de regularização no futuro, é só nos chamar. ✨";
          const html = _daniMontarEmailHTML({
            titulo: "Processo finalizado 🍀",
            mensagem: msg,
            cardNome: card.name,
            cardUrl: cardUrl,
          });
          _daniEnviarEmailCliente(card, "🍀 Processo finalizado — " + card.name, html, msg);
          _daniComentar(cardId, msg, /* marcarBoard */ true);
          incMetrica("dani_g11_alvaras_finalizado");
        }
      }
    } catch (e) {
      _daniLog("ERRO", "G11: falha ao mover", { erro: String(e), cardId: cardId });
    }
    props.deleteProperty(chave);
  });
}

// G13 — ARQUIVO MENSAL: +30 dias → avisa LGPD + deleta anexos
function _rotinaG13ArquivoMensal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("CLIENTES");
  if (!aba) return;
  const dados = aba.getDataRange().getValues();
  const headers = dados[0].map(h => String(h).trim().toUpperCase());
  const idxBoard = headers.indexOf("ID DO QUADRO");

  for (let i = 1; i < dados.length; i++) {
    const boardId = String(dados[i][idxBoard] || "").trim();
    if (!boardId) continue;
    try {
      _processarArquivoMensalDoBoard(boardId);
    } catch (e) { _daniLog("ERRO", "G13 board", { boardId: boardId, erro: String(e) }); }
  }
}

function _processarArquivoMensalDoBoard(boardId) {
  // Busca lista ARQUIVO MENSAL
  const rL = trelloGet("/1/boards/" + boardId + "/lists", { fields: "name,id" });
  if (rL.getResponseCode() !== 200) return;
  const listas = JSON.parse(rL.getContentText());
  const arquivo = listas.find(l => /arquivo\s+mensal/i.test(l.name || ""));
  if (!arquivo) return;

  // Busca cards na lista com data de entrada > 30 dias
  const rC = trelloGet("/1/lists/" + arquivo.id + "/cards", {
    fields: "name,shortUrl,desc,idBoard,dateLastActivity,attachments",
    attachments: "true",
  });
  if (rC.getResponseCode() !== 200) return;
  const cards = JSON.parse(rC.getContentText());
  const agora = new Date();

  cards.forEach(card => {
    const dataAtv = new Date(card.dateLastActivity);
    const dias = Math.floor((agora - dataAtv) / (1000 * 60 * 60 * 24));
    if (dias < 30) return;
    if ((card.attachments || []).length === 0) return; // já está limpo

    _daniLog("G13", "deletando anexos LGPD (30d em ARQUIVO MENSAL)", { cardId: card.id, attachments: card.attachments.length });

    // Avisa cliente antes
    const msg = "Olá! Aqui é a dani.ai. Conforme nossa política de LGPD, todos os documentos anexados " +
      "neste processo serão removidos após 30 dias na pasta Arquivo Mensal. Se ainda não salvou os " +
      "arquivos, baixe agora pelo link do processo. Obrigada! 🔒";
    const html = _daniMontarEmailHTML({
      titulo: "Política LGPD — anexos serão removidos",
      mensagem: msg,
      cardNome: card.name,
      cardUrl: card.shortUrl,
    });
    _daniEnviarEmailCliente(card, "🔒 LGPD — " + card.name, html, msg);

    // Deleta anexos do Trello
    (card.attachments || []).forEach(att => {
      try {
        const u = "https://api.trello.com/1/cards/" + card.id + "/attachments/" + att.id +
          "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
        fetchRetry(u, { method: "delete" });
      } catch (e) { _daniLog("AVISO", "G13: falha ao deletar anexo", { erro: String(e) }); }
    });

    incMetrica("dani_g13_arquivo_mensal");
  });
}

// G14/G15 — BLOQUEADOS: dia 15 pergunta, dia 30 deleta anexos
function _rotinaG14G15Bloqueados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("CLIENTES");
  if (!aba) return;
  const dados = aba.getDataRange().getValues();
  const headers = dados[0].map(h => String(h).trim().toUpperCase());
  const idxBoard = headers.indexOf("ID DO QUADRO");

  for (let i = 1; i < dados.length; i++) {
    const boardId = String(dados[i][idxBoard] || "").trim();
    if (!boardId) continue;
    try {
      _processarBloqueadosDoBoard(boardId);
    } catch (e) { _daniLog("ERRO", "G14/G15 board", { boardId: boardId, erro: String(e) }); }
  }
}

function _processarBloqueadosDoBoard(boardId) {
  const rL = trelloGet("/1/boards/" + boardId + "/lists", { fields: "name,id" });
  if (rL.getResponseCode() !== 200) return;
  const listas = JSON.parse(rL.getContentText());
  const bloq = listas.find(l => /bloquead/i.test(l.name || ""));
  if (!bloq) return;

  const rC = trelloGet("/1/lists/" + bloq.id + "/cards", {
    fields: "name,shortUrl,desc,idBoard,dateLastActivity,attachments",
    attachments: "true",
  });
  if (rC.getResponseCode() !== 200) return;
  const cards = JSON.parse(rC.getContentText());
  const agora = new Date();

  cards.forEach(card => {
    const dataAtv = new Date(card.dateLastActivity);
    const dias = Math.floor((agora - dataAtv) / (1000 * 60 * 60 * 24));
    const props = getProps();
    const chave = "bloqueado_" + card.id;
    const estadoRaw = props.getProperty(chave);
    const estado = estadoRaw ? JSON.parse(estadoRaw) : { dia15: false, dia30: false };

    // G14 — Dia 15
    if (dias >= 15 && !estado.dia15) {
      const msg = "Olá! Aqui é a dani.ai. Este processo está bloqueado há 15 dias. " +
        "Você ainda quer mantê-lo nessa situação? Se em mais 15 dias não tivermos retorno, os anexos " +
        "serão removidos. Se quiser retomar, é só responder.";
      const html = _daniMontarEmailHTML({
        titulo: "Processo bloqueado — confirma se mantém?",
        mensagem: msg,
        cardNome: card.name,
        cardUrl: card.shortUrl,
      });
      _daniEnviarEmailCliente(card, "⚠️ Processo bloqueado há 15d — " + card.name, html, msg);
      _daniComentar(card.id, msg, /* marcarBoard */ true);
      estado.dia15 = true;
      props.setProperty(chave, JSON.stringify(estado));
      _daniLog("G14", "BLOQUEADOS dia 15 — perguntou cliente", { cardId: card.id });
      incMetrica("dani_g14_bloqueado_15");
    }

    // G15 — Dia 30 → deleta anexos (NÃO o card)
    if (dias >= 30 && !estado.dia30) {
      (card.attachments || []).forEach(att => {
        try {
          const u = "https://api.trello.com/1/cards/" + card.id + "/attachments/" + att.id +
            "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
          fetchRetry(u, { method: "delete" });
        } catch (e) {}
      });
      const msg = "Olá! Aqui é a dani.ai. Como este processo permaneceu bloqueado por 30 dias sem retorno, " +
        "removemos os anexos por segurança e LGPD. O card permanece pra histórico. Se precisar retomar, " +
        "é só nos chamar — começamos uma nova solicitação.";
      const html = _daniMontarEmailHTML({
        titulo: "Anexos removidos por LGPD",
        mensagem: msg,
        cardNome: card.name,
        cardUrl: card.shortUrl,
      });
      _daniEnviarEmailCliente(card, "🔒 Anexos removidos — " + card.name, html, msg);
      estado.dia30 = true;
      props.setProperty(chave, JSON.stringify(estado));
      _daniLog("G15", "BLOQUEADOS dia 30 — anexos deletados", { cardId: card.id });
      incMetrica("dani_g15_bloqueado_30");
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 🩺 HEARTBEAT — testa Claude API a cada 1h (junto com follow-up 4h)
// ────────────────────────────────────────────────────────────────────────────
// Se Claude API falhar 3x consecutivas (3h), envia alerta pro EMAIL_ALERTA_ERRO.
// Estado em property "heartbeat_falhas_consecutivas" + "heartbeat_ultimo_alerta".
// ════════════════════════════════════════════════════════════════════════════

function heartbeatDani() {
  const props = getProps();
  let ok = false;
  try {
    const resp = chamarClaude("Responda apenas: OK", 10, CLAUDE_MODEL_HAIKU);
    ok = String(resp || "").toUpperCase().indexOf("OK") !== -1;
  } catch (e) {
    _daniLog("HEARTBEAT", "falha", { erro: String(e) });
  }

  const falhas = parseInt(props.getProperty("heartbeat_falhas_consecutivas") || "0", 10);
  if (ok) {
    if (falhas > 0) {
      _daniLog("HEARTBEAT", "Claude API voltou ao normal", { falhas_anteriores: falhas });
    }
    props.setProperty("heartbeat_falhas_consecutivas", "0");
    props.setProperty("heartbeat_ultimo_ok", new Date().toISOString());
    return;
  }

  const novasFalhas = falhas + 1;
  props.setProperty("heartbeat_falhas_consecutivas", String(novasFalhas));

  if (novasFalhas >= 3) {
    const ultimoAlerta = props.getProperty("heartbeat_ultimo_alerta");
    const horasSemAlerta = ultimoAlerta
      ? (new Date() - new Date(ultimoAlerta)) / (1000 * 60 * 60) : 999;
    if (horasSemAlerta >= 6) {
      try {
        MailApp.sendEmail(EMAIL_ALERTA_ERRO,
          "🚨 Dani — Claude API fora do ar há " + novasFalhas + "h",
          "Heartbeat falhou " + novasFalhas + " vezes consecutivas.\n\n" +
          "Verificar:\n" +
          "1. Saldo da conta Anthropic (https://console.anthropic.com/settings/billing)\n" +
          "2. Status da Anthropic (https://status.anthropic.com)\n" +
          "3. Logs em DANI_LOG\n\n" +
          "Dani não está agindo em comentários novos. ⚠️");
        props.setProperty("heartbeat_ultimo_alerta", new Date().toISOString());
        _daniLog("HEARTBEAT", "alerta enviado pro Thales", { falhas: novasFalhas });
      } catch (e) {
        _daniLog("ERRO", "heartbeat: falha ao enviar alerta", { erro: String(e) });
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🧹 LIMPEZA DE PROPERTIES ÓRFÃS
// ────────────────────────────────────────────────────────────────────────────
// Cards arquivados / movidos pra fora deixam properties acumuladas.
// Esta rotina varre todas e deleta as órfãs (card não existe mais ou
// foi arquivado). Roda dentro de rotinasDiariasDani 9h30.
// ════════════════════════════════════════════════════════════════════════════

function limparPropertiesOrfas() {
  Logger.log("🧹 Limpando properties órfãs...");
  const props = getProps();
  const todas = props.getProperties();
  const cardsConhecidos = new Set();
  const cardsExistem = {};
  const PREFIXES = ["bucket_inicio_", "bucket_total_", "lembrete_",
                    "g2_pendencia_", "bloqueado_", "alvaras_chegada_",
                    "g9_ultimo_aviso_"];

  // Extrai cardIds candidatos
  Object.keys(todas).forEach(k => {
    PREFIXES.forEach(p => {
      if (k.indexOf(p) !== 0) return;
      const resto = k.substring(p.length);
      // CardId é o trecho até primeiro "_" ou "__"
      const idx1 = resto.indexOf("__"); // bucket_total_<id>__lista__bucket
      const idx2 = resto.indexOf("_");
      const cardId = (idx1 !== -1 ? resto.substring(0, idx1)
                    : (idx2 !== -1 ? resto.substring(0, idx2) : resto));
      if (cardId && cardId.length === 24) cardsConhecidos.add(cardId);
    });
  });

  Logger.log("  " + cardsConhecidos.size + " cards únicos com properties");

  let deletadas = 0, verificados = 0;
  cardsConhecidos.forEach(cardId => {
    if (cardsExistem[cardId] !== undefined) return; // cache
    verificados++;
    try {
      const r = trelloGet("/1/cards/" + cardId, { fields: "closed,id" });
      if (r.getResponseCode() === 200) {
        const c = JSON.parse(r.getContentText());
        cardsExistem[cardId] = !c.closed;
      } else if (r.getResponseCode() === 404) {
        cardsExistem[cardId] = false;
      } else {
        cardsExistem[cardId] = true; // dúvida = não deleta
      }
    } catch (e) {
      cardsExistem[cardId] = true;
    }
    Utilities.sleep(150); // rate limit
  });

  Object.keys(todas).forEach(k => {
    PREFIXES.forEach(p => {
      if (k.indexOf(p) !== 0) return;
      const resto = k.substring(p.length);
      const idx1 = resto.indexOf("__");
      const idx2 = resto.indexOf("_");
      const cardId = (idx1 !== -1 ? resto.substring(0, idx1)
                    : (idx2 !== -1 ? resto.substring(0, idx2) : resto));
      if (cardId && cardsExistem[cardId] === false) {
        props.deleteProperty(k);
        deletadas++;
      }
    });
  });

  Logger.log("✅ Limpeza concluída: " + verificados + " cards verificados, " + deletadas + " properties deletadas");
  _daniLog("LIMPEZA", "properties órfãs removidas", { verificados: verificados, deletadas: deletadas });
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 G2 follow-up de 4h (Onda 1.A — fix 25/04 madrugada)
// ────────────────────────────────────────────────────────────────────────────
// Quando funcionário comenta pedindo doc/info, Dani aplica etiqueta + email
// IMEDIATAMENTE — mas NÃO comenta no card. O comentário só vem se cliente
// não responder em 4h (regra do Thales: "se cliente não respondeu, AÍ sim
// comenta no cartão e manda novo email").
//
// Trigger: rotinaG2FollowUp4h roda a cada 1h.
// State: property "g2_pendencia_<cardId>_<etiqueta>" = JSON com timestamp_inicio,
//        mensagem original, follow_up_enviado.
// Limpa: G4 CUMPRIU/PARCIAL deleta a property — sem follow-up.
// Idempotente: marca follow_up_enviado=true após disparar (1 follow-up só).
// ════════════════════════════════════════════════════════════════════════════

function rotinaG2FollowUp4h() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(120000)) { Logger.log("⚠️ rotinaG2FollowUp4h: lock"); return; }
  try {
    // Heartbeat aproveitando o slot horário (zero overhead extra de trigger)
    try { heartbeatDani(); } catch (e) { _daniLog("ERRO", "heartbeat", { erro: String(e) }); }

    if (!daniAtiva()) {
      _daniLog("G2_4H", "DRY-RUN — pula");
      return;
    }
    const props = getProps();
    const todas = props.getProperties();
    const agora = new Date();
    let processadas = 0, disparadas = 0;

    Object.keys(todas).forEach(k => {
      if (k.indexOf("g2_pendencia_") !== 0) return;
      processadas++;
      let est;
      try { est = JSON.parse(todas[k]); } catch (e) { return; }
      if (est.follow_up_enviado) return;

      const inicio = new Date(est.timestamp_inicio);
      const horas = (agora - inicio) / (1000 * 60 * 60);
      if (horas < 4) return;

      // Extrai cardId + etiqueta da chave (cardId pode ter underscore? não — Trello id é hex)
      const resto = k.replace("g2_pendencia_", "");
      const idx = resto.indexOf("_");
      if (idx === -1) return;
      const cardId = resto.substring(0, idx);
      const etiqueta = resto.substring(idx + 1);

      try {
        const card = _danigetCardCompleto(cardId);
        if (!card) { props.deleteProperty(k); return; }

        // Se cliente já respondeu (etiqueta de pendência foi removida), limpa silencioso
        const aindaTem = (card.labels || []).some(l => (l.name || "").trim() === etiqueta);
        if (!aindaTem) {
          props.deleteProperty(k);
          _daniLog("G2_4H", "etiqueta já removida — pendência cancelada", { cardId: cardId, etiqueta: etiqueta });
          return;
        }

        const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);
        const isDoc = etiqueta === DANI_ETIQUETA_DOC;
        const emoji = isDoc ? "📄" : "💬";

        // Comenta no card (com @board)
        const textoCard = emoji + " Lembrando: " + (est.mensagem_cliente || est.resumo || "ainda preciso da sua resposta sobre o que pedimos.");
        _daniComentar(cardId, textoCard, /* marcarBoard */ true);

        // Email follow-up
        const html = _daniMontarEmailHTML({
          titulo: "Ainda aguardamos sua resposta 🍀",
          mensagem: "Olá! Aqui é a dani.ai novamente. Há cerca de 4h pedimos uma informação sobre " +
            "o seu processo, mas ainda não tivemos retorno. Pode dar uma olhadinha quando puder?\n\n" +
            "Resumo do que pedimos: " + (est.resumo || "(ver detalhes no card)"),
          cardNome: card.name,
          cardUrl: cardUrl,
          etiquetaPendencia: etiqueta,
        });
        _daniEnviarEmailCliente(card, "🍀 Ainda aguardamos: " + (est.resumo || "pendência") + " — " + card.name, html, est.mensagem_cliente);

        est.follow_up_enviado = true;
        est.timestamp_followup = new Date().toISOString();
        props.setProperty(k, JSON.stringify(est));
        disparadas++;
        _daniLog("G2_4H", "follow-up disparado (4h sem resposta)", { cardId: cardId, etiqueta: etiqueta });
        incMetrica("dani_g2_followup_4h");
      } catch (e) {
        _daniLog("ERRO", "G2_4H falha em " + k, { erro: String(e) });
      }
    });

    _daniLog("G2_4H", "varredura concluída", { processadas: processadas, disparadas: disparadas });
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 G9 — Notificação periódica de cards EM ANÁLISE NO ÓRGÃO
// ────────────────────────────────────────────────────────────────────────────
// Pra cada card com etiqueta EM ANÁLISE NO ÓRGÃO há ≥1 dia, manda email
// pro cliente avisando que o processo continua em análise.
// Cadência: 1x/dia (rodada em rotinasDiariasDani às 9h30).
// Anti-spam: property "g9_ultimo_aviso_<cardId>" guarda data ISO do último
// aviso (formato YYYY-MM-DD). Não envia 2x no mesmo dia.
// Reaproveita property "bucket_inicio_<cardId>_EM ANÁLISE NO ÓRGÃO" (Onda 4).
// ════════════════════════════════════════════════════════════════════════════

function _rotinaG9NotificarAnaliseOrgao() {
  const props = getProps();
  const todas = props.getProperties();
  const hojeISO = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const prefix = "bucket_inicio_";
  const sufixo = "_EM ANÁLISE NO ÓRGÃO";

  let processados = 0, enviados = 0;

  Object.keys(todas).forEach(k => {
    if (k.indexOf(prefix) !== 0 || k.indexOf(sufixo) === -1) return;
    const cardId = k.substring(prefix.length, k.length - sufixo.length);
    if (!cardId) return;
    processados++;

    // Pula se já avisou hoje
    const chaveAviso = "g9_ultimo_aviso_" + cardId;
    if (props.getProperty(chaveAviso) === hojeISO) return;

    const inicio = new Date(todas[k]);
    const dias = Math.floor((new Date() - inicio) / (1000 * 60 * 60 * 24));
    if (dias < 1) return; // ainda muito cedo (entrou na análise hoje)

    try {
      const card = _danigetCardCompleto(cardId);
      if (!card) return;

      const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);
      // Tenta extrair nome do solicitante e órgão da descrição (formato do form)
      const desc = card.desc || "";
      const matchSol = desc.match(/SOLICITANTE:\s*([^\n]+)/i);
      const nome = matchSol ? matchSol[1].trim() : "tudo bem";
      // Inferir órgão pela lista atual
      const listaNome = _danigetNomeLista(card.idList) || "";
      let orgao = "no órgão competente";
      if (/viabilidade/i.test(listaNome)) orgao = "na prefeitura";
      else if (/dbe/i.test(listaNome)) orgao = "na Receita Federal";
      else if (/em an[áa]lise/i.test(listaNome) || /vre/i.test(listaNome)) orgao = "na Junta Comercial";
      else if (/inscri[çc][ãa]o/i.test(listaNome)) orgao = "na prefeitura/estado";

      const mensagem =
        "Olá, " + nome + ". Eu sou a dani.ai, inteligência artificial da Trevo Legaliza. " +
        "Estou passando aqui pra avisar que consultei seu processo (" + card.name + ") " +
        "e ele permanece em análise " + orgao + " (há " + dias + " dia" + (dias === 1 ? "" : "s") + "). " +
        "Assim que houver retorno, te aviso na hora.";

      const html = _daniMontarEmailHTML({
        titulo: "Processo em análise no órgão 📋",
        mensagem: mensagem,
        cardNome: card.name,
        cardUrl: cardUrl,
      });

      const okEmail = _daniEnviarEmailCliente(card, "📋 Em análise " + orgao + " — " + card.name, html, mensagem);
      if (okEmail) {
        props.setProperty(chaveAviso, hojeISO);
        enviados++;
        incMetrica("dani_g9_aviso_analise");
      }
    } catch (e) {
      _daniLog("ERRO", "G9: falha em card " + cardId, { erro: String(e) });
    }
  });

  _daniLog("G9", "varredura concluída", { processados: processados, enviados: enviados });
}

/**
 * Remove TODOS os webhooks ativos. Use apenas em rollback / migração.
 */
function removerTodosWebhooks() {
  const r = trelloGet("/1/tokens/" + prop("TRELLO_TOKEN") + "/webhooks", {});
  if (r.getResponseCode() !== 200) { Logger.log("❌ " + r.getContentText()); return; }
  const lista = JSON.parse(r.getContentText());
  let ok = 0, fail = 0;
  lista.forEach(w => {
    const u = "https://api.trello.com/1/webhooks/" + w.id +
      "?key=" + prop("TRELLO_KEY") + "&token=" + prop("TRELLO_TOKEN");
    const resp = fetchRetry(u, { method: "delete" });
    if (resp.getResponseCode() === 200) ok++;
    else fail++;
  });
  Logger.log("Removidos: " + ok + " | Falhas: " + fail);
}

// ╔══════════════════════════════════════╗
// ║        SECRETÁRIA DANI — GMAIL       ║
// ╚══════════════════════════════════════╝

function VarrerEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log("⚠️ Varredura em andamento"); return; }
  try {
    varrerComentariosTrello();
    varrerEmailsOrgaos();
  } catch (e) { notificarErro("VarrerEmails", e); throw e; }
  finally { lock.releaseLock(); }
}

function varrerComentariosTrello() {
  const threads = GmailApp.search('from:(trello.com) is:unread subject:("mencionou você" OR "comentou")', 0, 20);
  if (threads.length === 0) return;
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (!msg.isUnread()) continue;
      try {
        const corpo = msg.getPlainBody();
        const dados = parsearEmailTrello(corpo);
        if (!dados) { msg.markRead(); continue; }
        if (ehEquipeInterna(dados.remetente)) { msg.markRead(); continue; }
        const cls = classificarComentario(dados.comentario, dados.card, dados.quadro);
        Utilities.sleep(2000);
        let status = "PENDENTE";
        let respostaDani = "";
        if (cls.autoResponder && cls.resposta && dados.cardUrl) {
          const cardId = extrairCardIdDaUrl(dados.cardUrl);
          if (cardId) {
            const textoFinal = cls.resposta + ASSINATURA_DANI;
            if (postarComentarioNoCard(cardId, textoFinal)) {
              status = "✅ DANI RESPONDEU";
              respostaDani = textoFinal;
              incMetrica("dani_comentou_cliente");
            }
          }
        }
        registrarPendencia({
          dataHora: msg.getDate(), tipo: "COMENTÁRIO CLIENTE",
          cliente: dados.remetente, quadro: dados.quadro, card: dados.card, cardUrl: dados.cardUrl,
          conteudo: dados.comentario, respostaDani: respostaDani,
          classificacao: cls.nivel, acaoSugerida: cls.acao, status
        });
        msg.markRead();
      } catch (e) { Logger.log("⚠️ Erro (mantido não lido): " + e.message); }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 G8 — Email do órgão (Onda 2 — 25/04/2026)
// ────────────────────────────────────────────────────────────────────────────
// Lê emails na label Gmail "🏛️ TRIAGEM DE ÓRGÃOS", interpreta via Claude
// e age conforme veredito:
//   • DEFERIDO        — comenta no card + email pro cliente "boa notícia"
//                       + remove etiqueta EM ANÁLISE NO ÓRGÃO
//   • INDEFERIDO      — DISCRETO: comenta marcando @leticiatonelli3 +
//                       @trevolegaliza pedindo consulta manual; email
//                       interno pra trevolegaliza@gmail.com +
//                       leticia.tonelli@trevolegaliza.com.br
//                       CLIENTE NÃO É NOTIFICADO (regra do Thales)
//   • SEM_MOVIMENTACAO — só registra; cron G9 cuida de notificar cliente
//                       periodicamente
//   • OUTRO           — registra como pendência pra equipe revisar manual
// ════════════════════════════════════════════════════════════════════════════

const DANI_ETIQUETA_ANALISE_ORGAO = "EM ANÁLISE NO ÓRGÃO";

function varrerEmailsOrgaos() {
  const nomes = ["🏛️ TRIAGEM DE ÓRGÃOS","TRIAGEM DE ÓRGÃOS","TRIAGEM DE ORGAOS"];
  let label = null;
  for (const n of nomes) { try { label = GmailApp.getUserLabelByName(n); if (label) break; } catch (e) {} }
  if (!label) return;
  const threads = label.getThreads(0, 20).filter(t => t.isUnread());
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (!msg.isUnread()) continue;
      try {
        _processarEmailOrgao(msg);
      } catch (e) {
        _daniLog("ERRO", "varrerEmailsOrgaos: exceção", { erro: String(e), assunto: msg.getSubject() });
      }
    }
  }
}

function _processarEmailOrgao(msg) {
  const corpo = msg.getPlainBody();
  const assunto = msg.getSubject();
  const remetente = msg.getFrom();

  _daniLog("ORGAO", "interpretando email", { remetente: remetente, assunto: assunto.substring(0, 100) });

  if (!daniAtiva()) {
    _daniLog("DRY-RUN", "DANI_ATIVA=false. Não processo email do órgão.");
    return;
  }

  const interp = interpretarEmailOrgao(corpo, assunto, remetente);
  if (!interp) {
    _daniLog("ORGAO", "interpretação falhou — mantém email não lido");
    return;
  }
  Utilities.sleep(2000);

  let card = null;
  if (interp.protocolo) card = buscarCardPorProtocoloViaSearch(interp.protocolo);

  _daniLog("ORGAO", "interpretado", {
    veredito: interp.veredito, orgao: interp.orgao, protocolo: interp.protocolo,
    cardEncontrado: !!card, cardId: card ? card.cardId : null,
  });

  // Sem card identificado: registra pendência manual e marca lido
  if (!card || !card.cardId) {
    registrarPendencia({
      dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
      cliente: interp.orgao || remetente,
      quadro: "NÃO IDENTIFICADO",
      card: "PROTOCOLO: " + (interp.protocolo || "N/A"),
      cardUrl: "",
      conteudo: interp.resumo, respostaDani: "",
      classificacao: "🟡 IMPORTANTE",
      acaoSugerida: "Verificar manualmente — Dani não achou card pelo protocolo.",
      status: "PENDENTE",
    });
    msg.markRead();
    return;
  }

  const cardUrl = "https://trello.com/c/" + card.cardId;

  // Roteamento por veredito
  if (interp.veredito === "DEFERIDO") {
    _agirDeferido(card, interp, msg, cardUrl);
  } else if (interp.veredito === "INDEFERIDO") {
    _agirIndeferido(card, interp, msg, corpo, cardUrl);
  } else if (interp.veredito === "SEM_MOVIMENTACAO") {
    _agirSemMovimentacao(card, interp, msg, cardUrl);
  } else {
    _agirOrgaoOutro(card, interp, msg, cardUrl);
  }

  msg.markRead();
}

function _agirDeferido(card, interp, msg, cardUrl) {
  _daniLog("ORGAO", "DEFERIDO — agindo", { cardId: card.cardId });

  // 1. Comentário no card (cliente VÊ — vai marcar @board pra notificar)
  const textoCard =
    "✅ **Boa notícia!** Recebemos confirmação do " + (interp.orgao || "órgão") +
    " — processo **DEFERIDO**.\n\n" +
    (interp.protocolo ? "📋 Protocolo: " + interp.protocolo + "\n" : "") +
    (interp.resumo ? "📝 " + interp.resumo + "\n" : "");
  _daniComentar(card.cardId, textoCard, /* marcarBoard */ true);

  // 2. Email pro cliente
  const cardCompleto = _danigetCardCompleto(card.cardId);
  if (cardCompleto && interp.mensagemCliente) {
    const html = _daniMontarEmailHTML({
      titulo: "Processo deferido! ✅",
      mensagem: interp.mensagemCliente,
      cardNome: cardCompleto.name,
      cardUrl: cardUrl,
    });
    _daniEnviarEmailCliente(cardCompleto, "✅ Deferido — " + cardCompleto.name, html, interp.mensagemCliente);
  }

  // 3. Remove etiqueta EM ANÁLISE NO ÓRGÃO (se tiver)
  if (cardCompleto) {
    _daniRemoverEtiqueta(card.cardId, cardCompleto.idBoard, DANI_ETIQUETA_ANALISE_ORGAO);
  }

  registrarPendencia({
    dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
    cliente: interp.orgao, quadro: card.quadro, card: card.card, cardUrl: cardUrl,
    conteudo: interp.resumo, respostaDani: textoCard,
    classificacao: "🟢 INFORMATIVO", acaoSugerida: "Deferimento — cliente notificado",
    status: "✅ DANI NOTIFICOU CLIENTE",
  });
  incMetrica("dani_orgao_deferido");
}

function _agirIndeferido(card, interp, msg, corpoOriginal, cardUrl) {
  _daniLog("ORGAO", "INDEFERIDO — agindo discretamente (cliente NÃO sabe)", { cardId: card.cardId });

  // 1. Comentário discreto no card marcando equipe interna (cliente vê o card mas NÃO entende)
  const textoCardDiscreto =
    "🔎 @leticiatonelli3 @trevolegaliza — favor consultar este processo manualmente. " +
    "O e-mail do órgão sobre este processo não pôde ser visualizado por completo.";
  _daniComentar(card.cardId, textoCardDiscreto, /* marcarBoard */ false);

  // 2. Email INTERNO explícito (cliente NÃO recebe nada)
  const destinatariosInternos = (getProps().getProperty("INDEFERIDO_NOTIFY_EMAILS") ||
    "trevolegaliza@gmail.com,leticia.tonelli@trevolegaliza.com.br")
    .split(/[,;]/).map(s => s.trim()).filter(validarEmail);

  const corpoEmail =
    "🚨 INDEFERIMENTO detectado em processo da Trevo Legaliza\n\n" +
    "Card: " + card.card + "\n" +
    "Quadro: " + card.quadro + "\n" +
    "Link: " + cardUrl + "\n" +
    "Órgão: " + (interp.orgao || "N/A") + "\n" +
    "Protocolo: " + (interp.protocolo || "N/A") + "\n\n" +
    "Resumo da Dani:\n" + interp.resumo + "\n\n" +
    "─── Email original do órgão ───\n" +
    (corpoOriginal || "").substring(0, 4000) + "\n\n" +
    "🍀 Dani — IA da Trevo Legaliza";

  try {
    MailApp.sendEmail({
      to: destinatariosInternos.join(","),
      subject: "🚨 INDEFERIMENTO — " + card.card,
      body: corpoEmail,
      name: "Dani 🍀 Trevo Legaliza",
    });
    _daniLog("ORGAO", "email INDEFERIDO enviado pra equipe", { destinatarios: destinatariosInternos });
  } catch (e) {
    _daniLog("ERRO", "INDEFERIDO: falha ao enviar email interno", { erro: String(e) });
  }

  registrarPendencia({
    dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
    cliente: interp.orgao, quadro: card.quadro, card: card.card, cardUrl: cardUrl,
    conteudo: interp.resumo, respostaDani: textoCardDiscreto,
    classificacao: "🔴 URGENTE", acaoSugerida: "INDEFERIMENTO — equipe deve consultar manualmente",
    status: "🚨 INDEFERIDO — EQUIPE NOTIFICADA",
  });
  incMetrica("dani_orgao_indeferido");
}

function _agirSemMovimentacao(card, interp, msg, cardUrl) {
  _daniLog("ORGAO", "SEM_MOVIMENTACAO — registra", { cardId: card.cardId });
  registrarPendencia({
    dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
    cliente: interp.orgao, quadro: card.quadro, card: card.card, cardUrl: cardUrl,
    conteudo: interp.resumo, respostaDani: "",
    classificacao: "🟢 INFORMATIVO", acaoSugerida: "Sem movimentação — cron diário cuida de notificar",
    status: "REGISTRADO",
  });
  incMetrica("dani_orgao_sem_mov");
}

function _agirOrgaoOutro(card, interp, msg, cardUrl) {
  _daniLog("ORGAO", "OUTRO — registra como pendência manual", { cardId: card.cardId });
  registrarPendencia({
    dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
    cliente: interp.orgao, quadro: card.quadro, card: card.card, cardUrl: cardUrl,
    conteudo: interp.resumo, respostaDani: "",
    classificacao: "🟡 IMPORTANTE", acaoSugerida: "Equipe revisar manualmente",
    status: "PENDENTE",
  });
  incMetrica("dani_orgao_outro");
}

function parsearEmailTrello(corpo) {
  const mUrl = corpo.match(/(https:\/\/trello\.com\/c\/[a-zA-Z0-9]+[^\s\)]*)/);
  const cardUrl = mUrl ? mUrl[1] : "";
  const mN = corpo.match(/^(.+?)\s+(?:mencionou voc|comentou)/i);
  const remetente = mN ? mN[1].trim() : "";
  const mC = corpo.match(/no cart[aã]o\s+(.+?)\s+de\s+/i);
  const card = mC ? mC[1].replace(/[_*]/g, "").trim() : "";
  const mQ = corpo.match(/no cart[aã]o\s+.+?\s+de\s+(.+?)[\n\r]/i);
  const quadro = mQ ? mQ[1].replace(/[_*]/g, "").trim() : "";
  const mCom = corpo.match(/de\s+.+?[\n\r]+([\s\S]+?)(?:Responder por email|Reply by email|$)/i);
  const comentario = mCom ? mCom[1].replace(/@\w+/g, "").replace(/\s+/g, " ").trim() : "";
  if (!card || !comentario) return null;
  return { remetente, card, quadro, comentario, cardUrl };
}

function extrairCardIdDaUrl(cardUrl) { const m = cardUrl.match(/trello\.com\/c\/([a-zA-Z0-9]+)/); return m ? m[1] : null; }
/**
 * Detecta se um nome é de funcionário interno da Trevo.
 * Lê da aba EQUIPE (se existir, fonte da verdade) ou usa EQUIPE_INTERNA constante.
 * Cache por execução pra não reler a aba toda vez.
 */
var __equipeInternaCache = null;
function getEquipeInterna() {
  if (__equipeInternaCache !== null) return __equipeInternaCache;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("EQUIPE");
    if (aba) {
      const dados = aba.getDataRange().getValues();
      const headers = dados[0].map(h => String(h).trim().toUpperCase());
      const idxNome = headers.indexOf("NOME");
      const idxAtivo = headers.indexOf("ATIVO");
      const lista = [];
      for (let i = 1; i < dados.length; i++) {
        const nome = String(dados[i][idxNome] || "").toLowerCase().trim();
        const ativo = idxAtivo >= 0 ? String(dados[i][idxAtivo] || "true").toLowerCase().trim() : "true";
        if (nome && (ativo === "true" || ativo === "sim" || ativo === "1" || ativo === "")) {
          lista.push(nome);
        }
      }
      if (lista.length > 0) {
        __equipeInternaCache = lista;
        return lista;
      }
    }
  } catch (e) { Logger.log("⚠️ getEquipeInterna fallback pra constante: " + e.message); }
  __equipeInternaCache = EQUIPE_INTERNA.slice();
  return __equipeInternaCache;
}

function ehEquipeInterna(nome) {
  const n = (nome || "").toLowerCase().trim();
  return getEquipeInterna().some(i => n.includes(i));
}

/**
 * Classifica autor de uma action Trello como "trevo" ou "cliente".
 * Considera fullName E username pra detectar override DANI_FORCAR_CLIENTE
 * (que aceita username sem @ ou parte do fullName).
 */
function _classificarAutorTrello(action) {
  const m = (action && action.memberCreator) || {};
  const fullName = String(m.fullName || "").toLowerCase().trim();
  const username = String(m.username || "").toLowerCase().trim();

  // 1) Override DANI_FORCAR_CLIENTE — bate com fullName OU username
  const forcarRaw = String(getProps().getProperty("DANI_FORCAR_CLIENTE") || "").toLowerCase();
  if (forcarRaw) {
    const lista = forcarRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const u of lista) {
      if (!u) continue;
      if (fullName.indexOf(u) !== -1) return "cliente";
      if (username.indexOf(u) !== -1) return "cliente";
      // Match parcial reverso (forçar pode ser substring do username)
      if (u.indexOf(username) !== -1 && username.length >= 3) return "cliente";
    }
  }

  // 2) Equipe interna pelo fullName
  return ehEquipeInterna(fullName) ? "trevo" : "cliente";
}

/**
 * Cria a aba EQUIPE populada com os funcionários atuais (constante EQUIPE_INTERNA)
 * + colunas extras pra Thales preencher. Idempotente: se aba existir, não sobrescreve.
 */
function MapearEquipeInterna() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName("EQUIPE");
  if (aba) {
    Logger.log("ℹ️ Aba EQUIPE já existe — não sobrescrevo. Edite manualmente.");
    return;
  }
  aba = ss.insertSheet("EQUIPE");
  aba.getRange(1, 1, 1, 4).setValues([["NOME", "USUARIO_TRELLO", "EMAIL", "ATIVO"]]);
  aba.getRange(1, 1, 1, 4).setFontWeight("bold");
  aba.setFrozenRows(1);

  const linhas = [
    ["Trevo Legaliza",  "@trevolegaliza",         "trevolegaliza@gmail.com",                   "true"],
    ["Letícia Tonelli", "@leticiatonelli3",       "leticia.tonelli@trevolegaliza.com.br",      "true"],
    ["Arthur Shiguemi", "@arthurlegalizacao",     "",                                          "true"],
    ["Abner Maliq",     "@abnermaliqdossantosjimoh", "",                                       "true"],
    ["Amanda Cristovão","@amandacristovao1",      "",                                          "true"],
    ["Carolina Guirado","@carolinaguirado7",      "",                                          "true"],
  ];
  aba.getRange(2, 1, linhas.length, 4).setValues(linhas);
  aba.autoResizeColumns(1, 4);
  __equipeInternaCache = null;
  Logger.log("✅ Aba EQUIPE criada com " + linhas.length + " funcionários. Edite a coluna ATIVO=false pra desativar alguém.");
}

function chamarClaude(p, maxTokens, modelo) {
  const modeloEfetivo = modelo || CLAUDE_MODEL;
  const payload = { model: modeloEfetivo, max_tokens: maxTokens || 500, messages: [{ role: "user", content: p }] };
  const opts = { method: "post", headers: { "x-api-key": prop("CLAUDE_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" }, payload: JSON.stringify(payload), muteHttpExceptions: true };
  for (let t = 1; t <= 3; t++) {
    const r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", opts);
    const c = r.getResponseCode();
    if (c === 200) {
      const data = JSON.parse(r.getContentText());
      let tx = data.content[0].text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return tx.replace(/[\n\r\t]/g, " ").replace(/[\x00-\x1F]/g, " ");
    }
    if (c === 529 || c === 429 || c === 503) { Utilities.sleep(5000 * t); continue; }
    throw new Error("IA " + c + ": " + r.getContentText());
  }
  throw new Error("IA indisponível");
}

function classificarComentario(com, card, quadro) {
  const p = 'Você é a Dani, secretária virtual da Trevo Legaliza.\n\nCOMENTÁRIO de cliente:\nQUADRO: ' + quadro + '\nCARD: ' + card + '\nCOMENTÁRIO: "' + com + '"\n\nClassifique em UMA: 🔴 DÚVIDA | 🟡 DOCUMENTO | 🟢 CONFIRMAÇÃO | 🔵 SOLICITAÇÃO\nPode responder sozinha? Só se: documento, confirmação, pagamento. Na dúvida NÃO.\n\nJSON: {"nivel":"🟡 DOCUMENTO","acao":"ação","autoResponder":true,"resposta":"texto ou null"}';
  try { const j = JSON.parse(chamarClaude(p)); return { nivel: j.nivel || "🔴 DÚVIDA", acao: j.acao || "Verificar manualmente", autoResponder: j.autoResponder === true, resposta: j.resposta || null }; }
  catch (e) { return { nivel: "🔴 DÚVIDA", acao: "Verificar manualmente.", autoResponder: false, resposta: null }; }
}

function interpretarEmailOrgao(corpo, assunto, remetente) {
  const p =
    'Você é a Dani, IA da Trevo Legaliza. Acabou de chegar um email\n' +
    'de um órgão público sobre um processo. Você precisa interpretar.\n\n' +
    'EMAIL:\n' +
    '  De: ' + remetente + '\n' +
    '  Assunto: ' + assunto + '\n' +
    '  Corpo:\n' + (corpo || "").substring(0, 3000) + '\n\n' +
    'EXTRAIA E CLASSIFIQUE:\n\n' +
    '1. veredito (CRÍTICO — escolha exatamente um):\n' +
    '   • DEFERIDO        — processo aprovado pelo órgão (sucesso)\n' +
    '   • INDEFERIDO      — processo recusado/exigência (problema; cliente NÃO pode saber direto)\n' +
    '   • SEM_MOVIMENTACAO — email só comunica que processo continua em análise\n' +
    '   • OUTRO           — qualquer outra coisa (esclarecimento, informativo geral)\n\n' +
    '2. protocolo: número do protocolo do processo (apenas dígitos, ou null se não tem)\n' +
    '3. orgao: nome do órgão (Junta Comercial, Receita Federal, Prefeitura, etc)\n' +
    '4. resumo: 1-2 frases descrevendo o conteúdo\n' +
    '5. mensagemCliente: SE veredito=DEFERIDO, texto curto, gentil, identificando-se como dani.ai,\n' +
    '   informando o cliente que o processo foi aprovado. Em outros casos, deixe vazio.\n\n' +
    'INSTRUÇÃO CRÍTICA DE FORMATO:\n' +
    'Sua resposta DEVE ser exclusivamente JSON válido, começando com { e terminando com }.\n' +
    'NÃO escreva nada antes ou depois. NÃO use blocos de código. NÃO comente.\n\n' +
    'Schema:\n' +
    '{"veredito":"<um dos 4>","protocolo":"<num ou null>","orgao":"<nome>","resumo":"<frase>","mensagemCliente":"<texto ou vazio>"}';

  // G8 email órgão = classificação + extração de dados → Haiku
  const j = chamarClaudeJson(p, 800, CLAUDE_MODEL_HAIKU);
  if (!j) {
    _daniLog("CLAUDE_FAIL", "interpretarEmailOrgao: retorno null", { remetente: remetente, assunto: (assunto || "").substring(0, 100) });
    return null;
  }
  if (["DEFERIDO", "INDEFERIDO", "SEM_MOVIMENTACAO", "OUTRO"].indexOf(j.veredito) === -1) {
    _daniLog("CLAUDE_FAIL", "interpretarEmailOrgao: veredito inválido", j);
    j.veredito = "OUTRO";
  }
  return {
    veredito: j.veredito,
    protocolo: j.protocolo || null,
    orgao: j.orgao || remetente,
    resumo: j.resumo || assunto,
    mensagemCliente: j.mensagemCliente || "",
  };
}

function buscarCardPorProtocoloViaSearch(protocolo) {
  const p = String(protocolo).replace(/[^0-9]/g, "");
  if (p.length < 5) return null;
  const r = trelloGet("/1/search", { query: p, modelTypes: "cards", cards_limit: "10", card_fields: "name,idBoard,shortLink", board_fields: "name" });
  if (r.getResponseCode() !== 200) return null;
  const data = JSON.parse(r.getContentText());
  if (!data.cards || data.cards.length === 0) return null;
  const c = data.cards[0];
  const bn = (data.boards || []).find(b => b.id === c.idBoard)?.name || "?";
  return { cardId: c.id, card: c.name, quadro: bn };
}

function postarComentarioNoCard(cardId, texto) {
  const r = trelloPost("/1/cards/" + cardId + "/actions/comments", { text: texto });
  return r.getResponseCode() === 200;
}

// =============================================
// PENDÊNCIAS — 12 colunas (inclui texto Dani + link + revisão Thales)
// =============================================
function registrarPendencia(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName("PENDÊNCIAS");
  if (!aba) {
    aba = ss.insertSheet("PENDÊNCIAS");
    aba.getRange(1, 1, 1, 12).setValues([[
      "DATA/HORA","TIPO","CLIENTE/REMETENTE","QUADRO","CARD","LINK CARD",
      "CONTEÚDO ORIGINAL","RESPOSTA DA DANI","CLASSIFICAÇÃO","AÇÃO SUGERIDA","STATUS","REVISADO POR THALES"
    ]]);
    aba.getRange(1, 1, 1, 12).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  aba.insertRowAfter(1);
  aba.getRange(2, 1, 1, 12).setValues([[
    d.dataHora, d.tipo, d.cliente, d.quadro, d.card, d.cardUrl || "",
    d.conteudo, d.respostaDani || "", d.classificacao, d.acaoSugerida, d.status, ""
  ]]);
  const r = aba.getRange(2, 1, 1, 12);
  if (d.classificacao.includes("🔴")) r.setBackground("#FCEBEB");
  else if (d.classificacao.includes("🟡")) r.setBackground("#FAEEDA");
  else if (d.classificacao.includes("🔵")) r.setBackground("#E6F1FB");
  else r.setBackground("#EAF3DE");
}

function TestarVarredura() { VarrerEmails(); }

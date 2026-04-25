// =============================================
// AUTOMAÇÃO TREVO LEGALIZA 🍀
// Google Forms → Drive → Trello + Secretária Dani
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
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
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
 * Tolerante a respostas com markdown wrap.
 */
function chamarClaudeJson(prompt, maxTokens) {
  try {
    const txt = chamarClaude(prompt, maxTokens || 600);
    // chamarClaude já remove ```json e \n,\r,\t. Tenta parsear direto.
    return JSON.parse(txt);
  } catch (e) {
    Logger.log("⚠️ Claude não retornou JSON válido: " + e.message);
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
    'Um funcionário interno acabou de comentar num card do Trello. Você precisa\n' +
    'classificar a intenção do comentário pra decidir se aplica etiqueta de\n' +
    'pendência (e notifica o cliente) ou só repassa atualização.\n\n' +
    'CONTEXTO DO CARD:\n' +
    '  Nome: ' + (contexto.cardNome || "?") + '\n' +
    '  Lista atual: ' + (contexto.listaNome || "?") + '\n' +
    '  Etiquetas atuais: ' + (contexto.etiquetas.join(", ") || "(nenhuma)") + '\n\n' +
    'COMENTÁRIO DO FUNCIONÁRIO (' + (contexto.autor || "?") + '):\n' +
    '"' + (textoComentario || "").substring(0, 1500) + '"\n\n' +
    'CLASSIFIQUE EM EXATAMENTE UMA AÇÃO:\n' +
    '  • SOLICITA_DOC      — funcionário pediu documento/arquivo do cliente\n' +
    '  • SOLICITA_RESPOSTA — funcionário pediu confirmação/resposta/info do cliente\n' +
    '  • ATUALIZA_STATUS   — funcionário só atualizou andamento (ex: "viabilidade transmitida pelo protocolo X", "DBE deferido")\n' +
    '  • OUTRO             — anotação interna, fofoca, sem ação pro cliente\n\n' +
    'COMPONHA A MENSAGEM PARA O CLIENTE (se aplicável):\n' +
    '  • Tom: gentil, profissional, direto, breve. Cliente é contador (intermediário).\n' +
    '  • Sempre se identifique no início como "dani.ai".\n' +
    '  • Se SOLICITA_DOC ou SOLICITA_RESPOSTA: peça com clareza o que é necessário.\n' +
    '  • Se ATUALIZA_STATUS: comunique com naturalidade o que aconteceu.\n' +
    '  • Se OUTRO: deixe mensagemCliente vazia.\n\n' +
    'RESPONDA EM JSON puro (sem markdown). Schema:\n' +
    '{"acao":"SOLICITA_DOC|SOLICITA_RESPOSTA|ATUALIZA_STATUS|OUTRO","resumo":"frase curta do que foi pedido/atualizado","mensagemCliente":"texto pro cliente ou string vazia"}';

  const j = chamarClaudeJson(prompt, 800);
  if (!j || DANI_NIVELS.indexOf(j.acao) === -1) {
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
  const cardId = (action.data && action.data.card && action.data.card.id) || "";
  const tipoAutor = ehEquipeInterna(autor) ? "trevo" : "cliente";

  Logger.log("  💬 comentário " + tipoAutor + " (" + autor + "): " + texto.substring(0, 100));

  // Skip: comentário da própria Dani (loop guard)
  if (texto.indexOf(ASSINATURA_DANI.trim().substring(5, 25)) !== -1) {
    return _respJson({ ok: true, ignored: "self_comment" });
  }

  // Idempotência
  if (_jaProcessadoAcao(action.id)) {
    return _respJson({ ok: true, ignored: "ja_processado" });
  }

  if (!cardId) return _respJson({ ok: false, error: "card_id ausente" });

  // ── G2: funcionário comenta ──────────────────────────────────────────
  if (tipoAutor === "trevo") {
    return _danihandlerG2(action, cli, texto, autor, cardId);
  }

  // ── G4: cliente comenta — Onda 1.B implementa ────────────────────────
  Logger.log("    [G4] Onda 1.B implementa resposta de cliente");
  return _respJson({ ok: true, handler: "comentario_cliente", _todo: "Onda 1.B" });
}

function _danihandlerG2(action, cli, texto, autor, cardId) {
  // Busca contexto completo do card
  const card = _danigetCardCompleto(cardId);
  if (!card) {
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

  // Modo dry-run: só loga o que faria
  if (!daniAtiva()) {
    Logger.log("    [DRY-RUN] DANI_ATIVA=false. Não chamo Claude nem ajo.");
    Logger.log("    Contexto que iria pra IA: " + JSON.stringify(contexto));
    return _respJson({ ok: true, dry_run: true, contexto: contexto });
  }

  // Classifica via Claude
  const cls = _classificarComentarioFuncionario(texto, contexto);
  if (!cls) {
    Logger.log("    ⚠️ Classificação falhou — ignorando");
    incMetrica("dani_classificacao_falha");
    return _respJson({ ok: false, error: "classificacao_falha" });
  }

  Logger.log("    🧠 Claude classificou: " + cls.acao + " — " + (cls.resumo || ""));
  incMetrica("dani_classificou_" + cls.acao);

  const cardUrl = card.shortUrl || ("https://trello.com/c/" + cardId);

  // ── Aplica ação conforme classificação ────────────────────────────────
  if (cls.acao === "SOLICITA_DOC") {
    _daniAplicarEtiqueta(cardId, card.idBoard, DANI_ETIQUETA_DOC);
    if (cls.mensagemCliente) {
      const html = _daniMontarEmailHTML({
        titulo: "Pendência no seu processo 🍀",
        mensagem: cls.mensagemCliente,
        cardNome: card.name,
        cardUrl: cardUrl,
        etiquetaPendencia: DANI_ETIQUETA_DOC,
      });
      _daniEnviarEmailCliente(card, "🍀 " + (cls.resumo || "Documento pendente") + " — " + card.name, html, cls.mensagemCliente);
      _daniComentar(cardId, "📄 " + cls.mensagemCliente, /* marcarBoard */ true);
    }
    return _respJson({ ok: true, acao: cls.acao, etiqueta_aplicada: DANI_ETIQUETA_DOC });
  }

  if (cls.acao === "SOLICITA_RESPOSTA") {
    _daniAplicarEtiqueta(cardId, card.idBoard, DANI_ETIQUETA_RESP);
    if (cls.mensagemCliente) {
      const html = _daniMontarEmailHTML({
        titulo: "Precisamos de uma resposta sua 🍀",
        mensagem: cls.mensagemCliente,
        cardNome: card.name,
        cardUrl: cardUrl,
        etiquetaPendencia: DANI_ETIQUETA_RESP,
      });
      _daniEnviarEmailCliente(card, "🍀 " + (cls.resumo || "Resposta pendente") + " — " + card.name, html, cls.mensagemCliente);
      _daniComentar(cardId, "💬 " + cls.mensagemCliente, /* marcarBoard */ true);
    }
    return _respJson({ ok: true, acao: cls.acao, etiqueta_aplicada: DANI_ETIQUETA_RESP });
  }

  if (cls.acao === "ATUALIZA_STATUS") {
    if (cls.mensagemCliente) {
      const html = _daniMontarEmailHTML({
        titulo: "Atualização do seu processo 🍀",
        mensagem: cls.mensagemCliente,
        cardNome: card.name,
        cardUrl: cardUrl,
      });
      _daniEnviarEmailCliente(card, "🍀 Atualização — " + card.name, html, cls.mensagemCliente);
      // Comentário ATUALIZA_STATUS no card é redundante (funcionário já comentou).
      // Só emails. Cliente recebe a tradução.
    }
    return _respJson({ ok: true, acao: cls.acao });
  }

  // OUTRO: nada
  return _respJson({ ok: true, acao: "OUTRO", silencio: true });
}

// ─── Outros handlers (stubs) — implementação em ondas seguintes ────────────

function handlerEtiquetaAdd(action, cli) {
  const label = (action.data && action.data.label && action.data.label.name) || "";
  Logger.log("  🏷️  etiqueta adicionada: " + label);
  return _respJson({ ok: true, handler: "etiqueta_add", label: label, _todo: "Onda 4 (cálculo de prazo)" });
}

function handlerEtiquetaRemove(action, cli) {
  const label = (action.data && action.data.label && action.data.label.name) || "";
  Logger.log("  🚫 etiqueta removida: " + label);
  return _respJson({ ok: true, handler: "etiqueta_remove", label: label, _todo: "Onda 4 (cálculo de prazo)" });
}

function handlerCardAtualizado(action, cli) {
  const before = action.data.listBefore;
  const after  = action.data.listAfter;
  if (before && after) {
    Logger.log("  ↔️  card movido: '" + before.name + "' → '" + after.name + "'");
    return _respJson({ ok: true, handler: "card_movido", from: before.name, to: after.name, _todo: "Onda 3 (regras por lista)" });
  }
  return _respJson({ ok: true, ignored: "updateCard sem mudança de lista" });
}

function handlerAnexo(action, cli) {
  const attachment = action.data && action.data.attachment;
  Logger.log("  📎 anexo adicionado: " + (attachment ? attachment.name : "?"));
  return _respJson({ ok: true, handler: "anexo", _todo: "Onda 1.B" });
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

/**
 * Decide se manda email hoje para este card.
 * Regras:
 *   Dias 1-5: diário
 *   Dias 6-10: dia sim, dia não
 *   Dia 11+: avisa Thales uma vez e para
 * Conta dia a partir do primeiro envio registrado.
 * Reset se etiqueta sair (o histórico morre por expiração de Property).
 */
function processarLembreteCard(card, codigoCliente, emailsLembretes, emailBloqueado, forcarPrimeiro) {
  const props = PropertiesService.getScriptProperties();
  const chaveCard = "lembrete_" + card.id;
  const estadoRaw = props.getProperty(chaveCard);
  const estado = estadoRaw ? JSON.parse(estadoRaw) : { primeiroEnvio: null, ultimoEnvio: null, tentativas: 0, abandonado: false };

  if (estado.abandonado) return false;

  const hoje = new Date();
  const hojeISO = Utilities.formatDate(hoje, Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Calcula dia número (1 = primeiro envio)
  let diaNumero = 1;
  if (estado.primeiroEnvio) {
    const primeiro = new Date(estado.primeiroEnvio + "T00:00:00");
    const diffMs = hoje.getTime() - primeiro.getTime();
    diaNumero = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  }

  // Regras de escalonamento
  let deveMandarHoje = false;
  let abandonarAgora = false;
  if (!estado.primeiroEnvio || forcarPrimeiro) {
    deveMandarHoje = true;
    diaNumero = 1;
  } else if (diaNumero <= 5) {
    deveMandarHoje = estado.ultimoEnvio !== hojeISO;
  } else if (diaNumero <= 10) {
    // dia sim, dia não a partir do dia 6 (par sim, ímpar não, relativo ao primeiro)
    const dpar = (diaNumero - 5) % 2 === 1;
    deveMandarHoje = dpar && estado.ultimoEnvio !== hojeISO;
  } else {
    // dia 11+: Thales é avisado, Dani para
    abandonarAgora = true;
  }

  if (abandonarAgora) {
    avisarThalesAbandono(card, codigoCliente, estado.tentativas);
    estado.abandonado = true;
    props.setProperty(chaveCard, JSON.stringify(estado));
    return false;
  }

  if (!deveMandarHoje) return false;

  // Descobre destinatários
  const destinatarios = [];
  if (emailsLembretes) {
    String(emailsLembretes).split(/[,;]/).map(s => s.trim()).filter(validarEmail).forEach(e => {
      if (String(emailBloqueado || "").split(/[,;]/).map(s => s.trim().toLowerCase()).indexOf(e.toLowerCase()) === -1) {
        destinatarios.push(e);
      }
    });
  }

  // Fallback: extrai email do corpo do card se não há EMAIL_LEMBRETES
  if (destinatarios.length === 0) {
    const emailCard = extrairEmailDoCardDesc(card.desc || "");
    if (emailCard && String(emailBloqueado).toLowerCase() !== emailCard.toLowerCase()) destinatarios.push(emailCard);
  }

  if (destinatarios.length === 0) {
    Logger.log("⚠️ Nenhum destinatário pra card " + card.id);
    return false;
  }

  // Busca email de comentário do card (pra CC — resposta vira comentário automático)
  const emailCardTrello = getEmailDoCard(card.id);

  // Monta e envia email
  const etiquetas = (card.labels || []).map(l => l.name).filter(Boolean);
  const enviou = enviarEmailLembrete({
    destinatarios: destinatarios,
    emailCardTrello: emailCardTrello,
    cardNome: card.name,
    cardUrl: card.shortUrl,
    etiquetas: etiquetas,
    codigoCliente: codigoCliente,
    diaNumero: diaNumero,
  });

  if (enviou) {
    if (!estado.primeiroEnvio) estado.primeiroEnvio = hojeISO;
    estado.ultimoEnvio = hojeISO;
    estado.tentativas = (estado.tentativas || 0) + 1;
    props.setProperty(chaveCard, JSON.stringify(estado));
    registrarLembrete({ cardId: card.id, cardNome: card.name, cardUrl: card.shortUrl, codigo: codigoCliente, destinatarios: destinatarios.join(", "), tentativa: estado.tentativas, etiquetas: etiquetas.join(", ") });
  }
  return enviou;
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
  const diaTxt = opts.diaNumero === 1 ? "Novo lembrete" : "Lembrete — dia " + opts.diaNumero;
  const assunto = "🍀 " + diaTxt + " — Pendência no processo " + opts.cardNome;

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0d1310;color:#f2f2f2;">' +
      '<div style="background:linear-gradient(135deg,#0d1310 0%,#1a3d26 100%);padding:32px 28px;text-align:center;">' +
        '<img src="' + LOGO_TREVO_URL + '" alt="Trevo Legaliza" style="height:56px;margin-bottom:12px;" />' +
        '<h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:0.3px;">Pendência no seu processo 🍀</h1>' +
      '</div>' +
      '<div style="background:#fff;color:#2d2d2d;padding:32px 28px;">' +
        '<p style="font-size:16px;margin:0 0 16px;">Olá! Aqui é a <strong>Dani</strong>, IA da Trevo Legaliza.</p>' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">' +
          'Identifiquei que o processo abaixo está com uma ou mais <strong>pendências</strong> esperando ação. ' +
          'Enquanto a etiqueta não for resolvida, vou lembrar você por aqui.' +
        '</p>' +
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
  const handlers = ["sincronizarBoardsETrevoDani"];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Cria trigger diário 8h
  ScriptApp.newTrigger("sincronizarBoardsETrevoDani")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log("✅ Trigger sincronizarBoardsETrevoDani criado (diário 8h).");
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
        const interp = interpretarEmailOrgao(msg.getPlainBody(), msg.getSubject(), msg.getFrom());
        Utilities.sleep(2000);
        let card = null;
        if (interp.protocolo) card = buscarCardPorProtocoloViaSearch(interp.protocolo);
        let respostaDani = "";
        let cardUrl = "";
        if (card && card.cardId) {
          cardUrl = "https://trello.com/c/" + card.cardId;
          const t = "📧 **Atualização do Órgão Público**\n\n🏛️ **Órgão:** " + (interp.orgao || "N/I") +
            "\n📋 **Protocolo:** " + (interp.protocolo || "N/A") + "\n\n📝 **Resumo:** " + interp.resumo +
            "\n\n⚡ **Ação necessária:** " + interp.acao + ASSINATURA_DANI;
          if (postarComentarioNoCard(card.cardId, t)) {
            respostaDani = t;
            incMetrica("dani_comentou_orgao");
          }
        }
        registrarPendencia({
          dataHora: msg.getDate(), tipo: "E-MAIL ÓRGÃO",
          cliente: interp.orgao || msg.getFrom(),
          quadro: card ? card.quadro : "NÃO IDENTIFICADO",
          card: card ? card.card : "PROTOCOLO: " + (interp.protocolo || "N/A"),
          cardUrl: cardUrl,
          conteudo: interp.resumo, respostaDani: respostaDani,
          classificacao: interp.nivel, acaoSugerida: interp.acao,
          status: card ? "✅ DANI POSTOU NO CARD" : "PENDENTE"
        });
        msg.markRead();
      } catch (e) { Logger.log("⚠️ Erro órgão (mantido): " + e.message); }
    }
  }
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
  // Override de teste: usuários listados em DANI_FORCAR_CLIENTE NUNCA são equipe interna.
  // Útil pra simular fluxo cliente em board de teste sem ter conta Trello externa.
  // Formato: "carolinaguirado7,outrouser" (sem @, separados por vírgula).
  const forcarRaw = getProps().getProperty("DANI_FORCAR_CLIENTE") || "";
  if (forcarRaw) {
    const lista = forcarRaw.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (lista.some(u => n.indexOf(u) !== -1)) {
      return false;
    }
  }
  return getEquipeInterna().some(i => n.includes(i));
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

function chamarClaude(p, maxTokens) {
  const payload = { model: CLAUDE_MODEL, max_tokens: maxTokens || 500, messages: [{ role: "user", content: p }] };
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
  const p = 'Você é a Dani, secretária virtual da Trevo Legaliza.\n\nE-MAIL de órgão:\nREMETENTE: ' + remetente + '\nASSUNTO: ' + assunto + '\nCORPO:\n' + corpo.substring(0, 3000) + '\n\nJSON: {"protocolo":"num ou null","resumo":"1-2 frases","nivel":"🟡 IMPORTANTE | 🟢 INFORMATIVO | 🔴 URGENTE","acao":"ação","orgao":"nome"}';
  try { const j = JSON.parse(chamarClaude(p)); return { protocolo: j.protocolo || null, resumo: j.resumo || "N/A", nivel: j.nivel || "🟡 IMPORTANTE", acao: j.acao || "Verificar.", orgao: j.orgao || remetente }; }
  catch (e) { return { protocolo: null, resumo: assunto, nivel: "🟡 IMPORTANTE", acao: "Verificar manualmente.", orgao: remetente }; }
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

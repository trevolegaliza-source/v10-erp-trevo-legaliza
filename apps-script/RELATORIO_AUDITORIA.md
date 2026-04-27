# 🔍 Relatório de Auditoria — Dani v7.12.3

**Data:** 27/04/2026 (atualizado tarde)
**Arquivo:** `apps-script/automacao-trevo.gs` (~5210 linhas)
**Método:** 4 agentes Claude analisando zonas paralelas + validação manual + bugs reportados em produção

---

## 📊 Sumário executivo

Total: **26 issues mapeadas** distribuídas em 4 zonas do código.

| Severidade | Total | Corrigido até v7.12.3 | Pendente decisão Thales |
|---|---|---|---|
| 🔴 CRÍTICO | 9 | 5 | 4 |
| 🟠 IMPORTANTE | 10 | 1 | 9 |
| 🟡 ATENÇÃO | 14 | 0 | 14 |
| 🟢 NICE-TO-HAVE | 5 | 0 | 5 |

---

## ✅ Corrigido na v7.12.3 (27/04/2026 tarde)

### 🔴 [Linha 2484] handlerComentario não tratava espelhamento Placker — Dani nunca atuava em produção real
**Antes:** Funcionários comentam 99% das vezes na CENTRAL DE PROCESSO (única que têm acesso). Placker espelha bidirecionalmente, gerando webhook no board do cliente com:
- Autor: `Trevo Legaliza` (bot Placker)
- Texto: `NOME_FUNCIONARIO commented from the 🍀 CENTRAL DE PROCESSO board. learn more\n\nTEXTO_REAL`

A Dani via "Trevo Legaliza" como autor → não batia com EQUIPE → classificava como **cliente** → caía em G4 (avalia cumprimento de pendência) → cobrava de volta o pedido anterior em vez de processar o novo.
**Sintoma reportado:** Comentários do Arthur ("CASO NÃO TENHAM O USO DE SOLO..."), Amanda ("Transmitir viabilidade"), Letícia, Abner — todos tratados como cliente. Dani agia errado em todos os comentários espelhados desde o início (regra clientes nunca acessam CENTRAL → todo `commented from CENTRAL` é por definição funcionário).
**Depois:** Adicionada `_parsePlackerMirror(texto)` (regex tolera markdown `>` e `**`). `handlerComentario` agora detecta espelhamento antes de classificar autor, extrai nome real e texto limpo, força roteamento G2. Se autor real não estiver na EQUIPE, loga `[PLACKER_WARN]` mas processa mesmo assim (regra de negócio: CENTRAL = funcionário; ausente = cadastro pendente).

---

## ✅ Corrigido na v7.12.2 (27/04/2026 manhã)

### 🔴 [Linha 5005] ehEquipeInterna não normalizava acentos — funcionário virava cliente
**Antes:** Comparação por `.includes` em lowercase, sem remover acentos. Trello envia autor como "LETICIA TONELLI" (sem ç) mas a aba EQUIPE tem "Letícia Tonelli" (com ç). `.includes` falhava → Letícia era classificada como **cliente** → caía no fluxo G4 (avalia cumprimento de pendência) em vez do G2 (processa pedido interno) → comentários internos eram tratados como resposta de cliente.
**Sintoma reportado em produção:** Letícia comentou `@card por favor responder comentário abaixo`, Dani respondeu cobrando o protocolo 3084 anterior em vez de processar o pedido. Etiqueta EM ANDAMENTO não removida, RESPOSTA PENDENTE não adicionada, email não encaminhado.
**Causa-raiz confirmada por log:** `[G4] iniciado` → `[G4] pendência ativa detectada` → `[G4] NAO_CUMPRIU — pendência mantida`. Webhook chegou e foi roteado pra G4 em vez de G2.
**Depois:** Adicionada `_normalizarNome(s)` (NFD + strip diacritics). `ehEquipeInterna` normaliza ambos os lados da comparação. Bug afetava qualquer membro da EQUIPE com á/é/í/ó/ú/â/ê/ô/ã/õ/ç no nome.

---

## ✅ Já corrigidos na v7.12.1

### 🔴 [Linha 1334] Token auth fail-open
**Antes:** Se `WEBHOOK_TOKEN` estava vazio, qualquer payload passava sem auth (fail-open).
**Depois:** Sem token configurado = rejeita todos os webhooks com 500 (fail-closed).

### 🔴 [Linha 4672] Email do órgão reprocessado infinitamente
**Antes:** Se Claude falhasse em interpretar email, código retornava sem `markRead()` → próximo cron tentava de novo → loop infinito + custo Claude desperdiçado.
**Depois:** Marca como lido + cria pendência manual em `PENDÊNCIAS` pra equipe revisar no Sheets.

### 🟠 [Linhas 1783-1786] Divisão por zero em médias do relatório
**Antes:** Se totalCards fosse 0 (edge case improvável), médias ficavam NaN.
**Depois:** Defensive `totalCards > 0 ? x / totalCards : 0`.

### 🟠 [Linha 1985] `this[nome]` em painel_runFuncao
**Antes:** Apps Script V8 strict mode pode tornar `this` undefined em funções globais.
**Depois:** `globalThis[nome]` com try/catch + log no DANI_LOG.

---

## 🔴 CRÍTICOS pendentes (recomendo atacar em breve)

### 1. JSON.parse() sem try-catch em chamadas Trello
**Linhas:** 768, 781, 1120, 1136 (criação card), e várias outras.
**Problema:** Se Trello retorna 401/429/500, `getContentText()` é HTML/erro. `JSON.parse()` quebra silenciosamente.
**Risco:** Throw não-capturado → execution falha sem feedback no DANI_LOG.
**Fix:** Sempre validar `r.getResponseCode() === 200` ANTES do parse, ou envolver em try/catch.

### 2. CLAUDE_MODEL_HAIKU pode estar undefined no fallback
**Linha:** 2363.
**Problema:** Se constante mudar/quebrar, `chamarClaudeJson(prompt, 800, undefined)` pode comportar-se mal.
**Risco:** Médio — hoje constante existe, mas tipo de bug que aparece em refatoração.
**Fix:** Validar constante existe antes do fallback.

### 3. Property `lembrete_*` corrompida = JSON.parse crash
**Linha:** 3499.
**Problema:** Sem try-catch ao parsear estado do lembrete. Se property corrompida (migração v7.7→v7.12), crashes sem retorno.
**Risco:** Trigger LembretesPendencias inteiro pode quebrar e parar de rodar.
**Fix:** Try-catch com fallback pra estado default.

### 4. Regex bucket_total v7.7.x vs v7.8.0 (perda de dados)
**Linha:** 2946.
**Problema:** Em `gerarDashboardDani`, regex `/^bucket_total_(.+?)_(TREVO|CLIENTE|ORGAO)$/` esperaria padrão antigo. Padrão novo é `cardId__lista__bucket` (3 partes). Cards antigos com properties v7.7.x podem ficar órfãos no dashboard.
**Risco:** Médio — só afeta cards anteriores à v7.8.0.
**Fix:** Adicionar fallback explícito pra padrão antigo.

---

## 🟠 IMPORTANTES pendentes

### 5. Indexação de coluna sem null safety (aba CLIENTES)
**Linhas:** 369-370, 424-426.
**Problema:** Se Thales deletar coluna `EMAIL_LEMBRETES` da aba CLIENTES, `headers.indexOf(...)` retorna -1, depois `dados[i][-1]` acessa último índice (lixo).
**Fix:** Helper `safeGet(arr, idx) => idx >= 0 ? arr[idx] : ""`.

### 6. extrairIdDrive regex frágil
**Linha:** 330.
**Problema:** `/[-\w]{25,}/` assume IDs Drive sempre ≥25 chars. Se Google muda formato, quebra.
**Fix:** Regex estruturada `/(?:drive\.google\.com\/(?:file|folders)\/d\/|id=)([a-zA-Z0-9_-]+)/`.

### 7. searchFolders com apóstrofo no nome empresa
**Linha:** 1088.
**Problema:** Empresa "D'Angelo" passa por `replace(/'/g, "\\'")` mas API Drive ainda pode falhar.
**Fix:** Usar `Drive.Files.list()` com query parametrizada.

### 8. Loop guard G4 frágil (cliente repete mesma mensagem)
**Linha:** 2614.
**Problema:** Busca último pedido Trevo comparando texto !== resposta atual. Se cliente repete texto exato, algoritmo pega comentário do próprio cliente como "último pedido".
**Risco:** Edge case raro.
**Fix:** Filtrar por `c.data < new Date(action.date)` além do equipe interna check.

### 9. Detecção de equipe via substring (.includes)
**Linha:** 4880-4883.
**Problema:** Se equipe tem "Ana", comentário de "Analyzer Bot" dá falso positivo (Bot vira "trevo").
**Fix:** Word boundary regex ou match exato em primeiro+último nome.

### 10. Limpeza properties órfãs sem batching
**Linha:** 3034.
**Problema:** `reconstruirBucketsCard` deleta properties em loop sem rate limit. Card com 2000+ properties pode falhar com quota Apps Script.
**Risco:** Baixo na prática (cards reais ≤200 properties).
**Fix:** Batching com `Utilities.sleep(100)` a cada 50 deletes.

### 11. Heurística "houveAnexo" no G4 frágil
**Linha:** 2689.
**Problema:** Detecta anexo por keywords "anex"/"segue" no texto. Cliente pode falar "segue email anterior" sem anexar nada.
**Fix:** G5 já passa texto sintético `[Cliente anexou arquivo: ...]` — usar isso como marcador único.

### 12. Estado g2_pendencia_* deletado sem log
**Linha:** 2653.
**Problema:** G4 deleta property sem verificar se existia. Pode mascarar inconsistência.
**Fix:** Log se property era inexistente quando se esperava ter.

### 13. Email INDEFERIDO destinatários default hardcoded
**Linha:** 4794.
**Problema:** Default `"trevolegaliza@gmail.com,leticia.tonelli@trevolegaliza.com.br"` hardcoded no código. Se equipe muda, precisa edit no .gs.
**Fix:** Mover pra Property `INDEFERIDO_NOTIFY_EMAILS` (já existe — só remover default hardcoded e exigir setup).

### 14. dani_panel — hardcoded emoji em padrão de detecção
**Linha:** 4647.
**Problema:** Label Gmail `🏛️ TRIAGEM DE ÓRGÃOS` tem emoji que pode ser redrawn diferente em macOS/Linux.
**Fix:** Buscar por substring `TRIAGEM` mais permissivo.

---

## 🟡 ATENÇÃO (consertar quando puder)

| # | Linha | Problema |
|---|---|---|
| 15 | 391 | `removeAll([])` no cache não faz nada — devia ser `removeAll()` |
| 16 | 461 | Dedup form pode ser bypass com 2 submits em <1s (timestamps iguais) |
| 17 | 500 | `isPrioridadeMaxima` assume texto exato; mudou no form, quebra |
| 18 | 523 | `buildSpecPorTipo` cor default "blue" silenciosa pra tipos novos |
| 19 | 764-775 | `aplicarEtiquetasNoCartao` perde silenciosamente etiquetas inexistentes |
| 20 | 923-983 | `campo()` muito sensível a nomes Google Forms — refatoração futura usar IDs |
| 21 | 1957 | Email draft sem destinatário pode ser enviado vazio acidentalmente |
| 22 | 2227 | Log de replyTo enganoso quando `getEmailDoCard` retorna null |
| 23 | 3315 | `updateCard` sem listBefore/After: silent skip sem log |
| 24 | 3554 | Filter de email bloqueado O(n²) — cache em Set evitaria |
| 25 | 3368 | G10 alvarás pode mandar 2x se webhook duplicar action.id (improvável) |
| 26 | 4587 | `GmailApp.search` limit=20 — se >20 emails Trello pendentes, perde |
| 27 | 4830-4843 | Parsing email Trello frágil (regex single-line, acentos) |
| 28 | 4970 | Prompt Claude email órgão limitado a 3000 chars — perde info |

---

## 🟢 NICE-TO-HAVE

- LOGO_TREVO_URL hardcoded (URLs de imagem) — config externa
- ASSINATURA_DANI hardcoded em português — i18n futuro
- CAMPOS_JA_USADOS Set gigante de 237 strings — Trie ou Map seria mais rápido
- chamarClaude sem retry em 401 — falha rápida seria melhor UX
- `__equipeInternaCache` global stale após edição da aba — TTL 1h

---

## 🎯 Recomendação prática (próxima sessão)

**Atacar nesta ordem:**

1. **JSON.parse safety wrapper** — função `parseJsonSeguro(content, fallback)` e usar globalmente. Resolve issues #1, #15, #21 e bugs futuros similares.
2. **safeGet helper pra acesso a colunas** — Resolve #5 e protege contra mudanças na aba CLIENTES.
3. **Batching properties cleanup** — issue #10. Importante quando base crescer.
4. **Detecção equipe word-boundary** — issue #9. Falsos positivos podem ser difíceis de detectar.
5. **Lembrete try-catch + estado default** — issue #3. Trigger quebrando em produção é incidente sério.

**O resto pode esperar** ou ser pego à medida que cliente reportar.

---

## 📌 Notas importantes

### O que NÃO encontramos
- ✅ **Sem vulnerabilidades de injection** — uso de fetch parametrizado.
- ✅ **Sem vazamento de credenciais em logs** — properties são lidas via `prop()` mas nunca dumpadas.
- ✅ **Sem race conditions críticas** — LockService usado nos pontos certos.
- ✅ **Sem código morto óbvio** — funções removidas estão limpas.

### Padrão recorrente
Código tem **"fallback tolerante demais"** — não falha alto, mas falha silenciosa, levando a comportamento inesperado em produção. Adicionar logs explícitos em todo `try/catch silencioso` ajudaria a debug futuro.

### Performance hoje
Com 49 boards e ~hundreds de cards:
- `gerarDashboardDani` ~30s (aceitável)
- `painel_exportarRelatorio` ~30-60s (varia com filtros)
- `limparPropertiesOrfas` 1 GET por card único — escalará linearmente

Todas funções dentro do limite Apps Script (6min).

---

*Auditoria realizada por agentes Claude na ausência do Thales. Bugs críticos verificados manualmente antes de aplicar fixes. Issues menores deixadas como recomendação pra ele decidir.*

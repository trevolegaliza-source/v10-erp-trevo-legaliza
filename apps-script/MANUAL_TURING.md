# 🧭 Guia Rápido Pra Thales — Apps Script Trevo v6.0

Bem-vindo! Este manual é pra quando você precisar mexer no Apps Script sem medo. Sem jargão técnico, só resposta direta.

---

## 1. O QUE ESSE SCRIPT FAZ

**A ideia principal:** Quando um cliente envia um formulário Google, o script faz três coisas automaticamente:

1. **Cria um card no Trello** com todos os detalhes do processo (cliente, urgência, tipo de serviço)
2. **Cria uma pasta no Google Drive** pra armazenar documentos do cliente
3. **Manda um email de confirmação** pro cliente avisando que recebemos

**Além disso, o script:**
- Tem uma "Secretária Virtual" chamada **Dani** que lê emails e comentários no Trello, entende o que é importante e posta mensagens úteis nos cards
- **Manda lembretes automáticos** toda manhã (9h) pra cards que estão pendentes — se ninguém mexer, manda 2ª vez mais forte, depois aviso de risco de abandono
- **Coleta métricas** — quantos processos, quantos lembretes, quantos erros — tudo em abas da planilha pra você acompanhar

---

## 2. AS ABAS DA PLANILHA (Onde estão os dados)

| Aba | O que é | Quem mexe |
|-----|---------|----------|
| **CLIENTES** | Lista de clientes com código, email, ID do Trello | MapearClientes() (automático) |
| **MÉTRICAS** | Contadores diários: forms recebidos, lembretes enviados, erros | Script monta sozinho |
| **PENDÊNCIAS** | Histórico de cards que ficaram esperando resposta | Script posta aqui automaticamente |
| **LEMBRETES** | Registro de cada lembrete que foi mandado (data, para quem, tentativa) | Script posta aqui automaticamente |

---

## 3. FUNÇÕES PRINCIPAIS (Agrupadas por função)

### ⚙️ SETUP (Rode UMA VEZ no começo)
- **setupProperties()** — Pede TRELLO_KEY, TRELLO_TOKEN, CLAUDE_API_KEY. Roda só na primeira vez. 🟢 Seguro

### 🔴 TRIGGER PRINCIPAL (Dispara sozinho)
- **aoEnviarFormulario(e)** — Quando form é enviado, cria card + pasta + email. **NÃO MEXER!** 🔴
- **LembretesPendencias()** — Roda todo dia 9h. Varre cards com pendência, manda lembretes escalonados. **NÃO MEXER!** 🔴

### 🟠 HELPERS DO TRELLO (Você usa quando precisa mexer em card)
- **criarCardTrello()** — Cria um card novo com nome, descrição, data de prazo
- **aplicarEtiquetasNoCartao()** — Marca um card com etiqueta (ex: "DOCUMENTO PENDENTE")
- **definirCapaCartao()** — Muda a cor da capa do card (vermelho, amarelo, azul...)

### 🟠 HELPERS DO DRIVE (Você usa quando precisa mexer em pasta)
- **criarPastasDrive()** — Cria a pasta principal + subpastas de cliente
- **compartilharComoLeitor()** — Dá acesso de leitura pra alguém na pasta

### 📧 HELPERS DE EMAIL (Você usa pra testar emails)
- **enviarEmailLembrete()** — Manda email de lembrete (usado pelo script, mas você pode testar)
- **enviarEmailConfirmacaoCliente()** — Manda email inicial pra cliente confirmando recebimento

### 🤖 INTEGRAÇÃO COM DANI (A secretária IA)
- **chamarClaude()** — Conversa com a Dani (Claude API) pra ela analisar emails/comentários
- **varrerComentariosTrello()** — Varre TODOS os comentários nos cards, passa pra Dani entender
- **varrerEmailsOrgaos()** — Lê emails chegando na conta, passa pra Dani entender

### 🔔 LEMBRETES (Funções internas do sistema de lembretes)
- **buscarCardsComEtiquetaLembrete()** — Encontra cards marcados como "DOCUMENTO PENDENTE"
- **processarLembreteCard()** — Decide qual email enviar (1ª, 2ª ou aviso de abandono)
- **registrarLembrete()** — Anota na aba LEMBRETES que foi mandado

### 🛠️ FUNÇÕES DE TESTE (Você usa pra testar sem quebrar)
- **TestedoCartao()** — Pega primeira linha da planilha e simula form sendo enviado
- **TestarVarredura()** — Simula o sistema de varredura de emails (para testes)

---

## 4. TRIGGERS AGENDADOS (O que roda sozinho)

| Trigger | Quando roda | O que faz |
|---------|-------------|----------|
| **onFormSubmit** | Quando form é enviado | Chama aoEnviarFormulario() |
| **LembretesPendencias** | Todos os dias 9h | Varre cards pendentes e manda lembretes |

Para ver/editar triggers: Extensões > Apps Script > menu de relógio (Triggers no painel esquerdo)

---

## 5. PROPRIEDADES NECESSÁRIAS (Segredos configurados)

Estas são salvas pelo `setupProperties()`. **NUNCA coloque direto no código!**

```
TRELLO_KEY       = Sua chave do Trello (pega em https://trello.com/app-key)
TRELLO_TOKEN     = Seu token do Trello (gerado junto com a chave)
CLAUDE_API_KEY   = Sua chave de API da Anthropic (Claude)
```

Para mudar: clique no menu do Apps Script > setupProperties() > mude o que precisa

---

## 6. INTEGRAÇÕES EXTERNAS (Sistemas que falam com o script)

- **Google Forms** — Cliente preenche formulário
- **Google Sheets** — Dados armazenados aqui (CLIENTES, MÉTRICAS, etc)
- **Google Drive** — Pastas de clientes criadas aqui
- **Trello** — Cards criados/comentados aqui
- **Gmail** — Emails lidos/enviados daqui
- **Claude API (Anthropic)** — Dani IA integrada pra análise de comentários
- **API do Trello** — Script conversa diretamente com Trello

---

## 7. 🟢 SEGURO MEXER (Você pode mudar sem medo)

Estas coisas você pode editar sem quebrar nada:

- **Cores das etiquetas no Trello** — LOGO_TREVO_URL, LOGO_DANI_URL
- **Textos dos emails** — Mensagem de lembrete, saudação, assinatura
- **EMAIL_ALERTA_ERRO** — Para onde vão notificações de erro ("thales.burger@trevolegaliza.com.br")
- **ASSINATURA_DANI** — A assinatura da secretária virtual ("🍀 Dani — Secretária Virtual...")
- **ETIQUETAS_LEMBRETE** — Quais etiquetas no Trello disparam lembretes

---

## 8. 🟡 MEXER COM MUITO CUIDADO (Pode quebrar se errar)

Se você mexer nestas, teste com **TestedoCartao()** depois:

- **PASTA_CLIENTES_ATIVOS_ID** — ID da pasta mãe no Drive (se mudar, novas pastas vão pra lugar errado)
- **TRELLO_LIST_ID_PADRAO** — ID da lista padrão no Trello (todos os cards novos vão aqui)
- **ETIQUETAS_LEMBRETE** — Nomes das etiquetas de pendência (se mudar, script para de reconhecer pendências)
- **CAMPOS_JA_USADOS** — Nomes dos campos do form que estão em uso (se mexer, forms novos podem ficar estranhos)

Se mexer, SEMPRE rode TestedoCartao() pra confirmar.

---

## 9. 🔴 NUNCA MEXER (Quebra tudo!)

**Essas funções são críticas. NÃO MEXA:**

- **jaProcessado()** — Evita cartões duplicados (usa cache)
- **LockService** — Trava pra evitar conflitos quando várias coisas rodam juntas
- **campo()** — Busca valores nos respostas do form com tolerância (sem isso form quebra)
- **detectarViaAnalise()** — Entende onde o processo vai ser protocolo
- **aplicarEtiquetasNoCartao()** — Lógica complexa de aplicar etiquetas certas

Se precisar mexer em uma dessas, **avise um desenvolvedor antes**.

---

## 10. FLUXOGRAMA RESUMIDO (O que acontece)

```
1. Cliente preenche form no Google Forms
2. Script recebe resposta automaticamente
3. Script valida código do cliente
   ├─ Se inválido → manda email dizendo tá errado, fim
   └─ Se válido → continua
4. Script cria pasta no Drive
5. Script cria card no Trello
6. Script manda email de confirmação pro cliente
7. Dani começa a monitorar o card (lembretes, análise de comentários)
8. Todos os dias 9h → Script varre cards pendentes
   ├─ Se 1-5 dias → email de lembrete normal
   ├─ Se 6-10 dias → email mais urgente
   └─ Se 11+ dias → aviso pro Thales de risco de abandono
9. Se chegar email de órgão público → Dani analisa e posta no card automaticamente
```

---

## 11. COMO TESTAR SEM QUEBRAR NADA

### Teste do Card (simula form)
1. Abra a planilha (não o form!)
2. Coloque dados de teste na linha 2
3. No Apps Script, clique em **TestedoCartao()** e depois ▶️ (play)
4. Veja os logs pra confirmar se funcionou

### Teste de Varredura (simula leitura de emails)
1. Mande um email fake pra sua caixa (ou use um real)
2. No Apps Script, clique em **TestarVarredura()** e depois ▶️
3. Veja se Dani entendeu e postou algo no Trello

### Como ver logs (tudo o que acontece)
- Clique em **Execução Log** (relógio no painel esquerdo)
- Filtre por data/hora pra achar o que você rodou
- Procure por ✅ (sucesso) ou ❌ (erro)

---

## 12. CHECKLIST DE EMERGÊNCIA (Se algo quebrar)

**Passo 1: Entender o problema**
- Clique em Execução Log no Apps Script
- Procure por ❌ com a data/hora de quando quebrou
- Leia a mensagem de erro

**Passo 2: Email automático de erro**
- Se tiver erro grave, vai chegar email em thales.burger@trevolegaliza.com.br com detalhes
- Guarde esse email pra mostrar pro desenvolvedor

**Passo 3: Desabilitar trigger (parar tudo)**
- Vá em Extensões > Apps Script > Triggers (relógio)
- Clique no trigger que está com problema
- Clique na lixeira pra deletar
- Scripts vão parar de rodar sozinhos, mas você ainda pode testar manualmente

**Passo 4: Fazer rollback (voltar pra versão anterior)**
- No painel do Apps Script, clique em **Controle de versão**
- Procure pela versão mais recente que funcionava
- Clique em "Restaurar" aquela versão
- Todos os scripts voltam pro estado anterior

---

## 13. FAQ — 5 Perguntas Comuns

### P: Se eu desativar o Apps Script, o que acontece?
**R:** Nada chato — os clientes não vão conseguir enviar form. Você ativa de novo e tá OK. Nada perde.

### P: Como eu adiciono um novo tipo de processo?
**R:** Fale com o desenvolvedor. Script tem uma função chamada buildSpecPorTipo() que mapeia cada tipo. Vai precisar adicionar lógica lá.

### P: Posso mudar o texto da mensagem de lembrete?
**R:** Sim! Procure por "enviarEmailLembrete()" no código e mude o texto dentro. Depois clique em ▶️ pra salvar.

### P: Como vejo quantos lembretes foram enviados essa semana?
**R:** Abra a aba **LEMBRETES** na planilha. Cada linha é um lembrete que foi mandado. Filtre por data.

### P: O que fazer se a Dani responder errado?
**R:** Ela erra às vezes (IA não é perfeita). Você pode editar o comentário dela no Trello manualmente. Pra ela melhorar, deixe um comentário clarificando o que era pra fazer.

---

## 🤖 ARQUITETURA DANI v1.0 — Estado em 25/04/2026

A Dani está em produção do form-submit ao cron diário. Status por gatilho:

| Gatilho | O que faz | Status |
|---|---|---|
| **G1** Form submit | Cria card + pasta Drive + email cliente | ✅ produção (v6.0+) |
| **G2** Funcionário comenta | Claude classifica → SOLICITA_DOC/RESP/ATUALIZA → etiqueta + email | ✅ produção (v7.2+) |
| **G4** Cliente comenta | Avalia se cumpriu pendência → remove etiqueta OU pede de novo | ✅ produção (v7.3) |
| **G5** Cliente anexa arquivo | Roda G4 com texto sintético "[anexou: X]" | ✅ produção (v7.3) |
| **G6** Lembretes pendência | 5 max/etapa, reset, gentil no 5º. Caso especial pagamento (4h). | ✅ produção (v7.4) |
| **G8** Email do órgão | DEFERIDO/INDEFERIDO/SEM_MOV/OUTRO. Indeferido é discreto. | ✅ produção (v7.4) |
| **G10** ALVARÁS chegada | Oferece orçamento ao cliente | ✅ produção (v7.5) |
| **G11** ALVARÁS timeout 5d | Move pra PROCESSOS FINALIZADOS + email | ✅ produção (v7.5) |
| **G12** MAT chegada | Lembra contador + RESPOSTA PENDENTE | ✅ produção (v7.5) |
| **G13** ARQUIVO MENSAL +30d | Email LGPD + deleta anexos | ✅ produção (v7.5) |
| **G14** BLOQUEADOS dia 15 | Pergunta se mantém | ✅ produção (v7.5) |
| **G15** BLOQUEADOS dia 30 | Deleta anexos | ✅ produção (v7.5) |
| **G3** EM ANDAMENTO automática | Detecta funcionário começou a trabalhar | ⏳ Onda 4 |
| **G9** SEM_MOVIMENTACAO follow-up | Notifica cliente periodicamente | ⏳ Onda 4 |
| **3 buckets** (Trevo/Cliente/Órgão) | Cálculo de prazo por etiqueta pra relatório | ⏳ Onda 4 |

### Properties novas (v7.0+)
| Property | Função |
|---|---|
| `DANI_ATIVA` | Trava de segurança (`true`/`false`). Default false (dry-run). |
| `WEBHOOK_TOKEN` | Auth do doPost (gerado por setupDaniProperties) |
| `WEBAPP_URL` | URL do deploy (pra Edge Function proxy chamar) |
| `INDEFERIDO_NOTIFY_EMAILS` | Destinatários do alerta INDEFERIDO |
| `DANI_FORCAR_CLIENTE` | Lista de usernames forçados como cliente (testes) |
| `alvaras_chegada_<cardId>` | Timestamp pra G11 timeout 5d |
| `bloqueado_<cardId>` | Estado JSON {dia15, dia30} pra G14/G15 |
| `lembrete_<cardId>_<etapa>` | Estado dos lembretes G6 |

### Abas novas (v7.1+)
| Aba | Conteúdo |
|---|---|
| `EQUIPE` | NOME, USUARIO_TRELLO, EMAIL, ATIVO — fonte da verdade pra ehEquipeInterna |
| `DANI_LOG` | Log persistente de cada execução (rotaciona em 500 linhas) |

### Triggers (após setupTriggersDani)
| Trigger | Frequência | Função |
|---|---|---|
| onFormSubmit | Form | aoEnviarFormulario |
| LembretesPendencias | 9h diário | LembretesPendencias |
| VarrerEmails | 15min | VarrerEmails |
| sincronizarBoardsETrevoDani | 8h diário | MapearClientes + garantirWebhooks |
| **rotinasDiariasDani** | **9h30 diário** | **G11+G13+G14+G15 (NOVO v7.5)** |

### Edge Function: dani-webhook-proxy
- Path: `supabase/functions/dani-webhook-proxy/index.ts`
- URL pública: `https://gwyinucaeaayuckvevma.supabase.co/functions/v1/dani-webhook-proxy`
- Env vars: APPS_SCRIPT_WEBAPP_URL + APPS_SCRIPT_TOKEN
- Existe pra contornar redirect 302 do Apps Script Web App "Anyone"

### Funções de ops da Dani
| Função | Uso |
|---|---|
| `ativarDani()` / `desativarDani()` | Liga/desliga (default: desligada) |
| `daniAtiva()` | Retorna estado |
| `statusDani()` | Diagnóstico completo (rodar quando algo não age) |
| `setupDaniProperties()` | Wizard 3 passos config inicial (planilha aberta) |
| `setupTriggersDani()` | Cria triggers agendados (idempotente) |
| `garantirWebhooksTodosBoards()` | Cria webhook em cada board CLIENTES |
| `removerTodosWebhooks()` | Rollback completo |
| `listarWebhooks()` | Debug |
| `MapearEquipeInterna()` | Cria aba EQUIPE inicial |
| `setForcarCliente('usernames')` | Atalho não-UI pra DANI_FORCAR_CLIENTE |
| `setupTesteDani_Carolina()` | Shortcut pro teste atual com Carolina |

---

**Última atualização:** 2026-04-25 (Dani v1.0 ondas 0/1/2/3 em produção, v7.5.0)
**Versão:** 6.0
**Perguntas?** Mande uma mensagem pro desenvolvedor ou abra um card no Trevo com tag "SUPORTE-SCRIPT"

---

# 📎 ANEXO — Auditoria técnica completa (23/04/2026)

> Isso aqui é pro desenvolvedor / TURING / sessão futura. Thales pode pular esta parte.

## A1. Mapa completo de funções (1519 linhas, 60+ funções)

### Infraestrutura (linhas 1-240)
| Função | O que faz |
|---|---|
| `getProps()`, `prop(k)` | Acesso ao PropertiesService |
| `setupProperties()` | Salva TRELLO_KEY, TRELLO_TOKEN, CLAUDE_API_KEY |
| `fetchRetry(url, opts, n)` | Retry exponencial em HTTP calls |
| `trelloGet/Post/Put(path, params)` | Wrappers autenticados da API Trello |
| `campo(r, nomes[])` | Busca fuzzy de campos do formulário |
| `validarEmail(e)` | Regex de email |
| `validarCodigoCliente(cod)` | Lookup na planilha CLIENTES com cache |
| `incMetrica(k)` | Incrementa contador diário na aba MÉTRICAS |
| `jaProcessado(dedup)` | Cache de idempotência (evita duplicatas) |
| `notificarErro(origem, e)` | Envia email pro EMAIL_ALERTA_ERRO |

### Trigger principal do formulário (linhas 239-352)
| Função | O que faz |
|---|---|
| `aoEnviarFormulario(e)` | Entrypoint do Google Form. Valida código → cria pasta Drive → cria card Trello → envia email cliente. Atomicidade via LockService. |
| `avisarClienteCodigoErrado(...)` | Email quando código não existe |
| `avisarFalhaCriacao(...)` | Email quando a criação falha |

### Construção de dados do processo (linhas 368-744)
| Função | O que faz |
|---|---|
| `coletarChavesMapeadas()` | Lista todos os campos conhecidos do form |
| `detectarViaAnalise(local)` | Matriz vs Regional vs Método Trevo (v6.0+) |
| `viaAnaliseInfo(via)` | Metadata de exibição da via |
| `calcularDueDate(urg, prio)` | Prazo do card baseado em urgência |
| `buildSpecPorTipo(r, tipo)` | Mapeia tipo de processo → campos a capturar |
| `definirNomeCartao/Empresa(r, ...)` | Formatação de nomes |
| `montarDescricaoAbertura/Alteracao/Transformacao/Encerramento/Avulso(r)` | Templates de descrição por tipo |

### Drive (linhas 744-810)
| Função | O que faz |
|---|---|
| `criarPastasDrive(r, cod, nome, email)` | Pasta cliente + subpasta processo |
| `compartilharComoLeitor(pasta, email)` | ACL do cliente |
| `buscarOuCriarPastaEmpresa(mae, nome)` | Idempotente |
| `moverArquivosDoCampo(r, nome, dest)` | Move anexos do form |

### Trello (linhas 810-847)
| Função | O que faz |
|---|---|
| `criarCardTrello(nome, desc, list, due)` | Cria card |
| `definirCapaCartao(id, cor)` | Cor da capa |
| `criarChecklistTrello(id, nome, itens)` | Adiciona checklist |
| `aplicarEtiquetasNoCartao(id, board, labels)` | Aplica/cria etiquetas |
| `adicionarMembrosDoBoardAoCartao(id, board)` | Adiciona membros da equipe |
| `getEmailDoCard(id)` | Lê email armazenado em custom field |

### Gestão de clientes (linha 848)
| Função | O que faz |
|---|---|
| `MapearClientes()` | Rebuild da aba CLIENTES a partir do Trello (lenta, rodar manual) |

### Lembretes (linhas 942-1176)
| Função | O que faz |
|---|---|
| `LembretesPendencias()` | Trigger diário 9h — varre cards com etiqueta de lembrete |
| `doPost(e)` | Webhook HTTP — ERP chama pra forçar lembrete imediato |
| `resolverClientePorBoard(boardId)` | Lookup inverso (board → cliente) |
| `buscarCardsComEtiquetaLembrete(board)` | Filtra cards com ETIQUETAS_LEMBRETE |
| `processarLembreteCard(card, cod, emails, bloq, forcar)` | Decide nível (1ª, 2ª, abandono) e dispara email |
| `extrairEmailDoCardDesc(desc)` | Parse do email do cliente da descrição |
| `avisarThalesAbandono(card, cod, n)` | Email crítico pro Thales |
| `registrarLembrete(d)` | Persiste na aba LEMBRETES |

### Emails (linhas 1192-1338)
| Função | O que faz |
|---|---|
| `enviarEmailLembrete(opts)` | Template de lembrete escalonado |
| `enviarEmailConfirmacaoCliente(...)` | Email de recebimento |

### Dani (IA) (linhas 1338-1519)
| Função | O que faz |
|---|---|
| `VarrerEmails()` | Orquestrador — chama os 2 varredores abaixo |
| `varrerComentariosTrello()` | Gmail → filtra notificações do Trello → Claude classifica → posta resposta se autoResponder=true |
| `varrerEmailsOrgaos()` | Label "🏛️ TRIAGEM DE ÓRGÃOS" → Claude interpreta → busca card por protocolo → posta comentário |
| `chamarClaude(p)` | Chamada HTTP pra Anthropic Messages API (max_tokens=500, retry 3x) |
| `classificarComentario(com, card, quadro)` | Prompt estruturado → JSON {nivel, acao, autoResponder, resposta} |
| `interpretarEmailOrgao(corpo, assunto, rem)` | Prompt estruturado → JSON {protocolo, resumo, nivel, acao, orgao} |
| `buscarCardPorProtocoloViaSearch(p)` | Trello /1/search por número de protocolo |
| `postarComentarioNoCard(id, txt)` | POST comentário |
| `parsearEmailTrello(corpo)` | Parse do email de notificação do Trello (extrai card, comentário, remetente) |
| `ehEquipeInterna(nome)` | Filtra comentários da equipe Trevo (não processa) |
| `registrarPendencia(d)` | Persiste na aba PENDÊNCIAS com cor por nível |

### Teste (linhas 910, 1519)
| Função | O que faz |
|---|---|
| `TestedoCartao()` | Pega linha 2 da planilha RESPOSTAS e simula form |
| `TestarVarredura()` | Roda VarrerEmails manualmente |

---

## A2. Triggers agendados (confirmar no painel Apps Script)

| Trigger | Frequência | Função |
|---|---|---|
| onFormSubmit (spreadsheet) | Ao enviar form | `aoEnviarFormulario(e)` |
| Time-based 9h | Diário | `LembretesPendencias()` |
| Time-based X min | Recorrente (deve existir?) | `VarrerEmails()` — **CONFIRMAR NO PAINEL** |
| HTTP Webhook | Sob demanda | `doPost(e)` (URL publicada) |

**⚠️ Ação recomendada pro Thales:** abrir o painel Apps Script > Triggers e tirar screenshot. Se `VarrerEmails` não tem trigger agendado, a Dani só roda quando chamada manualmente.

---

## A3. Integrações externas (fluxo completo)

```
┌───────────────┐   form     ┌───────────────────┐
│ Google Forms  │ ─────────▶ │ aoEnviarFormulario│
└───────────────┘            └────────┬──────────┘
                                      ├─▶ Drive API (pastas)
                                      ├─▶ Trello API (card)
                                      ├─▶ Gmail (email confirm)
                                      └─▶ Sheets (MÉTRICAS)

┌───────────────┐  trigger   ┌───────────────────┐
│ Cron 9h       │ ─────────▶ │ LembretesPendencia│
└───────────────┘            └────────┬──────────┘
                                      ├─▶ Trello API (listar cards)
                                      └─▶ Gmail (email lembrete)

┌───────────────┐  trigger   ┌───────────────────┐
│ Cron X min?   │ ─────────▶ │   VarrerEmails    │
└───────────────┘            └────────┬──────────┘
                                      ├─▶ Gmail (ler emails)
                                      ├─▶ Claude API (classificar)
                                      └─▶ Trello API (postar comentário)

┌───────────────┐  webhook   ┌───────────────────┐
│ ERP Supabase  │ ─────────▶ │      doPost       │
└───────────────┘            └────────┬──────────┘
                                      └─▶ processarLembreteCard (imediato)
```

---

## A4. Dívida técnica / pontos de atenção

1. **`doPost` sem autenticação** — aceita qualquer POST com `card_id`. Impacto baixo (só dispara lembretes), mas um atacante que descobrir a URL pode floodear emails. Sugestão: adicionar token no body e validar.

2. **`chamarClaude` com `max_tokens: 500`** — suficiente pra JSON curto, mas se a IA precisar resumir um processo inteiro (futuro), esse limite trava. Parametrizar.

3. **`classificarComentario` só retorna 4 níveis** (DÚVIDA, DOCUMENTO, CONFIRMAÇÃO, SOLICITAÇÃO) — quando formalizarmos o fluxo Dani, provavelmente precisará mais granularidade (ex.: ATUALIZAÇÃO DE STATUS, INFORMAÇÃO PRO CLIENTE).

4. **`ehEquipeInterna`** — lista hardcoded de nomes. Quando equipe mudar, tem que editar o `.gs`. Migrar pra planilha.

5. **`MapearClientes()` é lento** — varre todos os boards. Em 90 boards, pode demorar minutos e estourar timeout do Apps Script (6 min). Se crescer, migrar pra Trello webhooks.

6. **Sem tracking de versão da Dani** — quando mudar o prompt da Claude, não há histórico. Sugestão: gravar versão do prompt em `registrarPendencia`.

7. **`LembretesPendencias` não tem rollback** — se enviar email e falhar ao registrar, o cliente recebe email mas nada fica na planilha. Baixa frequência, mas possível.

---

## A5. Arquivos relacionados neste repositório

| Arquivo | Função |
|---|---|
| `apps-script/automacao-trevo.gs` | Código principal (1519 linhas) |
| `apps-script/MANUAL_TURING.md` | Este manual |
| `apps-script/INSTRUCOES_SETUP.md` | Passo-a-passo de setup inicial |

---

## A6. Próximas ondas (quando Thales terminar o documento de etiquetas/listas)

1. Expandir `classificarComentario` com tipos detalhados (SOLICITAÇÃO_DOCUMENTO, SOLICITAÇÃO_RESPOSTA, ATUALIZAÇÃO_STATUS etc.)
2. Adicionar `aplicarEtiquetaAutomatica` que recebe JSON da classificação e aplica/remove etiquetas
3. Adicionar `enviarEmailClienteContextual` com template dinâmico por tipo
4. Adicionar timer de follow-up: se cliente não responder em X horas, Dani comenta + envia email
5. Integrar `possivel_duplicata_processo` (migration 20260423180000) no fluxo de criação do card

— TURING, 23/04/2026

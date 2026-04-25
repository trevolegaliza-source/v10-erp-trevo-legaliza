# 🧪 Lista completa de testes da Dani v1.0

**Versão alvo:** v7.7.0
**Board de teste:** TESTE DANI - 010101 (https://trello.com/b/TlbALmkG/ronaldo-ms🍀)
**Cliente forçado em testes:** Carolina Guirado (`carolinaguirado7`)

---

## 🔧 Setup obrigatório antes dos testes

| # | Ação | Função |
|---|---|---|
| 1 | Cola v7.7.0 do `automacao-trevo.gs` no editor | — |
| 2 | `Cmd+S` pra salvar | — |
| 3 | **NEW VERSION no deploy** (Deploy → Manage → ✏️ → New version → Deploy) | — |
| 4 | Roda `setupTriggersDani()` 1 vez | cria triggers 8h e 9h30 |
| 5 | Confirma que está em modo real | `statusDani()` deve mostrar "🟢 LIGADA" |

> Se DANI_ATIVA estiver false, roda `ativarDani()`.

---

## ✅ Testes — Ondas 1, 2, 3, 4

### 📍 Onda 1.A — G2 (Funcionário pede / atualiza status)

#### **Teste 1.A.1 — Funcionário pede DOCUMENTO** ✅ JÁ VALIDADO 25/04

Loga como **Trevo Legaliza** → comenta no card de teste:
```
@card preciso do RG do sócio principal pra prosseguir
```

**Esperado:**
- ✅ Etiqueta `DOCUMENTO PENDENTE` aplicada no card
- ✅ Comentário Dani: "📄 Olá! Aqui é a dani.ai..." (com `@board`)
- ✅ Email cliente em `thales.burger@trevolegaliza.com.br` (HTML bonito)
- ✅ Etiqueta `EM ANDAMENTO` removida (se tinha)

#### **Teste 1.A.2 — Funcionário pede RESPOSTA**

Loga como **Trevo Legaliza** → comenta:
```
@card pode confirmar qual será o endereço da nova sede da empresa?
```

**Esperado:**
- Etiqueta `RESPOSTA DE COMENTÁRIO PENDENTE` aplicada
- Comentário Dani + email cliente
- DANI_LOG mostra `acao: SOLICITA_RESPOSTA`

#### **Teste 1.A.3 — Funcionário atualiza status**

Comenta:
```
@card viabilidade transmitida pelo protocolo SPP22536892
```

**Esperado:**
- **NENHUMA etiqueta nova**
- **NENHUM comentário extra Dani no card**
- **EMAIL cliente** com a tradução da atualização
- DANI_LOG: `acao: ATUALIZA_STATUS, emailEnviado: true`

#### **Teste 1.A.4 — Anotação interna (OUTRO)**

Comenta:
```
@card lembrar de revisar o capital social com a Carolina amanhã
```

**Esperado:**
- Silêncio total (nada acontece)
- DANI_LOG: `acao: OUTRO, silencio: true`

---

### 📍 Onda 1.B — G4 (Cliente responde) + G5 (Cliente anexa)

#### **Teste 1.B.1 — Cliente CUMPRE pendência**

Pré-requisito: card precisa ter `DOCUMENTO PENDENTE` ativo (use Teste 1.A.1 antes).

Loga como **Carolina Guirado** → comenta:
```
Segue o RG do sócio principal em anexo
```

**Esperado:**
- Etiqueta `DOCUMENTO PENDENTE` removida
- Etiqueta `PRONTO PARA SER FEITO` aplicada
- Comentário Dani: "✅ Recebido, obrigada! Vamos seguir com a análise."
- DANI_LOG: `veredito: CUMPRIU`

#### **Teste 1.B.2 — Cliente NÃO cumpre (recusa)**

Reaplica `DOCUMENTO PENDENTE` no card (manual ou via Teste 1.A.1).

Loga como **Carolina** → comenta:
```
Mas eu nunca precisei fornecer essa informação anteriormente
```

**Esperado:**
- `DOCUMENTO PENDENTE` mantida
- Comentário Dani: "ℹ️ Obrigada pela mensagem, mas ainda preciso..."
- DANI_LOG: `veredito: NAO_CUMPRIU`

#### **Teste 1.B.3 — Cliente responde vago ("Segue")**

Reaplica `DOCUMENTO PENDENTE`. Carolina:
```
Segue
```

**Esperado:**
- IA decide: provavelmente `NAO_CUMPRIU` (vago demais) ou `CUMPRIU` se inferir contexto
- Manda print do DANI_LOG pra Thales avaliar

#### **Teste 1.B.4 — Cliente anexa arquivo (G5)**

Reaplica `DOCUMENTO PENDENTE`. Carolina anexa qualquer PDF (sem texto).

**Esperado:**
- Webhook `addAttachmentToCard` chega → roteia pra G5 → roda G4 com texto sintético
- IA provavelmente decide `CUMPRIU` (anexo + pendência ativa)
- Etiqueta removida + PRONTO PARA SER FEITO + Dani agradece

---

### 📍 Onda 1.C — G6 (Lembretes refinados)

#### **Teste 1.C.1 — Sequência de lembretes**

Reaplica `DOCUMENTO PENDENTE` no card. **Não responda como cliente.**

Como o cron roda 9h diário, simule manualmente: roda `LembretesPendencias()` 5 vezes (com pausa de algumas horas entre cada).

**Esperado em cada execução:**
- 1º: email + comentário "🔔 Lembrete 1/5..."
- 2º: ...3...
- 3º: ...3...
- 4º: ...4...
- 5º: email + comentário **gentil**: "🔔 Último lembrete por aqui sobre essa pendência. Não é cobrança! Quando puder, dá uma olhadinha pra gente seguir. ✨"
- 6ª execução: silêncio (esgotou)

#### **Teste 1.C.2 — Reset ao mudar etapa**

Após esgotar 5 lembretes (Teste 1.C.1), MOVE o card pra outra lista (ex.: VRE).

Roda `LembretesPendencias()` de novo.

**Esperado:** Counter zerou. Lembrete 1/5 de novo.

---

### 📍 Onda 2 — G8 (Email do órgão) + G9 (Notificação periódica)

#### **Teste 2.G8.1 — Email DEFERIDO**

Aplique label "🏛️ TRIAGEM DE ÓRGÃOS" num email de teste com texto:
```
Assunto: Deferimento JUCESP — Protocolo 28572934
Corpo: Informamos que o processo de protocolo 28572934 (CAROLINE PALMEIRA SOCIEDADE INDIVIDUAL DE ADVOCACIA) foi DEFERIDO em 25/04/2026.
```

Aguarda cron `VarrerEmails` rodar (15 min) ou roda manualmente.

**Esperado:**
- Comentário no card com `@board`: "✅ Boa notícia! Recebemos confirmação..."
- Email cliente "Processo deferido!"
- Etiqueta `EM ANÁLISE NO ÓRGÃO` removida (se tinha)
- DANI_LOG: `veredito: DEFERIDO`

#### **Teste 2.G8.2 — Email INDEFERIDO (DISCRETO)**

Email teste:
```
Assunto: Exigência JUCESP — Protocolo 28572934
Corpo: O processo 28572934 está em exigência. Documento ilegível.
```

**Esperado:**
- **CLIENTE NÃO RECEBE NADA** ⚠️
- Comentário no card: "🔎 @leticiatonelli3 @trevolegaliza — favor consultar..."
- Email INTERNO pra `trevolegaliza@gmail.com` + `leticia.tonelli@trevolegaliza.com.br` com:
  - Card link
  - Órgão, protocolo
  - Email original do órgão completo
- DANI_LOG: `veredito: INDEFERIDO`

#### **Teste 2.G8.3 — Email SEM_MOVIMENTACAO**

Email teste:
```
Assunto: Protocolo em análise — JUCESP 28572934
Corpo: Seu processo continua em análise.
```

**Esperado:**
- Sem ação imediata (cliente não notificado agora)
- DANI_LOG: `veredito: SEM_MOVIMENTACAO`
- (G9 cuidará do follow-up)

#### **Teste 2.G9.1 — Notificação periódica em análise**

Aplica etiqueta `EM ANÁLISE NO ÓRGÃO` num card. Aguarda 1 dia.

Roda manualmente `rotinasDiariasDani()`.

**Esperado:**
- Email cliente: "Olá [nome]. Eu sou a dani.ai... seu processo X permanece em análise [órgão]..."
- DANI_LOG: `G9 — varredura concluída, enviados: 1+`

---

### 📍 Onda 3 — Regras especiais por lista

#### **Teste 3.G10 — ALVARÁS oferta de orçamento**

Move card pra lista `🍀 ALVARÁS E LICENÇAS`.

**Esperado:**
- Comentário Dani com texto premium: "Somos especialistas..."
- Email cliente "Alvarás e Licenças — quer um orçamento? 🍀"

#### **Teste 3.G11 — ALVARÁS timeout 5d**

Pré-req: card em ALVARÁS há 5+ dias (manipule a property `alvaras_chegada_<cardId>` pra ISO de 6 dias atrás se quiser testar antes).

Roda `rotinasDiariasDani()`.

**Esperado:**
- Card movido pra `🍀 PROCESSOS FINALIZADOS`
- Email cliente final
- DANI_LOG: `G11 — ALVARÁS timeout 5d`

#### **Teste 3.G12 — MAT lembrete contador**

Move card pra lista `🍀 MAT`.

**Esperado:**
- Aplica `RESPOSTA DE COMENTÁRIO PENDENTE`
- Comentário Dani + email contador "Próximo passo: MAT..."

#### **Teste 3.G13 — ARQUIVO MENSAL +30d (LGPD)**

Pré-req: card em ARQUIVO MENSAL com `dateLastActivity` >30d e anexos.

Roda `rotinasDiariasDani()`.

**Esperado:**
- Email cliente "Política LGPD"
- Anexos do card deletados
- Card permanece intacto

#### **Teste 3.G14 — BLOQUEADOS dia 15**

Pré-req: card em ⚠️ BLOQUEADOS com `dateLastActivity` ≥15d.

Roda `rotinasDiariasDani()`.

**Esperado:**
- Email + comentário Dani perguntando se mantém

#### **Teste 3.G15 — BLOQUEADOS dia 30**

Pré-req: card em ⚠️ BLOQUEADOS com `dateLastActivity` ≥30d e anexos.

Roda `rotinasDiariasDani()`.

**Esperado:**
- Anexos deletados (card permanece)
- Email cliente LGPD

---

### 📍 Onda 4 — G3 + Buckets + Dashboard

#### **Teste 4.G3.1 — EM ANDAMENTO automática (keyword)**

Loga como **Trevo Legaliza** → comenta:
```
@card iniciando análise do processo agora
```

**Esperado:**
- Etiqueta `EM ANDAMENTO` aplicada
- Etiqueta `PRONTO PARA SER FEITO` removida (se tinha)
- DANI_LOG: `G3 — EM ANDAMENTO aplicada (keyword detect)`
- Email cliente (ATUALIZA_STATUS) com tradução

#### **Teste 4.G3.2 — Outras keywords**

Testa cada uma comentando:
- "redigindo o contrato"
- "preparando a viabilidade"
- "vou começar agora"

Todas devem disparar G3.

#### **Teste 4.Buckets.1 — Cálculo dos 3 buckets**

Após uma sequência de etiquetas no card (ex.: PRONTO PARA SER FEITO → EM ANDAMENTO → DOCUMENTO PENDENTE → PRONTO PARA SER FEITO de novo).

Roda `mostrarPrazosCard("69ec2d293f4d7941bdcd603e")` (ID do card de teste).

**Esperado no Logger:**
```
══ Prazos do card 69ec2d293f4d7941bdcd603e ══
  🟢 Trevo:   X.X d
  🟡 Cliente: X.X d
  🔵 Órgão:   X.X d
  Total:     X.X d
```

#### **Teste 4.Buckets.2 — Reconstruir histórico**

Pra um card com vários cards históricos (não TESTE DANI, escolhe um real):

Roda `reconstruirBucketsCard("<cardId>")`.

**Esperado:**
- Logger mostra "✅ Reconstruído. N eventos processados."
- Prazos populados retroativamente

#### **Teste 4.Dashboard — gerarDashboardDani()**

Roda `gerarDashboardDani()`.

**Esperado:**
- Aba `DANI_DASHBOARD` criada/atualizada na planilha
- 4 seções: Status, Métricas hoje, Cards com lembretes, Top buckets

---

## 🔍 Funções de operação úteis

| Função | Quando usar |
|---|---|
| `statusDani()` | Diagnosticar tudo de uma vez |
| `ativarDani()` / `desativarDani()` | Liga/desliga (DANI_ATIVA) |
| `gerarDashboardDani()` | Atualizar aba DANI_DASHBOARD |
| `mostrarPrazosCard("<cardId>")` | Ver buckets de um card específico |
| `reconstruirBucketsCard("<cardId>")` | Popular buckets via histórico Trello |
| `listarWebhooks()` | Debug — ver webhooks ativos |
| `setForcarCliente("user1,user2")` | Mudar quem é forçado cliente em testes |

---

## 📊 Onde olhar o que está acontecendo

| Local | Conteúdo |
|---|---|
| Aba `DANI_LOG` (planilha) | Logs detalhados de cada execução, últimos 500 |
| Aba `MÉTRICAS` (planilha) | Contadores diários (chamadas IA, ações, etc) |
| Aba `LEMBRETES` (planilha) | Histórico de cada lembrete enviado |
| Aba `PENDÊNCIAS` (planilha) | Histórico de comentários classificados |
| Aba `DANI_DASHBOARD` (planilha) | Visão geral consolidada (após gerarDashboardDani) |
| Apps Script Execuções | Logs por execução individual (do deploy ou editor) |
| Inbox `thales.burger@...` | Emails enviados pelo cliente fake |
| Inbox `trevolegaliza@gmail.com` + `leticia.tonelli@...` | Alertas de INDEFERIMENTO |

---

## 🚨 Se algo der errado

1. Confere `statusDani()` primeiro
2. Lê últimas 10 linhas da aba `DANI_LOG`
3. Se aparecer `CLAUDE_PARSE_FAIL`, manda print da `resposta_bruta` pra mim
4. Se aparecer `ERRO`, manda print do stack
5. Se nada acontece, verifica:
   - Versão do `automacao-trevo.gs` (deve mostrar v7.7.0)
   - Deploy (NEW VERSION feita após colar?)
   - DANI_ATIVA = "true"
   - Webhook ativo no board (`listarWebhooks`)

---

**Última atualização:** 25/04/2026 02h
**Versão alvo:** v7.7.0
**Total de testes:** 22 cenários distintos cobrindo Ondas 0/1.A/1.B/1.C/2/3/4

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

**Última atualização:** 2026-04-22  
**Versão:** 6.0  
**Perguntas?** Mande uma mensagem pro desenvolvedor ou abra um card no Trevo com tag "SUPORTE-SCRIPT"

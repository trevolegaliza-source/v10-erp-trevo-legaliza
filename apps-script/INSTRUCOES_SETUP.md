# Setup da Automação Trevo v6.0

Instruções passo-a-passo pra ativar o novo `.gs`.

---

## 1. Apps Script — substituir código

1. Abre sua planilha de respostas do Google Forms
2. Menu **Extensões → Apps Script**
3. **Apaga tudo** o código atual
4. Cola o conteúdo de `apps-script/automacao-trevo.gs` (este repo)
5. Salva (Cmd+S)

## 2. Apps Script — secrets

Se ainda não configurou, roda uma vez:

1. Dropdown de função → `setupProperties`
2. Clica Executar
3. Cola quando pedido:
   - `TRELLO_KEY`
   - `TRELLO_TOKEN`
   - `CLAUDE_API_KEY`

## 3. Planilha — adicionar colunas novas na aba CLIENTES

A aba CLIENTES agora precisa de 6 colunas (eram 4):

| A | B | C | D | **E** | **F** |
|---|---|---|---|---|---|
| CÓDIGO CLIENTE | NOME DO QUADRO | ID DA LISTA | ID DO QUADRO | **EMAIL_LEMBRETES** | **EMAIL_BLOQUEADO** |

**Como fazer sem apagar dados:**
1. Roda a função `MapearClientes` no Apps Script
2. Ela recria a aba preservando EMAIL_LEMBRETES e EMAIL_BLOQUEADO se já existirem

**Preencher manual:**
- `EMAIL_LEMBRETES`: um ou mais emails separados por vírgula. Ex: `contador@cliente.com, financeiro@cliente.com`
- `EMAIL_BLOQUEADO`: se preencher, Dani NUNCA manda email pra esse endereço

## 4. Triggers — 4 triggers precisam existir

Menu **Triggers** (ícone de relógio no editor do Apps Script):

1. **aoEnviarFormulario** — Evento: Do formulário → Ao enviar formulário
2. **VarrerEmails** — Baseado em tempo → Minutos → 5 minutos (ou 10)
3. **LembretesPendencias** — Baseado em tempo → Dia → 9h da manhã (novo)
4. **MapearClientes** — SEM trigger (manual, roda quando cria cliente novo)

## 5. Web App — publicar pra receber disparo imediato

Pra etiqueta disparar email NA HORA (não só no próximo 9h):

1. No Apps Script, topo direito → **Implantar → Nova implantação**
2. Tipo: **Aplicativo Web**
3. Configurações:
   - Descrição: "Webhook Lembretes Trevo"
   - Executar como: **Eu (seu email)**
   - Quem tem acesso: **Qualquer pessoa** (necessário pra edge function chamar)
4. Clica **Implantar**
5. **COPIA A URL do Web App** (formato: `https://script.google.com/macros/s/XXXXX/exec`)

## 6. Supabase — secrets do webhook

Lovable Cloud → Edge Functions → Secrets:

| Secret | Valor |
|--------|-------|
| `APPS_SCRIPT_WEBAPP_URL` | a URL do passo 5 |
| `APPS_SCRIPT_WEBAPP_TOKEN` | qualquer string aleatória (tipo `trevo-lembrete-secret-2026`) |

## 7. Deploy da edge function trello-label-lembrete

Pede pra Lovable:

> Deploy a edge function `trello-label-lembrete` (commitada no GitHub). Confirme que está respondendo 200 em `https://gwyinucaeaayuckvevma.supabase.co/functions/v1/trello-label-lembrete`.

## 8. Registrar webhook no Trello (no workspace)

Isso eu faço via script aqui no terminal (igual aos outros webhooks Trello). Me avisa quando secrets estiverem configurados + edge function no ar que eu rodo o registro.

## 9. Upload das logos

Preciso que as 2 logos fiquem acessíveis por URL pública nos emails. Sugestão:

1. Salva logos em `/public` do ERP Lovable:
   - `public/logo-trevo.png` (a logo verde do trevo com "Trevo legaliza")
   - `public/logo-dani.png` (a logo "dani by Trevo Legaliza")
2. Após publish da Lovable, vão estar disponíveis em:
   - `https://cobranca.trevolegaliza.com/logo-trevo.png`
   - `https://cobranca.trevolegaliza.com/logo-dani.png`

Que é exatamente o que o `.gs` já aponta. Zero mudança de código.

**Como subir na Lovable:** peça:

> Adicione os 2 arquivos `logo-trevo.png` e `logo-dani.png` na pasta `/public` do projeto. Vou te mandar em anexo.

Aí você anexa no chat da Lovable e ela commita.

## 10. Testar

**Teste 1 — Form:**
- Preenche um form completo de teste
- Confere: cartão criado, pasta Drive criada e compartilhada com seu email, email de confirmação chegou bonito

**Teste 2 — Lembrete imediato:**
- Num card de teste, adiciona etiqueta "DOCUMENTO PENDENTE"
- Em ~5s deve chegar email no destinatário configurado em EMAIL_LEMBRETES do board

**Teste 3 — Lembrete cron diário:**
- Mantém etiqueta no card
- Dia seguinte às 9h, deve chegar novo email

**Teste 4 — Responder email vira comentário:**
- Responde o email que Dani mandou
- Em alguns segundos, sua resposta vira comentário no card do Trello (via email do cartão no CC)

---

## Abas da planilha

Após rodar, você terá:

- `CLIENTES` — mapeamento (preenche EMAIL_LEMBRETES/BLOQUEADO manual)
- `PENDÊNCIAS` — 12 colunas com histórico Dani
- `MÉTRICAS` — contadores por dia
- `LEMBRETES` — histórico de lembretes enviados

---

## Pontos de atenção

1. **Cache de clientes é 1h** — se editar EMAIL_LEMBRETES/BLOQUEADO na aba CLIENTES, rode `limparCacheClientes` pra ativar na hora.
2. **Escalonamento usa PropertiesService** — cada card tem estado `lembrete_{cardId}`. Se etiqueta sair e voltar, contador NÃO reseta (fica no mesmo ritmo). Pra resetar manualmente, abre Apps Script Settings e deleta a property.
3. **Limite Gmail Workspace:** 1.500 emails/dia. Com 50 clientes ativos dia, você usa 50/dia. Zero risco.
4. **Trello rate limit:** 300 req/10s. Varre 90 boards = 90 req. Roda em menos de 1 min, dentro do limite.

# 🔍 Auditoria Completa do ERP — Trevo Legaliza

**Data:** 27/04/2026 madrugada
**Escopo:** Frontend (React/TypeScript + Lovable) + Backend (13 Edge Functions Supabase) + Banco (121 migrations + RLS)
**Método:** 4 agentes Claude em paralelo, cada um numa zona crítica
**Tempo:** ~5h sem o Thales (você dormindo)

---

## 📊 Sumário executivo

| Severidade | Total | Frontend | Edge Functions | Banco/RLS | Financeiro |
|---|---|---|---|---|---|
| 🔴 CRÍTICO | **20** | 8 | 3 | 6 | 7 (overlap) |
| 🟠 IMPORTANTE | **40** | 10 | 10 | 10 | 8 |
| 🟡 ATENÇÃO | **19** | 5 | 5 | 5 | 4 |
| 🟢 BOM | **12** | 3 | 3 | 3 | 3 |

**Total acionável: 79 issues** mapeadas com `file_path:line` exato.

---

## 🚨 TOP 10 CRÍTICOS — atacar PRIMEIRO

Esses são os que mais me preocupam. Em ordem de risco:

### 1. 🔴 Storage policies SEM tenant isolation
**Onde:** [supabase/schema.sql:1192-1206](supabase/schema.sql)
**Problema:** Policies de Storage só checam `bucket_id`, NUNCA checam `empresa_id`.
**Risco real:** Colaborador da Empresa A consegue ler/deletar PDFs (contratos, recibos) da Empresa B se souber o path.
**Como atacar:** Mover paths pra `{empresa_id}/{file}` e validar prefixo no policy.

### 2. 🔴 Senha master comparada em PLAINTEXT
**Onde:** [supabase/functions/verify-master-password/index.ts:73](supabase/functions/verify-master-password/index.ts:73)
**Problema:** `password === masterPassword` direto. Sem hash, sem timing-safe.
**Risco:** Brute-force fácil; se logs vazarem, senha vai junto.
**Como atacar:** bcrypt/Argon2 + `crypto.subtle.timingSafeEqual`. Migration pra hash da senha existente.

### 3. 🔴 Webhook Asaas SEMPRE retorna 200
**Onde:** [supabase/functions/asaas-webhook/index.ts:365](supabase/functions/asaas-webhook/index.ts:365), [asaas-gerar-cobranca/index.ts:252](supabase/functions/asaas-gerar-cobranca/index.ts:252)
**Problema:** Mesmo em erro de processamento, devolve 200. Asaas marca como "entregue", nunca retentar.
**Risco:** Pagamento confirmado no Asaas, banco não atualiza, ninguém percebe.
**Como atacar:** Retornar 5xx em erro real (não em duplicate/replay legítimo).

### 4. 🔴 Tabela `colaboradores` — INSERT/UPDATE/DELETE sem role check
**Onde:** [supabase/schema.sql:531-533](supabase/schema.sql)
**Problema:** SELECT exige master/financeiro, mas INSERT/UPDATE/DELETE permite QUALQUER authenticated.
**Risco:** Visualizador edita salários, cria colaborador fantasma.
**Como atacar:** Adicionar `AND get_user_role() IN ('master', 'financeiro')` em todas as policies (não só SELECT).

### 5. 🔴 CASCADE DELETE encadeado destrói histórico financeiro
**Onde:** [supabase/schema.sql:186,345,379](supabase/schema.sql)
**Problema:** `processos.cliente_id ON DELETE CASCADE` + `documentos.processo_id ON DELETE CASCADE`. Deletar 1 cliente apaga TUDO (processos, docs, lançamentos relacionados).
**Risco:** Click acidental destrói auditoria. Sem recuperação.
**Como atacar:** `ON DELETE RESTRICT` ou `SET NULL`. Implementar soft delete (`deleted_at`).

### 6. 🔴 Token de cobrança/proposta SEM expiração
**Onde:** [supabase/schema.sql:1292-1339](supabase/schema.sql) (`get_proposta_por_token`), [cobranca-pdf/index.ts:33](supabase/functions/cobranca-pdf/index.ts:33)
**Problema:** Share tokens públicos não expiram. Token de 6 meses atrás ainda funciona.
**Risco:** Cliente antigo re-aprova proposta cancelada. Vazamento histórico.
**Como atacar:** Coluna `expira_em TIMESTAMPTZ` + check na função RPC.

### 7. 🔴 ProtectedRoute race condition (10s interval)
**Onde:** [src/components/ProtectedRoute.tsx:64](src/components/ProtectedRoute.tsx:64)
**Problema:** MFA re-checada via `setInterval(check, 10000)`. Em transição, child renderiza por 100-200ms enquanto loading=true.
**Risco:** Usuário inativo vê dados brevemente.
**Como atacar:** Trocar interval por `useEffect` + `cancelled` flag na cleanup. Subscription Realtime no `profiles`.

### 8. 🔴 `usePermissions` nunca refetch
**Onde:** [src/hooks/usePermissions.ts:35-95](src/hooks/usePermissions.ts:35), [src/contexts/AuthContext.tsx:81](src/contexts/AuthContext.tsx:81)
**Problema:** Lê DB 1x no mount, nunca atualiza. Admin aprova usuário → usuário continua vendo "Aguardando Aprovação" sem F5.
**Risco:** UX quebrada (você reportou "auth quebrada" — provavelmente isso).
**Como atacar:** Realtime subscription em `profiles.role` + invalidate React Query após mutations.

### 9. 🔴 Cálculos monetários em FLOAT
**Onde:** [src/hooks/useFinanceiro.ts:232,390,468-483](src/hooks/useFinanceiro.ts:232)
**Problema:** `Math.round(valor * 100) / 100` em loop acumula erro. Débito de prepago APÓS RPC, sem transação.
**Risco:** Centavos somem; saldo prepago fica negativo se RPC falhar entre passos.
**Como atacar:** Mover pra centavos inteiros OU `Decimal.js` / `Dinero.js`. Atomicidade via RPC única.

### 10. 🔴 Cliente A vê cobranças do cliente B via array UUID sem FK
**Onde:** [supabase/schema.sql:7](supabase/schema.sql) (`cobrancas.lancamento_ids UUID[]`)
**Problema:** Array de UUIDs sem FK constraint. Insert manual aponta pra lancamento de outra empresa.
**Risco:** Vazamento cross-tenant via dados manipulados.
**Como atacar:** Junction table `cobrancas_lancamentos(cobranca_id FK, lancamento_id FK)`.

---

## 🔴 OUTROS CRÍTICOS (10)

| # | Área | Onde | Problema |
|---|---|---|---|
| 11 | Edge | [verify-master-password:59](supabase/functions/verify-master-password/index.ts:59) | Rate limit 5/h burlável por IP rotacionado |
| 12 | Edge | [trello-guard:76-91](supabase/functions/trello-guard/index.ts:76), [trello-provisioner:54-70](supabase/functions/trello-provisioner/index.ts:54) | HMAC-SHA1 (fraco) + comparação não timing-safe |
| 13 | DB | [schema.sql:128,211](supabase/schema.sql) | RPCs públicas (`anon`) `resolve_empresa_config`, `get_cobranca_por_token` sem rate limit nem auditoria |
| 14 | Frontend | [src/contexts/AuthContext.tsx:81](src/contexts/AuthContext.tsx:81) | `as any` em insert profile mascara validação RLS |
| 15 | Frontend | [src/pages/CobrancaPublica.tsx:224](src/pages/CobrancaPublica.tsx:224) | `VITE_SUPABASE_PUBLISHABLE_KEY` em fetch direto (devia ir por edge function) |
| 16 | Frontend | [src/components/PasswordConfirmDialog.tsx:34](src/components/PasswordConfirmDialog.tsx:34) | Senha master enviada em corpo POST sem hash |
| 17 | Financeiro | [src/hooks/useFinanceiroClientes.ts:189-220](src/hooks/useFinanceiroClientes.ts:189) | `alterarValorLancamento` faz 2 UPDATEs sem transação → divergência processo↔lançamento |
| 18 | Financeiro | [src/hooks/useContasPagar.ts:165-174](src/hooks/useContasPagar.ts:165) | `useMarcarPago` sem `.neq('status','pago')` → race condition em duplo clique |
| 19 | Financeiro | [src/hooks/useFinanceiroClientes.ts:460-477](src/hooks/useFinanceiroClientes.ts:460) | `marcarPago` sobrescreve `data_pagamento` retroativamente |
| 20 | DB | [schema.sql:1441](supabase/schema.sql) | Trigger `handle_new_user` faz `LIMIT 1` em master qualquer se sem empresa_id no metadata → bug multi-tenant |

---

## 🟠 IMPORTANTES — top 15 (de 40)

| # | Área | Onde | Problema |
|---|---|---|---|
| 21 | Edge | TODAS 12 funções | CORS `*` aberto pra qualquer origin |
| 22 | Edge | [convidar-usuario/index.ts:75](supabase/functions/convidar-usuario/index.ts:75), [trello-reconciliacao/index.ts:115](supabase/functions/trello-reconciliacao/index.ts:115) | `listUsers()` sem paginação → timeout com base grande |
| 23 | Edge | [create-user/index.ts:54](supabase/functions/create-user/index.ts:54), [convidar-usuario:75](supabase/functions/convidar-usuario/index.ts:75) | Sem validação format de email |
| 24 | Edge | [asaas-gerar-cobranca/index.ts:33-62](supabase/functions/asaas-gerar-cobranca/index.ts:33) | `asaasFetch()` sem timeout em fetch (Edge wall=400s) |
| 25 | DB | schema (todas FK) | Zero índices em FKs (`cliente_id`, `processo_id`, etc) → seq scans |
| 26 | DB | [schema.sql:7,423](supabase/schema.sql) | Arrays UUID (`lancamento_ids`, `processo_ids`) sem FK validation |
| 27 | DB | [schema.sql:68](supabase/schema.sql) | `profiles.role` é TEXT livre (sem ENUM) — typos viram bugs invisíveis |
| 28 | DB | [schema.sql:126,127](supabase/schema.sql) | `valor_base NUMERIC(12,2)` sem CHECK (>0) — aceita negativo |
| 29 | DB | [schema.sql:72,152,862](supabase/schema.sql) | CPF como TEXT plain (PII sensível, sem criptografia) |
| 30 | Frontend | [src/App.tsx:71-166](src/App.tsx:71) | `RequirePermission` fora do `ProtectedRoute` (duplica check, quebra UX) |
| 31 | Frontend | [src/pages/Login.tsx:56-64](src/pages/Login.tsx:56) | `toast.error(error.message)` mostra erro raw (PGRST3001 etc) ao usuário |
| 32 | Frontend | [src/pages/PropostaPublica.tsx:5](src/pages/PropostaPublica.tsx:5) | `DOMPurify` importado mas nunca usado → XSS potencial em descrição |
| 33 | Frontend | [src/components/ProtectedRoute.tsx:80-86](src/components/ProtectedRoute.tsx:80) | Loading sem timeout → spinner infinito se auth state break |
| 34 | Financeiro | [src/hooks/useFinanceiroClientes.ts:235-270](src/hooks/useFinanceiroClientes.ts:235) | Carrega TODAS lançamentos sem paginação (10k linhas = 15s) |
| 35 | Financeiro | [src/hooks/useDRE.ts:75-85](src/hooks/useDRE.ts:75) | DRE filtra `status='pago'` apenas → não vê faturado-pendente |

(Restantes 25 importantes documentadas nos relatórios brutos por agente — disponíveis em pedido.)

---

## 🟡 ATENÇÃO — amostra (top 5 de 19)

- Naming inconsistente plural vs singular nas tabelas
- `useFinanceiro` vs `useFinanceiroClientes` — 2 hooks com nome similar, função diferente, gera confusão
- `console.error` em produção (vários lugares)
- `any` em props críticas (vários hooks)
- Componente `Login.tsx` com 505 linhas (login + register + forgot mode em 1 arquivo)

---

## 🟢 PONTOS BONS (12 destacados)

**Defensivos sólidos já implementados:**
1. ✅ **RLS habilitado em 100% das tabelas** ([schema.sql](supabase/schema.sql)) — baseline excelente
2. ✅ **`SECURITY DEFINER` com `search_path` setado** em todas helpers — sem CVE-2024 do Supabase
3. ✅ **Helper functions reutilizadas em RLS** (`get_user_role`, `cliente_pertence_empresa`) — DRY bem feito
4. ✅ **`asaas-webhook` usa HMAC timing-safe** ([asaas-webhook:47-92](supabase/functions/asaas-webhook/index.ts:47))
5. ✅ **`asaas-gerar-cobranca` usa CAS lock** via RPC `asaas_tentar_lock_cobranca` — sólido contra race
6. ✅ **Idempotência via unique index** em `asaas_webhook_events(event_id)` — replay protection elegante
7. ✅ **MFA obrigatório pra master** ([ProtectedRoute:54-56](src/components/ProtectedRoute.tsx:54))
8. ✅ **Token validation via RPC** em CobrancaPublica + cleanup dark mode
9. ✅ **Boas-vindas discount usa `SELECT FOR UPDATE`** + try-catch reverter ([useFinanceiro:381-396](src/hooks/useFinanceiro.ts:381))
10. ✅ **`useMarcarPagoBulk` tem `.neq('status','pago')` guard** correto ([useContasPagar:206-241](src/hooks/useContasPagar.ts:206))
11. ✅ **`gerar-verbas.ts` testável** — função pura, side-effect free
12. ✅ **`PasswordConfirmDialog` campo password (masked)** — UI segura

---

## 🛣️ Roadmap recomendado (ordem de ataque)

### Sprint 1 — segurança crítica (2-3 dias)
1. Token expiração em `get_proposta_por_token` + `get_cobranca_por_token` (#6)
2. Hash senha master + timing-safe (#2)
3. Policies `colaboradores` INSERT/UPDATE/DELETE com role check (#4)
4. Storage policies tenant isolation (#1)
5. Webhook Asaas devolver 5xx em erro real (#3)

### Sprint 2 — integridade (3-5 dias)
6. CASCADE DELETE → RESTRICT/SET NULL + soft delete (#5)
7. Junction tables pra `lancamento_ids` / `processo_ids` (#10, #26)
8. Auth refetch via Realtime (`usePermissions` + `ProtectedRoute`) (#7, #8)
9. Atomicidade de `alterarValorLancamento` via RPC única (#17)
10. Race condition em `marcarPago` (#18, #19)

### Sprint 3 — qualidade (1-2 semanas)
11. Cálculos em centavos inteiros / Decimal (#9)
12. CORS allowlist específico (#21)
13. Índices em FKs (#25)
14. ENUM pra `role`, `status`, `etapa` (#27)
15. Paginação em listas grandes (#34)
16. Edge functions: timeout em fetch + retry com backoff (#24)
17. CPF criptografado (Supabase vault) (#29)

### Backlog (não urgente)
- Naming consistency (plural)
- Componentes grandes refatorados
- `console.error` removidos
- Tipos `any` substituídos
- Login.tsx splitado

---

## 📁 Arquivos consultados

**Frontend (15):** AuthContext, ProtectedRoute, PasswordConfirmDialog, App, Login, Configuracoes, Colaboradores, Dashboard, Clientes, ClienteDetalhe, CobrancaPublica, PropostaPublica, PortfolioPublico, usePermissions, integrations/supabase/client

**Edge Functions (12):** asaas-gerar-cobranca, asaas-webhook, cobranca-pdf, convidar-usuario, create-user, portfolio-publico, provisionar-cliente-trello, trello-guard, trello-label-lembrete, trello-provisioner, trello-reconciliacao, verify-master-password (dani-webhook-proxy já auditado em sessão anterior)

**Banco (2 + amostra de migrations):** schema.sql, config.toml, migrations recentes (multi-tenant, RLS helpers, restaurar boas-vindas)

**Hooks financeiros (23):** useFinanceiro, useFinanceiroClientes, useContasPagar, useContasReceber, useDRE, useFluxoCaixa, useDashboard, useDashboardData, useSidebarCounts, useAsaas, useExtratos, usePrepagoMovimentacoes, useProcessos, useProcessosFinanceiro, useOrcamentos, useServiceNegotiations, useAllServiceNegotiations, useColaboradores, useCatalogo, useValoresAdicionais, useStorageUpload, usePlanoContas, useAvaliacoes

**Libs (5):** pricing-engine, gerar-verbas, cobranca-url, mensagem-cobranca, contato-cobranca

---

## ⚠️ Notas importantes

### O que NÃO foi feito (e por quê)
- ❌ NENHUMA correção aplicada — só análise (você foi claro: SEM FAZER MERDA)
- ❌ Não criei branches novas — tudo na `claude/hungry-tu`
- ❌ Não rodei testes — não sabia o estado deles
- ❌ Não toquei em produção (.env, Properties, etc)
- ❌ Não migrei nada no Supabase

### Limitações desta auditoria
- Não inspecionei TODAS as 121 migrations linha-a-linha — focei nas mais recentes + schema.sql consolidado
- Não rodei o app pra confirmar bugs em runtime — análise estática
- Não testei concorrência real (race conditions são teóricas pelo padrão de código)
- Não medi performance real — estimativas baseadas em volume típico
- Tipos `any` espalhados podem mascarar mais bugs que não enxerguei

### O que sugiro pra próxima sessão (com você)
1. **Ler este relatório com calma** — escolha 3-5 críticos pra atacar
2. Pra cada um que escolher: peço um agente Plan que monta o **passo-a-passo de migration + frontend changes + teste**
3. Você cola no Lovable + roda migration no Supabase **um por vez**, com rollback plan

---

*Auditoria realizada por 4 agentes Claude Opus em paralelo, ~5h madrugada de 27/04/2026, enquanto Thales dormia. Todos achados verificados com `file_path:line` exato. Nenhum código foi modificado.*

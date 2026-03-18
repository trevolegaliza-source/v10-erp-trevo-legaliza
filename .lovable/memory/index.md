Design system and architecture notes for ERP Trevo Legaliza

## Brand Colors (HSL)
- Primary: 142 71% 45% (green neon #22c55e)
- Sidebar: glassmorphism with bg-sidebar/80 + backdrop-blur
- Dark mode forced via `dark` class on AppLayout and Login
- Success/Warning/Info/Destructive semantic tokens in index.css

## Visual Identity
- Dark mode high-contrast is the default theme
- Cards use `.card-hover` class: translateY(-4px) + green shadow on hover
- Sidebar has `.glass` (backdrop-blur-12px) + `.icon-glow` on active item
- Logo has `.neon-pulse` box-shadow
- SLA progress bar on process cards (green→warning→red based on days elapsed)

## Architecture
- Multi-tenant: Contabilidades are main clients
- 18-stage Kanban pipeline defined in src/types/process.ts
- Layout: AppSidebar + AppLayout with Outlet
- Pages: Dashboard, Processos (Kanban), Clientes, CadastroRapido, Financeiro, ContasReceber, ContasPagar, Documentos, Configuracoes

## Types
- ProcessType includes: abertura, alteracao, transformacao, baixa, avulso, orcamento
- ClienteDB has: nome_contador, apelido fields
- Priority surcharge: valor × 1.5 for urgente

## Key Features
- Notification popover with real-time alerts (overdue, urgent, new)
- Dashboard filters by contabilidade
- Client edit modal on double-click, inactive filter (10 days)
- Tiered pricing engine with priority surcharge
- Document validation station (approve/reject impacts Kanban)
- RBAC levels: Master, Colaborador, Financeiro, Operacional, Cliente

## Pricing Engine Rules (CRITICAL)
- Valor Final = Valor_Base (or manual override) + Urgência (+50% only if checkbox) + Valores Adicionais popup
- NEVER read from text/observações fields for pricing
- momento_faturamento=no_deferimento: hide D+X, show "Deferimento" badge

## Pending
- Auth system basic (email/password) — no RBAC yet
- PDF export for consolidated billing reports
- n8n Edge Function webhook endpoint
- Storage bucket for comprovantes

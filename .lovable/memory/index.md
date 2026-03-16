Design system and architecture notes for ERP Trevo Legaliza

## Brand Colors (HSL)
- Primary: 152 55% 33% (green)
- Sidebar: 200 18% 14% (dark gray)
- Success/Warning/Info/Destructive semantic tokens in index.css

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

## Pending
- Auth system not yet implemented
- PDF export for consolidated billing reports
- n8n Edge Function webhook endpoint
- Storage bucket for comprovantes

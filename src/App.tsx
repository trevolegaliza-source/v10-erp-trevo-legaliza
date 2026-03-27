import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Processos = lazy(() => import("./pages/Processos"));
const ProcessosAtivosDetalhe = lazy(() => import("./pages/ProcessosAtivosDetalhe"));
const FaturamentoDetalhe = lazy(() => import("./pages/FaturamentoDetalhe"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteDetalhe = lazy(() => import("./pages/ClienteDetalhe"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const CadastroRapido = lazy(() => import("./pages/CadastroRapido"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
    Carregando...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/processos" element={<Processos />} />
                  <Route path="/processos-ativos" element={<ProcessosAtivosDetalhe />} />
                  <Route path="/faturamento" element={<FaturamentoDetalhe />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/cadastro-rapido" element={<CadastroRapido />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/contas-receber" element={<Navigate to="/financeiro" replace />} />
                  <Route path="/contas-pagar" element={<ContasPagar />} />
                  <Route path="/colaboradores" element={<Colaboradores />} />
                  <Route path="/documentos" element={<Documentos />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

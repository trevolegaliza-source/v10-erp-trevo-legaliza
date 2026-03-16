import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Processos from "./pages/Processos";
import ProcessosAtivosDetalhe from "./pages/ProcessosAtivosDetalhe";
import FaturamentoDetalhe from "./pages/FaturamentoDetalhe";
import Clientes from "./pages/Clientes";
import Financeiro from "./pages/Financeiro";
import ContasReceber from "./pages/ContasReceber";
import ContasPagar from "./pages/ContasPagar";
import CadastroRapido from "./pages/CadastroRapido";
import Documentos from "./pages/Documentos";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/processos-ativos" element={<ProcessosAtivosDetalhe />} />
            <Route path="/faturamento" element={<FaturamentoDetalhe />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/cadastro-rapido" element={<CadastroRapido />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/contas-receber" element={<ContasReceber />} />
            <Route path="/contas-pagar" element={<ContasPagar />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

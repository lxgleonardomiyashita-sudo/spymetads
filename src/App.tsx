import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Monitores from "./pages/Monitores";
import Grupos from "./pages/Grupos";
import GrupoDetalhe from "./pages/GrupoDetalhe";
import Analises from "./pages/Analises";
import Tags from "./pages/Tags";
import Alertas from "./pages/Alertas";
import SpyEspecial from "./pages/SpyEspecial";
import ParaTestar from "./pages/ParaTestar";
import Configuracoes from "./pages/Configuracoes";
import Auth from "./pages/Auth";
import SuperGrupos from "./pages/SuperGrupos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/monitores" element={<Monitores />} />
            <Route path="/grupos" element={<Grupos />} />
            <Route path="/grupos/:id" element={<GrupoDetalhe />} />
            <Route path="/analises" element={<Analises />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/spy-especial" element={<SpyEspecial />} />
            <Route path="/para-testar" element={<ParaTestar />} />
            <Route path="/super-grupos" element={<SuperGrupos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

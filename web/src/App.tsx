/**
 * App.tsx — Componente raiz da aplicação
 * 
 * Responsabilidades:
 * 1. Configurar providers (Theme, Socket, Auth)
 * 2. Definir rotas da aplicação
 * 3. Proteger rotas — redireciona para /login se não autenticado
 * 4. Layout: Sidebar + conteúdo principal
 */
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useSession } from './lib/authClient';
import { Sidebar, MobileHeader } from './components/Sidebar';

// ─── Páginas ───
import { Dashboard } from './pages/Dashboard';
import { Categories } from './pages/Categories';
import { Settings } from './pages/Settings';
import { Commands } from './pages/Commands';
import { Leads } from './pages/Leads';
import { Forms } from './pages/Forms';
import { CRM } from './pages/CRM';
import { QuickReplies } from './pages/QuickReplies';
import { AiTraining } from './pages/AiTraining';
import { ScheduledMessages } from './pages/ScheduledMessages';
import { Connection } from './pages/Connection';
import { Marketing } from './pages/Marketing';
import { Clients } from './pages/Clients';
import { Login } from './pages/Login';

/**
 * ProtectedLayout — Layout principal protegido por autenticação
 * Redireciona para /login se o usuário não estiver logado
 */
function ProtectedLayout() {
  const { data: session, isPending } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Exibe loading enquanto verifica a sessão
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ch-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-ch-cyan/30 border-t-ch-cyan rounded-full animate-spin" />
          <p className="text-ch-muted text-sm">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // Redireciona se não autenticado
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Layout autenticado com Sidebar + rotas internas
  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-ch-bg font-sans text-ch-text">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto pt-14 lg:pt-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/categorias" element={<Categories />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/comandos" element={<Commands />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/conexao" element={<Connection />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/formularios" element={<Forms />} />
              <Route path="/respostas-rapidas" element={<QuickReplies />} />
              <Route path="/treinamento-ia" element={<AiTraining />} />
              <Route path="/agendamento" element={<ScheduledMessages />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/clientes" element={<Clients />} />
            </Routes>
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}

/**
 * App — Componente raiz com Router e roteamento de autenticação
 */
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Rota pública — Login */}
          <Route path="/login" element={<LoginGuard />} />
          {/* Todas as outras rotas são protegidas */}
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

/**
 * LoginGuard — Redireciona para dashboard se já estiver logado
 */
function LoginGuard() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ch-bg">
        <div className="w-12 h-12 border-4 border-ch-cyan/30 border-t-ch-cyan rounded-full animate-spin" />
      </div>
    );
  }

  // Se já está logado, redireciona para o Dashboard
  if (session) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default App;

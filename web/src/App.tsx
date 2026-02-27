import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar, MobileHeader } from './components/Sidebar';
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

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <SocketProvider>
        <Router>
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
                </Routes>
              </main>
            </div>
          </div>
        </Router>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;

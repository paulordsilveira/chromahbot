import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar, MobileHeader } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Categories } from './pages/Categories';
import { Settings } from './pages/Settings';
import { Leads } from './pages/Leads';
import { Forms } from './pages/Forms';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <SocketProvider>
        <Router>
          <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex-1 flex flex-col min-w-0">
              <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
              <main className="flex-1 overflow-auto pt-14 lg:pt-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/categorias" element={<Categories />} />
                  <Route path="/configuracoes" element={<Settings />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/formularios" element={<Forms />} />
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

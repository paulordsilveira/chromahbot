import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Settings, MessageSquare, Users, FileText, Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { theme, toggleTheme } = useTheme();
    
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/categorias', icon: List, label: 'Categorias' },
        { path: '/formularios', icon: FileText, label: 'Formulários' },
        { path: '/leads', icon: Users, label: 'Leads' },
        { path: '/configuracoes', icon: Settings, label: 'Configurações' },
    ];

    const handleNavClick = () => {
        if (window.innerWidth < 1024) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-gray-900 dark:bg-gray-950 text-white flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 lg:p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="text-blue-500" />
                        <span className="hidden xs:inline">Corretando</span>
                    </h2>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 hover:bg-gray-800 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <nav className="flex-1 p-3 lg:p-4 overflow-y-auto">
                    <ul className="space-y-1 lg:space-y-2">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    onClick={handleNavClick}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 p-3 rounded transition-colors ${
                                            isActive 
                                                ? 'bg-blue-600' 
                                                : 'hover:bg-gray-800'
                                        }`
                                    }
                                >
                                    <item.icon size={20} />
                                    <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
                
                {/* Theme toggle */}
                <div className="p-3 lg:p-4 border-t border-gray-800">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
                    >
                        {theme === 'light' ? (
                            <>
                                <Moon size={18} />
                                <span className="text-sm">Modo Escuro</span>
                            </>
                        ) : (
                            <>
                                <Sun size={18} />
                                <span className="text-sm">Modo Claro</span>
                            </>
                        )}
                    </button>
                </div>
                
                <div className="p-3 lg:p-4 border-t border-gray-800 text-sm text-gray-400 text-center">
                    v1.0.0
                </div>
            </div>
        </>
    );
};

export const MobileHeader: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const { theme, toggleTheme } = useTheme();
    
    return (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <div className="flex items-center justify-between">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                    <Menu size={24} className="text-gray-700 dark:text-gray-300" />
                </button>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="text-blue-500" size={20} />
                    Corretando
                </h1>
                <button
                    onClick={toggleTheme}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                    {theme === 'light' ? (
                        <Moon size={20} className="text-gray-700" />
                    ) : (
                        <Sun size={20} className="text-gray-300" />
                    )}
                </button>
            </div>
        </header>
    );
};

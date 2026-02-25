import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Settings, MessageSquare, FileText, Menu, X, Briefcase, Zap } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Conexão WPP' },
        { path: '/categorias', icon: List, label: 'Categorias' },
        { path: '/crm', icon: Briefcase, label: 'CRM' },
        { path: '/formularios', icon: FileText, label: 'Formulários' },
        { path: '/leads', icon: MessageSquare, label: 'WhatsApp' },
        { path: '/comandos', icon: Zap, label: 'Comandos' },
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-ch-surface text-ch-text flex flex-col
                border-r border-ch-border
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 lg:p-6 border-b border-ch-border flex items-center justify-between">
                    <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                        <Zap className="text-ch-cyan" size={24} />
                        <span className="hidden xs:inline bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent">ChromaH</span>
                    </h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 hover:bg-ch-surface-2 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-3 lg:p-4 overflow-y-auto">
                    <ul className="space-y-1 lg:space-y-1.5">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    onClick={handleNavClick}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${isActive
                                            ? 'gradient-btn text-ch-bg font-semibold shadow-lg'
                                            : 'text-ch-muted hover:text-ch-text hover:bg-ch-surface-2'
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

                <div className="p-3 lg:p-4 border-t border-ch-border text-xs text-ch-muted text-center">
                    ChromaH Bot v1.0
                </div>
            </div>
        </>
    );
};

export const MobileHeader: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    return (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-ch-surface/90 backdrop-blur-md border-b border-ch-border px-4 py-3">
            <div className="flex items-center justify-between">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-ch-surface-2 rounded-lg transition-colors"
                >
                    <Menu size={24} className="text-ch-text" />
                </button>
                <h1 className="text-lg font-bold flex items-center gap-2">
                    <Zap className="text-ch-cyan" size={20} />
                    <span className="bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent">ChromaH</span>
                </h1>
                <div className="w-10" /> {/* Spacer for center alignment */}
            </div>
        </header>
    );
};

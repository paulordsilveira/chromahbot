import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Settings, MessageSquare, FileText, Menu, X, Briefcase, Zap, Brain, Calendar, Send, Smartphone, Megaphone, Users } from 'lucide-react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const [isAiEnabled, setIsAiEnabled] = useState(true);

    useEffect(() => {
        axios.get(`${API_URL}/config`).then(({ data }) => {
            setIsAiEnabled(data?.isAiEnabled !== 0);
        }).catch(() => { });
    }, []);

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/conexao', icon: Smartphone, label: 'Conexão' },
        { path: '/categorias', icon: List, label: 'Categorias' },
        { path: '/crm', icon: Briefcase, label: 'CRM' },
        { path: '/clientes', icon: Users, label: 'Clientes' },
        { path: '/formularios', icon: FileText, label: 'Formulários' },
        { path: '/leads', icon: MessageSquare, label: 'Leads & Tickets' },
        { path: '/comandos', icon: Zap, label: 'Comandos' },
        { path: '/respostas-rapidas', icon: Send, label: 'Respostas Rápidas' },
        { path: '/agendamento', icon: Calendar, label: 'Agendamento' },
        { path: '/treinamento-ia', icon: Brain, label: 'Treinar IA' },
        { path: '/marketing', icon: Megaphone, label: 'Marketing' },
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

                <div className="p-3 lg:p-4 border-t border-ch-border text-center">
                    <p className="text-xs text-ch-muted">ChromaH Bot v2.0</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isAiEnabled ? 'bg-ch-cyan/15 text-ch-cyan' : 'bg-ch-magenta/15 text-ch-magenta'}`}>
                        {isAiEnabled ? '🧠 IA Ativa' : '📋 Modo URA'}
                    </span>
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
                <div className="w-10" />
            </div>
        </header>
    );
};

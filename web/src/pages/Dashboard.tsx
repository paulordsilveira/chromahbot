import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { QRCodeCanvas } from 'qrcode.react';
import {
    Users, MessageSquare, TrendingUp, Activity, BarChart3, Clock, Brain,
    Download, Tag, Zap, Calendar, Send, FileText, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

interface Metrics {
    totalContacts: number;
    totalMessages: number;
    todayMessages: number;
    weekMessages: number;
    todayLeads: number;
    weekLeads: number;
    totalForms: number;
    activeToday: number;
    isAiEnabled: boolean;
    dailyMessages: { day: string; count: number; role: string }[];
    topCategories: { name: string; emoji: string; mentions: number }[];
    formsByType: { type: string; count: number }[];
}

export const Dashboard: React.FC = () => {
    const { status, qrCode } = useSocket();
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetrics();
        const interval = setInterval(loadMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadMetrics = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/metrics`);
            setMetrics(data);
        } catch (e) {
            console.error('Erro ao carregar métricas:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = () => {
        if (status === 'open') return 'bg-emerald-500';
        if (status === 'connecting') return 'bg-yellow-500 animate-pulse';
        return 'bg-red-500';
    };

    const getStatusText = () => {
        if (status === 'open') return 'Conectado';
        if (status === 'connecting') return 'Conectando...';
        return 'Desconectado';
    };

    // Preparar dados do gráfico de barras simplificado
    const getChartData = () => {
        if (!metrics?.dailyMessages) return [];
        const days: Record<string, { user: number; assistant: number }> = {};
        metrics.dailyMessages.forEach(d => {
            if (!days[d.day]) days[d.day] = { user: 0, assistant: 0 };
            if (d.role === 'user') days[d.day].user = d.count;
            else days[d.day].assistant = d.count;
        });
        return Object.entries(days).map(([day, counts]) => ({
            label: new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
            user: counts.user,
            assistant: counts.assistant,
            total: counts.user + counts.assistant,
        }));
    };

    const chartData = getChartData();
    const maxMessages = Math.max(...chartData.map(d => d.total), 1);

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-ch-text">Dashboard</h1>
                    <p className="text-ch-muted">Visão geral do seu assistente</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                    <span className="text-ch-text font-medium">{getStatusText()}</span>
                    {metrics?.isAiEnabled ? (
                        <span className="px-3 py-1 bg-ch-cyan/15 text-ch-cyan rounded-full text-xs font-bold">🧠 IA Ativa</span>
                    ) : (
                        <span className="px-3 py-1 bg-ch-magenta/15 text-ch-magenta rounded-full text-xs font-bold">📋 Modo URA</span>
                    )}
                </div>
            </div>

            {/* QR Code se não conectado */}
            {status !== 'open' && qrCode && (
                <div className="glass rounded-2xl p-8 border border-ch-border mb-8 flex flex-col items-center gap-4">
                    <h2 className="text-xl font-bold text-ch-text">Escaneie o QR Code</h2>
                    <div className="bg-white p-4 rounded-2xl shadow-xl">
                        <QRCodeCanvas value={qrCode} size={240} />
                    </div>
                    <p className="text-ch-muted text-sm">Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar</p>
                </div>
            )}

            {/* Cards de métricas */}
            {metrics && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <MetricCard icon={Users} label="Total Contatos" value={metrics.totalContacts} color="cyan" />
                        <MetricCard icon={MessageSquare} label="Msgs Hoje" value={metrics.todayMessages} sub={`${metrics.weekMessages} na semana`} color="purple" />
                        <MetricCard icon={TrendingUp} label="Leads Hoje" value={metrics.todayLeads} sub={`${metrics.weekLeads} na semana`} color="magenta" />
                        <MetricCard icon={Activity} label="Ativos Hoje" value={metrics.activeToday} sub={`${metrics.totalForms} formulários`} color="cyan" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Gráfico de barras - Mensagens por dia */}
                        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-ch-border">
                            <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2">
                                <BarChart3 size={20} className="text-ch-cyan" /> Mensagens (7 dias)
                            </h3>
                            {chartData.length > 0 ? (
                                <div className="flex items-end gap-2 h-48">
                                    {chartData.map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-xs text-ch-muted">{d.total}</span>
                                            <div className="w-full flex flex-col gap-0.5" style={{ height: `${(d.total / maxMessages) * 100}%`, minHeight: '4px' }}>
                                                <div className="bg-ch-cyan rounded-t" style={{ flex: d.assistant }} />
                                                <div className="bg-ch-purple rounded-b" style={{ flex: d.user }} />
                                            </div>
                                            <span className="text-[10px] text-ch-muted">{d.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-48 flex items-center justify-center text-ch-muted text-sm">Sem dados ainda</div>
                            )}
                            <div className="flex gap-4 mt-3 text-xs text-ch-muted">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-ch-purple" /> Recebidas</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-ch-cyan" /> Enviadas</span>
                            </div>
                        </div>

                        {/* Top Categorias */}
                        <div className="glass rounded-2xl p-6 border border-ch-border">
                            <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2">
                                <Tag size={20} className="text-ch-purple" /> Categorias Populares
                            </h3>
                            <div className="space-y-3">
                                {metrics.topCategories.length > 0 ? metrics.topCategories.map((cat, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-ch-surface-2 rounded-xl">
                                        <span className="text-ch-text text-sm font-medium">{cat.emoji || '📂'} {cat.name}</span>
                                        <span className="text-ch-muted text-xs">{cat.mentions} menções</span>
                                    </div>
                                )) : (
                                    <p className="text-ch-muted text-sm text-center py-4">Sem dados</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Formulários por tipo */}
                    {metrics.formsByType.length > 0 && (
                        <div className="glass rounded-2xl p-6 border border-ch-border mb-8">
                            <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-ch-magenta" /> Formulários por Tipo
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {metrics.formsByType.map((f, i) => (
                                    <div key={i} className="bg-ch-surface-2 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-bold text-ch-text">{f.count}</p>
                                        <p className="text-xs text-ch-muted capitalize">{f.type.replace(/_/g, ' ')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Export */}
                    <div className="glass rounded-2xl p-6 border border-ch-border">
                        <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2">
                            <Download size={20} className="text-ch-cyan" /> Exportar Dados
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { type: 'contacts', label: 'Contatos', icon: Users },
                                { type: 'messages', label: 'Mensagens', icon: MessageSquare },
                                { type: 'forms', label: 'Formulários', icon: FileText },
                                { type: 'leads', label: 'Leads', icon: TrendingUp },
                            ].map(item => (
                                <div key={item.type} className="flex gap-2">
                                    <a
                                        href={`${API_URL}/export/${item.type}?format=csv`}
                                        download
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-ch-surface-2 hover:bg-ch-cyan/10 text-ch-text rounded-xl text-sm font-medium transition-colors"
                                    >
                                        <item.icon size={16} /> {item.label} CSV
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {loading && !metrics && (
                <div className="flex justify-center items-center h-[40vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ch-cyan" />
                </div>
            )}
        </div>
    );
};

// ─── MetricCard Component ───
const MetricCard: React.FC<{ icon: any; label: string; value: number; sub?: string; color: string }> = ({ icon: Icon, label, value, sub, color }) => (
    <div className={`glass rounded-2xl p-5 border border-ch-border hover:border-ch-${color}/30 transition-colors`}>
        <div className="flex items-center justify-between mb-2">
            <Icon size={20} className={`text-ch-${color}`} />
        </div>
        <p className="text-2xl font-bold text-ch-text">{value}</p>
        <p className="text-xs text-ch-muted">{label}</p>
        {sub && <p className="text-[10px] text-ch-muted/60 mt-1">{sub}</p>}
    </div>
);

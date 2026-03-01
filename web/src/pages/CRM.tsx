import React, { useState, useEffect } from 'react';
import { Search, Eye, User, Phone, Mail, Calendar, LayoutGrid, List, X, Save, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

const STATUS_OPTIONS = [
    { key: 'atendido', label: 'Atendido', color: 'bg-ch-cyan', emoji: '🔵' },
    { key: 'cadastrado', label: 'Cadastrado', color: 'bg-cyan-500', emoji: '🔷' },
    { key: 'em_negociacao', label: 'Em negociação', color: 'bg-yellow-500', emoji: '🟡' },
    { key: 'locado', label: 'Locado', color: 'bg-purple-500', emoji: '🟣' },
    { key: 'finalizado', label: 'Finalizado', color: 'bg-ch-surface0', emoji: '⚫' },
    { key: 'contrato_elaborado', label: 'Contrato Elaborado', color: 'bg-indigo-500', emoji: '🔮' },
    { key: 'pendente', label: 'Pendente', color: 'bg-orange-500', emoji: '🟠' },
    { key: 'pago', label: 'Pago', color: 'bg-emerald-500', emoji: '🟢' },
    { key: 'concluido', label: 'Concluído', color: 'bg-emerald-600', emoji: '✅' },
];

interface StatusHistorico {
    status: string;
    data: string;
    info?: string;
}

interface CRMClient {
    id: string;
    contactId?: number;
    formId?: number;
    origem: string;
    nome: string;
    contato: string;
    cpf?: string;
    email?: string;
    statusAtual: string;
    statusHistorico: StatusHistorico[];
    observacao?: string;
    createdAt: string;
    messageCount?: number;
    lastMessage?: string;
    type: 'contact' | 'form';
    endereco?: string;
    rg?: string;
    renda?: string;
    ocupacao?: string;
    profilePicUrl?: string;
}

interface ChatMessage {
    id: number;
    contactId: number;
    timestamp: string;
    fromMe: number;
    content: string;
}

type ViewMode = 'kanban' | 'table';

export const CRM: React.FC = () => {
    const [clients, setClients] = useState<CRMClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterOrigem, setFilterOrigem] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');

    const [selectedClient, setSelectedClient] = useState<CRMClient | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusInfo, setStatusInfo] = useState('');

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [loadingChat, setLoadingChat] = useState(false);

    useEffect(() => {
        if (selectedClient && selectedClient.type === 'contact') {
            loadChatMessages(selectedClient.contactId!);
        } else {
            setChatMessages([]);
        }
    }, [selectedClient]);

    const loadChatMessages = async (contactId: number) => {
        try {
            setLoadingChat(true);
            const { data } = await axios.get(`${API_URL}/crm/contact/${contactId}/messages`);
            setChatMessages(data);
        } catch (err) {
            console.error("Failed to load chat", err);
        } finally {
            setLoadingChat(false);
        }
    };

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_URL}/crm`);
            setClients(Array.isArray(data) ? data : []);
        } catch {
            setError('Falha ao carregar dados do CRM.');
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(c => {
        if (filterStatus && c.statusAtual !== filterStatus) return false;
        if (filterOrigem && c.origem !== filterOrigem) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            c.nome?.toLowerCase().includes(s) ||
            c.contato?.includes(s) ||
            c.cpf?.includes(s) ||
            c.email?.toLowerCase().includes(s)
        );
    });

    const clientsByStatus = STATUS_OPTIONS.reduce((acc, st) => {
        acc[st.key] = filteredClients.filter(c => c.statusAtual === st.key);
        return acc;
    }, {} as Record<string, CRMClient[]>);

    const openStatusModal = (client: CRMClient, status: string) => {
        setSelectedClient(client);
        setNewStatus(status);
        setStatusInfo('');
        setShowStatusModal(true);
    };

    const confirmStatusChange = async () => {
        if (!selectedClient) return;
        try {
            const historico: StatusHistorico = {
                status: newStatus,
                data: new Date().toISOString(),
                info: statusInfo || undefined,
            };
            const statusHistorico = [...(selectedClient.statusHistorico || []), historico];

            const type = selectedClient.type;
            const id = type === 'contact' ? selectedClient.contactId : selectedClient.formId;

            await axios.put(`${API_URL}/crm/${type}/${id}/status`, {
                statusAtual: newStatus,
                statusHistorico,
            });

            setShowStatusModal(false);
            loadClients();
        } catch {
            setError('Erro ao atualizar status.');
        }
    };

    const getStatusInfo = (key: string) => STATUS_OPTIONS.find(s => s.key === key) || STATUS_OPTIONS[0];

    const ClientCard: React.FC<{ client: CRMClient }> = ({ client }) => {
        const status = getStatusInfo(client.statusAtual);
        return (
            <div className="glass rounded-xl shadow p-3 mb-2 border-l-4" style={{ borderLeftColor: status.color.replace('bg-', '#').replace('-500', '') }}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {client.profilePicUrl ? (
                            <img src={client.profilePicUrl} alt={client.nome} className="w-8 h-8 rounded-full object-cover shrink-0 border border-ch-border" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-ch-surface flex items-center justify-center shrink-0 border border-ch-border text-ch-muted">
                                <User size={14} />
                            </div>
                        )}
                        <h4 className="font-medium text-sm text-ch-text truncate">{client.nome || 'Sem nome'}</h4>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${client.origem === 'bot' ? 'bg-emerald-500/10 text-green-700' : 'bg-ch-cyan/10 text-ch-cyan'}`}>
                        {client.origem === 'bot' ? '🤖 Bot' : '📝 Form'}
                    </span>
                </div>
                <div className="text-xs text-ch-muted space-y-1">
                    {client.contato && <div className="flex items-center gap-1"><Phone size={12} /> {client.contato}</div>}
                    {client.email && <div className="flex items-center gap-1"><Mail size={12} /> {client.email}</div>}
                    <div className="flex items-center gap-1"><Calendar size={12} /> {new Date(client.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
                <div className="mt-2 flex gap-1">
                    <button
                        onClick={() => setSelectedClient(client)}
                        className="flex-1 text-xs bg-ch-surface-2 hover:bg-ch-surface-2 hover:bg-ch-surface-2 px-2 py-1 rounded flex items-center justify-center gap-1 text-ch-text"
                    >
                        <Eye size={12} /> Ver
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-ch-text">CRM</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-ch-cyan text-white' : 'bg-gray-200 bg-ch-surface-2 text-ch-text'}`}
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded ${viewMode === 'table' ? 'bg-ch-cyan text-white' : 'bg-gray-200 bg-ch-surface-2 text-ch-text'}`}
                    >
                        <List size={20} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-ch-magenta/10 bg-ch-magenta/10 border border-ch-magenta/30 border-ch-magenta/30 text-ch-magenta text-ch-magenta p-3 rounded flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, contato, CPF..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-ch-border rounded-xl bg-ch-surface text-ch-text"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="border border-ch-border rounded-xl px-3 py-2 bg-ch-surface text-ch-text"
                    >
                        <option value="">Todos Status</option>
                        {STATUS_OPTIONS.map(s => (
                            <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterOrigem}
                        onChange={e => setFilterOrigem(e.target.value)}
                        className="border border-ch-border rounded-xl px-3 py-2 bg-ch-surface text-ch-text"
                    >
                        <option value="">Todas Origens</option>
                        <option value="bot">🤖 Bot</option>
                        <option value="formulario">📝 Formulário</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-ch-text">Carregando...</div>
            ) : viewMode === 'kanban' ? (
                /* Kanban View */
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-4 min-w-max">
                        {STATUS_OPTIONS.map(status => (
                            <div key={status.key} className="w-72 flex-shrink-0">
                                <div className={`${status.color} text-white px-3 py-2 rounded-t-lg font-medium flex items-center justify-between`}>
                                    <span>{status.emoji} {status.label}</span>
                                    <span className="bg-ch-surface/20 px-2 py-0.5 rounded text-sm">{clientsByStatus[status.key]?.length || 0}</span>
                                </div>
                                <div className="bg-ch-surface-2 bg-ch-bg rounded-b-lg p-2 min-h-[200px] max-h-[60vh] overflow-y-auto">
                                    {clientsByStatus[status.key]?.map(client => (
                                        <ClientCard key={client.id} client={client} />
                                    ))}
                                    {(!clientsByStatus[status.key] || clientsByStatus[status.key].length === 0) && (
                                        <div className="text-center text-ch-muted text-sm py-4">Nenhum cliente</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* Table View */
                <div className="glass rounded-xl shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-ch-bg">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-ch-muted">Nome</th>
                                    <th className="text-left p-3 text-sm font-medium text-ch-muted">Contato</th>
                                    <th className="text-left p-3 text-sm font-medium text-ch-muted">Origem</th>
                                    <th className="text-left p-3 text-sm font-medium text-ch-muted">Status</th>
                                    <th className="text-left p-3 text-sm font-medium text-ch-muted">Data</th>
                                    <th className="text-right p-3 text-sm font-medium text-ch-muted">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(client => {
                                    const status = getStatusInfo(client.statusAtual);
                                    return (
                                        <tr key={client.id} className="border-t border-ch-border hover:bg-ch-surface-2 hover:bg-ch-surface-2">
                                            <td className="p-3 text-ch-text">
                                                <div className="flex items-center gap-3">
                                                    {client.profilePicUrl ? (
                                                        <img src={client.profilePicUrl} alt={client.nome} className="w-8 h-8 rounded-full object-cover shrink-0 border border-ch-border" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-ch-surface flex items-center justify-center shrink-0 border border-ch-border text-ch-muted">
                                                            <User size={14} />
                                                        </div>
                                                    )}
                                                    <span className="truncate max-w-[150px]">{client.nome || 'Sem nome'}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-ch-text">{client.contato || '-'}</td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2 py-1 rounded ${client.origem === 'bot' ? 'bg-emerald-500/10 text-green-700 dark:bg-green-900/30 text-emerald-400' : 'bg-ch-cyan/10 text-ch-cyan bg-ch-cyan/10 text-ch-cyan'}`}>
                                                    {client.origem === 'bot' ? '🤖 Bot' : '📝 Form'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`${status.color} text-white text-xs px-2 py-1 rounded`}>
                                                    {status.emoji} {status.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-ch-muted">
                                                {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => setSelectedClient(client)}
                                                    className="text-ch-cyan hover:text-ch-cyan p-1"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Client Detail Modal */}
            {selectedClient && !showStatusModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-[90vw] md:max-w-[70vw] max-h-[90vh] overflow-y-auto">
                        <div className="p-4 md:p-6 border-b border-ch-border flex justify-between items-center sticky top-0 glass z-10">
                            <h2 className="text-xl font-bold text-ch-text flex items-center gap-3">
                                {selectedClient.profilePicUrl ? (
                                    <img src={selectedClient.profilePicUrl} alt={selectedClient.nome} className="w-10 h-10 rounded-full object-cover shrink-0 border border-ch-border" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-ch-surface-2 flex items-center justify-center shrink-0 border border-ch-border text-ch-muted">
                                        <User size={20} />
                                    </div>
                                )}
                                {selectedClient.nome || 'Cliente'}
                            </h2>
                            <button onClick={() => setSelectedClient(null)} className="text-ch-muted hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 md:p-6 space-y-6">
                            {/* Status atual */}
                            <div className="bg-ch-bg p-4 rounded-xl">
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">📊 Status do Processo</label>
                                <div className="flex flex-wrap gap-2">
                                    {STATUS_OPTIONS.map(st => (
                                        <button
                                            key={st.key}
                                            type="button"
                                            onClick={() => openStatusModal(selectedClient, st.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedClient.statusAtual === st.key
                                                ? `${st.color} text-white ring-2 ring-offset-2 ring-offset-ch-bg`
                                                : 'bg-ch-surface border border-ch-border text-ch-muted hover:text-white hover:border-ch-muted'
                                                }`}
                                        >
                                            {selectedClient.statusAtual === st.key && <CheckCircle size={12} className="inline mr-1" />}
                                            {st.emoji} {st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Informações */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">Nome</label>
                                    <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.nome || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">Contato</label>
                                    <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.contato || '-'}</div>
                                </div>
                                {selectedClient.cpf && (
                                    <div>
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">CPF</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.cpf}</div>
                                    </div>
                                )}
                                {selectedClient.email && (
                                    <div>
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">E-mail</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.email}</div>
                                    </div>
                                )}
                                {selectedClient.endereco && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">Endereço</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.endereco}</div>
                                    </div>
                                )}
                                {selectedClient.rg && (
                                    <div>
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">RG</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.rg}</div>
                                    </div>
                                )}
                                {selectedClient.renda && (
                                    <div>
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">Renda</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.renda}</div>
                                    </div>
                                )}
                                {selectedClient.ocupacao && (
                                    <div>
                                        <label className="block text-sm font-semibold text-ch-text text-ch-text mb-1">Ocupação</label>
                                        <div className="p-3 bg-ch-bg rounded text-ch-text">{selectedClient.ocupacao}</div>
                                    </div>
                                )}
                            </div>

                            {/* Origem e Data */}
                            <div className="flex gap-4 text-sm">
                                <div className={`px-3 py-1 rounded ${selectedClient.origem === 'bot' ? 'bg-emerald-500/10 text-green-700' : 'bg-ch-cyan/10 text-ch-cyan'}`}>
                                    {selectedClient.origem === 'bot' ? '🤖 Veio do Bot' : '📝 Veio do Formulário'}
                                </div>
                                <div className="flex items-center gap-1 text-ch-muted">
                                    <Calendar size={14} /> {new Date(selectedClient.createdAt).toLocaleString('pt-BR')}
                                </div>
                            </div>

                            {/* Histórico de Status */}
                            {selectedClient.statusHistorico && selectedClient.statusHistorico.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text text-ch-text mb-2">🕐 Histórico de Status</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {selectedClient.statusHistorico.slice().reverse().map((h, i) => {
                                            const st = getStatusInfo(h.status);
                                            return (
                                                <div key={i} className="flex items-center gap-3 text-sm bg-ch-bg p-2 rounded">
                                                    <span className={`${st.color} text-white px-2 py-0.5 rounded text-xs`}>{st.emoji} {st.label}</span>
                                                    <span className="text-ch-muted">{new Date(h.data).toLocaleString('pt-BR')}</span>
                                                    {h.info && <span className="text-ch-muted text-ch-text">- {h.info}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Histórico Chat */}
                            {selectedClient.type === 'contact' && (
                                <div className="mt-6">
                                    <label className="block text-sm font-semibold text-ch-text mb-2 border-b border-ch-border pb-2 flex items-center justify-between">
                                        <span>💬 Histórico de Conversa</span>
                                        <span className="text-xs font-normal opacity-70 bg-ch-surface px-2 py-0.5 rounded-full border border-ch-border">{chatMessages.length} msgs</span>
                                    </label>
                                    <div className="bg-[#0b141a] rounded-xl overflow-hidden shadow-inner border border-ch-border flex flex-col max-h-[450px]">
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col">
                                            {loadingChat ? (
                                                <div className="text-center py-10 opacity-50 text-xs text-ch-text">Carregando histórico...</div>
                                            ) : chatMessages.length === 0 ? (
                                                <div className="text-center py-10 opacity-50 text-xs text-ch-text">Nenhuma mensagem registrada.</div>
                                            ) : (
                                                chatMessages.map((msg, i) => {
                                                    const isMe = msg.fromMe === 1;
                                                    return (
                                                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm ${isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm' : 'bg-[#202c33] text-[#e9edef] rounded-tl-sm'}`}>
                                                                <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</div>
                                                                <div className="flex justify-end items-center gap-1 mt-1">
                                                                    <span className="text-[10px] text-white/50">{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 md:p-6 border-t border-ch-border sticky bottom-0 glass">
                            <button onClick={() => setSelectedClient(null)} className="w-full px-4 py-3 bg-ch-surface-2 text-white font-medium rounded-xl border border-ch-border hover:bg-ch-purple transition-colors shadow-lg">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Change Modal */}
            {showStatusModal && selectedClient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-[95vw] md:max-w-[50vw]">
                        <div className="p-4 border-b border-ch-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-ch-text">
                                Alterar Status para: {STATUS_OPTIONS.find(s => s.key === newStatus)?.emoji} {STATUS_OPTIONS.find(s => s.key === newStatus)?.label}
                            </h3>
                            <button onClick={() => setShowStatusModal(false)} className="text-ch-muted hover:text-ch-text text-ch-muted">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">
                                    Informações Adicionais <span className="text-ch-muted text-xs">(opcional)</span>
                                </label>
                                <textarea
                                    value={statusInfo}
                                    onChange={e => setStatusInfo(e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 h-24 bg-ch-surface-2 text-ch-text"
                                    placeholder="Observações sobre esta mudança de status..."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 border border-ch-border rounded hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text">
                                Cancelar
                            </button>
                            <button onClick={confirmStatusChange} className="px-4 py-2 bg-ch-cyan text-white rounded hover:bg-ch-cyan/80 flex items-center gap-2">
                                <Save size={16} /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

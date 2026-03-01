import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronRight, User, MessageCircle, Bell, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

// ─── Tipos ───
type MessageLog = {
  id: number;
  content: string;
  role: string;
  timestamp: string;
};

type LeadTicket = {
  id: number;
  contactId: number;
  type: 'lead' | 'atendimento';
  status: string;
  summary?: string;
  notifiedAt: string;
  attendedAt?: string;
  contactName?: string;
  contactPhone?: string;
  profilePicUrl?: string;
  jid?: string;
  messages?: MessageLog[]; // Mensagens agora vêm junto do ticket
};

// ─── Componente Principal ───
export const Leads: React.FC = () => {
  const [tickets, setTickets] = useState<LeadTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<string>('all');
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [summarizingId, setSummarizingId] = useState<number | null>(null);
  // Controle de sub-abas dentro do ticket expandido (resumo vs conversa)
  const [ticketSubTab, setTicketSubTab] = useState<Record<number, 'resumo' | 'conversa'>>({});

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        // Tickets agora já vêm com as mensagens do contato incluídas
        const [ticketsRes, statusesRes] = await Promise.all([
          axios.get(`${API_URL}/lead-tickets`),
          axios.get(`${API_URL}/lead-status`)
        ]);
        setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);
        setLeadStatuses(Array.isArray(statusesRes.data) ? statusesRes.data : []);
      } catch (e) {
        setError('Falha ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Expandir/recolher bloco do ticket
  const toggleExpand = (id: number) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Atualizar status do ticket
  const updateTicketStatus = async (ticketId: number, status: string) => {
    try {
      await axios.put(`${API_URL}/lead-tickets/${ticketId}/status`, { status });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status, ...(status === 'Atendido' || status === 'Finalizado' ? { attendedAt: new Date().toISOString() } : {}) } : t));
    } catch (e) {
      setError('Falha ao atualizar status.');
    }
  };

  // Resumir conversa com IA
  const handleSummarize = async (ticketId: number) => {
    try {
      setSummarizingId(ticketId);
      const res = await axios.post(`${API_URL}/lead-tickets/${ticketId}/summarize`);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, summary: res.data.summary } : t));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao gerar resumo');
    } finally {
      setSummarizingId(null);
    }
  };

  // Iniciais do nome para avatar fallback
  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  // Filtro de tickets
  const filteredTickets = tickets.filter(t => {
    if (ticketFilter !== 'all' && t.status !== ticketFilter) return false;
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      t.contactName?.toLowerCase().includes(lower) ||
      t.contactPhone?.toLowerCase().includes(lower) ||
      t.summary?.toLowerCase().includes(lower)
    );
  });

  // Quantidade de pendentes para badge
  const pendingCount = tickets.filter(t => t.status === 'Pendente' || t.status === 'pending').length;

  // Badge de status dinâmico
  const getStatusBadge = (statusName: string) => {
    const found = leadStatuses.find(s => s.name === statusName);
    if (found) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-current/20 ${found.color}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div> {found.name}
        </span>
      );
    }
    // Fallbacks para status legado
    switch (statusName?.toLowerCase()) {
      case 'pendente':
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20"><Clock size={12} /> Pendente</span>;
      case 'atendido':
      case 'attended':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-ch-cyan/15 text-ch-cyan border border-ch-cyan/20"><CheckCircle size={12} /> Atendido</span>;
      case 'finalizado':
      case 'closed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-ch-muted/15 text-ch-muted border border-ch-border"><XCircle size={12} /> Finalizado</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-ch-surface-2 text-ch-text border border-ch-border">{statusName}</span>;
    }
  };

  // Badge de tipo
  const getTypeBadge = (type: string) => {
    return type === 'atendimento'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-ch-magenta/15 text-ch-magenta">🔴 Atendimento</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-400">🟢 Lead</span>;
  };

  // Obter sub-aba ativa do ticket
  const getSubTab = (ticketId: number) => ticketSubTab[ticketId] || 'resumo';

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ch-text">Leads & Tickets</h1>
          <p className="text-sm text-ch-muted mt-1">Acompanhe leads, interações e histórico de conversas</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            <Bell size={18} className="text-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-400">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou mensagem..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-ch-surface-2 border border-ch-border rounded-xl p-3 focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan text-ch-text placeholder-ch-muted outline-none transition-all"
        />
        <div className="flex items-center gap-1 bg-ch-surface-2 border border-ch-border rounded-xl p-1 overflow-x-auto no-scrollbar max-w-full">
          <Filter size={14} className="text-ch-muted ml-2 flex-shrink-0" />
          <button
            onClick={() => setTicketFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap ${ticketFilter === 'all'
              ? 'bg-ch-cyan/20 text-ch-cyan'
              : 'text-ch-muted hover:text-ch-text'
              }`}
          >
            Todos
          </button>
          {leadStatuses.map(f => (
            <button
              key={f.id}
              onClick={() => setTicketFilter(f.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 whitespace-nowrap ${ticketFilter === f.name
                ? 'bg-ch-cyan/20 text-ch-cyan'
                : 'text-ch-muted hover:text-ch-text'
                }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-ch-magenta/10 border border-ch-magenta/30 text-ch-magenta p-3 rounded-xl">{error}</div>
      )}

      {/* Lista de Tickets — agora com conversa embutida no bloco */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass rounded-2xl border border-ch-border p-6 text-ch-muted">Carregando...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="glass rounded-2xl border border-ch-border p-8 text-center">
            <Bell size={40} className="text-ch-muted/30 mx-auto mb-3" />
            <p className="text-ch-muted">Nenhum ticket encontrado.</p>
            <p className="text-xs text-ch-muted/60 mt-1">Os tickets aparecem quando novos contatos conversam com o bot.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket.id} className="glass rounded-2xl border border-ch-border overflow-hidden">
              {/* Header do ticket — clicável para expandir */}
              <div
                className="flex items-center gap-3 md:gap-4 p-3 md:p-4 cursor-pointer hover:bg-ch-surface-2 transition-colors"
                onClick={() => toggleExpand(ticket.id)}
              >
                {/* Avatar */}
                {ticket.profilePicUrl ? (
                  <img
                    src={ticket.profilePicUrl}
                    alt={ticket.contactName || 'Avatar'}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-ch-cyan/10 flex items-center justify-center text-ch-cyan font-bold flex-shrink-0 ${ticket.profilePicUrl ? 'hidden' : ''}`}>
                  {getInitials(ticket.contactName)}
                </div>

                {/* Info do contato */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base md:text-lg text-ch-text truncate">{ticket.contactName || 'Sem nome'}</span>
                    {getTypeBadge(ticket.type)}
                  </div>
                  <div className="text-xs md:text-sm text-ch-muted flex flex-wrap items-center gap-1 md:gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><User size={12} /> {ticket.contactPhone}</span>
                    <span className="hidden sm:inline text-ch-border">|</span>
                    <span>{new Date(ticket.notifiedAt).toLocaleString('pt-BR')}</span>
                    {ticket.messages && ticket.messages.length > 0 && (
                      <>
                        <span className="hidden sm:inline text-ch-border">|</span>
                        <span className="flex items-center gap-1 text-ch-cyan"><MessageCircle size={12} /> {ticket.messages.length} msgs</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + chevron */}
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticket.status)}
                  <button className="text-ch-muted p-1">
                    {expanded.includes(ticket.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                </div>
              </div>

              {/* Bloco expandido — Resumo + Conversa embutida */}
              {expanded.includes(ticket.id) && (
                <div className="border-t border-ch-border bg-ch-bg">
                  {/* Sub-abas: Resumo | Conversa */}
                  <div className="flex border-b border-ch-border">
                    <button
                      onClick={() => setTicketSubTab(prev => ({ ...prev, [ticket.id]: 'resumo' }))}
                      className={`px-4 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${getSubTab(ticket.id) === 'resumo' ? 'border-ch-cyan text-ch-cyan' : 'border-transparent text-ch-muted hover:text-ch-text'}`}
                    >
                      <Bell size={13} /> Resumo & Ações
                    </button>
                    <button
                      onClick={() => setTicketSubTab(prev => ({ ...prev, [ticket.id]: 'conversa' }))}
                      className={`px-4 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${getSubTab(ticket.id) === 'conversa' ? 'border-ch-cyan text-ch-cyan' : 'border-transparent text-ch-muted hover:text-ch-text'}`}
                    >
                      <MessageCircle size={13} /> Conversa ({ticket.messages?.length || 0})
                    </button>
                  </div>

                  {/* Sub-aba: Resumo & Ações */}
                  {getSubTab(ticket.id) === 'resumo' && (
                    <div className="p-3 md:p-4">
                      {/* Resumo da conversa */}
                      {ticket.summary && (
                        <div className="mb-4">
                          <div className="text-xs font-bold text-ch-muted uppercase mb-2">Resumo da Conversa</div>
                          <div className="bg-ch-surface-2 rounded-xl p-3 text-sm text-ch-text whitespace-pre-wrap">
                            {ticket.summary}
                          </div>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex gap-4 flex-wrap items-center mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ch-muted uppercase">Alterar Status:</span>
                          <select
                            value={ticket.status}
                            onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                            className="bg-ch-surface p-2 rounded-lg text-sm text-ch-text border border-ch-border focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          >
                            {leadStatuses.map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-px h-6 bg-ch-border hidden sm:block"></div>

                        <button
                          onClick={() => handleSummarize(ticket.id)}
                          disabled={summarizingId === ticket.id}
                          className="px-4 py-2 bg-gradient-to-br from-ch-purple/20 to-ch-magenta/20 border border-ch-purple/30 text-ch-text hover:from-ch-purple/30 hover:to-ch-magenta/30 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {summarizingId === ticket.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-ch-purple/30 border-b-ch-purple rounded-full"></div>
                          ) : (
                            <span className="text-ch-purple">✨</span>
                          )}
                          {summarizingId === ticket.id ? 'Resumindo...' : 'Resumir com IA'}
                        </button>

                        {ticket.attendedAt && (
                          <span className="text-xs text-ch-muted ml-auto hidden sm:block">
                            Última interação: {new Date(ticket.attendedAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-aba: Conversa (histórico de mensagens embutido no bloco do lead) */}
                  {getSubTab(ticket.id) === 'conversa' && (
                    <div className="p-3 md:p-4 max-h-96 overflow-y-auto">
                      {ticket.messages && ticket.messages.length > 0 ? (
                        <div className="space-y-2">
                          {ticket.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`p-2 md:p-3 rounded-xl max-w-[90%] md:max-w-[80%] ${m.role === 'user'
                                ? 'bg-ch-cyan/10 border border-ch-cyan/20 ml-auto text-right'
                                : 'bg-ch-surface-2 border border-ch-border'
                                }`}
                            >
                              <div className="text-xs text-ch-muted mb-1">
                                {m.role === 'user' ? '👤 Cliente' : '🤖 Bot'} • {new Date(m.timestamp).toLocaleString('pt-BR')}
                              </div>
                              <div className="whitespace-pre-wrap text-xs md:text-sm text-ch-text">{m.content}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MessageCircle size={32} className="text-ch-muted/30 mx-auto mb-2" />
                          <p className="text-ch-muted text-sm">Nenhuma mensagem registrada para este contato.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

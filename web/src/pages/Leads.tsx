import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronRight, User, MessageCircle, Bell, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

type LeadTicket = {
  id: number;
  contactId: number;
  type: 'lead' | 'atendimento';
  status: 'pending' | 'attended' | 'closed';
  summary?: string;
  notifiedAt: string;
  attendedAt?: string;
  contactName?: string;
  contactPhone?: string;
  profilePicUrl?: string;
  jid?: string;
};

type MessageLog = {
  id: number;
  content: string;
  role: string;
  timestamp: string;
};

type Contact = {
  id: number;
  name?: string | null;
  phone: string;
  jid?: string;
  profilePicUrl?: string | null;
  updatedAt: string;
  messages?: MessageLog[];
};

type Tab = 'tickets' | 'contacts';
type TicketFilter = 'all' | 'pending' | 'attended' | 'closed';

export const Leads: React.FC = () => {
  const [tickets, setTickets] = useState<LeadTicket[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('tickets');
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('all');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [ticketsRes, contactsRes] = await Promise.all([
          axios.get(`${API_URL}/lead-tickets`),
          axios.get(`${API_URL}/contacts`),
        ]);
        setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);
        setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      } catch (e) {
        setError('Falha ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const updateTicketStatus = async (ticketId: number, status: string) => {
    try {
      await axios.put(`${API_URL}/lead-tickets/${ticketId}/status`, { status });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: status as any, attendedAt: new Date().toISOString() } : t));
    } catch (e) {
      setError('Falha ao atualizar status.');
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

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

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(lower) ||
      c.phone?.toLowerCase().includes(lower) ||
      c.messages?.some(m => m.content.toLowerCase().includes(lower))
    );
  });

  const pendingCount = tickets.filter(t => t.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20"><Clock size={12} /> Pendente</span>;
      case 'attended':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-ch-cyan/15 text-ch-cyan border border-ch-cyan/20"><CheckCircle size={12} /> Atendido</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-ch-muted/15 text-ch-muted border border-ch-border"><XCircle size={12} /> Finalizado</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'atendimento'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-ch-magenta/15 text-ch-magenta">🔴 Atendimento</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-400">🟢 Lead</span>;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ch-text">Leads & Tickets</h1>
          <p className="text-sm text-ch-muted mt-1">Acompanhe leads e solicitações de atendimento</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
            <Bell size={18} className="text-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-400">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ch-border mb-4 overflow-x-auto no-scrollbar">
        {[
          { key: 'tickets' as Tab, label: 'Tickets', icon: Bell, count: tickets.length },
          { key: 'contacts' as Tab, label: 'Conversas', icon: MessageCircle, count: contacts.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key
                ? 'border-ch-cyan text-ch-cyan'
                : 'border-transparent text-ch-muted hover:text-ch-text'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className="text-xs bg-ch-surface-2 px-2 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
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
        {activeTab === 'tickets' && (
          <div className="flex items-center gap-1 bg-ch-surface-2 border border-ch-border rounded-xl p-1">
            <Filter size={14} className="text-ch-muted ml-2" />
            {(['all', 'pending', 'attended', 'closed'] as TicketFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setTicketFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ticketFilter === f
                    ? 'bg-ch-cyan/20 text-ch-cyan'
                    : 'text-ch-muted hover:text-ch-text'
                  }`}
              >
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'attended' ? 'Atendidos' : 'Finalizados'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-ch-magenta/10 border border-ch-magenta/30 text-ch-magenta p-3 rounded-xl">{error}</div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
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
                <div
                  className="flex items-center gap-3 md:gap-4 p-3 md:p-4 cursor-pointer hover:bg-ch-surface-2 transition-colors"
                  onClick={() => toggleExpand(ticket.id + 10000)}
                >
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base md:text-lg text-ch-text truncate">{ticket.contactName || 'Sem nome'}</span>
                      {getTypeBadge(ticket.type)}
                    </div>
                    <div className="text-xs md:text-sm text-ch-muted flex flex-wrap items-center gap-1 md:gap-2 mt-0.5">
                      <span className="flex items-center gap-1"><User size={12} /> {ticket.contactPhone}</span>
                      <span className="hidden sm:inline text-ch-border">|</span>
                      <span>{new Date(ticket.notifiedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(ticket.status)}
                    <button className="text-ch-muted p-1">
                      {expanded.includes(ticket.id + 10000) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                  </div>
                </div>

                {expanded.includes(ticket.id + 10000) && (
                  <div className="border-t border-ch-border bg-ch-bg p-3 md:p-4">
                    {ticket.summary && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-ch-muted uppercase mb-2">Resumo da Conversa</div>
                        <div className="bg-ch-surface-2 rounded-xl p-3 text-sm text-ch-text whitespace-pre-wrap">
                          {ticket.summary}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {ticket.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateTicketStatus(ticket.id, 'attended')}
                            className="px-4 py-2 bg-ch-cyan/20 text-ch-cyan rounded-lg text-sm font-bold hover:bg-ch-cyan/30 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle size={14} /> Marcar como Atendido
                          </button>
                          <button
                            onClick={() => updateTicketStatus(ticket.id, 'closed')}
                            className="px-4 py-2 bg-ch-muted/10 text-ch-muted rounded-lg text-sm font-medium hover:bg-ch-muted/20 transition-colors flex items-center gap-1"
                          >
                            <XCircle size={14} /> Finalizar
                          </button>
                        </>
                      )}
                      {ticket.status === 'attended' && (
                        <button
                          onClick={() => updateTicketStatus(ticket.id, 'closed')}
                          className="px-4 py-2 bg-ch-muted/10 text-ch-muted rounded-lg text-sm font-medium hover:bg-ch-muted/20 transition-colors flex items-center gap-1"
                        >
                          <XCircle size={14} /> Finalizar
                        </button>
                      )}
                      {ticket.status === 'closed' && (
                        <span className="text-xs text-ch-muted">
                          Finalizado em {ticket.attendedAt ? new Date(ticket.attendedAt).toLocaleString('pt-BR') : '-'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-3">
          {loading ? (
            <div className="glass rounded-2xl border border-ch-border p-6 text-ch-muted">Carregando...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="glass rounded-2xl border border-ch-border p-6 text-ch-muted">Nenhum contato encontrado.</div>
          ) : (
            filteredContacts.map((c) => (
              <div key={c.id} className="glass rounded-2xl border border-ch-border overflow-hidden">
                <div
                  className="flex items-center gap-3 md:gap-4 p-3 md:p-4 cursor-pointer hover:bg-ch-surface-2 transition-colors"
                  onClick={() => toggleExpand(c.id)}
                >
                  {c.profilePicUrl ? (
                    <img
                      src={c.profilePicUrl}
                      alt={c.name || 'Avatar'}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-ch-cyan/10 flex items-center justify-center text-ch-cyan font-bold flex-shrink-0 ${c.profilePicUrl ? 'hidden' : ''}`}>
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base md:text-lg text-ch-text truncate">{c.name || 'Sem nome'}</div>
                    <div className="text-xs md:text-sm text-ch-muted flex flex-wrap items-center gap-1 md:gap-2">
                      <span className="flex items-center gap-1"><User size={12} /> {c.phone}</span>
                      <span className="hidden sm:inline text-ch-border">|</span>
                      <span className="flex items-center gap-1"><MessageCircle size={12} /> {c.messages?.length || 0}</span>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-ch-muted">Última atividade</div>
                    <div className="text-sm text-ch-text">{new Date(c.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <button className="text-ch-muted p-1 md:p-2">
                    {expanded.includes(c.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                </div>

                {expanded.includes(c.id) && c.messages && c.messages.length > 0 && (
                  <div className="border-t border-ch-border bg-ch-bg p-3 md:p-4 max-h-80 md:max-h-96 overflow-y-auto">
                    <div className="text-xs font-bold text-ch-muted uppercase mb-3">Histórico da Conversa</div>
                    <div className="space-y-2">
                      {[...c.messages].reverse().map((m) => (
                        <div
                          key={m.id}
                          className={`p-2 md:p-3 rounded-xl max-w-[90%] md:max-w-[80%] ${m.role === 'user'
                            ? 'bg-ch-cyan/10 border border-ch-cyan/20 ml-auto text-right'
                            : 'bg-ch-surface-2 border border-ch-border'
                            }`}
                        >
                          <div className="text-xs text-ch-muted mb-1">
                            {m.role === 'user' ? 'Cliente' : 'Bot'} • {new Date(m.timestamp).toLocaleString()}
                          </div>
                          <div className="whitespace-pre-wrap text-xs md:text-sm text-ch-text">{m.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

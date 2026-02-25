import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, X, Save, Clock, Send } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

interface ScheduledMessage {
    id: number;
    contactId: number | null;
    targetJid: string | null;
    contactName: string | null;
    contactPhone: string | null;
    message: string;
    scheduledAt: string;
    sentAt: string | null;
    status: string;
    isBroadcast: number;
}

interface Contact {
    id: number;
    name: string;
    phone: string;
    jid: string;
}

export const ScheduledMessages: React.FC = () => {
    const [messages, setMessages] = useState<ScheduledMessage[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ contactId: '', message: '', scheduledAt: '', isBroadcast: false });

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const [msgsRes, contactsRes] = await Promise.all([
                axios.get(`${API_URL}/scheduled-messages`),
                axios.get(`${API_URL}/contacts`),
            ]);
            setMessages(msgsRes.data);
            setContacts(contactsRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        try {
            const contact = contacts.find(c => c.id === Number(form.contactId));
            await axios.post(`${API_URL}/scheduled-messages`, {
                contactId: form.isBroadcast ? null : Number(form.contactId),
                targetJid: form.isBroadcast ? null : contact?.jid,
                message: form.message,
                scheduledAt: new Date(form.scheduledAt).toISOString(),
                isBroadcast: form.isBroadcast,
            });
            setShowModal(false);
            setForm({ contactId: '', message: '', scheduledAt: '', isBroadcast: false });
            loadData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Erro ao agendar');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Cancelar mensagem agendada?')) return;
        await axios.delete(`${API_URL}/scheduled-messages/${id}`);
        loadData();
    };

    const pending = messages.filter(m => m.status === 'pending');
    const sent = messages.filter(m => m.status === 'sent');

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return dateStr; }
    };

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ch-cyan" /></div>;

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-ch-text flex items-center gap-2"><Calendar size={28} className="text-ch-purple" /> Agendamento</h1>
                    <p className="text-ch-muted">Agende mensagens para envio automático</p>
                </div>
                <button onClick={() => setShowModal(true)} className="gradient-btn text-ch-bg px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2">
                    <Plus size={20} /> Agendar Mensagem
                </button>
            </div>

            {/* Pendentes */}
            <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2"><Clock size={20} className="text-ch-cyan" /> Pendentes ({pending.length})</h3>
            {pending.length === 0 ? (
                <div className="glass rounded-2xl p-8 border border-ch-border text-center mb-8">
                    <Calendar size={40} className="text-ch-muted mx-auto mb-2" />
                    <p className="text-ch-muted">Nenhuma mensagem agendada</p>
                </div>
            ) : (
                <div className="space-y-3 mb-8">
                    {pending.map(m => (
                        <div key={m.id} className="glass rounded-2xl p-5 border border-ch-border flex items-start justify-between gap-4 hover:border-ch-cyan/30 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-mono bg-ch-cyan/15 text-ch-cyan px-2 py-1 rounded">{formatDate(m.scheduledAt)}</span>
                                    {m.isBroadcast ? <span className="text-xs bg-ch-purple/15 text-ch-purple px-2 py-1 rounded">📢 Broadcast</span> : null}
                                    {m.contactName && <span className="text-xs text-ch-muted">→ {m.contactName}</span>}
                                </div>
                                <p className="text-ch-text text-sm whitespace-pre-wrap line-clamp-2">{m.message}</p>
                            </div>
                            <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-ch-magenta/10 rounded-xl text-ch-muted hover:text-ch-magenta transition-colors shrink-0">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Enviadas */}
            {sent.length > 0 && (
                <>
                    <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2"><Send size={20} className="text-ch-muted" /> Enviadas ({sent.length})</h3>
                    <div className="space-y-2 opacity-60">
                        {sent.slice(0, 10).map(m => (
                            <div key={m.id} className="glass rounded-xl p-4 border border-ch-border flex items-center gap-4">
                                <span className="text-xs text-ch-muted">{formatDate(m.sentAt || m.scheduledAt)}</span>
                                {m.contactName && <span className="text-xs text-ch-muted">→ {m.contactName}</span>}
                                <p className="text-ch-muted text-sm flex-1 truncate">{m.message}</p>
                                <span className="text-xs text-emerald-500 font-medium">✓ Enviada</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-lg border border-ch-border">
                        <div className="p-6 border-b border-ch-border flex justify-between items-center">
                            <h2 className="text-xl font-bold text-ch-text">Agendar Mensagem</h2>
                            <button onClick={() => setShowModal(false)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Destinatário</label>
                                <select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })} disabled={form.isBroadcast} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50">
                                    <option value="">Selecione um contato...</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Data e Hora</label>
                                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Mensagem</label>
                                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50" placeholder="Mensagem que será enviada..." />
                            </div>
                        </div>
                        <div className="p-6 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-ch-muted hover:text-ch-text rounded-xl">Cancelar</button>
                            <button onClick={handleSave} disabled={!form.message || !form.scheduledAt || (!form.isBroadcast && !form.contactId)} className="gradient-btn text-ch-bg px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2"><Save size={18} /> Agendar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

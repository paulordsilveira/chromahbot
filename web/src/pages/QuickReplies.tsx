import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Zap, Plus, Edit2, Trash2, X, Save, Copy, CheckCircle } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

interface QuickReply {
    id: number;
    shortcut: string;
    title: string;
    content: string;
    category: string;
}

export const QuickReplies: React.FC = () => {
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<QuickReply | null>(null);
    const [form, setForm] = useState({ shortcut: '', title: '', content: '', category: 'geral' });
    const [copied, setCopied] = useState<number | null>(null);

    useEffect(() => { loadReplies(); }, []);

    const loadReplies = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/quick-replies`);
            setReplies(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        try {
            if (editing) {
                await axios.put(`${API_URL}/quick-replies/${editing.id}`, form);
            } else {
                await axios.post(`${API_URL}/quick-replies`, form);
            }
            setShowModal(false);
            setEditing(null);
            setForm({ shortcut: '', title: '', content: '', category: 'geral' });
            loadReplies();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Erro ao salvar');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir resposta rápida?')) return;
        await axios.delete(`${API_URL}/quick-replies/${id}`);
        loadReplies();
    };

    const handleCopy = (id: number, content: string) => {
        navigator.clipboard.writeText(content);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const openEdit = (r: QuickReply) => {
        setEditing(r);
        setForm({ shortcut: r.shortcut, title: r.title, content: r.content, category: r.category });
        setShowModal(true);
    };

    const categories = [...new Set(replies.map(r => r.category))];

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ch-cyan" /></div>;

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-ch-text flex items-center gap-2"><Zap size={28} className="text-ch-cyan" /> Respostas Rápidas</h1>
                    <p className="text-ch-muted">Templates de mensagens para envio rápido pelo operador</p>
                </div>
                <button onClick={() => { setEditing(null); setForm({ shortcut: '', title: '', content: '', category: 'geral' }); setShowModal(true); }} className="gradient-btn text-ch-bg px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2">
                    <Plus size={20} /> Nova Resposta
                </button>
            </div>

            {replies.length === 0 ? (
                <div className="glass rounded-2xl p-12 border border-ch-border text-center">
                    <Zap size={48} className="text-ch-muted mx-auto mb-4" />
                    <p className="text-ch-muted">Nenhuma resposta rápida criada ainda.</p>
                    <p className="text-ch-muted text-sm mt-2">Crie templates que o operador pode usar para responder rapidamente.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {(categories.length > 1 ? categories : ['geral']).map(cat => (
                        <div key={cat}>
                            {categories.length > 1 && <h3 className="text-sm font-bold text-ch-muted uppercase mb-3">{cat}</h3>}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {replies.filter(r => r.category === cat).map(r => (
                                    <div key={r.id} className="glass rounded-2xl p-5 border border-ch-border hover:border-ch-cyan/30 transition-all group">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <span className="text-xs font-mono bg-ch-cyan/15 text-ch-cyan px-2 py-1 rounded-lg">{r.shortcut}</span>
                                                <h4 className="text-ch-text font-semibold mt-2">{r.title}</h4>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleCopy(r.id, r.content)} className="p-1.5 hover:bg-ch-surface-2 rounded-lg text-ch-muted hover:text-ch-cyan">
                                                    {copied === r.id ? <CheckCircle size={16} /> : <Copy size={16} />}
                                                </button>
                                                <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-ch-surface-2 rounded-lg text-ch-muted hover:text-ch-cyan"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-ch-surface-2 rounded-lg text-ch-muted hover:text-ch-magenta"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                        <p className="text-ch-muted text-sm line-clamp-3 whitespace-pre-wrap">{r.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-lg border border-ch-border">
                        <div className="p-6 border-b border-ch-border flex justify-between items-center">
                            <h2 className="text-xl font-bold text-ch-text">{editing ? 'Editar' : 'Nova'} Resposta Rápida</h2>
                            <button onClick={() => setShowModal(false)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Atalho</label>
                                    <input value={form.shortcut} onChange={e => setForm({ ...form, shortcut: e.target.value })} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50" placeholder="/saudacao" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Categoria</label>
                                    <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50" placeholder="geral" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Título</label>
                                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50" placeholder="Saudação inicial" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ch-muted uppercase mb-1">Conteúdo da Mensagem</label>
                                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-cyan/50 min-h-[120px]" rows={5} placeholder="Olá! Obrigado pelo contato. Como posso ajudar?" />
                            </div>
                        </div>
                        <div className="p-6 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-ch-muted hover:text-ch-text rounded-xl">Cancelar</button>
                            <button onClick={handleSave} className="gradient-btn text-ch-bg px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2"><Save size={18} /> Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState } from 'react';
import { Plus, Edit, Trash, ChevronDown, ChevronRight, Save, X, Package, Smile, Bold, Italic, Strikethrough, Code } from 'lucide-react';

// Máscaras e formatadores
const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const number = parseInt(digits, 10) / 100;
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const WHATSAPP_EMOJIS = [
    // Imóveis e Construção
    '🏠', '🏡', '🏢', '🏗️', '🏘️', '🏚️', '🏛️', '🏰', '🏯', '🏭',
    // Negócios e Finanças
    '💼', '💰', '💵', '💳', '🏦', '📊', '📈', '📉', '🤝', '✍️',
    // Comunicação
    '📱', '📞', '📧', '💬', '📝', '📋', '📄', '📁', '📂', '🗂️',
    // Localização
    '📍', '🗺️', '🧭', '🚗', '🚙', '🔑', '🔐', '🚪', '🪟', '🛋️',
    // Pessoas e Ações
    '👤', '👥', '🙋', '💁', '🤵', '👷', '🧑‍💼', '👨‍💼', '👩‍💼', '🏃',
    // Status e Indicadores
    '✅', '❌', '⚠️', '❓', '❗', '💡', '⭐', '🌟', '🔔', '📢',
    // Tempo e Calendário
    '📅', '⏰', '⏳', '🕐', '📆', '🗓️',
    // Outros úteis
    '🎯', '🔍', '🔎', '⚙️', '🛠️', '📌', '🏷️', '🎁', '🎉', '👍'
];
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

interface Item {
    id: number;
    subcategoryId: number;
    name: string;
    title?: string;
    description?: string;
    price?: string;
    locationLink?: string;
    contactLink?: string;
    webLink?: string;
    imageUrls?: string;
    videoUrls?: string;
    documentUrls?: string;
    empresa?: string;
    contato?: string;
    email?: string;
    endereco?: string;
    enabled?: boolean;
}

interface SubCategory {
    id: number;
    name: string;
    emoji?: string;
    order: number;
    categoryId: number;
    enabledInBot?: boolean;
    items?: Item[];
}

interface Category {
    id: number;
    name: string;
    emoji?: string;
    order: number;
    subcategories: SubCategory[];
}

const emptySubCategory: Partial<SubCategory> = {
    name: '',
    emoji: '',
    enabledInBot: true,
};

const emptyItem: Partial<Item> = {
    name: '',
    title: '',
    description: '',
    price: '',
    locationLink: '',
    contactLink: '',
    webLink: '',
    imageUrls: '',
    videoUrls: '',
    documentUrls: '',
    empresa: '',
    contato: '',
    email: '',
    endereco: '',
    enabled: true,
};

export const Categories: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [expanded, setExpanded] = useState<number[]>([]);
    const [editingCat, setEditingCat] = useState<Category | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [editingSub, setEditingSub] = useState<{ categoryId: number; sub: Partial<SubCategory> } | null>(null);
    const [isNewSub, setIsNewSub] = useState(false);
    const [editingItem, setEditingItem] = useState<{ subcategoryId: number; item: Partial<Item> } | null>(null);
    const [isNewItem, setIsNewItem] = useState(false);
    const [expandedSubs, setExpandedSubs] = useState<number[]>([]);
    const [subItems, setSubItems] = useState<Record<number, Item[]>>({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCatEmojiPicker, setShowCatEmojiPicker] = useState(false);

    React.useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                setError(null);
                const { data } = await axios.get(`${API_URL}/categories`);
                setCategories(Array.isArray(data) ? data : []);
            } catch (e) {
                setError('Falha ao carregar categorias.');
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    const toggleExpand = (id: number) => {
        setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSaveCategory = async () => {
        if (!editingCat) return;

        try {
            setError(null);
            const { data } = await axios.put(`${API_URL}/categories/${editingCat.id}`, {
                name: editingCat.name,
                order: editingCat.order,
            });
            setCategories(prev => prev.map(c => c.id === editingCat.id ? { ...c, ...data } : c));
            setEditingCat(null);
        } catch (e) {
            setError('Falha ao salvar categoria.');
        }
    };

    const handleCreateCategory = async () => {
        const name = window.prompt('Nome da categoria');
        if (!name) return;
        const orderRaw = window.prompt('Ordem (número)', String(categories.length + 1));
        const order = Number(orderRaw);

        try {
            setError(null);
            const { data } = await axios.post(`${API_URL}/categories`, { name, order: Number.isFinite(order) ? order : 0 });
            setCategories(prev => [...prev, { ...data, subcategories: data.subcategories || [] }].sort((a, b) => a.order - b.order));
        } catch (e) {
            setError('Falha ao criar categoria.');
        }
    };

    const handleDeleteCategory = async (id: number) => {
        const ok = window.confirm('Excluir categoria e suas subcategorias?');
        if (!ok) return;

        try {
            setError(null);
            await axios.delete(`${API_URL}/categories/${id}`);
            setCategories(prev => prev.filter(c => c.id !== id));
        } catch (e) {
            setError('Falha ao excluir categoria.');
        }
    };

    const openNewSubCategory = (category: Category) => {
        const nextOrder = (category.subcategories?.length ?? 0) + 1;
        setEditingSub({ categoryId: category.id, sub: { ...emptySubCategory, order: nextOrder } });
        setIsNewSub(true);
    };

    const openEditSubCategory = (category: Category, sub: SubCategory) => {
        setEditingSub({ categoryId: category.id, sub: { ...sub } });
        setIsNewSub(false);
    };

    const handleSaveSubCategory = async () => {
        if (!editingSub) return;
        const { categoryId, sub } = editingSub;

        try {
            setError(null);
            if (isNewSub) {
                const { data } = await axios.post(`${API_URL}/categories/${categoryId}/subcategories`, sub);
                setCategories(prev => prev.map(c => {
                    if (c.id !== categoryId) return c;
                    const nextSubs = [...(c.subcategories ?? []), data].sort((a, b) => a.order - b.order);
                    return { ...c, subcategories: nextSubs };
                }));
            } else {
                const { data } = await axios.put(`${API_URL}/subcategories/${sub.id}`, sub);
                setCategories(prev => prev.map(c => {
                    if (c.id !== categoryId) return c;
                    return { ...c, subcategories: c.subcategories.map(s => s.id === sub.id ? { ...s, ...data } : s) };
                }));
            }
            setEditingSub(null);
        } catch (e) {
            setError('Falha ao salvar subcategoria.');
        }
    };

    const handleDeleteSubCategory = async (categoryId: number, subId: number) => {
        if (!window.confirm('Excluir subcategoria?')) return;
        try {
            setError(null);
            await axios.delete(`${API_URL}/subcategories/${subId}`);
            setCategories(prev => prev.map(c => {
                if (c.id !== categoryId) return c;
                return { ...c, subcategories: c.subcategories.filter(s => s.id !== subId) };
            }));
        } catch (e) {
            setError('Falha ao excluir subcategoria.');
        }
    };

    const updateSubField = (field: keyof SubCategory, value: any) => {
        if (!editingSub) return;
        setEditingSub({ ...editingSub, sub: { ...editingSub.sub, [field]: value } });
    };

    const toggleSubExpand = async (subId: number) => {
        if (expandedSubs.includes(subId)) {
            setExpandedSubs(prev => prev.filter(id => id !== subId));
        } else {
            setExpandedSubs(prev => [...prev, subId]);
            if (!subItems[subId]) {
                try {
                    const { data } = await axios.get(`${API_URL}/subcategories/${subId}/items`);
                    setSubItems(prev => ({ ...prev, [subId]: data }));
                } catch (e) {
                    console.error('Erro ao carregar itens');
                }
            }
        }
    };

    const openNewItem = (subcategoryId: number) => {
        setEditingItem({ subcategoryId, item: { ...emptyItem } });
        setIsNewItem(true);
    };

    const openEditItem = (subcategoryId: number, item: Item) => {
        setEditingItem({ subcategoryId, item: { ...item } });
        setIsNewItem(false);
    };

    const handleSaveItem = async () => {
        if (!editingItem) return;
        const { subcategoryId, item } = editingItem;
        if (!item.name?.trim() || !item.title?.trim()) {
            setError('Nome/Identificador e Título são obrigatórios.');
            return;
        }
        try {
            setError(null);
            if (isNewItem) {
                const { data } = await axios.post(`${API_URL}/subcategories/${subcategoryId}/items`, item);
                setSubItems(prev => ({ ...prev, [subcategoryId]: [...(prev[subcategoryId] || []), data] }));
            } else {
                const { data } = await axios.put(`${API_URL}/items/${item.id}`, item);
                setSubItems(prev => ({
                    ...prev,
                    [subcategoryId]: prev[subcategoryId]?.map(i => i.id === item.id ? { ...i, ...data } : i) || []
                }));
            }
            setEditingItem(null);
        } catch (e) {
            setError('Falha ao salvar item.');
        }
    };

    const handleDeleteItem = async (subcategoryId: number, itemId: number) => {
        if (!window.confirm('Excluir item?')) return;
        try {
            await axios.delete(`${API_URL}/items/${itemId}`);
            setSubItems(prev => ({
                ...prev,
                [subcategoryId]: prev[subcategoryId]?.filter(i => i.id !== itemId) || []
            }));
        } catch (e) {
            setError('Falha ao excluir item.');
        }
    };

    const updateItemField = (field: keyof Item, value: any) => {
        if (!editingItem) return;
        setEditingItem({ ...editingItem, item: { ...editingItem.item, [field]: value } });
    };

    return (
        <div className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-ch-text">Gerenciar Categorias</h1>
                <button onClick={handleCreateCategory} className="bg-ch-cyan text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-ch-cyan/80 w-full sm:w-auto justify-center">
                    <Plus size={20} /> <span>Nova Categoria</span>
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-ch-magenta/10 bg-ch-magenta/10 border border-ch-magenta/30 border-ch-magenta/30 text-ch-magenta text-ch-magenta p-3 rounded">{error}</div>
            )}

            <div className="glass rounded-xl shadow-lg overflow-hidden">
                {loading ? (
                    <div className="p-6 text-ch-text">Carregando...</div>
                ) : (
                    categories.map((category: Category, idx: number) => (
                        <div key={category.id} className="border-b border-gray-100 border-ch-border last:border-0">
                            <div className="flex items-center justify-between p-3 md:p-4 bg-ch-bg hover:bg-ch-surface-2 hover:bg-ch-surface-2 transition-colors">
                                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                    <button onClick={() => toggleExpand(category.id)} className="text-ch-muted">
                                        {expanded.includes(category.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </button>
                                    {editingCat?.id === category.id ? (
                                        <div className="flex items-center gap-2 relative">
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={editingCat.emoji || ''}
                                                    onChange={e => setEditingCat(prev => prev ? { ...prev, emoji: e.target.value } : prev)}
                                                    className="border p-1 rounded w-12 text-center"
                                                    placeholder="🏠"
                                                    maxLength={2}
                                                />
                                                <button type="button" onClick={() => setShowCatEmojiPicker(!showCatEmojiPicker)}
                                                    className="px-1 border rounded hover:bg-ch-surface-2" title="Escolher emoji">
                                                    <Smile size={16} className="text-ch-muted" />
                                                </button>
                                            </div>
                                            {showCatEmojiPicker && (
                                                <div className="absolute top-full left-0 mt-1 bg-ch-surface border rounded-xl shadow-lg p-2 z-50 w-64">
                                                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                                                        {WHATSAPP_EMOJIS.map((emoji, idx) => (
                                                            <button key={idx} type="button"
                                                                onClick={() => { setEditingCat(prev => prev ? { ...prev, emoji } : prev); setShowCatEmojiPicker(false); }}
                                                                className="w-7 h-7 text-lg hover:bg-ch-surface-2 rounded flex items-center justify-center">
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <input
                                                type="text"
                                                value={editingCat.name}
                                                onChange={e => setEditingCat(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                                className="border p-1 rounded"
                                            />
                                        </div>
                                    ) : (
                                        <span className="font-semibold text-base md:text-lg text-ch-text truncate">{idx + 1}. {category.emoji && `${category.emoji} `}{category.name}</span>
                                    )}
                                </div>

                                <div className="flex gap-1 md:gap-2 flex-shrink-0">
                                    {editingCat?.id === category.id ? (
                                        <>
                                            <button onClick={handleSaveCategory} className="text-emerald-400 p-1 md:p-2"><Save size={18} /></button>
                                            <button onClick={() => setEditingCat(null)} className="text-ch-magenta p-1 md:p-2"><X size={18} /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setEditingCat(category)} className="text-ch-cyan p-1 md:p-2 hover:bg-ch-cyan/10 dark:hover:bg-blue-900 rounded"><Edit size={18} /></button>
                                            <button onClick={() => handleDeleteCategory(category.id)} className="text-ch-magenta p-1 md:p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded"><Trash size={18} /></button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {expanded.includes(category.id) && (
                                <div className="p-3 md:p-4 pl-6 md:pl-12 glass">
                                    <div className="mb-3 md:mb-4 flex justify-between items-center">
                                        <h4 className="text-xs md:text-sm font-bold text-ch-muted uppercase">Subcategorias</h4>
                                        <button onClick={() => openNewSubCategory(category)} className="text-xs md:text-sm text-ch-cyan flex items-center gap-1 hover:underline">
                                            <Plus size={14} /> Adicionar
                                        </button>
                                    </div>
                                    {(category.subcategories || []).length > 0 ? (
                                        <ul className="space-y-2">
                                            {(category.subcategories || []).map((sub: SubCategory, subIdx: number) => (
                                                <li key={sub.id} className="border border-ch-border rounded">
                                                    <div className="flex items-center justify-between p-2 md:p-3 hover:bg-ch-surface-2 hover:bg-ch-surface-2">
                                                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                                            <button onClick={() => toggleSubExpand(sub.id)} className="text-ch-muted flex-shrink-0">
                                                                {expandedSubs.includes(sub.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                            <div className="min-w-0">
                                                                <span className="font-medium text-sm md:text-base text-ch-text">{subIdx + 1}. {sub.emoji && `${sub.emoji} `}{sub.name}</span>
                                                                {sub.enabledInBot === false && <span className="ml-2 text-xs text-orange-500">(oculto)</span>}
                                                                <span className="ml-2 text-xs text-ch-muted">({subItems[sub.id]?.length || 0})</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 md:gap-2 flex-shrink-0">
                                                            <button onClick={() => openNewItem(sub.id)} className="text-emerald-400 hover:text-green-700 p-1" title="Adicionar Item"><Package size={14} /></button>
                                                            <button onClick={() => openEditSubCategory(category, sub)} className="text-ch-muted hover:text-ch-cyan p-1"><Edit size={14} /></button>
                                                            <button onClick={() => handleDeleteSubCategory(category.id, sub.id)} className="text-ch-muted hover:text-ch-magenta p-1"><Trash size={14} /></button>
                                                        </div>
                                                    </div>
                                                    {expandedSubs.includes(sub.id) && (
                                                        <div className="p-2 md:p-3 pt-0 pl-6 md:pl-10 bg-ch-bg border-t border-ch-border">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-bold text-ch-muted uppercase">Itens</span>
                                                                <button onClick={() => openNewItem(sub.id)} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                                                                    <Plus size={12} /> Novo
                                                                </button>
                                                            </div>
                                                            {subItems[sub.id]?.length > 0 ? (
                                                                <ul className="space-y-1">
                                                                    {subItems[sub.id].map((item: Item) => (
                                                                        <li key={item.id} className="flex items-center justify-between p-2 glass border border-ch-border rounded text-sm">
                                                                            <span className="text-ch-text truncate">{item.name} {item.enabled === false && <span className="text-orange-500">(inativo)</span>}</span>
                                                                            <div className="flex gap-1 flex-shrink-0">
                                                                                <button onClick={() => openEditItem(sub.id, item)} className="text-ch-muted hover:text-ch-cyan p-1"><Edit size={14} /></button>
                                                                                <button onClick={() => handleDeleteItem(sub.id, item.id)} className="text-ch-muted hover:text-ch-magenta p-1"><Trash size={14} /></button>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-ch-muted text-xs italic">Nenhum item cadastrado.</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-ch-muted text-sm italic">Nenhuma subcategoria cadastrada.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {editingSub && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-4 md:p-6 border-b border-ch-border flex justify-between items-center">
                            <h2 className="text-lg md:text-xl font-bold text-ch-text">{isNewSub ? 'Nova Subcategoria' : 'Editar Subcategoria'}</h2>
                            <button onClick={() => setEditingSub(null)} className="text-ch-muted hover:text-ch-text text-ch-muted dark:hover:text-gray-200"><X size={24} /></button>
                        </div>
                        <div className="p-4 md:p-6 space-y-4">
                            {isNewSub && (
                                <div className="bg-ch-cyan/10 bg-ch-cyan/10 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <label className="block text-sm font-medium text-ch-cyan text-ch-cyan mb-2">⚡ Subcategorias Especiais</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => { updateSubField('name', 'Simulação'); updateSubField('emoji', '📝'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-cyan/50 border-ch-cyan/50 rounded hover:bg-ch-cyan/10 dark:hover:bg-blue-900 text-ch-text">📝 Simulação</button>
                                        <button type="button" onClick={() => { updateSubField('name', 'Cadastro Corretor'); updateSubField('emoji', '🤝'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-cyan/50 border-ch-cyan/50 rounded hover:bg-ch-cyan/10 dark:hover:bg-blue-900 text-ch-text">🤝 Corretor</button>
                                        <button type="button" onClick={() => { updateSubField('name', 'Cadastro Locação/Venda'); updateSubField('emoji', '🏠'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-cyan/50 border-ch-cyan/50 rounded hover:bg-ch-cyan/10 dark:hover:bg-blue-900 text-ch-text">🏠 Locação</button>
                                        <button type="button" onClick={() => { updateSubField('name', 'Dúvidas'); updateSubField('emoji', '❓'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-cyan/50 border-ch-cyan/50 rounded hover:bg-ch-cyan/10 dark:hover:bg-blue-900 text-ch-text">❓ Dúvidas</button>
                                        <button type="button" onClick={() => { updateSubField('name', 'Consulta de Processos'); updateSubField('emoji', '🔍'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-cyan/50 border-ch-cyan/50 rounded hover:bg-ch-cyan/10 dark:hover:bg-blue-900 text-ch-text">🔍 Processos</button>
                                        <button type="button" onClick={() => { updateSubField('name', 'Falar com'); updateSubField('emoji', '📞'); }}
                                            className="px-2 py-1 text-xs md:text-sm bg-ch-surface-2 border border-ch-purple/50 rounded hover:bg-ch-purple/10 dark:hover:bg-purple-900 text-ch-text">📞 Falar com</button>
                                    </div>
                                    <p className="text-xs text-ch-cyan text-ch-cyan mt-2">Clique para preencher ou digite abaixo.</p>
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-3 md:gap-4">
                                <div className="col-span-1 relative">
                                    <label className="block text-sm font-medium text-ch-text text-ch-text mb-1">Emoji</label>
                                    <div className="flex gap-1">
                                        <input type="text" value={editingSub.sub.emoji || ''} onChange={e => updateSubField('emoji', e.target.value)}
                                            className="w-full border border-ch-border rounded p-2 text-center text-xl bg-ch-surface-2 text-ch-text" placeholder="🏠" maxLength={2} />
                                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="px-2 border border-ch-border rounded hover:bg-ch-surface-2 hover:bg-ch-surface-2" title="Escolher emoji">
                                            <Smile size={20} className="text-ch-muted" />
                                        </button>
                                    </div>
                                    {showEmojiPicker && (
                                        <div className="absolute top-full left-0 mt-1 glass border border-ch-border rounded-xl shadow-lg p-2 z-50 w-64">
                                            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                                                {WHATSAPP_EMOJIS.map((emoji, idx) => (
                                                    <button key={idx} type="button"
                                                        onClick={() => { updateSubField('emoji', emoji); setShowEmojiPicker(false); }}
                                                        className="w-7 h-7 text-lg hover:bg-ch-surface-2 hover:bg-ch-surface-2 rounded flex items-center justify-center">
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-sm font-medium text-ch-text text-ch-text mb-1">Nome</label>
                                    <input type="text" value={editingSub.sub.name || ''} onChange={e => updateSubField('name', e.target.value)}
                                        className="w-full border border-ch-border rounded p-2 bg-ch-surface-2 text-ch-text" placeholder="Nome da subcategoria" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ch-text text-ch-text mb-1">Ordem</label>
                                <input type="number" value={editingSub.sub.order || ''} onChange={e => updateSubField('order', Number(e.target.value))}
                                    className="w-full border border-ch-border rounded p-2 bg-ch-surface-2 text-ch-text" />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="enabledInBot" checked={editingSub.sub.enabledInBot !== false}
                                    onChange={e => updateSubField('enabledInBot', e.target.checked)} className="w-4 h-4" />
                                <label htmlFor="enabledInBot" className="text-sm font-medium text-ch-text text-ch-text">Exibir no Bot</label>
                            </div>
                        </div>
                        <div className="p-4 md:p-6 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => setEditingSub(null)} className="px-4 py-2 border border-ch-border rounded hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text">Cancelar</button>
                            <button onClick={handleSaveSubCategory} className="px-4 py-2 bg-ch-cyan text-white rounded hover:bg-ch-cyan/80">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-[95vw] md:max-w-[80vw] max-h-[90vh] overflow-y-auto">
                        <div className="p-4 md:p-6 border-b border-ch-border flex justify-between items-center sticky top-0 glass z-10">
                            <h2 className="text-lg md:text-xl font-bold text-ch-text">{isNewItem ? 'Registrar Item' : 'Editar Item'}</h2>
                            <button onClick={() => setEditingItem(null)} className="text-ch-muted hover:text-ch-text text-ch-muted dark:hover:text-gray-200"><X size={24} /></button>
                        </div>
                        <div className="p-4 md:p-6 space-y-5">
                            {/* Imagens - até 10 - UPLOAD MÚLTIPLO */}
                            <div className="bg-ch-bg p-4 rounded-xl border border-ch-border">
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">📷 Imagens (até 10)</label>
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {(editingItem.item.imageUrls?.split('\n').filter(Boolean) || []).slice(0, 10).map((url, idx) => (
                                        <div key={idx} className="relative w-20 h-20 border-2 border-ch-border rounded-xl overflow-hidden bg-ch-surface-2 shadow-sm">
                                            <img src={url} alt={`Img ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23eee" width="64" height="64"/><text x="50%" y="50%" fill="%23999" font-size="8" text-anchor="middle" dy=".3em">Erro</text></svg>'; }} />
                                            <button
                                                onClick={() => {
                                                    const urls = editingItem.item.imageUrls?.split('\n').filter(Boolean) || [];
                                                    urls.splice(idx, 1);
                                                    updateItemField('imageUrls', urls.join('\n'));
                                                }}
                                                className="absolute top-0 right-0 bg-ch-magenta text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl font-bold hover:bg-ch-magenta"
                                            >×</button>
                                        </div>
                                    ))}
                                    {(editingItem.item.imageUrls?.split('\n').filter(Boolean).length || 0) < 10 && (
                                        <label className="w-20 h-20 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-muted transition-colors">
                                            <span className="text-2xl">+</span>
                                            <span className="text-xs">Adicionar</span>
                                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const currentUrls = editingItem.item.imageUrls?.split('\n').filter(Boolean) || [];
                                                const remaining = 10 - currentUrls.length;
                                                const filesToAdd = files.slice(0, remaining);

                                                filesToAdd.forEach(file => {
                                                    if (file.size > 5 * 1024 * 1024) return; // Max 5MB
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        const urls = editingItem.item.imageUrls?.split('\n').filter(Boolean) || [];
                                                        if (urls.length < 10) {
                                                            urls.push(reader.result as string);
                                                            updateItemField('imageUrls', urls.join('\n'));
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                });
                                                e.target.value = '';
                                            }} />
                                        </label>
                                    )}
                                </div>
                                <p className="text-xs text-ch-muted">Selecione várias imagens de uma vez. Máx 5MB cada.</p>
                            </div>

                            {/* Vídeos - até 2 */}
                            <div className="bg-ch-cyan/10 bg-ch-cyan/10/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">🎬 Vídeos (até 2)</label>
                                <div className="flex flex-wrap gap-3 mb-2">
                                    {(editingItem.item.videoUrls?.split('\n').filter(Boolean) || []).slice(0, 2).map((url, idx) => (
                                        <div key={idx} className="relative w-36 h-24 border-2 border-ch-cyan/50 border-ch-cyan/50 rounded-xl overflow-hidden bg-black shadow-sm">
                                            <video src={url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                                <span className="text-white text-2xl">▶</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const urls = editingItem.item.videoUrls?.split('\n').filter(Boolean) || [];
                                                    urls.splice(idx, 1);
                                                    updateItemField('videoUrls', urls.join('\n'));
                                                }}
                                                className="absolute top-0 right-0 bg-ch-magenta text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl font-bold hover:bg-ch-magenta"
                                            >×</button>
                                        </div>
                                    ))}
                                    {(editingItem.item.videoUrls?.split('\n').filter(Boolean).length || 0) < 2 && (
                                        <label className="w-36 h-24 border-2 border-dashed border-blue-400 dark:border-ch-cyan rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-ch-cyan/10 dark:hover:bg-blue-900/40 text-ch-cyan text-ch-cyan transition-colors">
                                            <span className="text-2xl">+</span>
                                            <span className="text-xs">Vídeo</span>
                                            <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file && file.size <= 50 * 1024 * 1024) { // Max 50MB
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        const urls = editingItem.item.videoUrls?.split('\n').filter(Boolean) || [];
                                                        if (urls.length < 2) {
                                                            urls.push(reader.result as string);
                                                            updateItemField('videoUrls', urls.join('\n'));
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                                e.target.value = '';
                                            }} />
                                        </label>
                                    )}
                                </div>
                                <p className="text-xs text-ch-muted">Máx 50MB por vídeo.</p>
                            </div>

                            {/* Documentos - até 5 */}
                            <div className="bg-emerald-500/10 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">📄 Documentos (até 5)</label>
                                <div className="space-y-2 mb-2">
                                    {(editingItem.item.documentUrls?.split('\n').filter(Boolean) || []).slice(0, 5).map((url, idx) => {
                                        const fileName = url.startsWith('data:') ? `Documento ${idx + 1}` : url.split('/').pop() || `Documento ${idx + 1}`;
                                        return (
                                            <div key={idx} className="flex items-center gap-2 bg-ch-surface-2 p-2 rounded border border-ch-border">
                                                <span className="text-emerald-400">📄</span>
                                                <span className="flex-1 text-sm truncate text-ch-text">{fileName}</span>
                                                <button
                                                    onClick={() => {
                                                        const urls = editingItem.item.documentUrls?.split('\n').filter(Boolean) || [];
                                                        urls.splice(idx, 1);
                                                        updateItemField('documentUrls', urls.join('\n'));
                                                    }}
                                                    className="text-ch-magenta hover:text-ch-magenta text-lg font-bold"
                                                >×</button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(editingItem.item.documentUrls?.split('\n').filter(Boolean).length || 0) < 5 && (
                                    <label className="inline-flex items-center gap-2 px-3 py-2 border-2 border-dashed border-green-400 dark:border-green-500 rounded cursor-pointer hover:bg-emerald-500/10 dark:hover:bg-green-900/40 text-emerald-400 text-emerald-400 text-sm transition-colors">
                                        <span>+ Adicionar documento</span>
                                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.html" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file && file.size <= 10 * 1024 * 1024) { // Max 10MB
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    const urls = editingItem.item.documentUrls?.split('\n').filter(Boolean) || [];
                                                    if (urls.length < 5) {
                                                        urls.push(reader.result as string);
                                                        updateItemField('documentUrls', urls.join('\n'));
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                            e.target.value = '';
                                        }} />
                                    </label>
                                )}
                                <p className="text-xs text-ch-muted mt-2">PDF, DOC, XLS, TXT, HTML. Máx 10MB.</p>
                            </div>

                            {/* Campos do formulário */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Nome/Identificador <span className="text-ch-magenta">*</span></label>
                                    <input type="text" value={editingItem.item.name || ''} onChange={e => updateItemField('name', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="Ex: Locação 1, Casa Verde" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Título <span className="text-ch-magenta">*</span></label>
                                    <input type="text" value={editingItem.item.title || ''} onChange={e => updateItemField('title', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="Título exibido na conversa" required />
                                </div>
                            </div>

                            {/* Descrição com ferramentas WhatsApp */}
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Descrição</label>
                                <div className="border border-ch-border rounded-xl overflow-hidden">
                                    <div className="bg-ch-surface-2 px-3 py-2 border-b border-ch-border flex gap-2">
                                        <button type="button" onClick={() => {
                                            const desc = editingItem.item.description || '';
                                            updateItemField('description', desc + '*texto*');
                                        }} className="px-2 py-1 text-sm bg-ch-surface bg-ch-surface-2 border dark:border-gray-500 rounded hover:bg-ch-surface-2 dark:hover:bg-ch-surface-20 text-ch-text" title="Negrito">
                                            <Bold size={16} />
                                        </button>
                                        <button type="button" onClick={() => {
                                            const desc = editingItem.item.description || '';
                                            updateItemField('description', desc + '_texto_');
                                        }} className="px-2 py-1 text-sm bg-ch-surface bg-ch-surface-2 border dark:border-gray-500 rounded hover:bg-ch-surface-2 dark:hover:bg-ch-surface-20 text-ch-text" title="Itálico">
                                            <Italic size={16} />
                                        </button>
                                        <button type="button" onClick={() => {
                                            const desc = editingItem.item.description || '';
                                            updateItemField('description', desc + '~texto~');
                                        }} className="px-2 py-1 text-sm bg-ch-surface bg-ch-surface-2 border dark:border-gray-500 rounded hover:bg-ch-surface-2 dark:hover:bg-ch-surface-20 text-ch-text" title="Riscado">
                                            <Strikethrough size={16} />
                                        </button>
                                        <button type="button" onClick={() => {
                                            const desc = editingItem.item.description || '';
                                            updateItemField('description', desc + '```código```');
                                        }} className="px-2 py-1 text-sm bg-ch-surface bg-ch-surface-2 border dark:border-gray-500 rounded hover:bg-ch-surface-2 dark:hover:bg-ch-surface-20 text-ch-text" title="Monoespaço">
                                            <Code size={16} />
                                        </button>
                                        <span className="text-xs text-ch-muted ml-2 self-center">WhatsApp: *negrito* _itálico_ ~riscado~</span>
                                    </div>
                                    <textarea value={editingItem.item.description || ''} onChange={e => updateItemField('description', e.target.value)}
                                        className="w-full p-3 bg-ch-surface-2 text-ch-text min-h-[150px] resize-y focus:outline-none" placeholder="Descrição detalhada do item..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Empresa/Nome</label>
                                    <input type="text" value={editingItem.item.empresa || ''} onChange={e => updateItemField('empresa', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Contato</label>
                                    <input type="text" value={editingItem.item.contato || ''}
                                        onChange={e => updateItemField('contato', formatPhone(e.target.value))}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50"
                                        placeholder="(00) 00000-0000" maxLength={15} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">E-mail</label>
                                    <input type="email" value={editingItem.item.email || ''} onChange={e => updateItemField('email', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="email@exemplo.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Valor</label>
                                    <input type="text" value={editingItem.item.price || ''}
                                        onChange={e => updateItemField('price', formatCurrency(e.target.value))}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50"
                                        placeholder="R$ 0,00" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Endereço Completo</label>
                                <input type="text" value={editingItem.item.endereco || ''} onChange={e => updateItemField('endereco', e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="Rua, número, bairro, cidade - UF" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Link de Localização</label>
                                <input type="text" value={editingItem.item.locationLink || ''} onChange={e => updateItemField('locationLink', e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="https://maps.google.com/..." />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Link de Contato (WhatsApp)</label>
                                    <input type="text" value={editingItem.item.contactLink || ''} onChange={e => updateItemField('contactLink', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="https://wa.me/5500000000000" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Link Web</label>
                                    <input type="text" value={editingItem.item.webLink || ''} onChange={e => updateItemField('webLink', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text focus:ring-2 focus:ring-ch-cyan/50" placeholder="https://..." />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <input type="checkbox" id="itemEnabled" checked={editingItem.item.enabled !== false}
                                    onChange={e => updateItemField('enabled', e.target.checked)} className="w-5 h-5 rounded" />
                                <label htmlFor="itemEnabled" className="text-sm font-semibold text-ch-text dark:text-gray-100">Ativo (visível no bot)</label>
                            </div>
                        </div>
                        <div className="p-4 md:p-6 border-t border-ch-border flex justify-end gap-3 sticky bottom-0 glass">
                            <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 border border-ch-border rounded-xl hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text font-medium">Cancelar</button>
                            <button onClick={handleSaveItem} className="px-5 py-2.5 bg-ch-cyan text-white rounded-xl hover:bg-ch-cyan/80 font-medium">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

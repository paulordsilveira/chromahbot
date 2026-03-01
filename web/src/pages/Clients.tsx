/**
 * Clients.tsx — Página de Gestão de Clientes
 * 
 * Permite:
 * - Listar clientes com filtros geográficos (Estado → Cidade → Bairro) e categoria
 * - Adicionar/editar clientes manualmente via modal
 * - Importar clientes via CSV
 * - Importar clientes via .db externo (scraper)
 * - Remover clientes individualmente
 * 
 * Usa a tabela `client` do chromah.db, separada da `marketing_lead`.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Users, Plus, Upload, Search, Trash2, Edit3, X, MapPin,
    HardDriveDownload, Phone, Mail, Globe, FileText, Save
} from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

// ─── Interface do Cliente ───
interface Client {
    id: number;
    name?: string;
    phoneNumber: string;
    source: string;         // 'manual', 'csv', 'db_import'
    category?: string;
    state?: string;
    city?: string;
    neighborhood?: string;
    email?: string;
    address?: string;
    website?: string;
    notes?: string;
    createdAt?: string;
}

// ─── Formulário vazio para novo cliente ───
const emptyForm: Omit<Client, 'id' | 'createdAt' | 'source'> = {
    name: '', phoneNumber: '', category: '', state: '', city: '',
    neighborhood: '', email: '', address: '', website: '', notes: ''
};

// ─── Normaliza telefone BR ───
const normalizePhoneBR = (raw: string): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.startsWith('55') && digits.length >= 12) digits = digits.substring(2);
    if (digits.length === 10) {
        const ddd = digits.substring(0, 2);
        const num = digits.substring(2);
        if (['9', '8', '7', '6'].includes(num[0])) {
            digits = ddd + '9' + num;
        }
    }
    return '55' + digits;
};

// ─── Componente Principal ───
export const Clients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImportingDb, setIsImportingDb] = useState(false);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // Modal de adição/edição
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [form, setForm] = useState(emptyForm);

    // ─── Carregar clientes ───
    const loadClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/clients`);
            // Normalizar telefones BR
            const normalized = data.map((c: Client) => ({
                ...c,
                phoneNumber: c.phoneNumber ? normalizePhoneBR(c.phoneNumber) : c.phoneNumber
            }));
            setClients(normalized);
        } catch (err) {
            console.error('Erro ao carregar clientes:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadClients(); }, [loadClients]);

    // ─── Filtros geográficos cascata ───
    const states = Array.from(new Set(clients.map(c => c.state).filter(Boolean))) as string[];
    const cities = Array.from(new Set(
        clients.filter(c => !stateFilter || c.state === stateFilter).map(c => c.city).filter(Boolean)
    )) as string[];
    const neighborhoods = Array.from(new Set(
        clients.filter(c => (!stateFilter || c.state === stateFilter) && (!cityFilter || c.city === cityFilter))
            .map(c => c.neighborhood).filter(Boolean)
    )) as string[];
    const categories = Array.from(new Set(clients.map(c => c.category).filter(Boolean))) as string[];

    // Aplicar filtros + busca
    let filtered = clients;
    if (stateFilter) filtered = filtered.filter(c => c.state === stateFilter);
    if (cityFilter) filtered = filtered.filter(c => c.city === cityFilter);
    if (neighborhoodFilter) filtered = filtered.filter(c => c.neighborhood === neighborhoodFilter);
    if (categoryFilter) filtered = filtered.filter(c => c.category === categoryFilter);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            c.phoneNumber.includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.city || '').toLowerCase().includes(q)
        );
    }

    // ─── Abrir modal para novo cliente ───
    const openNewModal = () => {
        setEditingClient(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    // ─── Abrir modal para editar cliente ───
    const openEditModal = (client: Client) => {
        setEditingClient(client);
        setForm({
            name: client.name || '', phoneNumber: client.phoneNumber || '',
            category: client.category || '', state: client.state || '',
            city: client.city || '', neighborhood: client.neighborhood || '',
            email: client.email || '', address: client.address || '',
            website: client.website || '', notes: client.notes || ''
        });
        setShowModal(true);
    };

    // ─── Salvar cliente (criar ou editar) ───
    const handleSave = async () => {
        if (!form.phoneNumber) return alert('Telefone é obrigatório!');
        try {
            const payload = { ...form, phoneNumber: normalizePhoneBR(form.phoneNumber) };
            if (editingClient) {
                await axios.put(`${API_URL}/clients/${editingClient.id}`, payload);
            } else {
                await axios.post(`${API_URL}/clients`, payload);
            }
            setShowModal(false);
            loadClients();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Erro ao salvar cliente');
        }
    };

    // ─── Remover cliente ───
    const handleDelete = async (id: number) => {
        if (!window.confirm('Remover este cliente?')) return;
        try {
            await axios.delete(`${API_URL}/clients/${id}`);
            loadClients();
        } catch { alert('Erro ao remover'); }
    };

    // ─── Importar .db externo via Upload ───
    const handleDbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        if (!window.confirm('Importar contatos deste banco de dados (.db / .sqlite)?\nDados duplicados na base serão ignorados.')) {
            e.target.value = '';
            return;
        }

        setIsImportingDb(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await axios.post(`${API_URL}/clients/import-db`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(`✅ Importação concluída!\n${data.inserted} novos clientes inseridos de ${data.total} registros.`);
            loadClients();
        } catch (err: any) {
            alert(`Erro: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsImportingDb(false);
            e.target.value = '';
        }
    };

    // ─── Importar CSV com headers dinâmicos ───
    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];

        // Mapear headers flexíveis (português e inglês)
        const leadsToUpload = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ''; });
            return {
                name: obj.name || obj.nome || obj.title || '',
                phoneNumber: obj.phonenumber || obj.phone || obj.telefone || obj.phone_number || '',
                neighborhood: obj.neighborhood || obj.bairro || '',
                category: obj.category || obj.categoria || '',
                state: obj.state || obj.estado || '',
                city: obj.city || obj.cidade || '',
                email: obj.email || '',
                address: obj.address || obj.endereco || '',
                website: obj.website || obj.site || '',
                notes: obj.notes || obj.observacao || obj.obs || ''
            };
        }).filter(l => l.phoneNumber);

        try {
            const { data } = await axios.post(`${API_URL}/clients/csv-upload`, { leads: leadsToUpload });
            alert(`✅ ${data.inserted} clientes importados!`);
            loadClients();
        } catch { alert('Erro ao importar CSV'); }
        e.target.value = '';
    };

    // ─── Atualizar campo do formulário ───
    const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent inline-flex items-center gap-3">
                        <Users className="text-ch-cyan" size={32} />
                        Clientes
                    </h1>
                    <p className="text-ch-muted mt-2">Gerencie sua base de clientes — adicione, importe e organize.</p>
                </div>

                <div className="flex gap-2">
                    {/* Botão Importar .db */}
                    <label className={`bg-ch-cyan/10 hover:bg-ch-cyan/20 text-ch-cyan transition-colors px-4 py-2 border border-ch-cyan/30 rounded-lg cursor-pointer flex items-center gap-2 ${isImportingDb ? 'opacity-50 pointer-events-none' : ''}`}>
                        <HardDriveDownload size={18} /> {isImportingDb ? 'Importando...' : 'Importar DB'}
                        <input type="file" accept=".db,.sqlite" className="hidden" onChange={handleDbUpload} disabled={isImportingDb} />
                    </label>
                    {/* Botão Importar CSV */}
                    <label className="bg-ch-surface-2 hover:bg-ch-surface-3 transition-colors px-4 py-2 border border-ch-border rounded-lg cursor-pointer flex items-center gap-2">
                        <Upload size={18} /> Importar CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </label>
                    {/* Botão Novo Cliente */}
                    <button onClick={openNewModal}
                        className="gradient-btn px-4 py-2 rounded-lg text-ch-bg font-bold flex items-center gap-2">
                        <Plus size={18} /> Novo Cliente
                    </button>
                </div>
            </div>

            {/* Corpo principal */}
            <div className="bg-ch-surface border border-ch-border rounded-xl p-6">
                {/* Barra de busca + filtros */}
                <div className="flex flex-wrap gap-3 mb-4 items-center">
                    {/* Busca */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-muted" />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nome, telefone, email ou cidade..."
                            className="w-full bg-ch-bg border border-ch-border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                    </div>

                    {/* Filtros geográficos cascata */}
                    <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setCityFilter(''); setNeighborhoodFilter(''); }}
                        className="bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text min-w-[130px]">
                        <option value="">🏛️ Estado ({states.length})</option>
                        {states.sort().map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setNeighborhoodFilter(''); }}
                        className="bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text min-w-[130px]">
                        <option value="">🏙️ Cidade ({cities.length})</option>
                        {cities.sort().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}
                        className="bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text min-w-[130px]">
                        <option value="">📍 Bairro ({neighborhoods.length})</option>
                        {neighborhoods.sort().map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text min-w-[130px]">
                        <option value="">📂 Categoria ({categories.length})</option>
                        {categories.sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* Contagem */}
                <p className="text-xs text-ch-muted mb-3">{filtered.length} de {clients.length} clientes</p>

                {/* Tabela de clientes */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-ch-border text-xs text-ch-muted">
                                <th className="p-3 font-normal">Origem</th>
                                <th className="p-3 font-normal">Nome</th>
                                <th className="p-3 font-normal">Telefone</th>
                                <th className="p-3 font-normal">E-mail</th>
                                <th className="p-3 font-normal">Cidade</th>
                                <th className="p-3 font-normal">Bairro</th>
                                <th className="p-3 font-normal">Categoria</th>
                                <th className="p-3 font-normal w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-ch-muted">
                                    {isLoading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
                                </td></tr>
                            ) : (
                                filtered.map((client) => (
                                    <tr key={client.id} className="border-b border-ch-border/50 hover:bg-ch-surface-2/50 transition-colors">
                                        <td className="p-3">
                                            {/* Badge de origem com cores distintas */}
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${client.source === 'csv' ? 'bg-ch-magenta/20 text-ch-magenta' :
                                                client.source === 'db_import' ? 'bg-ch-cyan/20 text-ch-cyan' :
                                                    'bg-ch-purple/20 text-ch-purple'
                                                }`}>
                                                {client.source === 'csv' ? 'CSV' : client.source === 'db_import' ? 'DB' : 'MAN'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium">{client.name || '-'}</td>
                                        <td className="p-3 text-ch-muted text-sm">{client.phoneNumber}</td>
                                        <td className="p-3 text-ch-muted text-sm truncate max-w-[180px]">{client.email || '-'}</td>
                                        <td className="p-3 text-sm text-ch-muted">{client.city || '-'}</td>
                                        <td className="p-3 text-sm text-ch-muted">{client.neighborhood || '-'}</td>
                                        <td className="p-3 text-sm text-ch-muted truncate max-w-[150px]">{client.category || '-'}</td>
                                        <td className="p-3">
                                            <div className="flex gap-1">
                                                {/* Botão editar */}
                                                <button onClick={() => openEditModal(client)}
                                                    className="p-1.5 text-ch-muted hover:text-ch-cyan transition-colors rounded" title="Editar">
                                                    <Edit3 size={14} />
                                                </button>
                                                {/* Botão remover */}
                                                <button onClick={() => handleDelete(client.id)}
                                                    className="p-1.5 text-ch-muted hover:text-ch-magenta transition-colors rounded" title="Remover">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ Modal de Adição/Edição ═══ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-ch-surface border border-ch-border rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {editingClient ? <><Edit3 size={20} className="text-ch-cyan" /> Editar Cliente</> : <><Plus size={20} className="text-ch-cyan" /> Novo Cliente</>}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-ch-surface-2 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Nome + Telefone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block">Nome</label>
                                    <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="Ex: João Silva" />
                                </div>
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block flex items-center gap-1"><Phone size={12} /> Telefone *</label>
                                    <input type="text" value={form.phoneNumber} onChange={(e) => updateField('phoneNumber', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="(99) 99999-9999" />
                                </div>
                            </div>

                            {/* Email + Website */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block flex items-center gap-1"><Mail size={12} /> E-mail</label>
                                    <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="email@exemplo.com" />
                                </div>
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block flex items-center gap-1"><Globe size={12} /> Website</label>
                                    <input type="text" value={form.website} onChange={(e) => updateField('website', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="https://..." />
                                </div>
                            </div>

                            {/* Estado + Cidade + Bairro */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block">Estado</label>
                                    <input type="text" value={form.state} onChange={(e) => updateField('state', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="SP" />
                                </div>
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block">Cidade</label>
                                    <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="São Paulo" />
                                </div>
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block">Bairro</label>
                                    <input type="text" value={form.neighborhood} onChange={(e) => updateField('neighborhood', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="Centro" />
                                </div>
                            </div>

                            {/* Endereço + Categoria */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block flex items-center gap-1"><MapPin size={12} /> Endereço</label>
                                    <input type="text" value={form.address} onChange={(e) => updateField('address', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="Rua, nº, complemento" />
                                </div>
                                <div>
                                    <label className="text-xs text-ch-muted mb-1 block">Categoria</label>
                                    <input type="text" value={form.category} onChange={(e) => updateField('category', e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="Ex: Restaurante" />
                                </div>
                            </div>

                            {/* Observações */}
                            <div>
                                <label className="text-xs text-ch-muted mb-1 block flex items-center gap-1"><FileText size={12} /> Observações</label>
                                <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)}
                                    rows={3}
                                    className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text resize-none"
                                    placeholder="Anotações sobre este cliente..." />
                            </div>
                        </div>

                        {/* Botões do modal */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-ch-surface-2 text-ch-muted hover:text-ch-text rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave}
                                className="gradient-btn px-6 py-2 rounded-lg text-ch-bg font-bold flex items-center gap-2">
                                <Save size={16} /> {editingClient ? 'Salvar' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

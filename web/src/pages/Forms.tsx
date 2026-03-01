import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash, Save, X, Upload, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

// Máscara de telefone
const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Status disponíveis para processos
const STATUS_OPTIONS = [
    { key: 'atendido', label: 'Atendido', color: 'bg-ch-cyan' },
    { key: 'cadastrado', label: 'Cadastrado', color: 'bg-cyan-500' },
    { key: 'em_negociacao', label: 'Em negociação', color: 'bg-yellow-500' },
    { key: 'locado', label: 'Locado', color: 'bg-purple-500' },
    { key: 'finalizado', label: 'Finalizado', color: 'bg-ch-surface0' },
    { key: 'contrato_elaborado', label: 'Contrato Elaborado', color: 'bg-indigo-500' },
    { key: 'pendente', label: 'Pendente', color: 'bg-orange-500' },
    { key: 'pago', label: 'Pago', color: 'bg-emerald-500' },
    { key: 'concluido', label: 'Concluído', color: 'bg-emerald-600' },
];

type TabType = 'atendimento' | 'simulacao' | 'corretor' | 'locacao';

interface ArquivoInterno {
    titulo: string;
    arquivo: string; // base64
    tipo: string;
}

interface StatusHistorico {
    status: string;
    data: string;
    info?: string;
    mensagem?: string;
    anexo?: string;
}

interface FormEntry {
    id: number;
    type: string;
    data: string;
    createdAt: string;
    origem?: string;
    nome?: string;
    cpf?: string;
    contato?: string;
    endereco?: string;
    localizacao?: string;
    email?: string;
    referencia?: string;
    observacao?: string;
    processos?: string;
    imobiliaria?: string;
    rg?: string;
    renda?: string;
    ocupacao?: string;
    arquivosInternos?: ArquivoInterno[];
    statusAtual?: string;
    statusHistorico?: StatusHistorico[];
}

const ORIGEM_OPTIONS = ['Instagram', 'WhatsApp', 'Google', 'Indicação', 'Corretor Parceiro'];

const emptyAtendimento = {
    origem: '',
    nome: '',
    cpf: '',
    contato: '',
    endereco: '',
    localizacao: '',
    email: '',
    referencia: '',
    observacao: '',
    processos: '',
    rg: '',
    renda: '',
    ocupacao: '',
    arquivosInternos: [] as ArquivoInterno[],
    statusAtual: 'atendido',
    statusHistorico: [] as StatusHistorico[],
};

export const Forms: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('atendimento');
    const [forms, setForms] = useState<FormEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [editingForm, setEditingForm] = useState<Partial<FormEntry> | null>(null);
    const [isNew, setIsNew] = useState(false);

    // Estados para modal de arquivo
    const [showFileModal, setShowFileModal] = useState(false);
    const [fileTitle, setFileTitle] = useState('');
    const [fileData, setFileData] = useState<string | null>(null);
    const [fileType, setFileType] = useState('');
    const [fileError, setFileError] = useState<string | null>(null);

    // Estados para modal de status
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusInfo, setStatusInfo] = useState('');
    const [statusMensagem, setStatusMensagem] = useState('');
    const [statusAnexo, setStatusAnexo] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        loadForms();
    }, []);

    const loadForms = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_URL}/forms`);
            const parsed = (data || []).map((f: any) => {
                let parsedData = {};
                try {
                    parsedData = JSON.parse(f.data || '{}');
                } catch { }
                return { ...f, ...parsedData };
            });
            setForms(parsed);
        } catch (e) {
            setError('Falha ao carregar formulários.');
        } finally {
            setLoading(false);
        }
    };

    const filteredForms = forms.filter(f => {
        if (activeTab === 'atendimento' && f.type !== 'atendimento_interno') return false;
        if (activeTab === 'simulacao' && f.type !== 'simulacao') return false;
        if (activeTab === 'corretor' && f.type !== 'cadastro_corretor') return false;
        if (activeTab === 'locacao' && f.type !== 'cadastro_locacao') return false;

        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            (f.nome?.toLowerCase().includes(searchLower)) ||
            (f.cpf?.includes(search)) ||
            (f.contato?.includes(search)) ||
            (f.email?.toLowerCase().includes(searchLower)) ||
            (f.observacao?.toLowerCase().includes(searchLower))
        );
    });

    const openNewAtendimento = () => {
        setEditingForm({ ...emptyAtendimento, type: 'atendimento_interno' });
        setIsNew(true);
    };

    const openEditForm = (form: FormEntry) => {
        setEditingForm({ ...form });
        setIsNew(false);
    };

    const handleSave = async () => {
        if (!editingForm) return;
        // Validar contato obrigatório
        const contatoDigits = (editingForm.contato || '').replace(/\D/g, '');
        if (contatoDigits.length < 11) {
            setError('Contato é obrigatório e deve ter 11 dígitos.');
            return;
        }
        try {
            setError(null);
            const payload = {
                type: editingForm.type || 'atendimento_interno',
                data: {
                    origem: editingForm.origem,
                    nome: editingForm.nome,
                    cpf: editingForm.cpf,
                    contato: editingForm.contato,
                    endereco: editingForm.endereco,
                    localizacao: editingForm.localizacao,
                    email: editingForm.email,
                    referencia: editingForm.referencia,
                    observacao: editingForm.observacao,
                    processos: editingForm.processos,
                    imobiliaria: editingForm.imobiliaria,
                    rg: editingForm.rg,
                    renda: editingForm.renda,
                    ocupacao: editingForm.ocupacao,
                    arquivosInternos: editingForm.arquivosInternos || [],
                    statusAtual: editingForm.statusAtual || 'atendido',
                    statusHistorico: editingForm.statusHistorico || [],
                },
            };

            if (isNew) {
                await axios.post(`${API_URL}/forms`, payload);
            } else {
                await axios.put(`${API_URL}/forms/${editingForm.id}`, payload);
            }
            setEditingForm(null);
            loadForms();
        } catch (e) {
            setError('Falha ao salvar formulário.');
        }
    };

    // Adicionar arquivo interno
    const handleAddFile = () => {
        if (!fileTitle.trim() || !fileData) {
            setFileError('Preencha o título e selecione um arquivo.');
            return;
        }
        if (!editingForm) return;

        const newFile: ArquivoInterno = { titulo: fileTitle, arquivo: fileData, tipo: fileType };
        const arquivos = [...(editingForm.arquivosInternos || []), newFile];
        setEditingForm({ ...editingForm, arquivosInternos: arquivos });

        setShowFileModal(false);
        setFileTitle('');
        setFileData(null);
        setFileType('');
        setFileError(null);
    };

    // Remover arquivo interno
    const handleRemoveFile = (idx: number) => {
        if (!editingForm) return;
        const arquivos = [...(editingForm.arquivosInternos || [])];
        arquivos.splice(idx, 1);
        setEditingForm({ ...editingForm, arquivosInternos: arquivos });
    };

    // Abrir modal de mudança de status
    const openStatusModal = (status: string) => {
        setNewStatus(status);
        setStatusInfo('');
        setStatusMensagem('');
        setStatusAnexo(null);
        setStatusError(null);
        setShowStatusModal(true);
    };

    // Confirmar mudança de status
    const confirmStatusChange = () => {
        if (!editingForm) return;
        try {
            const historico: StatusHistorico = {
                status: newStatus,
                data: new Date().toISOString(),
                info: statusInfo || undefined,
                mensagem: statusMensagem || undefined,
                anexo: statusAnexo || undefined,
            };
            const statusHistorico = [...(editingForm.statusHistorico || []), historico];
            setEditingForm({ ...editingForm, statusAtual: newStatus, statusHistorico });
            setShowStatusModal(false);
        } catch {
            setStatusError('Erro ao atualizar status.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Excluir este registro?')) return;
        try {
            await axios.delete(`${API_URL}/forms/${id}`);
            loadForms();
        } catch (e) {
            setError('Falha ao excluir.');
        }
    };

    const updateField = (field: string, value: string) => {
        if (!editingForm) return;
        setEditingForm({ ...editingForm, [field]: value });
    };

    const tabs: { key: TabType; label: string }[] = [
        { key: 'atendimento', label: 'Atendimento Interno' },
        { key: 'simulacao', label: 'Simulação' },
        { key: 'corretor', label: 'Cadastro Corretor' },
        { key: 'locacao', label: 'Cadastro Locação/Venda' },
    ];

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-ch-text">Formulários</h1>

            {error && (
                <div className="mb-4 bg-ch-magenta/10 bg-ch-magenta/10 border border-ch-magenta/30 border-ch-magenta/30 text-ch-magenta text-ch-magenta p-3 rounded">{error}</div>
            )}

            <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF, contato..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-ch-border rounded-xl bg-ch-surface text-ch-text placeholder-ch-muted"
                    />
                </div>
                {activeTab === 'atendimento' && (
                    <button onClick={openNewAtendimento} className="bg-ch-cyan text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-ch-cyan/80 w-full sm:w-auto">
                        <Plus size={20} /> <span className="sm:inline">Novo</span>
                    </button>
                )}
            </div>

            <div className="flex overflow-x-auto border-b border-ch-border mb-4 -mx-4 px-4 md:mx-0 md:px-0">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 md:px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === tab.key
                            ? 'border-blue-600 text-ch-cyan'
                            : 'border-transparent text-ch-muted hover:text-ch-text dark:hover:text-ch-muted'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="glass rounded-xl shadow-lg overflow-hidden">
                {loading ? (
                    <div className="p-6 text-ch-text">Carregando...</div>
                ) : filteredForms.length === 0 ? (
                    <div className="p-6 text-ch-muted">Nenhum registro encontrado.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                            <thead className="bg-ch-bg">
                                <tr>
                                    {activeTab === 'atendimento' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted">Origem</th>}
                                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted">{activeTab === 'locacao' ? 'Nome/Empresa' : 'Nome'}</th>
                                    {activeTab !== 'locacao' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden sm:table-cell">CPF</th>}
                                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted">{activeTab === 'locacao' ? 'E-mail' : 'Contato'}</th>
                                    {activeTab === 'atendimento' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden md:table-cell">Processos</th>}
                                    {activeTab === 'corretor' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden sm:table-cell">Imobiliária</th>}
                                    {activeTab === 'locacao' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden sm:table-cell">Endereço</th>}
                                    {activeTab === 'locacao' && <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden md:table-cell">Localização</th>}
                                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted hidden sm:table-cell">Data</th>
                                    <th className="text-right p-2 md:p-3 text-xs md:text-sm font-medium text-ch-muted">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredForms.map(form => (
                                    <tr key={form.id} className="border-t border-ch-border hover:bg-ch-surface-2 hover:bg-ch-surface-2">
                                        {activeTab === 'atendimento' && <td className="p-2 md:p-3 text-sm text-ch-text">{form.origem || '-'}</td>}
                                        <td className="p-2 md:p-3 text-sm text-ch-text">{form.nome || '-'}</td>
                                        {activeTab !== 'locacao' && <td className="p-2 md:p-3 text-sm text-ch-text hidden sm:table-cell">{form.cpf || '-'}</td>}
                                        <td className="p-2 md:p-3 text-sm text-ch-text">{activeTab === 'locacao' ? (form.email || '-') : (form.contato || '-')}</td>
                                        {activeTab === 'atendimento' && <td className="p-2 md:p-3 max-w-xs truncate text-sm text-ch-text hidden md:table-cell">{form.processos || '-'}</td>}
                                        {activeTab === 'corretor' && <td className="p-2 md:p-3 text-sm text-ch-text hidden sm:table-cell">{form.imobiliaria || '-'}</td>}
                                        {activeTab === 'locacao' && <td className="p-2 md:p-3 text-sm text-ch-text hidden sm:table-cell">{form.endereco || '-'}</td>}
                                        {activeTab === 'locacao' && <td className="p-2 md:p-3 max-w-xs truncate text-sm text-ch-text hidden md:table-cell">{form.localizacao || '-'}</td>}
                                        <td className="p-2 md:p-3 text-xs md:text-sm text-ch-muted hidden sm:table-cell">{new Date(form.createdAt).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-2 md:p-3 text-right">
                                            <button onClick={() => openEditForm(form)} className="text-ch-cyan hover:text-ch-cyan mr-2 p-1"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(form.id)} className="text-ch-magenta hover:text-ch-magenta p-1"><Trash size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-[95vw] md:max-w-[80vw] max-h-[90vh] overflow-y-auto">
                        <div className="p-4 md:p-6 border-b border-ch-border flex justify-between items-center sticky top-0 glass z-10">
                            <h2 className="text-lg md:text-xl font-bold text-ch-text">{isNew ? 'Novo Atendimento' : 'Editar Registro'}</h2>
                            <button onClick={() => setEditingForm(null)} className="text-ch-muted hover:text-ch-text text-ch-muted dark:hover:text-gray-200"><X size={24} /></button>
                        </div>
                        <div className="p-4 md:p-6 space-y-5">
                            {/* Status do Processo */}
                            {(editingForm.type === 'atendimento_interno' || isNew) && (
                                <div className="bg-ch-bg p-4 rounded-xl border border-ch-border">
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">📊 Status do Processo</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_OPTIONS.map(st => (
                                            <button
                                                key={st.key}
                                                type="button"
                                                onClick={() => openStatusModal(st.key)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${editingForm.statusAtual === st.key
                                                        ? `${st.color} text-white ring-2 ring-offset-2 ring-${st.color.replace('bg-', '')}`
                                                        : 'bg-gray-200 bg-ch-surface-2 text-ch-text text-ch-text hover:bg-gray-300 hover:bg-ch-surface-2'
                                                    }`}
                                            >
                                                {editingForm.statusAtual === st.key && <CheckCircle size={12} className="inline mr-1" />}
                                                {st.label}
                                            </button>
                                        ))}
                                    </div>
                                    {editingForm.statusHistorico && editingForm.statusHistorico.length > 0 && (
                                        <div className="mt-3 text-xs text-ch-muted">
                                            <Clock size={12} className="inline mr-1" />
                                            Última atualização: {new Date(editingForm.statusHistorico[editingForm.statusHistorico.length - 1].data).toLocaleString('pt-BR')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {(editingForm.type === 'atendimento_interno' || isNew) && (
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Origem</label>
                                    <select
                                        value={editingForm.origem || ''}
                                        onChange={e => updateField('origem', e.target.value)}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text"
                                    >
                                        <option value="">Selecione...</option>
                                        {ORIGEM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Nome</label>
                                    <input type="text" value={editingForm.nome || ''} onChange={e => updateField('nome', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">CPF</label>
                                    <input type="text" value={editingForm.cpf || ''} onChange={e => updateField('cpf', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" placeholder="000.000.000-00" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Contato <span className="text-ch-magenta">*</span></label>
                                    <input
                                        type="text"
                                        value={editingForm.contato || ''}
                                        onChange={e => updateField('contato', formatPhone(e.target.value))}
                                        className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text"
                                        placeholder="(00) 00000-0000"
                                        maxLength={15}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">E-mail</label>
                                    <input type="email" value={editingForm.email || ''} onChange={e => updateField('email', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                                </div>
                            </div>

                            {/* Campos opcionais: RG, Renda, Ocupação */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">RG <span className="text-ch-muted text-xs">(opcional)</span></label>
                                    <input type="text" value={editingForm.rg || ''} onChange={e => updateField('rg', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Renda <span className="text-ch-muted text-xs">(opcional)</span></label>
                                    <input type="text" value={editingForm.renda || ''} onChange={e => updateField('renda', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" placeholder="R$ 0,00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Ocupação <span className="text-ch-muted text-xs">(opcional)</span></label>
                                    <input type="text" value={editingForm.ocupacao || ''} onChange={e => updateField('ocupacao', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Endereço</label>
                                <input type="text" value={editingForm.endereco || ''} onChange={e => updateField('endereco', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Localização</label>
                                <input type="text" value={editingForm.localizacao || ''} onChange={e => updateField('localizacao', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" placeholder="Link do Google Maps" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Referência</label>
                                <input type="text" value={editingForm.referencia || ''} onChange={e => updateField('referencia', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                            </div>

                            {editingForm.type === 'cadastro_corretor' && (
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Imobiliária</label>
                                    <input type="text" value={editingForm.imobiliaria || ''} onChange={e => updateField('imobiliaria', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Observação</label>
                                <textarea value={editingForm.observacao || ''} onChange={e => updateField('observacao', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 h-24 bg-ch-surface-2 text-ch-text" />
                            </div>

                            {(editingForm.type === 'atendimento_interno' || isNew) && (
                                <div>
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Processos</label>
                                    <textarea value={editingForm.processos || ''} onChange={e => updateField('processos', e.target.value)} className="w-full border border-ch-border rounded-xl p-3 h-24 bg-ch-surface-2 text-ch-text" placeholder="Histórico de processos do cliente..." />
                                </div>
                            )}

                            {/* Arquivos Internos */}
                            {(editingForm.type === 'atendimento_interno' || isNew) && (
                                <div className="bg-ch-cyan/10 bg-ch-cyan/10/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-3">📁 Arquivos Internos</label>
                                    <div className="flex flex-wrap gap-3 mb-3">
                                        {(editingForm.arquivosInternos || []).map((arq, idx) => (
                                            <div key={idx} className="relative bg-ch-surface-2 p-2 rounded-xl border border-ch-border flex items-center gap-2 max-w-[200px]">
                                                {arq.tipo.startsWith('image/') ? (
                                                    <img src={arq.arquivo} alt={arq.titulo} className="w-12 h-12 object-cover rounded" />
                                                ) : (
                                                    <FileText size={24} className="text-ch-cyan" />
                                                )}
                                                <span className="text-xs truncate flex-1 text-ch-text">{arq.titulo}</span>
                                                <button onClick={() => handleRemoveFile(idx)} className="text-ch-magenta hover:text-ch-magenta text-lg font-bold">×</button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setShowFileModal(true)}
                                            className="w-20 h-20 border-2 border-dashed border-blue-400 dark:border-ch-cyan rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-ch-cyan/10 dark:hover:bg-blue-900/40 text-ch-cyan text-ch-cyan transition-colors"
                                        >
                                            <Upload size={20} />
                                            <span className="text-xs mt-1">Upload</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 md:p-6 border-t border-ch-border flex justify-end gap-3 sticky bottom-0 glass">
                            <button onClick={() => setEditingForm(null)} className="px-5 py-2.5 border border-ch-border rounded-xl hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text font-medium">Cancelar</button>
                            <button onClick={handleSave} className="px-5 py-2.5 bg-ch-cyan text-white rounded-xl hover:bg-ch-cyan/80 font-medium flex items-center gap-2"><Save size={18} /> Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Upload de Arquivo */}
            {showFileModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-4 border-b border-ch-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-ch-text">Adicionar Arquivo</h3>
                            <button onClick={() => { setShowFileModal(false); setFileError(null); }} className="text-ch-muted hover:text-ch-text text-ch-muted"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            {fileError && (
                                <div className="bg-ch-magenta/10 bg-ch-magenta/10 border border-ch-magenta/30 border-ch-magenta/30 text-ch-magenta text-ch-magenta p-2 rounded text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> {fileError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Título do Arquivo</label>
                                <input
                                    type="text"
                                    value={fileTitle}
                                    onChange={e => setFileTitle(e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 bg-ch-surface-2 text-ch-text"
                                    placeholder="Ex: Comprovante de Renda"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Selecionar Arquivo</label>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 10 * 1024 * 1024) {
                                                setFileError('Arquivo muito grande. Máximo 10MB.');
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                setFileData(reader.result as string);
                                                setFileType(file.type);
                                                setFileError(null);
                                            };
                                            reader.onerror = () => setFileError('Erro ao ler arquivo. Tente novamente.');
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="w-full border border-ch-border rounded-xl p-2 bg-ch-surface-2 text-ch-text"
                                />
                                {fileData && <p className="text-xs text-emerald-400 mt-1">✓ Arquivo selecionado</p>}
                            </div>
                        </div>
                        <div className="p-4 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => { setShowFileModal(false); setFileError(null); }} className="px-4 py-2 border border-ch-border rounded hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text">Cancelar</button>
                            <button onClick={handleAddFile} className="px-4 py-2 bg-ch-cyan text-white rounded hover:bg-ch-cyan/80">Salvar Arquivo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Mudança de Status */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="glass rounded-xl shadow-xl w-full max-w-[95vw] md:max-w-[60vw] lg:max-w-[50vw]">
                        <div className="p-4 border-b border-ch-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-ch-text">Alterar Status para: {STATUS_OPTIONS.find(s => s.key === newStatus)?.label}</h3>
                            <button onClick={() => setShowStatusModal(false)} className="text-ch-muted hover:text-ch-text text-ch-muted"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            {statusError && (
                                <div className="bg-ch-magenta/10 bg-ch-magenta/10 border border-ch-magenta/30 border-ch-magenta/30 text-ch-magenta text-ch-magenta p-2 rounded text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> {statusError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Informações Adicionais <span className="text-ch-muted text-xs">(opcional)</span></label>
                                <textarea
                                    value={statusInfo}
                                    onChange={e => setStatusInfo(e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 h-20 bg-ch-surface-2 text-ch-text"
                                    placeholder="Observações internas..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Mensagem ao Cliente <span className="text-ch-muted text-xs">(opcional)</span></label>
                                <textarea
                                    value={statusMensagem}
                                    onChange={e => setStatusMensagem(e.target.value)}
                                    className="w-full border border-ch-border rounded-xl p-3 h-20 bg-ch-surface-2 text-ch-text"
                                    placeholder="Mensagem que será enviada ao cliente..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-ch-text dark:text-gray-100 mb-1">Anexo <span className="text-ch-muted text-xs">(opcional)</span></label>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = () => setStatusAnexo(reader.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="w-full border border-ch-border rounded-xl p-2 bg-ch-surface-2 text-ch-text"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-ch-border flex justify-end gap-3">
                            <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 border border-ch-border rounded hover:bg-ch-surface-2 hover:bg-ch-surface-2 text-ch-text">Cancelar</button>
                            <button onClick={confirmStatusChange} className="px-4 py-2 bg-ch-cyan text-white rounded hover:bg-ch-cyan/80">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

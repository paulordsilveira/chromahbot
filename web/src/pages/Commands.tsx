import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, Command, Trash2, Edit2, Save, Send, Search, Filter, Power, PowerOff, Clock, Eye, Download, Image as ImageIcon, FileText } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

type CustomCommand = {
    id: number;
    triggers: string;
    textMessage: string;
    fileData: string;
    isActive: number;
    createdAt: string;
    linkedSubcategoryId?: number | null;
    linkedItemId?: number | null;
};

export const Commands: React.FC = () => {
    const [commands, setCommands] = useState<CustomCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterState, setFilterState] = useState<'all' | 'active' | 'inactive'>('all');

    // States of Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [triggers, setTriggers] = useState('');
    const [textMessage, setTextMessage] = useState('');
    const [tempFiles, setTempFiles] = useState<any[]>([]);
    const [isActiveStatus, setIsActiveStatus] = useState<number>(1);
    const [viewingCommand, setViewingCommand] = useState<CustomCommand | null>(null);

    // Links (Funnel positions)
    const [linkedSubcat, setLinkedSubcat] = useState<number | ''>('');
    const [linkedItem, setLinkedItem] = useState<number | ''>('');

    // Auxiliary data for dropdowns
    const [categoriesList, setCategoriesList] = useState<any[]>([]);
    const [itemsList, setItemsList] = useState<any[]>([]);

    useEffect(() => {
        fetchCommands();
        fetchAuxData();
    }, []);

    const fetchCommands = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/commands`);
            setCommands(data);
        } catch (err) {
            setError('Erro ao carregar comandos: ' + (err as any).message);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxData = async () => {
        try {
            const [cats, its] = await Promise.all([
                axios.get(`${API_URL}/categories`),
                axios.get(`${API_URL}/items`)
            ]);
            setCategoriesList(cats.data);
            setItemsList(its.data);
        } catch (err) {
            console.error('API Error loading aux lists:', err);
        }
    };

    const parseFiles = (fileDataStr: string | null) => {
        try {
            if (!fileDataStr) return [];
            return JSON.parse(fileDataStr);
        } catch {
            return [];
        }
    };

    const handleOpenModal = (cmd?: CustomCommand) => {
        if (cmd) {
            setEditingId(cmd.id);
            setTriggers(cmd.triggers);
            setTextMessage(cmd.textMessage || '');
            setTempFiles(parseFiles(cmd.fileData));
            setIsActiveStatus(cmd.isActive !== undefined ? cmd.isActive : 1);
            setLinkedSubcat(cmd.linkedSubcategoryId || '');
            setLinkedItem(cmd.linkedItemId || '');
        } else {
            setEditingId(null);
            setTriggers('');
            setTextMessage('');
            setTempFiles([]);
            setIsActiveStatus(1);
            setLinkedSubcat('');
            setLinkedItem('');
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        let readersReady = 0;
        const newDocs: any[] = [];

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                newDocs.push({
                    name: file.name,
                    type: file.type,
                    data: reader.result as string
                });
                readersReady++;
                if (readersReady === files.length) {
                    setTempFiles(prev => [...prev, ...newDocs]);
                }
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // reseta input param novo trigger
    };

    const removeFile = (index: number) => {
        setTempFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!triggers.trim()) {
            alert('Você precisa definir pelo menos uma palavra de comando (trigger).');
            return;
        }

        const payload = {
            triggers,
            textMessage,
            fileData: JSON.stringify(tempFiles),
            isActive: isActiveStatus,
            linkedSubcategoryId: linkedSubcat === '' ? null : Number(linkedSubcat),
            linkedItemId: linkedItem === '' ? null : Number(linkedItem)
        };

        try {
            if (editingId) {
                await axios.put(`${API_URL}/commands/${editingId}`, payload);
            } else {
                await axios.post(`${API_URL}/commands`, payload);
            }
            fetchCommands();
            handleCloseModal();
        } catch (err: any) {
            alert('Erro ao salvar comando: ' + err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Certeza que deseja deletar este atalho?')) return;
        try {
            await axios.delete(`${API_URL}/commands/${id}`);
            fetchCommands();
        } catch (err: any) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    const toggleCommandStatus = async (cmd: CustomCommand) => {
        try {
            const newStatus = cmd.isActive === 1 ? 0 : 1;
            await axios.put(`${API_URL}/commands/${cmd.id}`, {
                triggers: cmd.triggers,
                textMessage: cmd.textMessage,
                fileData: cmd.fileData,
                isActive: newStatus
            });
            fetchCommands();
        } catch (err: any) {
            alert('Erro ao alterar status: ' + err.message);
        }
    };

    const filteredCommands = commands.filter(cmd => {
        // filter status
        if (filterState === 'active' && cmd.isActive === 0) return false;
        if (filterState === 'inactive' && cmd.isActive !== 0) return false;

        // search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const triggersMatch = cmd.triggers.toLowerCase().includes(term);
            const textMatch = (cmd.textMessage || '').toLowerCase().includes(term);
            return triggersMatch || textMatch;
        }
        return true;
    });

    if (loading) return <div className="p-8 text-ch-text text-center">Carregando Atalhos...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8 pb-6 border-b border-ch-border">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent mb-2">
                        Comandos Dinâmicos
                    </h1>
                    <p className="text-ch-muted max-w-3xl">
                        Crie atalhos ocultos que <b>apenas você (o dono conectado via Zap Web/App)</b> pode disparar na conversa do cliente.
                        Envie múltiplos arquivos físicos e textos padronizados com um único comando.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="gradient-btn text-ch-bg font-semibold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-ch-cyan/20 shrink-0"
                >
                    <Plus size={20} />
                    <span>Criar Atalho</span>
                </button>
            </div>

            {error && (
                <div className="p-4 bg-ch-magenta/20 text-ch-magenta border border-ch-magenta/30 rounded-xl">
                    {error}
                </div>
            )}

            {/* Search and Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-ch-surface p-4 rounded-2xl border border-ch-border">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-muted" size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Pesquisar comando ou texto..."
                        className="w-full pl-10 pr-4 py-2.5 bg-ch-bg border border-ch-border text-ch-text rounded-xl outline-none focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto whitespace-nowrap pb-1 md:pb-0">
                    <Filter className="text-ch-muted mr-1 shrink-0" size={18} />
                    <button
                        onClick={() => setFilterState('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterState === 'all' ? 'bg-ch-cyan/20 text-ch-cyan border-ch-cyan border' : 'bg-ch-surface-2 text-ch-muted border border-ch-surface-2 hover:bg-ch-border'}`}
                    >
                        Todos ({commands.length})
                    </button>
                    <button
                        onClick={() => setFilterState('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterState === 'active' ? 'bg-ch-cyan/20 text-ch-cyan border-ch-cyan border' : 'bg-ch-surface-2 text-ch-muted border border-ch-surface-2 hover:bg-ch-border'}`}
                    >
                        Ativos ({commands.filter(c => c.isActive !== 0).length})
                    </button>
                    <button
                        onClick={() => setFilterState('inactive')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterState === 'inactive' ? 'bg-ch-magenta/20 text-ch-magenta border-ch-magenta border' : 'bg-ch-surface-2 text-ch-muted border border-ch-surface-2 hover:bg-ch-border'}`}
                    >
                        Inativos ({commands.filter(c => c.isActive === 0).length})
                    </button>
                </div>
            </div>

            {/* Grid of Commands */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCommands.map(cmd => {
                    const files = parseFiles(cmd.fileData);
                    const isActive = cmd.isActive !== 0;
                    const dateAdded = cmd.createdAt ? new Date(cmd.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/D';

                    let linkedSubcatName = '';
                    if (cmd.linkedSubcategoryId) {
                        for (const cat of categoriesList) {
                            const sub = cat.subcategories?.find((s: any) => s.id === cmd.linkedSubcategoryId);
                            if (sub) {
                                linkedSubcatName = sub.name;
                                break;
                            }
                        }
                    }
                    let linkedItemName = '';
                    if (cmd.linkedItemId) {
                        const it = itemsList.find(i => i.id === cmd.linkedItemId);
                        if (it) {
                            linkedItemName = it.name;
                        }
                    }

                    return (
                        <div key={cmd.id} className={`p-6 rounded-2xl border flex flex-col transition-all shadow-lg relative group ${isActive ? 'bg-ch-surface border-ch-border hover:border-ch-cyan/40 shadow-black/20' : 'bg-ch-bg border-ch-border/50 opacity-80'}`}>

                            {/* Actions Overlay */}
                            <div className="absolute top-4 right-4 flex flex-col md:flex-row gap-2 opacity-100 transition-opacity">
                                <button
                                    onClick={() => setViewingCommand(cmd)}
                                    className="bg-ch-surface-2 p-2 rounded-lg text-ch-purple hover:bg-ch-purple hover:text-white transition-colors shadow"
                                    title="Visualizar Somente Leitura"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => handleOpenModal(cmd)}
                                    className="bg-ch-surface-2 p-2 rounded-lg text-ch-cyan hover:bg-ch-cyan hover:text-ch-bg transition-colors shadow"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => toggleCommandStatus(cmd)}
                                    className={`p-2 rounded-lg transition-colors shadow ${isActive ? 'bg-ch-surface-2 text-ch-magenta hover:bg-ch-magenta hover:text-white' : 'bg-ch-surface-2 text-ch-cyan hover:bg-ch-cyan hover:text-white'}`}
                                    title={isActive ? "Desativar" : "Ativar"}
                                >
                                    {isActive ? <PowerOff size={16} /> : <Power size={16} />}
                                </button>
                                <button
                                    onClick={() => handleDelete(cmd.id)}
                                    className="bg-ch-surface-2 p-2 rounded-lg text-ch-muted hover:bg-ch-magenta hover:text-white transition-colors shadow"
                                    title="Excluir Permanentemente"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-gradient-to-br from-ch-cyan/20 to-ch-purple/20 text-ch-cyan' : 'bg-ch-surface-2 text-ch-muted'}`}>
                                    <Command size={20} />
                                </div>
                                <div className="pr-20"> {/* pr-20 to avoid overlaying the hover buttons */}
                                    <h3 className={`font-bold text-lg leading-tight ${isActive ? 'text-ch-text' : 'text-ch-muted line-through'}`}>
                                        {cmd.triggers.split(',').length > 1 ? 'Múltiplos Atalhos' : cmd.triggers}
                                    </h3>
                                    <div className="flex gap-2 text-xs font-mono mt-1 flex-wrap">
                                        {cmd.triggers.split(',').map((t, idx) => (
                                            <span key={idx} className={`px-2 py-1 rounded ${isActive ? 'bg-ch-surface-2 text-ch-purple' : 'bg-ch-bg border border-ch-border text-ch-muted'}`}>
                                                {t.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                {cmd.textMessage && (
                                    <div>
                                        <span className={`text-xs font-bold uppercase block mb-1 ${isActive ? 'text-ch-muted' : 'text-ch-muted/50'}`}>Mensagem Injetada:</span>
                                        <p className={`text-sm line-clamp-3 p-3 rounded-lg border border-ch-border/50 ${isActive ? 'text-ch-text/80 bg-ch-surface-2/50' : 'text-ch-muted bg-ch-bg'}`}>
                                            {cmd.textMessage}
                                        </p>
                                    </div>
                                )}

                                {files.length > 0 && (
                                    <div>
                                        <span className={`text-xs font-bold uppercase block mb-2 ${isActive ? 'text-ch-muted' : 'text-ch-muted/50'}`}>Arquivos Anexos ({files.length}):</span>
                                        <div className="flex flex-wrap gap-2">
                                            {files.slice(0, 3).map((f: any, i: number) => (
                                                <span key={i} className={`text-xs px-2 py-1 rounded line-clamp-1 max-w-[150px] ${isActive ? 'bg-ch-cyan/10 text-ch-cyan border border-ch-cyan/20' : 'bg-ch-surface-2 text-ch-muted'}`}>
                                                    📎 {f.name}
                                                </span>
                                            ))}
                                            {files.length > 3 && (
                                                <span className="text-xs text-ch-muted px-2 py-1">+{files.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(cmd.linkedSubcategoryId || cmd.linkedItemId) && (
                                    <div className={`mt-2 p-3 rounded-lg border flex items-start gap-2 ${isActive ? 'bg-ch-surface border-ch-cyan/30 text-ch-cyan' : 'bg-ch-surface-2 border-ch-border text-ch-muted'}`}>
                                        <Command size={14} className="mt-0.5 shrink-0" />
                                        <div className="text-xs">
                                            <b className="block mb-0.5">Vínculo de Funil Ativo:</b>
                                            {cmd.linkedSubcategoryId && <p>↳ Subcategoria: {linkedSubcatName || `ID ${cmd.linkedSubcategoryId}`}</p>}
                                            {cmd.linkedItemId && <p>↳ Item: {linkedItemName || `ID ${cmd.linkedItemId}`}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex items-center justify-between text-[11px] font-bold text-ch-muted pt-4 border-t border-ch-border/50">
                                <div className="flex items-center gap-1">
                                    <Clock size={12} /> Adicionado: {dateAdded}
                                </div>
                                {isActive ? (
                                    <span className="text-ch-cyan flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-ch-cyan"></span> Ativo</span>
                                ) : (
                                    <span className="text-ch-magenta flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-ch-magenta/50"></span> Inativo</span>
                                )}
                            </div>

                        </div>
                    );
                })}
            </div>

            {filteredCommands.length === 0 && !loading && (
                <div className="text-center py-20 bg-ch-surface/50 rounded-2xl border border-ch-border/50">
                    <Command size={48} className="mx-auto text-ch-muted mb-4 opacity-30" />
                    <h2 className="text-xl font-bold text-ch-text mb-2">Nenhum Comando Encontrado</h2>
                    {commands.length === 0 ? (
                        <>
                            <p className="text-ch-muted mb-6">Comece criando atalhos personalizados (Ex: /portfolio, /tabeladeprecos)</p>
                            <button
                                onClick={() => handleOpenModal()}
                                className="text-ch-cyan hover:text-ch-purple font-medium flex items-center gap-2 mx-auto transition-colors"
                            >
                                <Plus size={20} />
                                Criar meu primeiro Atalho
                            </button>
                        </>
                    ) : (
                        <p className="text-ch-muted">Modifique os filtros ou termo de busca e tente novamente.</p>
                    )}
                </div>
            )}


            {/* Modal Creating/Editing */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-ch-surface w-full max-w-2xl rounded-3xl border border-ch-border shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-ch-border flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-ch-text flex items-center gap-3">
                                <Command className="text-ch-cyan" />
                                {editingId ? 'Editar Atalho Oculto' : 'Novo Atalho Oculto'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-ch-muted hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">

                            {/* Box 1: Triggers */}
                            <div>
                                <label className="block text-sm font-bold text-ch-muted uppercase mb-2 flex items-center justify-between">
                                    <span>Sua Palavra(s) de Comando ⚡</span>
                                    <span className="text-xs text-ch-cyan font-normal normal-case">Obrigatório</span>
                                </label>
                                <input
                                    value={triggers}
                                    onChange={(e) => setTriggers(e.target.value)}
                                    className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-xl p-4 outline-none focus:ring-2 focus:ring-ch-cyan/50 transition-colors font-mono"
                                    placeholder="/docs, /pdf, /apresentacao ..."
                                />
                                <p className="text-xs text-ch-muted mt-2">Separe as variações por vírgula. Sempre que você digitar uma dessas palavras exatamente como está, o gatilho será acionado e não enviado à IA.</p>
                            </div>

                            {/* Box 2: Text Message */}
                            <div>
                                <label className="block text-sm font-bold text-ch-muted uppercase mb-2">Mensagem de Texto Injetada</label>
                                <textarea
                                    value={textMessage}
                                    onChange={(e) => setTextMessage(e.target.value)}
                                    className="w-full min-h-[140px] bg-ch-surface-2 border border-ch-border text-ch-text rounded-xl p-4 outline-none focus:ring-2 focus:ring-ch-purple/50 transition-colors resize-none placeholder:text-ch-text/30"
                                    placeholder="Deixe em branco se for só enviar arquivo. 
Ou digite: 'Olá, segue anexo meu catálogo e apresentação conforme solicitado!'"
                                />
                            </div>

                            {/* Box 2.5: Funnel Links (new) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-ch-cyan uppercase mb-2">
                                        Vincular à uma Subcategoria (Opcional)
                                    </label>
                                    <select
                                        value={linkedSubcat}
                                        onChange={e => {
                                            setLinkedSubcat(e.target.value ? Number(e.target.value) : '');
                                            setLinkedItem(''); // evita crachar logica tendo 2 vinculos
                                        }}
                                        className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-xl p-3 outline-none focus:ring-2 focus:ring-ch-cyan/50 text-sm"
                                    >
                                        <option value="">-- Nenhuma --</option>
                                        {categoriesList.map(cat => (
                                            <optgroup key={cat.id} label={`📂 ${cat.name}`}>
                                                {cat.subcategories?.map((sub: any) => (
                                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-ch-muted mt-1">Ao usar este comando, o bot enviará a grade de botões dessa subcategoria.</p>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-ch-purple uppercase mb-2">
                                        Vincular apenas a um Item (Opcional)
                                    </label>
                                    <select
                                        value={linkedItem}
                                        onChange={e => {
                                            setLinkedItem(e.target.value ? Number(e.target.value) : '');
                                            setLinkedSubcat('');
                                        }}
                                        className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-xl p-3 outline-none focus:ring-2 focus:ring-ch-purple/50 text-sm"
                                    >
                                        <option value="">-- Nenhum --</option>
                                        {itemsList.map(item => (
                                            <option key={item.id} value={item.id}>{item.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-ch-muted mt-1">Aciona diretamente o card do item/formulário final.</p>
                                </div>
                            </div>

                            {/* Box 3: Files Attachments */}
                            <div className="bg-gradient-to-br from-ch-bg to-ch-surface-2 p-5 rounded-2xl border border-ch-border">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-ch-cyan flex items-center gap-2 mb-1">
                                            Arquivos Injetados
                                        </h4>
                                        <p className="text-xs text-ch-muted">Anexe PDFs, Imagens, Vídeos curtos que a Lid enviará junto com seu atalho de forma física.</p>
                                    </div>

                                    <label className="bg-ch-surface-2 border border-ch-border hover:border-ch-cyan text-ch-cyan px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                                        <Plus size={16} /> Adicionar
                                        <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>

                                {tempFiles.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {tempFiles.map((doc, i) => (
                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-ch-bg p-3 rounded-lg gap-3 border border-ch-border">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-10 h-10 rounded-lg bg-ch-surface-2 flex items-center justify-center text-ch-muted shrink-0">
                                                        📎
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-ch-text font-medium truncate sm:max-w-xs">{doc.name}</p>
                                                        <p className="text-xs text-ch-muted truncate block">{doc.type || 'unknown type'}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeFile(i)} className="text-ch-magenta hover:bg-ch-magenta/10 p-2 rounded-lg transition-colors flex items-center gap-2 justify-center sm:w-auto w-full border border-ch-border sm:border-none">
                                                    <Trash2 size={16} /> <span className="sm:hidden text-xs">Desanexar</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-ch-muted/50 border-2 border-dashed border-ch-border/50 rounded-xl">
                                        <Send size={24} className="mb-2" />
                                        <span className="text-sm">Nenhum arquivo anexado (só o texto será enviado)</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="p-6 border-t border-ch-border flex justify-end gap-3 bg-ch-surface-2/30">
                            <button
                                onClick={handleCloseModal}
                                className="px-6 py-2.5 rounded-xl border border-ch-border hover:bg-ch-surface-2 transition-colors font-medium text-ch-text"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="gradient-btn text-ch-bg font-bold px-8 py-2.5 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-ch-cyan/20 transition-all"
                            >
                                <Save size={20} />
                                Salvar Comando
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* View Modal */}
            {viewingCommand && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-ch-surface w-full max-w-2xl rounded-3xl border border-ch-border shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-ch-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-ch-text flex items-center gap-3">
                                <Eye className="text-ch-purple" />
                                Visualizando Atalho
                            </h2>
                            <button onClick={() => setViewingCommand(null)} className="text-ch-muted hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            <div>
                                <span className="text-xs font-bold uppercase block text-ch-muted mb-1">Palavra(s) de Comando ⚡</span>
                                <div className="flex gap-2 text-sm font-mono flex-wrap">
                                    {viewingCommand.triggers.split(',').map((t, idx) => (
                                        <span key={idx} className="bg-ch-surface-2 px-3 py-1.5 rounded-lg border border-ch-border text-ch-cyan">
                                            {t.trim()}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {viewingCommand.textMessage && (
                                <div>
                                    <span className="text-xs font-bold uppercase block text-ch-muted mb-2">Mensagem de Texto Injetada</span>
                                    <div className="bg-ch-surface/80 border-2 border-ch-border/60 rounded-xl p-5 text-white font-medium text-base whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {viewingCommand.textMessage}
                                    </div>
                                </div>
                            )}

                            {parseFiles(viewingCommand.fileData).length > 0 && (
                                <div>
                                    <span className="text-xs font-bold uppercase block text-ch-muted mb-2">
                                        Arquivos Anexos ({parseFiles(viewingCommand.fileData).length})
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {parseFiles(viewingCommand.fileData).map((f: any, i: number) => {
                                            const isImage = f.type.startsWith('image/');
                                            return (
                                                <div key={i} className={`flex flex-col bg-ch-surface-2 rounded-xl border border-ch-border/50 overflow-hidden hover:border-ch-purple transition-colors shadow-lg ${isImage ? 'sm:col-span-2' : ''}`}>
                                                    {isImage && (
                                                        <div className="bg-gradient-to-br from-ch-bg to-ch-surface aspect-[4/3] max-h-80 w-full relative overflow-hidden flex items-center justify-center p-2 rounded-t-xl">
                                                            <img src={f.data} alt={f.name} className="object-contain w-full h-full rounded shadow-xl" />
                                                        </div>
                                                    )}
                                                    <div className="p-3 flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {isImage ? <ImageIcon size={16} className="text-ch-purple shrink-0" /> : <FileText size={16} className="text-ch-cyan shrink-0" />}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-ch-text truncate">{f.name}</p>
                                                                <p className="text-[10px] text-ch-muted uppercase mt-0.5">{f.type.split('/')[1] || 'arquivo'}</p>
                                                            </div>
                                                        </div>
                                                        <a
                                                            href={f.data}
                                                            download={f.name}
                                                            className="p-2 bg-ch-bg text-ch-cyan hover:bg-ch-cyan hover:text-white rounded-lg transition-colors border border-ch-border shrink-0"
                                                            title="Baixar Arquivo"
                                                        >
                                                            <Download size={16} />
                                                        </a>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

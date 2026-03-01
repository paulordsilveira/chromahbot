import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Megaphone, Plus, Upload, Play, Pause, Square, Database, ImagePlus, FileText,
    Eye, Save, Send, Bold, Italic, Strikethrough, Code, Smile, Copy,
    Download, Search, Trash2, Clock, AlertTriangle, CalendarDays, MapPin, Edit3, HardDriveDownload
} from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api/marketing`;

// ─── Emojis populares para o Emoji Picker ───
const EMOJI_LIST = [
    '😀', '😂', '😍', '🥰', '😘', '😊', '🤩', '😎', '🤔', '😉', '🙏', '👍', '👏', '🎉', '🔥',
    '💯', '✅', '❤️', '💰', '📈', '📊', '📣', '🎯', '💡', '⚡', '🏆', '🌟', '💎', '🚀', '📱',
    '📧', '📞', '🤝', '💼', '🏠', '🔑', '📋', '✨', '🎁', '💫', '🍕', '🍔', '☕', '🍰', '🎂'
];

// ─── Utilitários de Telefone (formato brasileiro) ───

// Normaliza telefone BR: remove formatação, garante 55 e 9º dígito para celular
const normalizePhoneBR = (raw: string): string => {
    let digits = raw.replace(/\D/g, '');
    // Remove 0 inicial (0xx)
    if (digits.startsWith('0')) digits = digits.substring(1);
    // Se começa com 55, remove o código do país
    if (digits.startsWith('55') && digits.length >= 12) digits = digits.substring(2);
    // Se tem 10 dígitos (DDD + 8 dígitos), adiciona o 9 para celular
    if (digits.length === 10) {
        const ddd = digits.substring(0, 2);
        const num = digits.substring(2);
        if (['9', '8', '7', '6'].includes(num[0])) {
            digits = ddd + '9' + num;
        }
    }
    return '55' + digits;
};

// Aplica máscara visual: (00) 00000-0000
const maskPhoneBR = (value: string): string => {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 2) digits = digits.substring(2);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
    if (digits.length <= 11) return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
};

// ─── Interfaces ───
interface Campaign {
    id: number;
    name: string;
    messageContent: string;
    imagePath?: string;
    minDelay: number;
    maxDelay: number;
    status: 'paused' | 'running' | 'scheduled' | 'completed' | 'cancelled' | 'failed';
    createdAt: string;
    stats: {
        total: number;
        sent: number;
        failed: number;
        pending: number;
    };
}

// Interface unificada de Lead — usada tanto para dados importados de .db quanto CSV
interface Lead {
    id: number;
    name?: string;
    phoneNumber: string;
    source: string;       // 'csv', 'db_import', 'manual'
    neighborhood?: string;
    category?: string;
    state?: string;       // Estado geográfico
    city?: string;        // Cidade
    email?: string;
    address?: string;
    website?: string;
}

// ─── Painel de Leads memoizado com filtros geográficos: Estado → Cidade → Bairro ───
// Recebe lista unificada de leads (fonte única: marketing_lead)
const LeadListPanel = React.memo(({
    leads, selectedLeads, onToggle, onSelectAll
}: {
    leads: Lead[];
    selectedLeads: Set<string>;
    onToggle: (phone: string) => void;
    onSelectAll: (visiblePhones: string[]) => void;
}) => {
    const [categoryFilter, setCategoryFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Extrair dados únicos para filtros cascata (de todos os leads unificados)
    const states = Array.from(new Set(leads.map(l => l.state).filter(Boolean))) as string[];
    const cities = Array.from(new Set(
        leads.filter(l => !stateFilter || l.state === stateFilter).map(l => l.city).filter(Boolean)
    )) as string[];
    const neighborhoods = Array.from(new Set(
        leads.filter(l => (!stateFilter || l.state === stateFilter) && (!cityFilter || l.city === cityFilter)).map(l => l.neighborhood).filter(Boolean)
    )) as string[];
    const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean))) as string[];

    // Filtro encadeado: estado → cidade → bairro → categoria
    let filtered = leads;
    if (stateFilter) filtered = filtered.filter(l => l.state === stateFilter);
    if (cityFilter) filtered = filtered.filter(l => l.city === cityFilter);
    if (neighborhoodFilter) filtered = filtered.filter(l => l.neighborhood === neighborhoodFilter);
    if (categoryFilter) filtered = filtered.filter(l => l.category === categoryFilter);

    // Busca por nome ou telefone
    const searchFiltered = searchQuery
        ? filtered.filter(l => (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || l.phoneNumber.includes(searchQuery))
        : filtered;

    return (
        <div className="bg-ch-bg rounded-xl border border-ch-border p-4 flex flex-col" style={{ width: '30%', flexShrink: 0, height: '700px' }}>
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold flex items-center gap-2">
                    <MapPin size={16} className="text-ch-cyan" /> Público Alvo
                    <span className="bg-ch-cyan/20 text-ch-cyan px-2 py-0.5 rounded-full text-xs">{selectedLeads.size} sel.</span>
                </h3>
                <button onClick={() => {
                    const visiblePhones = searchFiltered.map(l => l.phoneNumber).filter(Boolean);
                    onSelectAll(visiblePhones);
                }} className="text-sm text-ch-cyan hover:underline">
                    Selecionar Visíveis ({searchFiltered.length})
                </button>
            </div>

            {/* Busca */}
            <div className="mb-2 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ch-muted" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar nome ou telefone..." className="w-full bg-ch-surface border border-ch-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-ch-cyan outline-none text-ch-text" />
            </div>

            {/* Filtros Geográficos Cascata: Estado → Cidade → Bairro */}
            <div className="grid grid-cols-1 gap-1.5 mb-2">
                <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setCityFilter(''); setNeighborhoodFilter(''); }}
                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-2 py-1 text-xs focus:border-ch-cyan outline-none text-ch-text">
                    <option value="">🏛️ Estado ({states.length})</option>
                    {states.sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setNeighborhoodFilter(''); }}
                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-2 py-1 text-xs focus:border-ch-cyan outline-none text-ch-text">
                    <option value="">🏙️ Cidade ({cities.length})</option>
                    {cities.sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}
                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-2 py-1 text-xs focus:border-ch-cyan outline-none text-ch-text">
                    <option value="">📍 Bairro ({neighborhoods.length})</option>
                    {neighborhoods.sort().map(n => <option key={n} value={n}>{n}</option>)}
                </select>
            </div>

            {/* Filtro Categoria */}
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-ch-surface border border-ch-border rounded-lg px-2 py-1 text-xs focus:border-ch-cyan outline-none text-ch-text mb-2">
                <option value="">📂 Categorias ({categories.length})</option>
                {categories.sort().map(cat => <option key={cat} value={cat}>{cat} ({filtered.filter(l => l.category === cat).length})</option>)}
            </select>

            <p className="text-[10px] text-ch-muted mb-1">{searchFiltered.length} leads visíveis</p>

            {/* Lista unificada de leads */}
            <div className="flex-1 overflow-y-auto space-y-1">
                {searchFiltered.map((lead, i) => (
                    <label key={`lead-${lead.phoneNumber}-${i}`} className="flex items-center gap-3 p-2 bg-ch-surface rounded-lg cursor-pointer hover:bg-ch-surface-2 transition-colors">
                        <input type="checkbox" className="w-4 h-4 rounded border-ch-border text-ch-cyan focus:ring-ch-cyan/20 cursor-pointer"
                            checked={selectedLeads.has(lead.phoneNumber)} onChange={() => onToggle(lead.phoneNumber)} />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{lead.name || '-'}</p>
                            <p className="text-xs text-ch-muted">
                                {lead.phoneNumber}
                                {lead.city ? ` • ${lead.city}` : ''}
                                {lead.neighborhood ? ` • ${lead.neighborhood}` : ''}
                            </p>
                        </div>
                        {/* Badge de origem */}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${lead.source === 'csv' ? 'bg-ch-magenta/15 text-ch-magenta' :
                            lead.source === 'db_import' ? 'bg-ch-cyan/15 text-ch-cyan' :
                                'bg-ch-purple/15 text-ch-purple'
                            }`}>
                            {lead.source === 'csv' ? 'CSV' : lead.source === 'db_import' ? 'DB' : 'MAN'}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
});

// ─── Componente Principal ───
export const Marketing: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'new' | 'schedules' | 'database'>('campaigns');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [allLeads, setAllLeads] = useState<Lead[]>([]);  // Fonte unificada de leads
    const [isImportingDb, setIsImportingDb] = useState(false); // Estado para importação de .db

    // Features API States
    const [commandsList, setCommandsList] = useState<any[]>([]);
    const [templatesList, setTemplatesList] = useState<any[]>([]);

    // Form States
    const [campaignName, setCampaignName] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [imagePath, setImagePath] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState(''); // para preview real da imagem
    const [isUploading, setIsUploading] = useState(false);
    const [minDelay, setMinDelay] = useState(30);
    const [maxDelay, setMaxDelay] = useState(90);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

    // Refinements States
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(''); // Data do agendamento (YYYY-MM-DD)
    const [scheduledTime, setScheduledTime] = useState(''); // Hora do agendamento (HH:MM)
    const [schedulesList, setSchedulesList] = useState<any[]>([]); // Lista de agendamentos

    // Estado para edição de template
    const [editingTemplate, setEditingTemplate] = useState<any>(null); // Template sendo editado
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editImage, setEditImage] = useState('');

    // Textarea ref para formatação WhatsApp
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ─── Funções de carregamento ───
    const loadDependencies = async () => {
        try {
            const [cmdRes, tplRes] = await Promise.all([
                axios.get(`${API_URL}/commands`),
                axios.get(`${API_URL}/templates`)
            ]);
            setCommandsList(cmdRes.data);
            setTemplatesList(tplRes.data);
        } catch (error: any) {
            console.error('Error loading commands or templates', error);
        }
    };

    const loadCampaigns = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/campaigns`);
            setCampaigns(data);
        } catch (error) {
            console.error('Error loading campaigns', error);
        }
    };

    // Carrega leads de fonte unificada (marketing_lead do chromah.db)
    const loadLeads = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/leads`);
            // Normalizar telefones BR para garantir formato consistente
            const normalized = data.map((l: any) => ({
                ...l,
                phoneNumber: l.phoneNumber ? normalizePhoneBR(l.phoneNumber) : l.phoneNumber
            }));
            setAllLeads(normalized);
        } catch (error) {
            console.error('Error loading leads', error);
        }
    };

    // Importar base de dados externa (.db) para marketing_lead
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
            const { data } = await axios.post(`${API_URL}/import-db`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(`✅ Importação concluída!\n${data.inserted} novos leads inseridos de ${data.total} registros.`);
            loadLeads();
        } catch (err: any) {
            console.error('Erro na chamada de importacao:', err);
            alert(`Erro na importação: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsImportingDb(false);
            e.target.value = '';
        }
    };

    // ─── Upload de Mídia (com preview real) ───
    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            // Se for imagem, salvar preview local
            if (file.type.startsWith('image/')) setImagePreviewUrl(base64);
            else setImagePreviewUrl('');
            try {
                setIsUploading(true);
                const { data } = await axios.post(`${API_URL}/upload-media`, { filename: file.name, base64 });
                setImagePath(data.path);
            } catch (err) {
                alert('Falha ao enviar arquivo');
            } finally {
                setIsUploading(false);
            }
        };
    };

    // ─── Drag & Drop para Mídia ───
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
            const file = e.dataTransfer.files[0];
            const fakeEvent = { target: { files: [file] } } as any;
            handleMediaUpload(fakeEvent);
        }
    };

    // ─── Formatação WhatsApp (bold, italic, strikethrough, mono) ───
    const wrapSelection = (prefix: string, suffix: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = messageContent.substring(start, end);
        const before = messageContent.substring(0, start);
        const after = messageContent.substring(end);
        const newText = `${before}${prefix}${selected || 'texto'}${suffix}${after}`;
        setMessageContent(newText);
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 5));
        }, 0);
    };

    const appendToMessage = (text: string) => setMessageContent(prev => prev + text);

    // Carregar lista de agendamentos
    const loadSchedules = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/schedules`);
            setSchedulesList(data);
        } catch (err) { console.error('Error loading schedules', err); }
    };

    // Criar novo agendamento baseado em template com enforce de boas práticas
    const handleCreateSchedule = async (templateId: number) => {
        if (!scheduledDate || !scheduledTime) return alert('Selecione data e hora.');
        if (selectedLeads.size === 0) return alert('Selecione pelo menos um lead.');
        // Enforce: delay mínimo 30s
        const safeMin = Math.max(minDelay, 30);
        const safeMax = Math.max(maxDelay, safeMin);
        if (minDelay < 30) { setMinDelay(30); }
        // Aviso horário comercial
        const hour = parseInt(scheduledTime.split(':')[0]);
        if (hour < 8 || hour >= 20) {
            if (!window.confirm('⚠️ Horário fora do comercial (8h-20h).\nIsto aumenta o risco de ban. Continuar?')) return;
        }
        try {
            await axios.post(`${API_URL}/schedules`, {
                templateId, scheduledDate, scheduledTime, minDelay: safeMin, maxDelay: safeMax,
                selectedPhones: Array.from(selectedLeads)
            });
            setScheduledDate(''); setScheduledTime('');
            loadSchedules(); alert('✅ Agendamento criado com sucesso!');
        } catch (err) { alert('Erro ao criar agendamento'); }
    };

    // Excluir agendamento
    const handleDeleteSchedule = async (id: number) => {
        if (!window.confirm('Excluir este agendamento?')) return;
        try { await axios.delete(`${API_URL}/schedules/${id}`); loadSchedules(); }
        catch (err) { alert('Erro ao excluir'); }
    };

    useEffect(() => {
        if (activeTab === 'campaigns') {
            loadCampaigns();
            const interval = setInterval(loadCampaigns, 10000);
            return () => clearInterval(interval);
        } else if (activeTab === 'schedules') {
            loadSchedules(); loadDependencies(); loadLeads();
        } else if (activeTab === 'new' || activeTab === 'database') {
            loadLeads(); loadDependencies();
        }
    }, [activeTab]);

    // ─── Criar campanha com enforce de boas práticas ───
    const handleCreateCampaign = async () => {
        if (!campaignName || !messageContent || selectedLeads.size === 0) {
            alert('Preencha o nome, a mensagem e selecione pelo menos um lead.');
            return;
        }
        // Enforce: delay mínimo 30s
        const safeMinDelay = Math.max(minDelay, 30);
        const safeMaxDelay = Math.max(maxDelay, safeMinDelay);
        if (minDelay < 30) {
            setMinDelay(30);
            alert('⚠️ Delay mínimo ajustado para 30 segundos (boa prática anti-ban).');
        }
        // Aviso se horário fora do comercial
        if (scheduledTime) {
            const hour = parseInt(scheduledTime.split(':')[0]);
            if (hour < 8 || hour >= 20) {
                if (!window.confirm('⚠️ O horário agendado está fora do horário comercial (8h-20h).\nEnviar mensagens fora desse período aumenta o risco de bloqueio.\n\nDeseja continuar mesmo assim?')) return;
            }
        }
        const targetLeads = Array.from(selectedLeads).map(phone => {
            const l = allLeads.find(x => x.phoneNumber === phone);
            return { phoneNumber: phone, name: l?.name || '' };
        });
        try {
            const scheduledAt = (scheduledDate && scheduledTime) ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : null;
            await axios.post(`${API_URL}/campaigns`, {
                name: campaignName, messageContent, imagePath, minDelay: safeMinDelay, maxDelay: safeMaxDelay, targetLeads, scheduledAt
            });
            setCampaignName(''); setMessageContent(''); setSelectedLeads(new Set()); setImagePath(''); setImagePreviewUrl(''); setScheduledDate(''); setScheduledTime('');
            setActiveTab('campaigns');
        } catch (error) { alert('Erro ao criar campanha'); }
    };

    // Duplicar campanha
    const handleDuplicateCampaign = (camp: Campaign) => {
        setCampaignName(`${camp.name} (Cópia)`);
        setMessageContent(camp.messageContent);
        setImagePath(camp.imagePath || '');
        setActiveTab('new');
    };

    // Exportar campanha como CSV
    const handleExportCampaign = async (campId: number) => {
        try {
            const { data } = await axios.get(`${API_URL}/campaigns/${campId}/queue`);
            if (!data || data.length === 0) return alert('Nenhum dado para exportar.');
            const csvContent = 'Nome,Telefone,Status,Enviado Em,Erro\n' +
                data.map((q: any) => `${q.contactName || ''},${q.phoneNumber},${q.status},${q.sentAt || ''},${q.errorLog || ''}`).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `campanha_${campId}_export.csv`; a.click();
            URL.revokeObjectURL(url);
        } catch (error) { alert('Erro ao exportar dados'); }
    };

    const handleToggleLead = useCallback((phone: string) => {
        setSelectedLeads(prev => {
            const next = new Set(prev);
            if (next.has(phone)) next.delete(phone); else next.add(phone);
            return next;
        });
    }, []);

    // Selecionar/deselecionar leads visíveis (filtrados)
    // Selecionar/deselecionar leads visíveis (filtrados)
    const handleSelectAll = useCallback((visiblePhones?: string[]) => {
        if (visiblePhones && visiblePhones.length > 0) {
            setSelectedLeads(prev => {
                const allVisible = visiblePhones.every(p => prev.has(p));
                const next = new Set(prev);
                if (allVisible) {
                    visiblePhones.forEach(p => next.delete(p));
                } else {
                    visiblePhones.forEach(p => next.add(p));
                }
                return next;
            });
        } else {
            const allPhones = allLeads.map(l => l.phoneNumber).filter(Boolean);
            setSelectedLeads(prev => prev.size === allPhones.length ? new Set() : new Set(allPhones));
        }
    }, [allLeads]);

    // ─── Templates CRUD ───
    const handleSaveTemplate = async () => {
        if (!campaignName || !messageContent) return alert('Dê um nome e insira mensagem para salvar como Template.');
        try {
            await axios.post(`${API_URL}/templates`, { name: campaignName, messageContent, imagePath });
            alert('Template salvo!'); loadDependencies();
        } catch (error) { alert('Erro ao salvar template.'); }
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!window.confirm('Excluir este template?')) return;
        try { await axios.delete(`${API_URL}/templates/${id}`); loadDependencies(); } catch (e) { alert('Erro ao excluir'); }
    };

    // ─── Editar Template (abre modal de edição) ───
    const openEditTemplate = (template: any) => {
        setEditingTemplate(template);
        setEditName(template.name);
        setEditContent(template.messageContent || '');
        setEditImage(template.imagePath || '');
    };
    const handleSaveEditTemplate = async () => {
        if (!editingTemplate || !editName || !editContent) return alert('Preencha nome e conteúdo.');
        try {
            await axios.put(`${API_URL}/templates/${editingTemplate.id}`, {
                name: editName, messageContent: editContent, imagePath: editImage || null
            });
            alert('✅ Template atualizado!'); setEditingTemplate(null); loadDependencies();
        } catch (e) { alert('Erro ao salvar template.'); }
    };

    // ─── Teste Unitário — normaliza o telefone com +55 antes de enviar ───
    const handleTestMessage = async () => {
        if (!testPhone || !messageContent) return alert('Insira um telefone e o texto da campanha.');
        setIsTesting(true);
        try {
            const fullPhone = normalizePhoneBR(testPhone);
            await axios.post(`${API_URL}/test`, { phoneNumber: fullPhone, messageContent, imagePath });
            alert('Teste enviado com sucesso!');
        } catch (error) { alert('Erro enviando teste. Cheque se o bot está conectado.'); }
        finally { setIsTesting(false); }
    };

    // ─── CSV Upload ───
    // Upload CSV com todos os campos disponíveis
    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];
        // Parsear linhas usando cabeçalhos dinâmicos
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
                website: obj.website || obj.site || ''
            };
        }).filter(l => l.phoneNumber);
        try {
            await axios.post(`${API_URL}/csv-upload`, { leads: leadsToUpload });
            loadLeads(); alert(`✅ ${leadsToUpload.length} leads importados!`);
        } catch (error) { alert('Erro ao importar CSV'); }
        e.target.value = '';
    };

    // ─── Importar DB ───

    const handleStatusChange = async (id: number, newStatus: string) => {
        try { await axios.put(`${API_URL}/campaigns/${id}/status`, { status: newStatus }); loadCampaigns(); }
        catch (error) { alert('Erro ao mudar status da campanha'); }
    };

    // ─── Contagem de caracteres ───
    const charCount = messageContent.length;
    const charColor = charCount > 4096 ? 'text-ch-magenta' : charCount > 1000 ? 'text-amber-400' : 'text-ch-muted';

    // ─── Dashboard Métricas ───
    const totalSent = campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.stats?.failed || 0), 0);
    const totalPending = campaigns.reduce((sum, c) => sum + (c.stats?.pending || 0), 0);
    const totalQueued = campaigns.reduce((sum, c) => sum + (c.stats?.total || 0), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent inline-flex items-center gap-3">
                        <Megaphone className="text-ch-cyan" size={32} />
                        Centro de Marketing
                    </h1>
                    <p className="text-ch-muted mt-2">Disparos programados, base de leads e conversão.</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex space-x-2 border-b border-ch-border mb-6 overflow-x-auto pb-2">
                {(['campaigns', 'new', 'schedules', 'database'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 font-medium rounded-t-lg transition-all duration-200 flex items-center gap-2 ${activeTab === tab
                            ? 'bg-ch-surface border-t border-l border-r border-ch-border text-ch-text scale-105'
                            : 'text-ch-muted hover:text-ch-text hover:bg-ch-surface-2'
                            }`}
                    >
                        {tab === 'campaigns' && <><Play size={18} /> Campanhas</>}
                        {tab === 'new' && <><Plus size={18} /> Nova Campanha</>}
                        {tab === 'schedules' && <><CalendarDays size={18} /> Agendamentos</>}
                        {tab === 'database' && <><Database size={18} /> Base de Contatos</>}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            <div className="bg-ch-surface border border-ch-border rounded-xl p-6">

                {/* ═══ ABA CAMPANHAS ═══ */}
                {activeTab === 'campaigns' && (
                    <div>
                        {/* Dashboard resumo */}
                        {campaigns.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-ch-bg rounded-xl border border-ch-border p-4 text-center">
                                    <p className="text-2xl font-bold text-ch-cyan">{totalQueued}</p>
                                    <p className="text-xs text-ch-muted mt-1">Total na Fila</p>
                                </div>
                                <div className="bg-ch-bg rounded-xl border border-ch-border p-4 text-center">
                                    <p className="text-2xl font-bold text-green-400">{totalSent}</p>
                                    <p className="text-xs text-ch-muted mt-1">Enviados</p>
                                </div>
                                <div className="bg-ch-bg rounded-xl border border-ch-border p-4 text-center">
                                    <p className="text-2xl font-bold text-amber-400">{totalPending}</p>
                                    <p className="text-xs text-ch-muted mt-1">Pendentes</p>
                                </div>
                                <div className="bg-ch-bg rounded-xl border border-ch-border p-4 text-center">
                                    <p className="text-2xl font-bold text-ch-magenta">{totalFailed}</p>
                                    <p className="text-xs text-ch-muted mt-1">Falhas</p>
                                </div>
                            </div>
                        )}

                        <h2 className="text-xl font-bold mb-4">Séries de Disparo (Queue)</h2>
                        {campaigns.length === 0 ? (
                            <p className="text-ch-muted">Nenhuma campanha cadastrada.</p>
                        ) : (
                            <div className="space-y-4">
                                {campaigns.map(camp => {
                                    const pct = camp.stats.total > 0 ? Math.round((camp.stats.sent / camp.stats.total) * 100) : 0;
                                    return (
                                        <div key={camp.id} className="bg-ch-bg p-4 rounded-xl border border-ch-border flex flex-col md:flex-row justify-between gap-4">
                                            <div className="flex-[2]">
                                                <h3 className="text-lg font-bold text-ch-text">{camp.name}</h3>
                                                <p className="text-sm text-ch-muted line-clamp-2 mt-1">{camp.messageContent}</p>
                                                <div className="flex gap-4 mt-3 text-sm flex-wrap">
                                                    <span className="bg-ch-surface-2 px-2 py-1 rounded">Delay: {camp.minDelay}s ~ {camp.maxDelay}s</span>
                                                    <span className={`px-2 py-1 rounded font-bold ${camp.status === 'running' ? 'bg-green-500/20 text-green-400' :
                                                        camp.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                                                            camp.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                                                                camp.status === 'completed' ? 'bg-ch-cyan/20 text-ch-cyan' :
                                                                    'bg-ch-magenta/20 text-ch-magenta'}`}>
                                                        {camp.status === 'scheduled' ? '📅 AGENDADO' : camp.status.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-[200px]">
                                                {/* Barra de progresso com % */}
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-ch-muted">Progresso</span>
                                                    <span className="font-bold">{camp.stats.sent} / {camp.stats.total} ({pct}%)</span>
                                                </div>
                                                <div className="w-full bg-ch-surface-2 rounded-full h-3 overflow-hidden">
                                                    <div className="bg-gradient-to-r from-ch-cyan to-ch-purple h-3 rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%` }}></div>
                                                </div>
                                                <div className="mt-2 text-xs text-ch-muted flex justify-between">
                                                    <span>Pendentes: {camp.stats.pending}</span>
                                                    <span className="text-ch-magenta">Falhas: {camp.stats.failed}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(camp.status === 'paused' || camp.status === 'failed' || camp.status === 'scheduled') && (
                                                    <button onClick={() => handleStatusChange(camp.id, 'running')} className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg" title="Iniciar Agora"><Play size={20} /></button>
                                                )}
                                                {camp.status === 'running' && (
                                                    <button onClick={() => handleStatusChange(camp.id, 'paused')} className="p-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg" title="Pausar"><Pause size={20} /></button>
                                                )}
                                                {camp.status !== 'completed' && camp.status !== 'cancelled' && (
                                                    <button onClick={() => { if (window.confirm('Cancelar esta campanha?')) handleStatusChange(camp.id, 'cancelled') }} className="p-2 bg-ch-magenta/20 text-ch-magenta hover:bg-ch-magenta/30 rounded-lg" title="Cancelar"><Square size={20} /></button>
                                                )}
                                                {/* Duplicar Campanha */}
                                                <button onClick={() => handleDuplicateCampaign(camp)} className="p-2 bg-ch-cyan/20 text-ch-cyan hover:bg-ch-cyan/30 rounded-lg" title="Duplicar">
                                                    <Copy size={20} />
                                                </button>
                                                {/* Exportar CSV */}
                                                <button onClick={() => handleExportCampaign(camp.id)} className="p-2 bg-ch-surface-2 text-ch-muted hover:text-ch-text rounded-lg" title="Exportar CSV">
                                                    <Download size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ ABA NOVA CAMPANHA ═══ */}
                {activeTab === 'new' && (
                    <div className="space-y-6">
                        <div className="flex gap-8" style={{ display: 'flex' }}>
                            <div className="space-y-4" style={{ width: '70%', flexShrink: 0 }}>
                                <div>
                                    <label className="block text-sm text-ch-muted mb-1">Nome da Campanha</label>
                                    <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
                                        className="w-full bg-ch-bg border border-ch-border rounded-lg px-4 py-2 focus:border-ch-cyan outline-none text-ch-text"
                                        placeholder="Ex: Promoção Dia das Mães" />
                                </div>

                                {/* Template Cards com Preview e Delete */}
                                {templatesList.length > 0 && (
                                    <div>
                                        <label className="block text-xs text-ch-muted mb-2">📋 Templates Salvos:</label>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {templatesList.map((t: any) => (
                                                <div key={t.id} className="min-w-[170px] max-w-[170px] bg-ch-bg border border-ch-border rounded-lg p-3 hover:border-ch-cyan transition-colors shrink-0 group relative">
                                                    <button onClick={() => { setCampaignName(t.name); setMessageContent(t.messageContent); setImagePath(t.imagePath || ''); }}
                                                        className="text-left w-full">
                                                        <p className="font-medium text-xs text-ch-text truncate group-hover:text-ch-cyan">{t.name}</p>
                                                        {t.imagePath && <span className="text-[10px] text-ch-cyan flex items-center gap-1 mt-1"><ImagePlus size={10} /> Mídia</span>}
                                                        <p className="text-[10px] text-ch-muted mt-1 line-clamp-3">{t.messageContent}</p>
                                                    </button>
                                                    {/* Botões Editar e Excluir */}
                                                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditTemplate(t)}
                                                            className="p-1 text-ch-muted hover:text-ch-cyan" title="Editar Template">
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button onClick={() => handleDeleteTemplate(t.id)}
                                                            className="p-1 text-ch-muted hover:text-ch-magenta" title="Excluir Template">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Editor de Mensagem */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm text-ch-muted">Conteúdo da Mensagem</label>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs ${charColor}`}>{charCount} caracteres</span>
                                            <button onClick={() => setShowPreviewModal(true)} className="text-ch-cyan hover:underline text-sm flex items-center gap-1"><Eye size={14} /> Preview</button>
                                            <button onClick={handleSaveTemplate} className="text-ch-muted hover:text-ch-cyan hover:underline text-sm flex items-center gap-1"><Save size={14} /> Salvar Template</button>
                                        </div>
                                    </div>
                                    <div className={`bg-ch-bg border rounded-lg focus-within:border-ch-cyan flex flex-col h-[340px] transition-colors ${isDragging ? 'border-ch-cyan border-2 bg-ch-cyan/5' : 'border-ch-border'}`}
                                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

                                        {imagePath && (
                                            <div className="p-3 bg-ch-surface-2 border-b border-ch-border flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-2 text-ch-cyan text-sm truncate">
                                                    {imagePreviewUrl ? (
                                                        <img src={imagePreviewUrl} alt="preview" className="w-10 h-10 rounded object-cover" />
                                                    ) : (
                                                        <FileText size={16} />
                                                    )}
                                                    <span className="truncate">{imagePath.split(/[\/\\]/).pop()}</span>
                                                </div>
                                                <button onClick={() => { setImagePath(''); setImagePreviewUrl(''); }} className="text-ch-magenta hover:underline text-xs">Excluir</button>
                                            </div>
                                        )}

                                        {isDragging && (
                                            <div className="p-8 text-center text-ch-cyan animate-pulse shrink-0">
                                                <ImagePlus size={32} className="mx-auto mb-2" />
                                                <p className="text-sm font-medium">Solte o arquivo aqui!</p>
                                            </div>
                                        )}

                                        <textarea ref={textareaRef} value={messageContent} onChange={(e) => setMessageContent(e.target.value)}
                                            className="w-full bg-transparent p-4 flex-1 outline-none text-ch-text resize-none"
                                            placeholder="Ex: Olá {{nome}}! Quebramos a tabela e as renegociações estão liberadas." />

                                        {/* Toolbar inferior com formatações + emoji + variável + comando + mídia */}
                                        <div className="flex items-center gap-1 p-2 bg-ch-surface border-t border-ch-border shrink-0 flex-wrap">
                                            {/* Formatação WhatsApp */}
                                            <button onClick={() => wrapSelection('*', '*')} className="p-1.5 bg-ch-bg border border-ch-border rounded hover:border-ch-cyan transition-colors" title="Negrito"><Bold size={14} /></button>
                                            <button onClick={() => wrapSelection('_', '_')} className="p-1.5 bg-ch-bg border border-ch-border rounded hover:border-ch-cyan transition-colors" title="Itálico"><Italic size={14} /></button>
                                            <button onClick={() => wrapSelection('~', '~')} className="p-1.5 bg-ch-bg border border-ch-border rounded hover:border-ch-cyan transition-colors" title="Riscado"><Strikethrough size={14} /></button>
                                            <button onClick={() => wrapSelection('```', '```')} className="p-1.5 bg-ch-bg border border-ch-border rounded hover:border-ch-cyan transition-colors" title="Monospace"><Code size={14} /></button>

                                            <div className="w-px h-5 bg-ch-border mx-1"></div>

                                            {/* Emoji Picker */}
                                            <div className="relative">
                                                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 bg-ch-bg border border-ch-border rounded hover:border-ch-cyan transition-colors" title="Emojis"><Smile size={14} /></button>
                                                {showEmojiPicker && (
                                                    <div className="absolute bottom-10 left-0 bg-ch-bg border border-ch-border rounded-xl p-3 shadow-xl z-20 w-[280px]">
                                                        <div className="grid grid-cols-9 gap-1">
                                                            {EMOJI_LIST.map(emoji => (
                                                                <button key={emoji} onClick={() => { appendToMessage(emoji); setShowEmojiPicker(false); }}
                                                                    className="text-lg hover:bg-ch-surface-2 rounded p-1 transition-colors">{emoji}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-px h-5 bg-ch-border mx-1"></div>

                                            <button onClick={() => appendToMessage('{{nome}}')}
                                                className="px-2 py-1 bg-ch-bg border border-ch-border rounded text-xs hover:border-ch-cyan transition-colors">+ Nome</button>

                                            <select onChange={(e) => { if (e.target.value) { appendToMessage(` ${e.target.value} `); e.target.value = ""; } }}
                                                className="px-2 py-1 bg-ch-bg border border-ch-border rounded text-xs hover:border-ch-cyan transition-colors outline-none max-w-[130px]">
                                                <option value="">+ Comando</option>
                                                {commandsList.map(cmd => (
                                                    <option key={cmd.id} value={cmd.triggers.split(',')[0].trim()}>{cmd.triggers}</option>
                                                ))}
                                            </select>

                                            <label className={`px-2 py-1 bg-ch-bg border border-ch-border cursor-pointer select-none rounded text-xs hover:border-ch-cyan transition-colors flex items-center gap-1 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                <ImagePlus size={14} /> {isUploading ? '...' : 'Mídia'}
                                                <input disabled={isUploading} type="file" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleMediaUpload} />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Teste Unitário com +55 e máscara */}
                                <div className="bg-ch-surface-2 rounded-lg p-4 border border-ch-border flex gap-4 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs text-ch-muted mb-1">Disparar Teste Unitário</label>
                                        <div className="flex">
                                            <span className="bg-ch-bg border border-r-0 border-ch-border rounded-l-lg px-3 py-2 text-sm text-ch-cyan font-medium">+55</span>
                                            <input type="text" value={maskPhoneBR(testPhone)}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/\D/g, '');
                                                    setTestPhone(raw.substring(0, 11));
                                                }}
                                                className="w-full bg-ch-bg border border-ch-border rounded-r-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text"
                                                placeholder="(98) 99999-0000" maxLength={16} />
                                        </div>
                                    </div>
                                    <button onClick={handleTestMessage} disabled={isTesting}
                                        className="h-[38px] px-4 bg-ch-surface border border-ch-cyan text-ch-cyan rounded-lg text-sm font-medium hover:bg-ch-cyan hover:text-ch-bg transition flex items-center gap-2">
                                        <Send size={16} /> {isTesting ? 'Enviando...' : 'Testar'}
                                    </button>
                                </div>

                                {/* Delays */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm text-ch-muted mb-1">Pausa Mínima (seg)</label>
                                        <input type="number" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))}
                                            className="w-full bg-ch-bg border border-ch-border rounded-lg px-4 py-2 focus:border-ch-cyan outline-none text-ch-text" /></div>
                                    <div><label className="block text-sm text-ch-muted mb-1">Pausa Máxima (seg)</label>
                                        <input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))}
                                            className="w-full bg-ch-bg border border-ch-border rounded-lg px-4 py-2 focus:border-ch-cyan outline-none text-ch-text" /></div>
                                </div>

                                {/* Agendamento com data e hora separados */}
                                <div className="bg-ch-surface-2 rounded-lg p-4 border border-ch-border">
                                    <label className="flex items-center gap-2 text-sm text-ch-muted mb-2">
                                        <Clock size={16} className="text-ch-cyan" />
                                        Agendar Disparo (opcional)
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-ch-muted mb-1">📅 Data</label>
                                            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                                                className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 focus:border-ch-cyan outline-none text-ch-text text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-ch-muted mb-1">⏰ Hora</label>
                                            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                                                className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 focus:border-ch-cyan outline-none text-ch-text text-sm" />
                                        </div>
                                    </div>
                                    {scheduledDate && scheduledTime && (
                                        <p className="text-xs text-ch-cyan mt-2 flex items-center gap-1">
                                            <Clock size={12} /> Campanha agendada para {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                </div>

                                {/* Aviso Anti-Ban */}
                                {selectedLeads.size > 200 && (
                                    <div className={`rounded-lg p-3 border flex items-start gap-3 ${selectedLeads.size > 500 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                                        <div className="text-xs">
                                            <p className="font-bold">{selectedLeads.size > 500 ? '🔴 Risco Alto de Bloqueio!' : '⚠️ Atenção: Volume Elevado'}</p>
                                            <p className="mt-1">{selectedLeads.size} contatos selecionados. O WhatsApp pode banir contas que enviam mais de 200 mensagens/dia para contatos desconhecidos.</p>
                                            <p className="mt-1 font-medium">Dicas: Use delays acima de 30s, envie em horário comercial (8h-20h), evite links suspeitos.</p>
                                        </div>
                                    </div>
                                )}

                                <button onClick={handleCreateCampaign}
                                    className="w-full gradient-btn py-3 rounded-xl font-bold text-ch-bg flex items-center justify-center gap-2 mt-4">
                                    <Play size={20} fill="currentColor" /> {(scheduledDate && scheduledTime) ? '📅 Agendar Disparo' : 'Emitir Disparo em Massa'}
                                </button>
                            </div>

                            <LeadListPanel leads={allLeads} selectedLeads={selectedLeads}
                                onToggle={handleToggleLead} onSelectAll={handleSelectAll} />
                        </div>
                    </div>
                )}

                {/* ═══ ABA BASE DE CONTATOS (unificada) ═══ */}
                {activeTab === 'database' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Base de Contatos ({allLeads.length} leads)</h2>
                            <div className="flex gap-2">
                                {/* Botão para importar .db externo */}
                                <label className={`bg-ch-cyan/10 hover:bg-ch-cyan/20 text-ch-cyan transition-colors px-4 py-2 border border-ch-cyan/30 rounded-lg cursor-pointer flex items-center gap-2 ${isImportingDb ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <HardDriveDownload size={18} /> {isImportingDb ? 'Importando...' : 'Importar Base de Dados'}
                                    <input type="file" accept=".db,.sqlite" className="hidden" onChange={handleDbUpload} disabled={isImportingDb} />
                                </label>
                                {/* Botão para importar CSV */}
                                <label className="bg-ch-surface-2 hover:bg-ch-surface-3 transition-colors px-4 py-2 border border-ch-border rounded-lg cursor-pointer flex items-center gap-2">
                                    <Upload size={18} /> Importar CSV
                                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                                </label>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-ch-border text-xs text-ch-muted">
                                        <th className="p-3 font-normal">Origem</th>
                                        <th className="p-3 font-normal">Nome / Empresa</th>
                                        <th className="p-3 font-normal">Telefone</th>
                                        <th className="p-3 font-normal">Cidade</th>
                                        <th className="p-3 font-normal">Bairro</th>
                                        <th className="p-3 font-normal">Categoria</th>
                                        <th className="p-3 font-normal w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allLeads.map((lead, i) => (
                                        <tr key={lead.id || i} className="border-b border-ch-border/50 hover:bg-ch-surface-2/50">
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lead.source === 'csv' ? 'bg-ch-magenta/20 text-ch-magenta' :
                                                    lead.source === 'db_import' ? 'bg-ch-cyan/20 text-ch-cyan' :
                                                        'bg-ch-purple/20 text-ch-purple'
                                                    }`}>
                                                    {lead.source === 'csv' ? 'CSV' : lead.source === 'db_import' ? 'DB' : 'MAN'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-medium">{lead.name || '-'}</td>
                                            <td className="p-3 text-ch-muted">{lead.phoneNumber}</td>
                                            <td className="p-3 text-sm text-ch-muted">{lead.city || '-'}</td>
                                            <td className="p-3 text-sm text-ch-muted">{lead.neighborhood || '-'}</td>
                                            <td className="p-3 text-sm text-ch-muted truncate max-w-[200px]">{lead.category || '-'}</td>
                                            <td className="p-3">
                                                <button onClick={async () => {
                                                    if (!window.confirm('Remover este lead?')) return;
                                                    try { await axios.delete(`${API_URL}/leads/${lead.id}`); loadLeads(); }
                                                    catch { alert('Erro ao remover'); }
                                                }} className="text-ch-muted hover:text-ch-magenta transition-colors" title="Remover">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ═══ ABA AGENDAMENTOS ═══ */}
                {activeTab === 'schedules' && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CalendarDays size={22} className="text-ch-cyan" /> Agendamentos Programados</h2>

                        {/* Criar agendamento */}
                        <div className="bg-ch-bg rounded-xl border border-ch-border p-5 mb-6">
                            <h3 className="font-bold mb-3 text-sm">Novo Agendamento (a partir de Template)</h3>
                            {templatesList.length === 0 ? (
                                <p className="text-ch-muted text-sm">Nenhum template salvo. Crie um na aba "Nova Campanha" primeiro.</p>
                            ) : (
                                <div className="flex gap-6">
                                    <div className="flex-1 space-y-3">
                                        {/* Selecionar template */}
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {templatesList.map((t: any) => (
                                                <div key={t.id}
                                                    onClick={() => { setMessageContent(t.messageContent || ''); setImagePath(t.imagePath || ''); setCampaignName(t.name || ''); }}
                                                    className={`min-w-[160px] bg-ch-surface border rounded-lg p-3 shrink-0 cursor-pointer transition-all ${messageContent === t.messageContent ? 'border-ch-cyan ring-1 ring-ch-cyan/30 scale-[1.02]' : 'border-ch-border hover:border-ch-cyan/50'}`}>
                                                    <p className="font-medium text-xs text-ch-text truncate">{t.name}</p>
                                                    {t.imagePath && <span className="text-[10px] text-ch-cyan flex items-center gap-1 mt-1"><ImagePlus size={10} /> Mídia</span>}
                                                    <p className="text-[10px] text-ch-muted mt-1 line-clamp-2">{t.messageContent}</p>
                                                    <button onClick={(e) => { e.stopPropagation(); setMessageContent(t.messageContent || ''); setImagePath(t.imagePath || ''); handleCreateSchedule(t.id); }}
                                                        className="mt-2 w-full text-xs bg-ch-cyan/20 text-ch-cyan px-2 py-1 rounded hover:bg-ch-cyan/30 transition-colors">📅 Agendar</button>
                                                </div>
                                            ))}
                                        </div>
                                        {messageContent && <p className="text-xs text-ch-cyan">✅ Template carregado — clique "Testar" para enviar para um número.</p>}

                                        {/* Data e Hora */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-ch-muted mb-1">📅 Data</label>
                                                <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                                                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-ch-muted mb-1">⏰ Hora</label>
                                                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                                                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="block text-xs text-ch-muted mb-1">Delay Mín (s)</label>
                                                <input type="number" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))}
                                                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" /></div>
                                            <div><label className="block text-xs text-ch-muted mb-1">Delay Máx (s)</label>
                                                <input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))}
                                                    className="w-full bg-ch-surface border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" /></div>
                                        </div>

                                        {/* Anti-ban warning */}
                                        {selectedLeads.size > 200 && (
                                            <div className={`rounded-lg p-3 border flex items-start gap-2 ${selectedLeads.size > 500 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                                <p className="text-xs">{selectedLeads.size > 500 ? '🔴 Risco de bloqueio!' : '⚠️ Volume elevado.'} {selectedLeads.size} leads. Recomendado: &lt;200/dia com delays &gt;30s.</p>
                                            </div>
                                        )}

                                        {/* Campo de Teste com opção de teste agendado */}
                                        <div className="bg-ch-surface-2 rounded-lg p-3 border border-ch-border">
                                            <label className="block text-xs text-ch-muted mb-1.5 flex items-center gap-1"><Send size={12} /> Testar Disparo</label>
                                            <div className="flex gap-2">
                                                <div className="flex flex-1">
                                                    <span className="bg-ch-bg border border-r-0 border-ch-border rounded-l-lg px-3 py-2 text-sm text-ch-cyan font-medium">+55</span>
                                                    <input type="text" value={maskPhoneBR(testPhone)}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/\D/g, '');
                                                            setTestPhone(raw.substring(0, 11));
                                                        }}
                                                        placeholder="(98) 99999-0000" maxLength={16}
                                                        className="flex-1 bg-ch-bg border border-ch-border rounded-r-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                                                </div>
                                                <button onClick={handleTestMessage} disabled={isTesting}
                                                    className="bg-ch-cyan/20 text-ch-cyan px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs hover:bg-ch-cyan/30 transition-colors disabled:opacity-50">
                                                    <Send size={14} /> {isTesting ? '...' : 'Enviar Agora'}
                                                </button>
                                                <button
                                                    disabled={!testPhone || !messageContent}
                                                    onClick={async () => {
                                                        if (!testPhone || !messageContent) return alert('Selecione um template e digite um número.');
                                                        // Cria agendamento para 1 minuto no futuro com apenas o número de teste
                                                        const now = new Date(Date.now() + 60000); // +1 min
                                                        const testDate = now.toISOString().split('T')[0];
                                                        const testTime = now.toTimeString().substring(0, 5);
                                                        const selectedTemplate = templatesList.find((t: any) => t.messageContent === messageContent);
                                                        if (!selectedTemplate) return alert('Selecione um template primeiro.');
                                                        try {
                                                            await axios.post(`${API_URL}/schedules`, {
                                                                templateId: selectedTemplate.id,
                                                                scheduledDate: testDate,
                                                                scheduledTime: testTime,
                                                                minDelay: 30, maxDelay: 30,
                                                                selectedPhones: [normalizePhoneBR(testPhone)]
                                                            });
                                                            loadSchedules();
                                                            alert(`🧪 Agendamento de teste criado!\nDisparo para +55 ${maskPhoneBR(testPhone)} em ~1 minuto (${testTime}).\nVerifique na lista de agendamentos abaixo.`);
                                                        } catch (err) { alert('Erro ao criar agendamento de teste.'); }
                                                    }}
                                                    className="bg-amber-500/20 text-amber-400 px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs hover:bg-amber-500/30 transition-colors disabled:opacity-50">
                                                    <Clock size={14} /> Testar Agendamento
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-ch-muted mt-1">
                                                <b>Enviar Agora:</b> envia imediatamente. <b>Testar Agendamento:</b> cria um agendamento real para ~1 min, verifica todo o pipeline.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Lead panel no lado direito */}
                                    <LeadListPanel leads={allLeads} selectedLeads={selectedLeads}
                                        onToggle={handleToggleLead} onSelectAll={handleSelectAll} />
                                </div>
                            )}
                        </div>

                        {/* Lista de agendamentos existentes */}
                        <h3 className="font-bold mb-3">Agendamentos Ativos</h3>
                        {schedulesList.length === 0 ? (
                            <p className="text-ch-muted text-sm">Nenhum agendamento criado.</p>
                        ) : (
                            <div className="space-y-3">
                                {schedulesList.map((s: any) => {
                                    const phones = JSON.parse(s.selectedPhones || '[]');
                                    return (
                                        <div key={s.id} className="bg-ch-bg rounded-xl border border-ch-border p-4 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm">{s.templateName || 'Template Removido'}</h4>
                                                <p className="text-xs text-ch-muted line-clamp-1 mt-1">{s.messageContent || ''}</p>
                                                <div className="flex gap-3 mt-2 text-xs text-ch-muted">
                                                    <span>📅 {s.scheduledDate}</span>
                                                    <span>⏰ {s.scheduledTime}</span>
                                                    <span>👥 {phones.length} contatos</span>
                                                    <span>⏱ {s.minDelay}s~{s.maxDelay}s</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${s.status === 'pending' ? 'bg-blue-500/20 text-blue-400' : s.status === 'running' ? 'bg-green-500/20 text-green-400' : s.status === 'completed' ? 'bg-ch-cyan/20 text-ch-cyan' : 'bg-ch-magenta/20 text-ch-magenta'}`}>
                                                    {s.status === 'pending' ? '⏳ PENDENTE' : s.status === 'running' ? '▶ RODANDO' : s.status.toUpperCase()}
                                                </span>
                                                {s.status === 'pending' && (
                                                    <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-ch-muted hover:text-ch-magenta" title="Excluir"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ PREVIEW MODAL (Celular Grande) ═══ */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}>
                    <div className="bg-[#EFEAE2] w-[420px] h-[780px] rounded-[3rem] border-[10px] border-gray-900 relative overflow-hidden flex flex-col shadow-2xl"
                        onClick={(e) => e.stopPropagation()} style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                        {/* Header */}
                        <div className="bg-[#00A884] text-white px-5 py-4 flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">J</div>
                            <div className="flex-1">
                                <h3 className="font-bold">João (Preview)</h3>
                                <p className="text-xs opacity-80">online</p>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="text-white/80 hover:text-white text-xl p-1">✕</button>
                        </div>
                        {/* Body */}
                        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3" style={{ backgroundColor: '#ECE5DD' }}>
                            <div className="bg-[#E1F3FB] px-3 py-1 rounded-lg text-xs self-center shadow-sm w-fit text-[#5A7F8F]">Hoje</div>

                            {imagePath && (
                                <div className="bg-white rounded-xl rounded-tl-none shadow-sm max-w-[90%] self-start overflow-hidden">
                                    {/* Mostrar imagem real se disponível */}
                                    {imagePreviewUrl ? (
                                        <img src={imagePreviewUrl} alt="preview" className="w-full max-h-[250px] object-cover" />
                                    ) : (
                                        <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-[200px] flex items-center justify-center text-gray-500 text-sm">
                                            {imagePath.endsWith('.mp4') ? '▶️ Vídeo' : imagePath.endsWith('.pdf') ? '📄 PDF' : '🖼️ Imagem'}
                                        </div>
                                    )}
                                    {messageContent.trim() && (
                                        <div className="px-3 py-2">
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{messageContent.replace(/\{\{nome\}\}/gi, 'João')}</p>
                                            <span className="text-[10px] text-gray-400 mt-1 block text-right">12:00 ✓✓</span>
                                        </div>
                                    )}
                                    {!messageContent.trim() && <div className="px-3 py-1"><span className="text-[10px] text-gray-400 block text-right">12:00 ✓✓</span></div>}
                                </div>
                            )}

                            {!imagePath && (
                                <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm max-w-[90%] self-start">
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{messageContent.replace(/\{\{nome\}\}/gi, 'João') || 'Sua mensagem aparecerá aqui...'}</p>
                                    <span className="text-[10px] text-gray-400 mt-1 block text-right">12:00 ✓✓</span>
                                </div>
                            )}
                        </div>
                        {/* Input Bar */}
                        <div className="bg-[#F0F0F0] px-3 py-2 flex items-center gap-2 shrink-0 border-t border-gray-300">
                            <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">Mensagem</div>
                            <div className="w-9 h-9 rounded-full bg-[#00A884] flex items-center justify-center">
                                <Send size={16} className="text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Edição de Template */}
            {editingTemplate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingTemplate(null)}>
                    <div className="bg-ch-surface border border-ch-border rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}
                        style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                        <h3 className="text-lg font-bold text-ch-text mb-4 flex items-center gap-2"><Edit3 size={18} className="text-ch-cyan" /> Editar Template</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-ch-muted mb-1">Nome do Template</label>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                    className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                            </div>
                            <div>
                                <label className="block text-xs text-ch-muted mb-1">Conteúdo da Mensagem</label>
                                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={8}
                                    className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs text-ch-muted mb-1">Caminho da Mídia (opcional)</label>
                                <input type="text" value={editImage} onChange={e => setEditImage(e.target.value)}
                                    placeholder="uploads/imagem.jpg"
                                    className="w-full bg-ch-bg border border-ch-border rounded-lg px-3 py-2 text-sm focus:border-ch-cyan outline-none text-ch-text" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setEditingTemplate(null)}
                                className="flex-1 px-4 py-2 bg-ch-surface-2 text-ch-muted rounded-lg hover:bg-ch-border transition-colors text-sm">Cancelar</button>
                            <button onClick={handleSaveEditTemplate}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-ch-cyan to-ch-purple text-ch-bg rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                <Save size={14} /> Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS animation inline */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

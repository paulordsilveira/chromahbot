import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Bot, BrainCircuit, Cpu, Save, CheckCircle, Globe, MessageSquare, Phone, Key, RefreshCcw, Wand2, Bell } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

type Config = {
  welcomeMessage?: string;
  welcomeImageUrl?: string;
  logoImage?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  groqApiKey?: string;
  openRouterApiKey?: string;
  activeAiProvider?: string;
  selectedModel?: string;
  systemPrompt?: string;
  assistantContext?: string;
  documentacao?: string;
  faqText?: string;
  atendimentoPhones?: string;
  whatsappLink?: string;
  contatoHumano?: string;
  notificationPhone?: string;
  humanKeywords?: string;
  pauseCommands?: string;
  resumeCommands?: string;
  docCommands?: string;
  menuCommands?: string;
  docsMessage?: string;
  docsFiles?: string;
  isAiEnabled?: number;
};

const PROVIDER_MODELS: Record<string, { id: string; name: string; free?: boolean }[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: '⭐ Gemini 2.5 Flash (Recomendado — Rápido + Function Calling)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Mais Inteligente)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Mais Rápido/Econômico)' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Estável)' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Legado)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Recomendado)' },
    { id: 'gpt-4o', name: 'GPT-4o (Completo)' },
    { id: 'o1-mini', name: 'o1 Mini' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat — Funciona com Tools)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner — ⚠️ Sem Function Calling)' },
  ],
  openrouter: [
    { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash (FREE)', free: true },
    { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (FREE)', free: true },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (FREE)', free: true },
    { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (FREE)', free: true },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (FREE)', free: true },
  ]
};

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<Config>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [showContextModal, setShowContextModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'bot' | 'ia' | 'cerebro'>('bot');
  const [openRouterModels, setOpenRouterModels] = useState(PROVIDER_MODELS.openrouter);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);

  const fetchFreeModels = async () => {
    try {
      setFetchingModels(true);
      const { data: response } = await axios.get('https://openrouter.ai/api/v1/models');
      const freeModels = response.data
        .filter((m: any) => parseFloat(m.pricing.prompt) === 0)
        .map((m: any) => ({
          id: m.id,
          name: `${m.name} (FREE)`,
          free: true
        }));

      if (freeModels.length > 0) {
        setOpenRouterModels(freeModels);
      }
    } catch (e) {
      console.error('Erro ao buscar modelos do OpenRouter:', e);
    } finally {
      setFetchingModels(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await axios.get(`${API_URL}/config`);
        setConfig(data ?? {});
      } catch (e) {
        setError('Falha ao carregar configurações.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const onSave = async (configToSave?: Record<string, any>) => {
    const rawPayload = configToSave || config;
    // Sanitizar: remover referências DOM/React que causam circular structure
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        payload[key] = value;
      }
    }
    console.log('[Settings] Salvando config...', Object.keys(payload));
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      const { data } = await axios.put(`${API_URL}/config`, payload);
      console.log('[Settings] Config salva com sucesso:', {
        systemPrompt: data.systemPrompt?.substring(0, 50),
        assistantContext: data.assistantContext?.substring(0, 50),
        documentacao: data.documentacao?.substring(0, 50),
        faqText: data.faqText?.substring(0, 50),
        activeAiProvider: data.activeAiProvider,
        selectedModel: data.selectedModel,
      });
      setConfig(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('[Settings] Erro ao salvar:', e);
      setError('Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof Config, value: any) => {
    console.log(`[Settings] updateConfig: ${key} = ${typeof value === 'string' ? value.substring(0, 80) + '...' : value}`);
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Auto-save ao fechar modal
  const saveAndCloseModal = (closeFn: (v: boolean) => void) => {
    closeFn(false);
    // Usar setTimeout para garantir que o state atualizou antes de salvar
    setTimeout(() => {
      onSave();
    }, 100);
  };

  const improveWithAI = async (fieldType: keyof Config) => {
    const text = config[fieldType];
    if (!text || (typeof text === 'string' && !text.trim())) {
      alert('Digite algum texto antes de melhorar com IA.');
      return;
    }
    try {
      setImproving(true);
      setImprovingField(fieldType);
      console.log(`[Settings] Melhorando ${fieldType} com IA...`);
      const { data } = await axios.post(`${API_URL}/improve-text`, { text, fieldType });
      if (data.improved) {
        console.log(`[Settings] IA retornou texto melhorado (${data.improved.length} chars)`);
        updateConfig(fieldType, data.improved);
      }
    } catch (e: any) {
      console.error('[Settings] Erro ao melhorar texto:', e);
      alert('Erro ao melhorar texto com IA. Verifique se o provedor está configurado.');
    } finally {
      setImproving(false);
      setImprovingField(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ch-cyan"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-ch-text">Configurações</h1>
          <p className="text-ch-muted">Gerencie a identidade e inteligência do seu assistente.</p>
        </div>
        <button
          onClick={() => onSave()}
          disabled={saving}
          className="gradient-btn text-ch-bg px-6 py-2.5 rounded-xl font-semibold disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <div className="animate-spin h-4 w-4 border-2 border-ch-bg/30 border-b-ch-bg rounded-full"></div> : <Save size={20} />}
          {saving ? 'Gravando...' : 'Salvar Alterações'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-ch-magenta/10 border-l-4 border-ch-magenta text-ch-magenta p-4 rounded-r-lg flex items-center gap-3">
          <X size={20} /> {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 bg-ch-cyan/10 border-l-4 border-ch-cyan text-ch-cyan p-4 rounded-r-lg flex items-center gap-3">
          <CheckCircle size={20} /> Configurações salvas com sucesso!
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-ch-border mb-6 overflow-x-auto no-scrollbar">
        {[
          { key: 'bot' as const, icon: Bot, label: 'Bot' },
          { key: 'ia' as const, icon: Cpu, label: 'IA (Provedores)' },
          { key: 'cerebro' as const, icon: BrainCircuit, label: 'Cérebro IA' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key
              ? 'border-ch-cyan text-ch-cyan'
              : 'border-transparent text-ch-muted hover:text-ch-text'
              }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden border border-ch-border">
        {activeTab === 'bot' && (
          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">

                {/* IA Master Switch */}
                <div className={`p-6 rounded-3xl border transition-colors relative overflow-hidden ${config.isAiEnabled !== 0 ? 'bg-gradient-to-br from-ch-surface to-ch-bg border-ch-cyan/30 shadow-lg shadow-ch-cyan/5 text-ch-cyan' : 'bg-gradient-to-br from-ch-surface to-ch-bg border-ch-magenta/30 shadow-lg shadow-ch-magenta/5 text-ch-magenta'}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 relative z-10">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Cpu size={24} />
                      Inteligência Artificial (Cérebro do Bot)
                    </h3>
                    <button
                      type="button"
                      onClick={() => updateConfig('isAiEnabled', config.isAiEnabled !== 0 ? 0 : 1)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75 ${config.isAiEnabled !== 0 ? 'bg-ch-cyan' : 'bg-ch-surface-2 border-ch-border'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${config.isAiEnabled !== 0 ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-ch-muted relative z-10 leading-relaxed">
                    {config.isAiEnabled !== 0
                      ? 'A IA conversacional está ATIVA. O bot responderá dúvidas e trará IA como assistente virtual livre.'
                      : <span className="text-ch-magenta font-semibold">⚠️ IA DESATIVADA. O robô operará no modo URA Clássica. Conversas fora do cardápio recebem o Menu.</span>
                    }
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-4">
                    <MessageSquare size={20} className="text-ch-cyan" /> Boas-vindas
                  </h3>
                  <label className="block text-sm font-medium text-ch-muted mb-2">Mensagem do Assistente</label>
                  <textarea
                    value={config.welcomeMessage ?? ''}
                    onChange={(e) => updateConfig('welcomeMessage', e.target.value)}
                    className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-4 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan outline-none transition-all"
                    rows={4}
                    placeholder="Como posso ajudar você hoje?"
                  />
                  <p className="text-xs text-ch-muted mt-2">Esta mensagem será enviada após a saudação inicial do bot.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ch-muted mb-2">Apresentação Social (WhatsApp Link)</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 text-ch-muted" size={18} />
                    <input
                      value={config.whatsappLink ?? ''}
                      onChange={(e) => updateConfig('whatsappLink', e.target.value)}
                      className="w-full bg-ch-surface-2 border border-ch-border rounded-xl p-3 pl-10 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan outline-none transition-all"
                      type="text"
                      placeholder="https://wa.me/5500000000000"
                    />
                  </div>
                </div>

                {/* INIT COMANDOS INVISIVEIS */}
                <div className="p-6 bg-gradient-to-br from-ch-bg to-ch-surface-2 rounded-3xl border border-ch-border shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-ch-cyan">
                    <Key size={100} />
                  </div>
                  <h4 className="text-xl font-bold mb-2 flex items-center gap-2 text-ch-cyan">
                    <Bot size={24} /> Comandos Invisíveis (In-Chat)
                  </h4>
                  <p className="text-sm text-ch-muted mb-6">
                    Configure os atalhos que <b>você mesmo</b> pode enviar pelo WhatsApp do Bot para dar ordens a ele secretamente durante o atendimento.
                    (Separe as palavras por vírgula. Ex: <span className="bg-ch-surface px-1 py-0.5 rounded text-ch-purple">/pausar, /atualizando</span>)
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ch-muted uppercase">Pausar a IA ⏸️</label>
                      <input
                        value={config.pauseCommands ?? ''}
                        onChange={(e) => updateConfig('pauseCommands', e.target.value)}
                        className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan transition-colors placeholder:text-ch-muted/50"
                        placeholder="/atualizando, /paulo aqui"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ch-muted uppercase">Retomar a IA ▶️</label>
                      <input
                        value={config.resumeCommands ?? ''}
                        onChange={(e) => updateConfig('resumeCommands', e.target.value)}
                        className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan transition-colors placeholder:text-ch-muted/50"
                        placeholder="/voltar, /online"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ch-muted uppercase">Mostrar Menu 📋</label>
                      <input
                        value={config.menuCommands ?? ''}
                        onChange={(e) => updateConfig('menuCommands', e.target.value)}
                        className="w-full bg-ch-surface-2 border border-ch-border text-ch-text rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-ch-cyan/50 focus:border-ch-cyan transition-colors placeholder:text-ch-muted/50"
                        placeholder="/menu, /opcoes"
                      />
                    </div>
                  </div>
                </div>
                {/* END COMANDOS INVISIVEIS */}

              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-4">
                    <Globe size={20} className="text-ch-purple" /> Identidade Visual
                  </h3>
                  <label className="block text-sm font-medium text-ch-muted mb-3">Logomarca / Foto do Perfil</label>
                  <div className="flex flex-col gap-4">
                    {config.logoImage && (
                      <div className="relative w-32 h-32 border-2 border-dashed border-ch-border rounded-2xl overflow-hidden bg-ch-surface-2 group">
                        <img src={config.logoImage} alt="Logo" className="w-full h-full object-contain" />
                        <button
                          onClick={() => updateConfig('logoImage', '')}
                          className="absolute top-2 right-2 bg-ch-magenta/80 backdrop-blur-sm text-white w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <label className="flex items-center justify-center gap-3 px-6 py-3 bg-ch-surface-2 border-2 border-dashed border-ch-border rounded-2xl cursor-pointer hover:border-ch-cyan/50 transition-all text-ch-muted hover:text-ch-text">
                      <Globe size={20} />
                      <span className="font-medium">{config.logoImage ? 'Trocar Imagem' : 'Fazer Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => updateConfig('logoImage', reader.result as string);
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="p-5 bg-ch-purple/10 rounded-2xl border border-ch-purple/20">
                  <h4 className="text-ch-purple font-semibold mb-3 flex items-center gap-2">
                    <Phone size={18} /> Atendimento Humano
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-ch-purple/70 uppercase mb-1">Nome do Contato</label>
                      <input
                        value={config.contatoHumano ?? ''}
                        onChange={(e) => updateConfig('contatoHumano', e.target.value)}
                        className="w-full bg-ch-surface-2 border-none rounded-lg p-2.5 text-ch-text"
                        placeholder="Ex: Paulo Silveira"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ch-purple/70 uppercase mb-1">Telefone / Ramal</label>
                      <input
                        value={config.atendimentoPhones ?? ''}
                        onChange={(e) => updateConfig('atendimentoPhones', e.target.value)}
                        className="w-full bg-ch-surface-2 border-none rounded-lg p-2.5 text-ch-text"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-ch-cyan/10 rounded-2xl border border-ch-cyan/20">
                  <h4 className="text-ch-cyan font-semibold mb-3 flex items-center gap-2">
                    <Bell size={18} /> Notificações (Leads)
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-ch-cyan/70 uppercase mb-1">Número para Notificações</label>
                      <input
                        value={config.notificationPhone ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                          let formatted = '';
                          if (raw.length <= 2) formatted = raw ? `+${raw}` : '';
                          else if (raw.length <= 4) formatted = `+${raw.slice(0, 2)} (${raw.slice(2)}`;
                          else if (raw.length <= 8) formatted = `+${raw.slice(0, 2)} (${raw.slice(2, 4)}) ${raw.slice(4)}`;
                          else formatted = `+${raw.slice(0, 2)} (${raw.slice(2, 4)}) ${raw.slice(4, 8)}-${raw.slice(8)}`;
                          updateConfig('notificationPhone', formatted);
                        }}
                        className="w-full bg-ch-surface-2 border-none rounded-lg p-2.5 text-ch-text"
                        placeholder="+55 (00) 0000-0000"
                      />
                      <p className="text-xs text-ch-muted mt-1">O bot enviará notificações de leads e atendimento para este número.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ch-cyan/70 uppercase mb-1">Palavras-chave para Atendimento</label>
                      <input
                        value={config.humanKeywords ?? ''}
                        onChange={(e) => updateConfig('humanKeywords', e.target.value)}
                        className="w-full bg-ch-surface-2 border-none rounded-lg p-2.5 text-ch-text"
                        placeholder="atendimento, falar com alguém, humano"
                      />
                      <p className="text-xs text-ch-muted mt-1">Separadas por vírgula. Quando detectadas, acionam notificação ao dono.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'ia' && (
          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-4">
                    <Cpu size={20} className="text-ch-purple" /> Provedor Ativo
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {['gemini', 'openai', 'groq', 'deepseek', 'openrouter'].map((provider) => (
                      <button
                        key={provider}
                        onClick={() => {
                          const models = PROVIDER_MODELS[provider];
                          updateConfig('activeAiProvider', provider);
                          updateConfig('selectedModel', models[0].id);
                        }}
                        className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${config.activeAiProvider === provider
                          ? 'border-ch-purple bg-ch-purple/10 text-ch-purple glow-purple'
                          : 'border-ch-border hover:border-ch-purple/40 text-ch-muted hover:text-ch-text'
                          }`}
                      >
                        <span className="capitalize font-bold">{provider}</span>
                        {config.activeAiProvider === provider && <CheckCircle size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-8">
                <div className="bg-ch-surface-2 p-6 rounded-2xl border border-ch-border">
                  <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-6">
                    <Key size={20} className="text-ch-cyan" /> Configuração do Modelo
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-ch-muted mb-2">Modelo Específico</label>
                      <select
                        value={config.selectedModel ?? ''}
                        onChange={(e) => updateConfig('selectedModel', e.target.value)}
                        className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text transition-all outline-none focus:ring-2 focus:ring-ch-cyan/50"
                      >
                        <option value="">Selecione um modelo...</option>
                        {(config.activeAiProvider === 'openrouter' ? openRouterModels : (PROVIDER_MODELS[config.activeAiProvider || 'gemini'] || [])).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      {config.activeAiProvider === 'openrouter' && (
                        <button
                          onClick={fetchFreeModels}
                          disabled={fetchingModels}
                          className="mt-3 flex items-center gap-2 text-xs font-bold text-ch-cyan hover:underline disabled:opacity-50"
                        >
                          <RefreshCcw size={14} className={fetchingModels ? 'animate-spin' : ''} />
                          {fetchingModels ? 'Buscando Modelos...' : 'Atualizar todos os modelos FREE'}
                        </button>
                      )}
                      <p className="text-xs text-ch-muted mt-2">Escolha o motor que irá processar as conversas.</p>
                    </div>

                    <div className="h-[1px] bg-ch-border my-2"></div>

                    {config.activeAiProvider === 'gemini' && (
                      <div>
                        <label className="block text-sm font-medium text-ch-muted mb-1">Gemini API Key</label>
                        <input
                          value={config.geminiApiKey ?? ''}
                          onChange={(e) => updateConfig('geminiApiKey', e.target.value)}
                          className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          type="password"
                          placeholder="Cole sua chave do Google AI Studio"
                        />
                      </div>
                    )}

                    {config.activeAiProvider === 'openai' && (
                      <div>
                        <label className="block text-sm font-medium text-ch-muted mb-1">OpenAI API Key</label>
                        <input
                          value={config.openaiApiKey ?? ''}
                          onChange={(e) => updateConfig('openaiApiKey', e.target.value)}
                          className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          type="password"
                          placeholder="sk-..."
                        />
                      </div>
                    )}

                    {config.activeAiProvider === 'groq' && (
                      <div>
                        <label className="block text-sm font-medium text-ch-muted mb-1">Groq API Key</label>
                        <input
                          value={config.groqApiKey ?? ''}
                          onChange={(e) => updateConfig('groqApiKey', e.target.value)}
                          className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          type="password"
                          placeholder="gsk_..."
                        />
                      </div>
                    )}

                    {config.activeAiProvider === 'deepseek' && (
                      <div>
                        <label className="block text-sm font-medium text-ch-muted mb-1">Deepseek API Key</label>
                        <input
                          value={config.deepseekApiKey ?? ''}
                          onChange={(e) => updateConfig('deepseekApiKey', e.target.value)}
                          className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          type="password"
                          placeholder="sk-..."
                        />
                      </div>
                    )}

                    {config.activeAiProvider === 'openrouter' && (
                      <div>
                        <label className="block text-sm font-medium text-ch-muted mb-1">OpenRouter API Key (Supports FREE models)</label>
                        <input
                          value={config.openRouterApiKey ?? ''}
                          onChange={(e) => updateConfig('openRouterApiKey', e.target.value)}
                          className="w-full bg-ch-surface border border-ch-border rounded-xl p-3 text-ch-text focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                          type="password"
                          placeholder="sk-or-v1-..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cerebro' && (
          <div className="p-6 md:p-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna Esquerda - Diretriz */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-4 font-bold">
                  <Cpu size={20} className="text-ch-cyan" /> Diretriz Principal
                </h3>

                {/* System Prompt - Card */}
                <button
                  onClick={() => setShowPromptModal(true)}
                  className="w-full p-6 bg-ch-surface-2 border-2 border-dashed border-ch-border rounded-2xl text-left transition-all hover:border-ch-cyan/40 group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-ch-text">🧠 System Prompt</span>
                    {config.systemPrompt ? <CheckCircle className="text-ch-cyan" size={20} /> : <X className="text-ch-muted" size={20} />}
                  </div>
                  <p className="text-sm text-ch-muted">Instrução principal que define o comportamento da IA.</p>
                  {config.systemPrompt && (
                    <p className="text-xs text-ch-muted/60 mt-2 line-clamp-2">{config.systemPrompt}</p>
                  )}
                  <span className="inline-block mt-4 text-xs font-bold text-ch-cyan group-hover:underline">Clique para editar →</span>
                </button>

                {/* Contexto Adicional - Card */}
                <button
                  onClick={() => setShowContextModal(true)}
                  className="w-full p-6 bg-ch-surface-2 border-2 border-dashed border-ch-border rounded-2xl text-left transition-all hover:border-ch-purple/40 group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-ch-text">🎭 Contexto Adicional (Personalidade)</span>
                    {config.assistantContext ? <CheckCircle className="text-ch-cyan" size={20} /> : <X className="text-ch-muted" size={20} />}
                  </div>
                  <p className="text-sm text-ch-muted">Tom de voz, personalidade e estilo de comunicação.</p>
                  {config.assistantContext && (
                    <p className="text-xs text-ch-muted/60 mt-2 line-clamp-2">{config.assistantContext}</p>
                  )}
                  <span className="inline-block mt-4 text-xs font-bold text-ch-purple group-hover:underline">Clique para editar →</span>
                </button>
              </div>

              {/* Coluna Direita - Base de Conhecimento */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-ch-text flex items-center gap-2 mb-4 font-bold">
                  <BrainCircuit size={20} className="text-ch-purple" /> Base de Conhecimento
                </h3>

                {/* Documentação - Card */}
                <button
                  onClick={() => setShowDocModal(true)}
                  className="w-full p-6 bg-ch-surface-2 border-2 border-dashed border-ch-border rounded-2xl text-left transition-all hover:border-ch-cyan/40 group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-ch-text">📚 Documentação</span>
                    {config.documentacao ? <CheckCircle className="text-ch-cyan" size={20} /> : <X className="text-ch-muted" size={20} />}
                  </div>
                  <p className="text-sm text-ch-muted">Informações detalhadas sobre produtos/serviços que a IA usará para responder.</p>
                  <span className="inline-block mt-4 text-xs font-bold text-ch-cyan group-hover:underline">Clique para editar →</span>
                </button>

                {/* FAQ - Card */}
                <button
                  onClick={() => setShowFaqModal(true)}
                  className="w-full p-6 bg-ch-surface-2 border-2 border-dashed border-ch-border rounded-2xl text-left transition-all hover:border-ch-purple/40 group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-ch-text">❓ Dúvidas Frequentes (FAQ)</span>
                    {config.faqText ? <CheckCircle className="text-ch-cyan" size={20} /> : <X className="text-ch-muted" size={20} />}
                  </div>
                  <p className="text-sm text-ch-muted">Perguntas comuns enviadas diretamente para o chat do WhatsApp.</p>
                  <span className="inline-block mt-4 text-xs font-bold text-ch-purple group-hover:underline">Clique para editar →</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============= MODAL: System Prompt ============= */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-ch-border">
            <div className="p-6 border-b border-ch-border flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-bold text-ch-text flex items-center gap-2">🧠 System Prompt</h2>
              <button onClick={() => saveAndCloseModal(setShowPromptModal)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-sm text-ch-cyan bg-ch-cyan/10 p-4 rounded-xl">
                🎯 <strong>Instrução principal da IA.</strong> Define como o assistente deve se comportar, qual empresa representa, e quais são seus objetivos.
              </p>
              <textarea
                value={config.systemPrompt ?? ''}
                onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                className="w-full flex-1 bg-ch-surface-2 border border-ch-border rounded-2xl p-6 resize-none text-ch-text text-sm leading-relaxed focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                placeholder={`Ex: Você é o assistente virtual da ChromaH, empresa de soluções digitais conscientes.\n\nSeu papel é atender clientes de forma natural, humana e eficiente.\nSempre cumprimente o cliente pelo nome quando possível.\nUse uma linguagem profissional mas próxima.\nNunca invente informações que não estão na documentação.`}
              />
            </div>
            <div className="p-6 border-t border-ch-border flex justify-between">
              <button
                onClick={() => improveWithAI('systemPrompt')}
                disabled={improving}
                className="px-6 py-3 bg-gradient-to-r from-ch-purple to-ch-magenta hover:opacity-90 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Wand2 size={18} className={improving && improvingField === 'systemPrompt' ? 'animate-spin' : ''} />
                {improving && improvingField === 'systemPrompt' ? 'Melhorando...' : '✨ Melhorar com IA'}
              </button>
              <button onClick={() => saveAndCloseModal(setShowPromptModal)} className="px-8 py-3 gradient-btn text-ch-bg rounded-xl font-bold transition-all shadow-lg">💾 Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ============= MODAL: Contexto Adicional ============= */}
      {showContextModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-ch-border">
            <div className="p-6 border-b border-ch-border flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-bold text-ch-text flex items-center gap-2">🎭 Contexto Adicional (Personalidade)</h2>
              <button onClick={() => saveAndCloseModal(setShowContextModal)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-sm text-ch-purple bg-ch-purple/10 p-4 rounded-xl">
                🎨 <strong>Personalidade e tom de voz.</strong> Defina como a IA deve se comunicar. Este contexto é adicionado junto ao System Prompt para enriquecer as respostas.
              </p>
              <textarea
                value={config.assistantContext ?? ''}
                onChange={(e) => updateConfig('assistantContext', e.target.value)}
                className="w-full flex-1 bg-ch-surface-2 border border-ch-border rounded-2xl p-6 resize-none text-ch-text text-sm leading-relaxed focus:ring-2 focus:ring-ch-purple/50 outline-none"
                placeholder={`Ex: Você é simpático e acolhedor, sempre tratando o cliente pelo nome.\n\nTom: Profissional mas próximo, como um consultor de confiança.\nEvite: Respostas genéricas, formalidade excessiva.\nEstilo: Use emojis com moderação, seja direto e objetivo.\nIdioma: Português brasileiro, linguagem natural.`}
              />
            </div>
            <div className="p-6 border-t border-ch-border flex justify-between">
              <button
                onClick={() => improveWithAI('assistantContext')}
                disabled={improving}
                className="px-6 py-3 bg-gradient-to-r from-ch-purple to-ch-magenta hover:opacity-90 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Wand2 size={18} className={improving && improvingField === 'assistantContext' ? 'animate-spin' : ''} />
                {improving && improvingField === 'assistantContext' ? 'Melhorando...' : '✨ Melhorar com IA'}
              </button>
              <button onClick={() => saveAndCloseModal(setShowContextModal)} className="px-8 py-3 gradient-btn text-ch-bg rounded-xl font-bold transition-all shadow-lg">💾 Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ============= MODAL: Documentação ============= */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-ch-border">
            <div className="p-6 border-b border-ch-border flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-bold text-ch-text flex items-center gap-2">📚 Documentação Estruturada</h2>
              <button onClick={() => saveAndCloseModal(setShowDocModal)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-sm text-ch-cyan bg-ch-cyan/10 p-4 rounded-xl line-clamp-2 md:line-clamp-none">
                💡 <strong>Dica de Especialista:</strong> Quanto mais detalhes você fornecer sobre seus processos, serviços e soluções, mais "humana" e precisa será a resposta da IA. Use tópicos claros.
              </p>
              <textarea
                value={config.documentacao ?? ''}
                onChange={(e) => updateConfig('documentacao', e.target.value)}
                className="w-full flex-1 bg-ch-surface-2 border border-ch-border rounded-2xl p-6 resize-none text-ch-text font-mono text-sm leading-relaxed focus:ring-2 focus:ring-ch-cyan/50 outline-none"
                placeholder={`Exemplo:\n\n• Serviços oferecidos: Automações, Consultoria, Soluções IA\n• Horário de atendimento: Segunda a Sexta, 09:00 às 18:00\n• Assistentes disponíveis: ZaapyFood, DODO CHEFA, Oráculo IA, NutrixIA...`}
              />
            </div>
            <div className="p-6 border-t border-ch-border flex justify-between">
              <button
                onClick={() => improveWithAI('documentacao')}
                disabled={improving}
                className="px-6 py-3 bg-gradient-to-r from-ch-purple to-ch-magenta hover:opacity-90 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Wand2 size={18} className={improving && improvingField === 'documentacao' ? 'animate-spin' : ''} />
                {improving && improvingField === 'documentacao' ? 'Melhorando...' : '✨ Melhorar com IA'}
              </button>
              <button onClick={() => saveAndCloseModal(setShowDocModal)} className="px-8 py-3 gradient-btn text-ch-bg rounded-xl font-bold transition-all shadow-lg">💾 Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ============= MODAL: FAQ ============= */}
      {showFaqModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ch-surface rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-ch-border">
            <div className="p-6 border-b border-ch-border flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-bold text-ch-text flex items-center gap-2">❓ Configuração de Dúvidas (FAQ)</h2>
              <button onClick={() => saveAndCloseModal(setShowFaqModal)} className="text-ch-muted hover:text-ch-text"><X size={24} /></button>
            </div>
            <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-sm text-ch-purple bg-ch-purple/10 p-4 rounded-xl">
                📝 Este conteúdo será enviado diretamente ao cliente quando ele escolher a opção "Dúvidas" no menu do WhatsApp.
              </p>
              <textarea
                value={config.faqText ?? ''}
                onChange={(e) => updateConfig('faqText', e.target.value)}
                className="w-full flex-1 bg-ch-surface-2 border border-ch-border rounded-2xl p-6 resize-none text-ch-text leading-relaxed focus:ring-2 focus:ring-ch-purple/50 outline-none"
                placeholder={`📌 Quais soluções a ChromaH oferece?\nOferecemos automações, assistentes IA, consultoria em processos e mais...\n\n📌 Como funciona o atendimento?\nNosso assistente virtual está disponível 24/7 via WhatsApp...`}
              />
            </div>
            <div className="p-6 border-t border-ch-border flex justify-between">
              <button
                onClick={() => improveWithAI('faqText')}
                disabled={improving}
                className="px-6 py-3 bg-gradient-to-r from-ch-purple to-ch-magenta hover:opacity-90 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Wand2 size={18} className={improving && improvingField === 'faqText' ? 'animate-spin' : ''} />
                {improving && improvingField === 'faqText' ? 'Melhorando...' : '✨ Melhorar com IA'}
              </button>
              <button onClick={() => saveAndCloseModal(setShowFaqModal)} className="px-8 py-3 bg-ch-purple hover:bg-ch-purple/80 text-white rounded-xl font-bold transition-all shadow-lg">💾 Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

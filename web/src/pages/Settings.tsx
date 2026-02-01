import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

type Config = {
  welcomeMessage?: string;
  welcomeImageUrl?: string;
  logoImage?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  groqApiKey?: string;
  activeAiProvider?: string;
  systemPrompt?: string;
  assistantContext?: string;
  documentacao?: string;
  faqText?: string;
  atendimentoPhones?: string;
  whatsappLink?: string;
  contatoHumano?: string;
};

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<Config>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);

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

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      await axios.put(`${API_URL}/config`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError('Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">Configurações</h1>
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md dark:text-gray-300">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Configurações</h1>
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60 w-full sm:w-auto"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded">{error}</div>
      )}
      {saved && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 p-3 rounded">Salvo.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md space-y-4">
          <h2 className="text-lg font-semibold dark:text-white">👋 Boas-vindas</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/30 p-2 rounded">A mensagem enviada será: <strong>"Olá! Sou o Assistente Corretando. [sua mensagem aqui]"</strong></p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem personalizada</label>
            <textarea
              value={config.welcomeMessage ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, welcomeMessage: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Como posso ajudar você hoje?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logomarca / Imagem</label>
            <div className="flex flex-wrap items-center gap-4">
              {config.logoImage && (
                <div className="relative w-20 h-20 md:w-24 md:h-24 border dark:border-gray-600 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img src={config.logoImage} alt="Logo" className="w-full h-full object-contain" />
                  <button
                    onClick={() => setConfig(p => ({ ...p, logoImage: '' }))}
                    className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300">
                <span>📂 {config.logoImage ? 'Alterar' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setConfig(p => ({ ...p, logoImage: reader.result as string }));
                      reader.readAsDataURL(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A imagem aparecerá junto com a mensagem de boas-vindas.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md space-y-4">
          <h2 className="text-lg font-semibold dark:text-white">📞 Atendimento</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contato humano</label>
            <input
              value={config.contatoHumano ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, contatoHumano: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              type="text"
              placeholder="Nome do atendente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone de atendimento</label>
            <input
              value={config.atendimentoPhones ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, atendimentoPhones: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              type="text"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link do WhatsApp</label>
            <input
              value={config.whatsappLink ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, whatsappLink: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              type="text"
              placeholder="https://wa.me/5500000000000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cole o link direto do WhatsApp para atendimento.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold dark:text-white">IA</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provedor ativo</label>
            <select
              value={config.activeAiProvider ?? 'gemini'}
              onChange={(e) => setConfig((p) => ({ ...p, activeAiProvider: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
            >
              <option value="gemini">gemini</option>
              <option value="deepseek">deepseek</option>
              <option value="groq">groq</option>
              <option value="openai">openai</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gemini API Key</label>
              <input
                value={config.geminiApiKey ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, geminiApiKey: e.target.value }))}
                className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
                type="password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deepseek API Key</label>
              <input
                value={config.deepseekApiKey ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, deepseekApiKey: e.target.value }))}
                className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
                type="password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Groq API Key</label>
              <input
                value={config.groqApiKey ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, groqApiKey: e.target.value }))}
                className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
                type="password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OpenAI API Key</label>
              <input
                value={config.openaiApiKey ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, openaiApiKey: e.target.value }))}
                className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
                type="password"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System prompt</label>
            <textarea
              value={config.systemPrompt ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, systemPrompt: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contexto do assistente</label>
            <textarea
              value={config.assistantContext ?? ''}
              onChange={(e) => setConfig((p) => ({ ...p, assistantContext: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-700 dark:text-white"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📚 Documentação</label>
              <button
                onClick={() => setShowDocModal(true)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-left dark:text-gray-300"
              >
                {config.documentacao ? '✅ Configurado - Clique para editar' : '➕ Adicionar documentação'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Informações que a IA usará para responder.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">❓ Dúvidas Frequentes</label>
              <button
                onClick={() => setShowFaqModal(true)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-left dark:text-gray-300"
              >
                {config.faqText ? '✅ Configurado - Clique para editar' : '➕ Adicionar FAQ'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Perguntas frequentes exibidas no bot.</p>
            </div>
          </div>
        </div>
      </div>

      {showDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] md:h-[80vh] flex flex-col">
            <div className="p-3 md:p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold dark:text-white">📚 Documentação</h2>
              <button onClick={() => setShowDocModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><X size={24} /></button>
            </div>
            <div className="p-3 md:p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded">
                💡 <strong>Dica:</strong> Adicione aqui tudo sobre sua área de atuação em tópicos. A IA vai usar essas informações para responder melhor aos clientes.
              </p>
              <textarea
                value={config.documentacao ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, documentacao: e.target.value }))}
                className="w-full flex-1 border dark:border-gray-600 rounded p-3 resize-none dark:bg-gray-700 dark:text-white"
                placeholder="Exemplo:\n\n• Trabalhamos com imóveis na região X\n• Horário de atendimento: 9h às 18h\n• Tipos de imóveis: casas, apartamentos, terrenos\n• Formas de pagamento aceitas...\n• Documentos necessários...\n• Processo de compra/locação..."
              />
            </div>
            <div className="p-3 md:p-4 border-t dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowDocModal(false)} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showFaqModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] md:h-[80vh] flex flex-col">
            <div className="p-3 md:p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold dark:text-white">❓ Dúvidas Frequentes</h2>
              <button onClick={() => setShowFaqModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><X size={24} /></button>
            </div>
            <div className="p-3 md:p-4 flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
                📝 Escreva as perguntas e respostas frequentes. Esse texto será exibido quando o usuário selecionar "Dúvidas" no menu.
              </p>
              <textarea
                value={config.faqText ?? ''}
                onChange={(e) => setConfig((p) => ({ ...p, faqText: e.target.value }))}
                className="w-full flex-1 border dark:border-gray-600 rounded p-3 resize-none dark:bg-gray-700 dark:text-white"
                placeholder="Exemplo:\n\n📌 Como funciona a simulação?\nVocê preenche seus dados e recebemos para análise...\n\n📌 Quais documentos preciso?\nRG, CPF, comprovante de renda...\n\n📌 Qual o prazo de resposta?\nEm até 24 horas úteis..."
              />
            </div>
            <div className="p-3 md:p-4 border-t dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowFaqModal(false)} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

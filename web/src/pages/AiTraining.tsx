import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Brain, Send, Bot, User, Loader2, Trash2 } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    images?: string[];
}

export const AiTraining: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(false);

    // Ref para auto-scroll até a última mensagem do chat
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sempre rola para o final quando novas mensagens chegam
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Carrega a saudação inicial do bot igual no WhatsApp
    const fetchGreeting = async () => {
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/ai-test`, {
                message: '/bot-greeting',
                history: []
            });
            if (data.responses && Array.isArray(data.responses)) {
                const initialMsgs = data.responses.map((resp: any) => ({
                    role: 'assistant',
                    content: resp.content,
                    images: resp.images
                }));
                setMessages(initialMsgs);
            }
        } catch (e: any) {
            console.error("Erro ao carregar saudação:", e);
        } finally {
            setLoading(false);
            setStarted(true);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { data } = await axios.post(`${API_URL}/ai-test`, {
                message: userMsg,
                history: messages // Passando histórico de contexto pra IA
            });

            // Fix 4: Atualiza state de mensagens em lote para evitar race condition
            if (data.responses && Array.isArray(data.responses)) {
                const newMsgs: Message[] = data.responses.map((resp: any) => ({
                    role: 'assistant' as const,
                    content: resp.content,
                    images: resp.images
                }));
                setMessages(prev => [...prev, ...newMsgs]);
            } else if (data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            }
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${e.response?.data?.error || e.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-ch-text flex items-center gap-2"><Brain size={28} className="text-ch-purple" /> Modo Treinamento</h1>
                    <p className="text-ch-muted">Teste como a IA responde sem enviar ao WhatsApp</p>
                </div>
                {messages.length > 0 && (
                    <button onClick={() => { setMessages([]); setStarted(false); }} className="p-2 hover:bg-ch-surface-2 rounded-xl text-ch-muted hover:text-ch-magenta transition-colors" title="Limpar conversa">
                        <Trash2 size={20} />
                    </button>
                )}
            </div>

            <div className="glass rounded-2xl border border-ch-border flex-1 flex flex-col overflow-hidden" style={{ minHeight: '60vh' }}>
                {/* Área de mensagens */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {!started && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-ch-muted">
                            <Brain size={64} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">Pronto para testar sua IA!</p>
                            <div className="flex flex-wrap gap-2 mt-6 justify-center">
                                <button onClick={fetchGreeting} className="gradient-btn px-6 py-2 text-ch-bg rounded-xl font-semibold transition-colors">
                                    Iniciar Conversa
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-ch-cyan/20 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-ch-cyan" />
                                </div>
                            )}
                            <div className={`max-w-[75%] p-4 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user'
                                ? 'bg-ch-purple/20 text-ch-text rounded-br-md'
                                : 'bg-ch-surface-2 text-ch-text rounded-bl-md'
                                }`}>
                                {msg.images && msg.images.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-3">
                                        {msg.images.map((img, idx) => (
                                            <img key={idx} src={img} alt="Anexo simulado" className="max-w-full rounded-xl max-h-48 object-cover border border-ch-border" />
                                        ))}
                                    </div>
                                )}
                                {msg.content}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-ch-purple/20 flex items-center justify-center shrink-0">
                                    <User size={16} className="text-ch-purple" />
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-ch-cyan/20 flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-ch-cyan" />
                            </div>
                            <div className="bg-ch-surface-2 p-4 rounded-2xl rounded-bl-md">
                                <Loader2 size={18} className="animate-spin text-ch-cyan" />
                            </div>
                        </div>
                    )}
                    {/* Elemento âncora para auto-scroll */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-ch-border">
                    <div className="flex gap-3">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            className="flex-1 bg-ch-surface-2 border border-ch-border rounded-xl px-4 py-3 text-ch-text outline-none focus:ring-2 focus:ring-ch-purple/50"
                            placeholder="Digite uma mensagem de teste..."
                            disabled={loading}
                        />
                        <button onClick={handleSend} disabled={loading || !input.trim()} className="gradient-btn text-ch-bg px-5 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                            <Send size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-ch-muted mt-2 text-center">
                        ⚠️ Modo sandbox — as mensagens NÃO são enviadas ao WhatsApp
                    </p>
                </div>
            </div>
        </div>
    );
};

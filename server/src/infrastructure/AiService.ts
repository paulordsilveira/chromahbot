import OpenAI from 'openai';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import db from './database';

// Tipos para Function Calling
export interface ToolCall {
    name: string;
    args: Record<string, any>;
}

export interface AiToolResponse {
    text: string | null;
    toolCalls: ToolCall[];
}

// Definição das tools no formato OpenAI (universal)
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, { type: string; description: string; enum?: string[] }>;
        required?: string[];
    };
}

class AiService {
    private async getConfig() {
        return db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    }

    // ─── Método original (sem tools) para fallback ───
    async getAiResponse(userMessage: string, history: any[] = []): Promise<string> {
        const config = await this.getConfig();
        const provider = config.activeAiProvider || 'gemini';
        const model = config.selectedModel;
        const systemPrompt = `${config.systemPrompt || ''}\n\nContexto: ${config.assistantContext || ''}\n\nDocumentação:\n${config.documentacao || ''}`;

        try {
            switch (provider) {
                case 'gemini':
                    return await this.callGemini(config.geminiApiKey, model || 'gemini-2.5-flash', systemPrompt, userMessage);
                case 'openai':
                    return await this.callOpenAI(config.openaiApiKey, model || 'gpt-4o-mini', systemPrompt, userMessage);
                case 'groq':
                    return await this.callOpenAI(config.groqApiKey, model || 'llama-3.3-70b-versatile', systemPrompt, userMessage, 'https://api.groq.com/openai/v1');
                case 'deepseek':
                    return await this.callOpenAI(config.deepseekApiKey, model || 'deepseek-chat', systemPrompt, userMessage, 'https://api.deepseek.com');
                case 'openrouter':
                    return await this.callOpenAI(config.openRouterApiKey, model || 'google/gemini-2.0-flash-lite-preview-02-05:free', systemPrompt, userMessage, 'https://openrouter.ai/api/v1');
                default:
                    return "Provedor de IA não configurado corretamente.";
            }
        } catch (error: any) {
            console.error(`AI Service Error (${provider}):`, error);
            return `Desculpe, tive um problema ao processar sua mensagem com ${provider}.`;
        }
    }

    // ─── Novo método: Function Calling com Tools ───
    async getAiResponseWithTools(
        userMessage: string,
        tools: ToolDefinition[],
        conversationHistory: Array<{ role: string; content: string }> = []
    ): Promise<AiToolResponse> {
        const config = await this.getConfig();
        const provider = config.activeAiProvider || 'gemini';
        const model = config.selectedModel;

        const systemPrompt = this.buildSystemPrompt(config);

        try {
            switch (provider) {
                case 'gemini':
                    return await this.callGeminiWithTools(
                        config.geminiApiKey,
                        model || 'gemini-2.5-flash',
                        systemPrompt,
                        userMessage,
                        tools,
                        conversationHistory
                    );

                case 'openai':
                    return await this.callOpenAIWithTools(
                        config.openaiApiKey,
                        model || 'gpt-4o-mini',
                        systemPrompt,
                        userMessage,
                        tools,
                        conversationHistory
                    );

                case 'groq':
                    return await this.callOpenAIWithTools(
                        config.groqApiKey,
                        model || 'llama-3.3-70b-versatile',
                        systemPrompt,
                        userMessage,
                        tools,
                        conversationHistory,
                        'https://api.groq.com/openai/v1'
                    );

                case 'deepseek':
                    return await this.callOpenAIWithTools(
                        config.deepseekApiKey,
                        model || 'deepseek-chat',
                        systemPrompt,
                        userMessage,
                        tools,
                        conversationHistory,
                        'https://api.deepseek.com'
                    );

                case 'openrouter':
                    return await this.callOpenAIWithTools(
                        config.openRouterApiKey,
                        model || 'google/gemini-2.0-flash-lite-preview-02-05:free',
                        systemPrompt,
                        userMessage,
                        tools,
                        conversationHistory,
                        'https://openrouter.ai/api/v1'
                    );

                default:
                    return { text: "Provedor de IA não configurado.", toolCalls: [] };
            }
        } catch (error: any) {
            console.error(`[AI Tools] Error (${provider}):`, error?.message || error);
            // Fallback: resposta simples sem tools
            try {
                const fallback = await this.getAiResponse(userMessage);
                return { text: fallback, toolCalls: [] };
            } catch {
                return { text: `Desculpe, tive um problema ao processar sua mensagem.`, toolCalls: [] };
            }
        }
    }

    private buildSystemPrompt(config: any): string {
        let prompt = '';

        // Instrução base do usuário (do Cérebro IA)
        const userPrompt = config.systemPrompt || '';
        const context = config.assistantContext || '';

        // Identidade do assistente PRIMEIRO (mais importante)
        if (userPrompt) {
            prompt += `${userPrompt}\n\n`;
        }

        // Contexto/Personalidade
        if (context) {
            prompt += `${context}\n\n`;
        }

        // ─── Categorias e Subcategorias do banco (injeção dinâmica) ───
        try {
            const categories = db.prepare('SELECT id, name, emoji FROM category ORDER BY "order" ASC').all() as any[];
            if (categories.length > 0) {
                prompt += `CATÁLOGO DE SERVIÇOS (referência — NÃO navegue automaticamente):\n`;
                for (const cat of categories) {
                    const emoji = cat.emoji || '';
                    prompt += `• ${emoji} ${cat.name}\n`;
                    const subs = db.prepare('SELECT name, emoji FROM subcategory WHERE categoryId = ? ORDER BY "order" ASC').all(cat.id) as any[];
                    for (const sub of subs) {
                        prompt += `  → ${sub.emoji || ''} ${sub.name}\n`;
                    }
                }
                prompt += `\n`;
            }
        } catch (e) {
            console.error('[AiService] Erro ao carregar categorias:', e);
        }

        // ─── Regras fundamentais ───
        prompt += `REGRA DE OURO: Você é um ATENDENTE HUMANO no WhatsApp. Converse de forma natural E direcione para o catálogo quando fizer sentido.

COMO USAR AS TOOLS:
- 'enviar_menu_principal': Use SOMENTE quando o cliente pedir EXPLICITAMENTE o menu ou o catálogo completo. NÃO USE se o cliente fizer perguntas abertas gerais (ex: "o que vocês fazem?", "o que é a empresa?"). Nessas situações, apenas responda em texto resumindo a empresa. NUNCA use se o cliente apenas chamar pelo seu nome (ex: "${config.assistantName || 'Mobius'}") ou falar "Oi".
- 'mostrar_categoria': Quando o cliente PEDIR para ver/navegar uma categoria: "me mostra recrutamento", "quero ver consultoria", "abre automações".
- 'mostrar_subcategoria': Quando o cliente PEDIR para ver/navegar uma subcategoria: "me mostra currículo", "quero ver simulação".

COMPORTAMENTO INTELIGENTE (o mais importante):
Quando o cliente MENCIONA um assunto que corresponde a uma categoria ou subcategoria do catálogo acima, faça assim:
1. Responda brevemente sobre o assunto (1-2 linhas)
2. SUGIRA a categoria/subcategoria relevante no texto: "Temos uma seção sobre isso! Quer que eu te mostre?"
3. NÃO chame a tool automaticamente — espere o cliente confirmar que quer ver

Exemplos de comportamento correto:
- Cliente: "é sobre recrutamento" → "Recrutamento é uma das nossas áreas! 💼 Temos várias opções de vagas e parcerias. Quer que eu te mostre essa categoria?"
- Cliente: "quero saber sobre currículo" → "Temos uma seção de currículo no nosso catálogo! 📄 Quer que eu abra pra você?"
- Cliente: "sim" / "mostra" / "quero ver" → AÍ SIM chame a tool (mostrar_categoria ou mostrar_subcategoria)

QUANDO RESPONDER SÓ COM TEXTO (sem sugerir categoria):
- Dúvidas: "não entendi", "como assim?" → explique
- Perguntas gerais: "o que é a ChromaH?" → responda da documentação
- Assuntos que NÃO correspondem ao catálogo → converse normalmente

ESTILO:
1. Mensagens CURTAS (1-3 linhas). WhatsApp, não e-mail.
2. Emojis com moderação (1-2 por mensagem).
3. Tom humano, natural, acolhedor.
4. NÃO repita o nome da empresa toda mensagem.

`;

        // Documentação como referência silenciosa
        if (config.documentacao) {
            prompt += `DOCUMENTAÇÃO DE REFERÊNCIA (use para responder perguntas, NÃO liste tudo de uma vez):\n${config.documentacao}\n\n`;
        }

        return prompt;
    }

    // ─── Gemini com Function Calling ───
    private async callGeminiWithTools(
        apiKey: string,
        model: string,
        systemPrompt: string,
        userMessage: string,
        tools: ToolDefinition[],
        history: Array<{ role: string; content: string }>
    ): Promise<AiToolResponse> {
        if (!apiKey) throw new Error("API Key do Gemini não configurada.");

        const genAI = new GoogleGenerativeAI(apiKey);

        // Converter tools para formato Gemini
        const geminiTools = [{
            functionDeclarations: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: Object.fromEntries(
                        Object.entries(tool.parameters.properties).map(([key, val]) => [
                            key,
                            {
                                type: SchemaType.STRING,
                                description: val.description,
                                ...(val.enum ? { enum: val.enum } : {})
                            }
                        ])
                    ),
                    required: tool.parameters.required || [],
                }
            }))
        }];

        const genModel = genAI.getGenerativeModel({
            model,
            systemInstruction: systemPrompt,
            tools: geminiTools as any,
            generationConfig: {
                temperature: 0.2,
            },
        });

        // Montar histórico de conversa
        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = genModel.startChat({ history: geminiHistory as any });
        const result = await chat.sendMessage(userMessage);
        const response = result.response;

        // Verificar se há function calls
        const candidate = response.candidates?.[0];
        if (!candidate) return { text: response.text(), toolCalls: [] };

        const parts = candidate.content?.parts || [];
        const functionCallParts = parts.filter((p: any) => p.functionCall);

        if (functionCallParts.length > 0) {
            const toolCalls: ToolCall[] = functionCallParts.map((p: any) => ({
                name: p.functionCall.name,
                args: p.functionCall.args || {}
            }));
            // Preservar texto que a IA enviou junto com as tools
            const textParts = parts.filter((p: any) => p.text);
            const textContent = textParts.map((p: any) => p.text).join('').trim();
            return { text: textContent || null, toolCalls };
        }

        return { text: response.text(), toolCalls: [] };
    }

    // ─── OpenAI-compatível com Function Calling ───
    private async callOpenAIWithTools(
        apiKey: string,
        model: string,
        systemPrompt: string,
        userMessage: string,
        tools: ToolDefinition[],
        history: Array<{ role: string; content: string }>,
        baseURL?: string
    ): Promise<AiToolResponse> {
        if (!apiKey) throw new Error(`API Key não configurada.`);

        const client = new OpenAI({ apiKey, baseURL });

        // Montar mensagens
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
        ];

        // Converter tools para formato OpenAI
        const openaiTools = tools.map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));

        const response = await client.chat.completions.create({
            model,
            messages,
            tools: openaiTools,
            tool_choice: 'auto',
        });

        const choice = response.choices[0];
        if (!choice) return { text: "Sem resposta da IA.", toolCalls: [] };

        // Verificar tool_calls
        const toolCalls_raw = (choice.message as any).tool_calls;
        if (toolCalls_raw && toolCalls_raw.length > 0) {
            const toolCalls: ToolCall[] = toolCalls_raw.map((tc: any) => ({
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments || '{}')
            }));
            return { text: null, toolCalls };
        }

        return { text: choice.message.content || "Sem resposta.", toolCalls: [] };
    }

    // ─── Métodos originais (mantidos para compatibilidade) ───
    private async callGemini(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
        if (!apiKey) throw new Error("API Key do Gemini não configurada.");
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model });

        const result = await genModel.generateContent([
            { text: `${systemPrompt}\n\nUsuário: ${userMessage}` }
        ]);
        return result.response.text();
    }

    private async callOpenAI(apiKey: string, model: string, systemPrompt: string, userMessage: string, baseURL?: string): Promise<string> {
        if (!apiKey) throw new Error(`API Key para ${baseURL || 'OpenAI'} não configurada.`);

        const client = new OpenAI({
            apiKey,
            baseURL
        });

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
        });

        return response.choices[0]?.message?.content || "Sem resposta da IA.";
    }
}

export default new AiService();

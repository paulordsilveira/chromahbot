import { WAMessage } from '@whiskeysockets/baileys';
import eventBus from '../infrastructure/EventBus';
import db from '../infrastructure/database';
import aiService from '../infrastructure/AiService';
import { ToolDefinition } from '../infrastructure/AiService';

const sendText = async (sock: any, jid: string, text: string) => {
    await sock.sendMessage(jid, { text });
};

const getPhoneFromJid = (jid: string) => {
    const base = jid.split('@')[0] ?? jid;
    return base.replace(/\D/g, '') || base;
};

interface FormState {
    type: 'simulacao' | 'corretor' | 'processos' | 'locacao';
    step: number;
    data: Record<string, string>;
}

const userFormStates = new Map<string, FormState>();
const userCategoryContext = new Map<string, number>(); // Stores Category ID
const userSubcategoryContext = new Map<string, { categoryId: number; subcategoryIndex: number }>();

// ─── Controle de sessão: welcome só 1x por sessão ───
const welcomedUsers = new Map<string, number>(); // jid → timestamp do último welcome
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min → nova sessão

// ─── Histórico de conversa por chat (últimas N msgs) ───
const MAX_HISTORY = 10;
const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();

// ─── Deduplicação de mensagens (Baileys pode enviar duplicatas) ───
const processedMessages = new Map<string, number>();
const processedTexts = new Map<string, number>(); // Deduplicação por texto

const DEDUP_TTL = 10_000; // 10 segundos para IDs
const TEXT_DEDUP_TTL = 3_000; // 3 segundos para mesmo texto no mesmo chat

setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of processedMessages) {
        if (now - ts > DEDUP_TTL) processedMessages.delete(key);
    }
    for (const [key, ts] of processedTexts) {
        if (now - ts > TEXT_DEDUP_TTL) processedTexts.delete(key);
    }
}, 30_000);

// ─── Padrões de saudação para interceptar antes da IA ───
const GREETING_PATTERNS = /^(oi|olá|ola|eai|eae|e ai|hey|hi|hello|boa tarde|bom dia|boa noite|tudo bem|td bem|salve|fala|opa|oie|oii|oiii)$/i;

// ─── Notificação ao dono ───
const notifyOwner = async (sock: any, type: 'lead' | 'atendimento', contactName: string, contactPhone: string, profilePicUrl?: string, summary?: string) => {
    try {
        const config = db.prepare('SELECT notificationPhone FROM config WHERE id = 1').get() as any;
        const ownerPhone = config?.notificationPhone?.replace(/\D/g, '');
        if (!ownerPhone) return;

        const ownerJid = `${ownerPhone}@s.whatsapp.net`;
        const emoji = type === 'atendimento' ? '🔴' : '🟢';
        const titulo = type === 'atendimento' ? 'ATENDIMENTO SOLICITADO' : 'NOVO LEAD';

        let msg = `${emoji} *${titulo}*\n\n`;
        msg += `👤 *Nome:* ${contactName}\n`;
        msg += `📞 *Telefone:* ${contactPhone}\n`;
        if (summary) msg += `\n💬 *Resumo:* ${summary}\n`;
        msg += `\n⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
        if (type === 'atendimento') {
            msg += `\n\n_Para atender, envie:_\n*/atender ${contactPhone}*`;
        }

        // Se temos a foto de perfil, enviar como imagem com legenda
        if (profilePicUrl) {
            try {
                await sock.sendMessage(ownerJid, {
                    image: { url: profilePicUrl },
                    caption: msg
                });
                console.log(`[Notify] ${type} enviado COM FOTO para ${ownerPhone}: ${contactName}`);
                return;
            } catch (imgErr) {
                console.warn(`[Notify] Falha ao enviar foto, enviando como texto:`, imgErr);
            }
        }

        // Fallback: enviar como texto puro
        await sock.sendMessage(ownerJid, { text: msg });
        console.log(`[Notify] ${type} enviado para ${ownerPhone}: ${contactName}`);
    } catch (err) {
        console.error('[Notify] Erro ao notificar dono:', err);
    }
};

const createLeadTicket = (contactId: number, type: 'lead' | 'atendimento', summary?: string) => {
    try {
        db.prepare('INSERT INTO lead_ticket (contactId, type, summary) VALUES (?, ?, ?)').run(contactId, type, summary || null);
    } catch (err) {
        console.error('[LeadTicket] Erro ao criar ticket:', err);
    }
};

function addToHistory(jid: string, role: 'user' | 'assistant', content: string) {
    if (!conversationHistory.has(jid)) conversationHistory.set(jid, []);
    const hist = conversationHistory.get(jid)!;
    hist.push({ role, content });
    if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
}

// ─── Definição das 7 Tools para Function Calling ───
const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'enviar_menu_principal',
        description: 'Envia o menu principal mostrando TODAS as categorias disponíveis. Use quando: o cliente pedir "menu", "catálogo", "opções", "o que vocês fazem", "quais categorias", "outras categorias", "ver tudo", ou qualquer variação pedindo para ver a lista completa de serviços/categorias. NUNCA use em saudações simples como "oi" ou "olá".',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'mostrar_categoria',
        description: 'Mostra as subcategorias de UMA categoria específica. Use quando o cliente demonstrar interesse em um TEMA da categoria ou quando ele aceitar a sua sugestão (ex: você sugeriu "Quer ver a categoria X?" e o cliente disse "Sim", use esta tool enviando o nome da categoria X).',
        parameters: {
            type: 'object',
            properties: {
                nome_categoria: { type: 'string', description: 'Nome EXATO da categoria conforme existe no catálogo' }
            },
            required: ['nome_categoria']
        }
    },
    {
        name: 'mostrar_subcategoria',
        description: 'Mostra os itens de uma subcategoria específica. Use quando o cliente demonstrar interesse no assunto da subcategoria ou quando ele aceitar sua sugestão de mostrá-la (ex: você ofereceu mostrar e ele disse "Sim", dispare a tool).',
        parameters: {
            type: 'object',
            properties: {
                nome_subcategoria: { type: 'string', description: 'Nome da subcategoria' }
            },
            required: ['nome_subcategoria']
        }
    },
    {
        name: 'mostrar_item',
        description: 'Mostra detalhes completos de um item específico (produto/serviço). Use quando o usuário pedir detalhes sobre algo específico.',
        parameters: {
            type: 'object',
            properties: {
                nome_item: { type: 'string', description: 'Nome do item a ser exibido' }
            },
            required: ['nome_item']
        }
    },
    {
        name: 'iniciar_formulario',
        description: 'Inicia um formulário de cadastro. Use quando o usuário quiser se cadastrar, fazer uma simulação, ou registrar informações.',
        parameters: {
            type: 'object',
            properties: {
                tipo: {
                    type: 'string',
                    description: 'Tipo do formulário',
                    enum: ['simulacao', 'corretor', 'processos', 'locacao']
                }
            },
            required: ['tipo']
        }
    },
    {
        name: 'enviar_contato_humano',
        description: 'Encaminha o contato de um atendente humano. Use quando o usuário pedir para falar com uma pessoa real, atendente, ou suporte humano.',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'enviar_faq',
        description: 'Envia as perguntas frequentes (FAQ). Use quando o usuário tiver dúvidas gerais sobre a empresa ou serviços.',
        parameters: { type: 'object', properties: {}, required: [] }
    }
];

const FORM_STEPS = {
    simulacao: ['nome', 'contato', 'cpf', 'endereco', 'renda', 'ocupacao'],
    corretor: ['nome', 'contato', 'tem_imobiliaria', 'nome_imobiliaria'],
    processos: ['cpf', 'nome_confirmacao'],
    locacao: ['nome', 'contato', 'email', 'endereco', 'localizacao'],
};

const FORM_PROMPTS = {
    simulacao: {
        nome: '📝 *Simulação MCMV*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        cpf: 'Informe seu *CPF*:',
        endereco: 'Informe seu *endereço completo*:',
        renda: 'Informe sua *renda mensal* (ex: R$ 3.000,00):',
        ocupacao: 'Informe sua *ocupação/profissão*:',
    },
    corretor: {
        nome: '📝 *Cadastro de Corretor Parceiro*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        tem_imobiliaria: 'Possui *imobiliária*? Digite *SIM* ou *NÃO*:',
        nome_imobiliaria: 'Qual o *nome da imobiliária*?',
    },
    processos: {
        cpf: '🔍 *Consulta de Processos*\n\nPor favor, informe seu *CPF*:',
        nome_confirmacao: 'Para confirmar, informe seu *nome completo*:',
    },
    locacao: {
        nome: '🏠 *Cadastro de Locação/Venda*\n\nPor favor, informe seu *nome ou empresa*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        email: 'Informe seu *e-mail*:',
        endereco: 'Informe o *endereço completo* do imóvel:',
        localizacao: 'Informe o *link de localização* (Google Maps) ou digite "pular":',
    },
};

const upsertContact = (jid: string, name: string, profilePicUrl?: string): { id: number; jid: string; name: string } => {
    const existing = db.prepare('SELECT * FROM contact WHERE jid = ?').get(jid) as any;
    if (existing) {
        if (profilePicUrl) {
            db.prepare("UPDATE contact SET name = ?, profilePicUrl = ?, updatedAt = datetime('now') WHERE id = ?").run(name, profilePicUrl, existing.id);
        } else {
            db.prepare("UPDATE contact SET name = ?, updatedAt = datetime('now') WHERE id = ?").run(name, existing.id);
        }
        return { ...existing, name };
    }
    const phone = getPhoneFromJid(jid);
    const result = db.prepare('INSERT INTO contact (jid, name, phone, profilePicUrl) VALUES (?, ?, ?, ?)').run(jid, name, phone, profilePicUrl || null);
    return { id: Number(result.lastInsertRowid), jid, name };
};

const logMessage = (contactId: number | null, role: 'user' | 'assistant' | 'system', content: string) => {
    if (contactId) {
        db.prepare('INSERT INTO message_log (contactId, content, role) VALUES (?, ?, ?)').run(contactId, content, role);
    }
};

const sendAndLogText = async (sock: any, jid: string, contactId: number | null, text: string) => {
    await sendText(sock, jid, text);
    await logMessage(contactId, 'assistant', text);
};

const parseMenuSelection = (raw: string) => {
    const trimmed = raw.trim();
    const catMatch = trimmed.match(/^(\d+)$/);
    if (catMatch) {
        return { type: 'category' as const, index: Number(catMatch[1]) };
    }

    return { type: 'none' as const };
};

const formatSubCategoryMessage = (sub: any) => {
    let out = `📌 *${sub.title || sub.name}*\n\n`;

    if (sub.text) {
        out += `${sub.text}\n\n`;
    } else if (sub.description) {
        out += `${sub.description}\n\n`;
    }

    if (typeof sub.price === 'number') {
        out += `Valor: ${sub.price}\n`;
    }

    const links: Array<{ label: string; value?: string | null }> = [
        { label: 'Localização', value: sub.locationLink },
        { label: 'Contato', value: sub.contactLink },
        { label: 'Página', value: sub.webLink }
    ];

    for (const link of links) {
        if (link.value) {
            out += `${link.label}: ${link.value}\n`;
        }
    }

    if (sub.imageUrls) {
        out += `\nImagens: ${sub.imageUrls}`;
    }

    return out.trim();
};

// ─── Executor de Tools ───
const executeToolCall = async (
    toolName: string,
    args: Record<string, any>,
    sock: any,
    jid: string,
    name: string,
    contactId: number | null
): Promise<boolean> => {
    try {
        switch (toolName) {
            case 'enviar_menu_principal':
                userCategoryContext.delete(jid);
                userSubcategoryContext.delete(jid);
                await sendMainMenu(sock, jid, name, contactId);
                return true;

            case 'mostrar_categoria': {
                const catName = args.nome_categoria;
                const categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
                const cat = categories.find((c: any) =>
                    c.name.toLowerCase().includes(catName.toLowerCase())
                );
                if (cat) {
                    userCategoryContext.set(jid, cat.id);
                    await displaySubcategories(sock, jid, cat.id, contactId);
                } else {
                    await sendAndLogText(sock, jid, contactId, `Não encontrei a categoria "${catName}". Digite *MENU* para ver as opções disponíveis.`);
                }
                return true;
            }

            case 'mostrar_subcategoria': {
                const subName = args.nome_subcategoria;
                const sub = db.prepare('SELECT s.*, c.id as catId FROM subcategory s JOIN category c ON s.categoryId = c.id WHERE s.enabledInBot = 1 AND LOWER(s.name) LIKE ?').get(`%${subName.toLowerCase()}%`) as any;
                if (sub) {
                    const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(sub.catId) as any[];
                    const subIdx = subcategories.findIndex((s: any) => s.id === sub.id) + 1;
                    await handleSubCategoryOption(sock, jid, sub.catId, subIdx, contactId);
                } else {
                    await sendAndLogText(sock, jid, contactId, `Não encontrei "${subName}". Digite *MENU* para ver as opções.`);
                }
                return true;
            }

            case 'mostrar_item': {
                const itemName = args.nome_item;
                const item = db.prepare('SELECT * FROM item WHERE enabled = 1 AND LOWER(name) LIKE ?').get(`%${itemName.toLowerCase()}%`) as any;
                if (item) {
                    await sendItemWithImages(sock, jid, contactId, item);
                } else {
                    await sendAndLogText(sock, jid, contactId, `Não encontrei o item "${itemName}". Digite *MENU* para ver as opções.`);
                }
                return true;
            }

            case 'iniciar_formulario': {
                const tipo = args.tipo as 'simulacao' | 'corretor' | 'processos' | 'locacao';
                if (FORM_STEPS[tipo]) {
                    await startForm(sock, jid, contactId, tipo);
                } else {
                    await sendAndLogText(sock, jid, contactId, `Tipo de formulário não reconhecido.`);
                }
                return true;
            }

            case 'enviar_contato_humano':
                await sendHumanContact(sock, jid, contactId);
                return true;

            case 'enviar_faq':
                await handleDuvidas(sock, jid, contactId);
                return true;

            default:
                console.warn(`[Flow] Tool desconhecida: ${toolName}`);
                return false;
        }
    } catch (error) {
        console.error(`[Flow] Erro executando tool ${toolName}:`, error);
        return false;
    }
};

// Main Flow Handler
import fs from 'fs';

export const handleMessage = async (msg: WAMessage, sock: any) => {
    if (!msg.key.remoteJid || !msg.message) return;

    // Deduplicação 1: ignorar mensagens já processadas pelo ID do Baileys
    const msgId = msg.key.id;
    if (msgId) {
        if (processedMessages.has(msgId)) {
            console.log(`[Flow] Mensagem duplicada ignorada (Mesmo ID): ${msgId}`);
            return;
        }
        processedMessages.set(msgId, Date.now());
    }

    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const name = msg.pushName || "Cliente";

    if (!text) {
        console.log(`[Flow] Mensagem vazia ou tipo não suportado.`);
        return;
    }

    try {
        const config = db.prepare('SELECT pauseCommands, resumeCommands, docCommands, menuCommands, docsMessage, docsFiles, notificationPhone, isAiEnabled FROM config WHERE id = 1').get() as any;
        const normalized = text.trim();
        const lower = normalized.toLowerCase();

        // ─── 🔵 INTERCEPTAÇÃO: MENSAGENS ENVIADAS PELA PRÓPRIA LID (ADMIN CONECTADO) ───
        if (msg.key.fromMe) {
            console.log(`[Flow - Operador] O próprio número enviou uma mensagem para ${jid}`);

            // Buscar usuário real que estava conversando para podermos alterar os dados dele
            const contact = db.prepare('SELECT id, botPaused FROM contact WHERE jid = ?').get(jid) as any;
            if (!contact) return; // Se nem iniciou conversa ali, não tem pra que o bot se intrometer.

            const checkCommand = (commandsString: string) => {
                if (!commandsString) return false;
                const cmdList = commandsString.split(',').map(c => c.trim().toLowerCase());
                return cmdList.includes(lower);
            };

            // 1. Comando de Pausar IA
            if (checkCommand(config.pauseCommands)) {
                db.prepare('UPDATE contact SET botPaused = 1 WHERE id = ?').run(contact.id);
                console.log(`[Flow - Operador] IA Pausada secretamente via Comando! Cliente: ${jid}`);
                return;
            }

            // 2. Comando de Retomar IA
            if (checkCommand(config.resumeCommands)) {
                db.prepare('UPDATE contact SET botPaused = 0 WHERE id = ?').run(contact.id);
                console.log(`[Flow - Operador] IA Retomada secretamente via Comando! Cliente: ${jid}`);
                return;
            }

            // 3. Comandos Dinâmicos Customizados (CRUD)
            const customCommands = db.prepare('SELECT * FROM custom_command').all() as any[];
            let triggeredCustom = false;

            for (const cmd of customCommands) {
                if (checkCommand(cmd.triggers)) {
                    if (cmd.isActive === 0) {
                        console.log(`[Flow - Operador] Comando Dinâmico '${cmd.triggers}' Acionado, porém está marcado como INATIVO.`);
                        return; // Retorna para não cair nas próximas verificações nativas errôneamente
                    }

                    triggeredCustom = true;
                    console.log(`[Flow - Operador] Comando Dinâmico Acionado: ${cmd.triggers}`);

                    // Envia texto
                    if (cmd.textMessage) {
                        await sendAndLogText(sock, jid, contact.id, cmd.textMessage);
                        console.log(`[Flow - Operador] Mensagem do Comando enviada.`);
                    }

                    // Envia Arquivos Físicos
                    if (cmd.fileData) {
                        try {
                            const files = JSON.parse(cmd.fileData);
                            for (const file of files) {
                                if (file.data) {
                                    const matches = file.data.match(/^data:(.+);base64,(.*)$/);
                                    if (matches && matches.length === 3) {
                                        const mimetype = matches[1];
                                        const base64Data = matches[2];
                                        const buffer = Buffer.from(base64Data, 'base64');

                                        await sock.sendMessage(jid, {
                                            document: buffer,
                                            mimetype: mimetype,
                                            fileName: file.name
                                        });
                                        console.log(`[Flow - Operador] Anexo '${file.name}' enviado!`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`[Flow - Operador] Erro ao enviar anexos do Comando:`, e);
                        }
                    }

                    // 4. Vínculo Direto de Item Final
                    if (cmd.linkedItemId) {
                        const item = db.prepare('SELECT * FROM item WHERE id = ?').get(cmd.linkedItemId) as any;
                        if (item) {
                            await sendItemWithImages(sock, jid, contact.id, item);
                            console.log(`[Flow - Operador] Relé disparou Card do Item: ${item.name}`);
                        }
                    }

                    // 5. Vínculo Direto de Subcategoria / Formulário Especial
                    if (cmd.linkedSubcategoryId) {
                        const sub = db.prepare('SELECT * FROM subcategory WHERE id = ?').get(cmd.linkedSubcategoryId) as any;
                        if (sub) {
                            const cat = db.prepare('SELECT name FROM category WHERE id = ?').get(sub.categoryId) as any;
                            const specialType = isSpecialSubcategory(sub.name, cat?.name);
                            if (specialType === 'simulacao' || specialType === 'corretor' || specialType === 'processos' || specialType === 'locacao') {
                                await startForm(sock, jid, contact.id, specialType);
                            } else if (specialType === 'duvidas') {
                                await handleDuvidas(sock, jid, contact.id);
                            } else if (specialType === 'contato') {
                                await sendHumanContact(sock, jid, contact.id);
                            } else {
                                const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
                                if (items.length > 0) {
                                    // Pega o index real para alimentar o menu interativo
                                    const subcategories = db.prepare('SELECT id FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(sub.categoryId) as any[];
                                    const realSubIdx = subcategories.findIndex((s: any) => s.id === sub.id) + 1;

                                    userSubcategoryContext.set(jid, { categoryId: sub.categoryId, subcategoryIndex: realSubIdx });

                                    let itemsText = `📂 *${sub.name}*\n\nEscolha um item:\n`;
                                    items.forEach((item: any, idx: number) => {
                                        itemsText += `*${idx + 1}* - ${item.name}\n`;
                                    });
                                    itemsText += `\nDigite *VOLTAR* para voltar.`;
                                    await sendAndLogText(sock, jid, contact.id, itemsText);
                                } else {
                                    await sendAndLogText(sock, jid, contact.id, `📂 *${sub.name}*\n\nNenhum item cadastrado nesta subcategoria.\n\nDigite *VOLTAR* para voltar.`);
                                }
                            }
                            console.log(`[Flow - Operador] Relé disparou Lógica da Subcategoria: ${sub.name}`);
                        }
                    }
                    break; // Sai do loop após achar 1 comando correspondente
                }
            }

            if (triggeredCustom) return; // Se rodou comando customizado, corta aqui.

            // 4. Comando Global: Listar Comandos
            if (lower === '/listarcomandos') {
                let report = `*⚡ Seus Comandos Invisíveis*\n\n`;

                // Nativos
                report += `*Nativos:*\n`;
                report += `⏸️ Pausar IA: ${config.pauseCommands || 'Não conf.'}\n`;
                report += `▶️ Retomar IA: ${config.resumeCommands || 'Não conf.'}\n`;
                report += `📋 Mostrar Menu: ${config.menuCommands || 'Não conf.'}\n\n`;

                // Customizados
                report += `*Atalhos Customizados (${customCommands.length}):*\n`;
                if (customCommands.length === 0) {
                    report += `Nenhum atalho criado no painel ainda.`;
                } else {
                    customCommands.forEach(cmd => {
                        let fileCount = 0;
                        try {
                            if (cmd.fileData) {
                                const files = JSON.parse(cmd.fileData);
                                fileCount = files.length;
                            }
                        } catch { }
                        const activeIcon = cmd.isActive === 0 ? '🔴 (Inativo)' : '🟢';
                        report += `📌 *${cmd.triggers}* ${activeIcon}\n`;
                        report += `└ ${cmd.textMessage ? '📝 Tem texto' : '🚫 Sem texto'} | 📎 ${fileCount} arquivo(s)\n`;
                    });
                }

                await sendAndLogText(sock, jid, contact.id, report);
                console.log(`[Flow - Operador] O Operador puxou a lista de comandos.`);
                return;
            }

            // 5. Comando de Menu
            if (checkCommand(config.menuCommands)) {
                userCategoryContext.delete(jid);
                userSubcategoryContext.delete(jid);
                await sendMainMenu(sock, jid, name, contact.id);
                console.log(`[Flow - Operador] Menu Injetado via Comando Direto!`);
                return;
            }

            // Se for fromMe mas NÃO for nenhum comando cadastrado, APENAS logamos e paramos (não passa pra IA)
            logMessage(contact.id, 'assistant', normalized);
            addToHistory(jid, 'assistant', normalized);
            return;
        }
        // ─── 🔴 FIM DA INTERCEPTAÇÃO FROM-ME ───
    } catch (e) {
        console.error("[Flow - Validation Error]:", e);
    }

    // Deduplicação 2: ignorar mensagens com O MESMO TEXTO do mesmo usuário em menos de 3s
    const textKey = `${jid}:${text.toLowerCase().trim()}`;
    if (processedTexts.has(textKey)) {
        console.log(`[Flow] Mensagem duplicada ignorada (Mesmo Texto < 3s): "${text}"`);
        return;
    }
    processedTexts.set(textKey, Date.now());

    console.log(`[ChromaH] ${jid}: ${text}`);

    try {
        const normalized = text.trim();
        const lower = normalized.toLowerCase();

        let profilePicUrl: string | undefined;
        try {
            profilePicUrl = await sock.profilePictureUrl(jid, 'image');
        } catch (e) {
            // User may not have a profile picture
        }

        const contact = upsertContact(jid, name, profilePicUrl);
        logMessage(contact.id, 'user', normalized);
        addToHistory(jid, 'user', normalized);

        // ─── Bot pausado? (dono está atendendo diretamente) ───
        const contactRow = db.prepare('SELECT botPaused FROM contact WHERE id = ?').get(contact.id) as any;
        if (contactRow?.botPaused === 1) {
            console.log(`[Flow] Bot pausado para ${jid}, ignorando mensagem.`);
            return;
        }

        // ─── Comandos do dono (/atender, /liberar) ───
        const config = db.prepare('SELECT notificationPhone, isAiEnabled FROM config WHERE id = 1').get() as any;
        const ownerPhone = config?.notificationPhone?.replace(/\D/g, '');
        if (ownerPhone && getPhoneFromJid(jid) === ownerPhone) {
            if (lower.startsWith('/atender ')) {
                const targetPhone = normalized.substring(9).replace(/\D/g, '');
                if (targetPhone) {
                    db.prepare('UPDATE contact SET botPaused = 1 WHERE phone = ?').run(targetPhone);
                    // Atualizar ticket
                    const targetContact = db.prepare('SELECT id FROM contact WHERE phone = ?').get(targetPhone) as any;
                    if (targetContact) {
                        db.prepare("UPDATE lead_ticket SET status = 'attended', attendedAt = datetime('now') WHERE contactId = ? AND status = 'pending'").run(targetContact.id);
                    }
                    await sendText(sock, jid, `✅ Bot *pausado* para ${targetPhone}. Você pode conversar diretamente.\n\nQuando terminar, envie:\n*/liberar ${targetPhone}*`);
                }
                return;
            }
            if (lower.startsWith('/liberar ')) {
                const targetPhone = normalized.substring(9).replace(/\D/g, '');
                if (targetPhone) {
                    db.prepare('UPDATE contact SET botPaused = 0 WHERE phone = ?').run(targetPhone);
                    // Fechar ticket
                    const targetContact = db.prepare('SELECT id FROM contact WHERE phone = ?').get(targetPhone) as any;
                    if (targetContact) {
                        db.prepare("UPDATE lead_ticket SET status = 'closed' WHERE contactId = ? AND status = 'attended'").run(targetContact.id);
                    }
                    await sendText(sock, jid, `✅ Bot *reativado* para ${targetPhone}. O bot voltará a responder normalmente.`);
                }
                return;
            }
        }

        // ─── Atalhos diretos (retrocompatibilidade) ───
        if (lower === 'menu' || lower === 'cancelar') {
            userFormStates.delete(jid);
            userCategoryContext.delete(jid);
            userSubcategoryContext.delete(jid);
            await sendMainMenu(sock, jid, name, contact.id);
            return;
        }

        if (lower === 'voltar') {
            userFormStates.delete(jid);
            if (userSubcategoryContext.has(jid)) {
                const ctx = userSubcategoryContext.get(jid)!;
                userSubcategoryContext.delete(jid);
                userCategoryContext.set(jid, ctx.categoryId);
                await displaySubcategories(sock, jid, ctx.categoryId, contact.id);
                return;
            }
            userCategoryContext.delete(jid);
            await sendMainMenu(sock, jid, name, contact.id);
            return;
        }

        if (lower === 'contato') {
            await sendHumanContact(sock, jid, contact.id);
            return;
        }

        // ─── Formulário ativo (prioridade máxima) ───
        const formState = userFormStates.get(jid);
        if (formState) {
            await handleFormStep(sock, jid, contact.id, normalized, formState);
            return;
        }

        // ─── Seleção numérica (contexto de menu ativo) ───
        const selection = parseMenuSelection(normalized);
        if (selection.type === 'category') {
            const subContext = userSubcategoryContext.get(jid);
            if (subContext) {
                await handleItemOption(sock, jid, subContext.categoryId, subContext.subcategoryIndex, selection.index, contact.id);
                return;
            }
            const categoryId = userCategoryContext.get(jid);
            if (categoryId) {
                await handleSubCategoryOption(sock, jid, categoryId, selection.index, contact.id);
                return;
            }
            // Se não há contexto de subcategoria ou categoria, tratar como menu principal
            await handleMenuOption(sock, jid, selection.index, contact.id);
            return;
        }

        // ─── Saudações → welcome só na PRIMEIRA vez da sessão ───
        if (GREETING_PATTERNS.test(lower)) {
            const lastWelcome = welcomedUsers.get(jid);
            const now = Date.now();
            const isNewSession = !lastWelcome || (now - lastWelcome) > SESSION_TIMEOUT;

            if (isNewSession) {
                console.log(`[Flow] Primeira saudação da sessão: "${lower}" → Enviando welcome`);
                welcomedUsers.set(jid, now);
                await sendWelcome(sock, jid, name, contact.id);
                addToHistory(jid, 'assistant', '(saudação enviada)');

                console.log(`[DEBUG FLOW] Valor lido config.isAiEnabled =`, config?.isAiEnabled);
                if (config?.isAiEnabled === 0) {
                    await sendMainMenu(sock, jid, name, contact.id);
                    addToHistory(jid, 'assistant', '(menu enviado por IA desativada)');
                }

                // Notificar dono: novo lead (1x por sessão)
                const phone = getPhoneFromJid(jid);
                createLeadTicket(contact.id, 'lead', `Novo contato iniciou conversa`);
                await notifyOwner(sock, 'lead', name, phone, profilePicUrl);
                return;
            }
            // Já mandou welcome nessa sessão → trata como conversa normal via IA
            console.log(`[Flow] Saudação repetida: "${lower}" → Enviando para IA (welcome já foi)`);

            // Mas se a IA estiver desligada, a pessoa só quer o Menu de volta de forma amigável
            if (config?.isAiEnabled === 0) {
                await sendMainMenu(sock, jid, name, contact.id);
                return;
            }
        }

        // ─── FALLBACK DE URA CLÁSSICA (SE IA ESTIVER DESATIVADA) ───
        if (config?.isAiEnabled === 0) {
            console.log(`[Flow] IA Global Desativada. Rejeitando processamento livre para: ${jid}`);
            await sendAndLogText(sock, jid, contact.id, "Por favor, digite apenas uma das opções listadas no Menu abaixo:");
            await sendMainMenu(sock, jid, name, contact.id);
            return;
        }

        // ─── IA com Function Calling ───
        console.log(`[Flow→AI] Enviando para IA: "${normalized}"`);
        eventBus.emit('bot.log', `[AI+Tools] Processing: ${normalized}`);
        const history = conversationHistory.get(jid) || [];

        const result = await aiService.getAiResponseWithTools(
            normalized,
            TOOL_DEFINITIONS,
            history.slice(0, -1)  // Não duplicar a msg atual (já vai no userMessage)
        );

        console.log(`[Flow←AI] Resultado: text=${result.text ? `"${result.text.substring(0, 80)}..."` : 'null'}, tools=${result.toolCalls.length}`);

        // Se a IA escolheu executar tools
        if (result.toolCalls.length > 0) {
            // Se a IA também enviou texto junto com as tools, enviar primeiro
            if (result.text) {
                addToHistory(jid, 'assistant', result.text);
                await sendAndLogText(sock, jid, contact.id, result.text);
            }
            for (const tc of result.toolCalls) {
                console.log(`[AI Tool] ${tc.name}(${JSON.stringify(tc.args)})`);
                const executed = await executeToolCall(tc.name, tc.args, sock, jid, name, contact.id);
                if (!executed) {
                    await sendAndLogText(sock, jid, contact.id, `Desculpe, não consegui executar essa ação. Digite *MENU* para ver as opções.`);
                }
            }
            return;
        }

        // Se a IA respondeu com texto
        if (result.text) {
            addToHistory(jid, 'assistant', result.text);
            await sendAndLogText(sock, jid, contact.id, result.text);
            return;
        }

        // Fallback
        await sendAndLogText(sock, jid, contact.id, `Desculpe, não entendi. Digite *MENU* para ver as opções disponíveis.`);
    } catch (error) {
        console.error("Error in handler:", error);
    }
};
// ─── Boas-vindas: welcomeMessage + logo, SEM menu ───
const sendWelcome = async (sock: any, jid: string, name: string, contactId: number | null) => {
    let welcomeMsg = '';
    let logoImage: string | null = null;

    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        if (config?.welcomeMessage) welcomeMsg = config.welcomeMessage;
        if (config?.logoImage) logoImage = config.logoImage;
    } catch (e) {
        console.error('[Flow] DB Error (welcome):', e);
    }

    // Usar welcomeMessage do config, ou fallback simples
    const text = welcomeMsg || `Olá, ${name}! Tudo bem? Em que posso te ajudar? 😊`;

    // Enviar com imagem se tiver logo
    if (logoImage && logoImage.startsWith('data:image')) {
        try {
            const base64Data = logoImage.split(',')[1];
            const mimeType = logoImage.split(';')[0].split(':')[1];
            await sock.sendMessage(jid, {
                image: Buffer.from(base64Data, 'base64'),
                caption: text,
                mimetype: mimeType
            });
            await logMessage(contactId, 'assistant', `[Imagem] ${text}`);
        } catch (imgErr) {
            console.error('[Flow] Error sending welcome image:', imgErr);
            await sendAndLogText(sock, jid, contactId, text);
        }
    } else {
        await sendAndLogText(sock, jid, contactId, text);
    }
};

const sendMainMenu = async (sock: any, jid: string, name: string, contactId: number | null) => {
    let categories: any[] = [];
    let logoImage: string | null = null;

    try {
        categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
        const config = db.prepare('SELECT logoImage FROM config WHERE id = 1').get() as any;
        if (config?.logoImage) logoImage = config.logoImage;
    } catch (e) {
        console.error("DB Error:", e);
    }

    let menuText = `📋 *MENU PRINCIPAL*\n`;
    menuText += `──────────────────\n`;

    categories.forEach((cat: any, idx: number) => {
        const emoji = cat.emoji || getCategoryDefaultEmoji(cat.name);
        menuText += `${getNumberEmoji(idx + 1)} ${emoji} ${cat.name}\n`;
    });

    menuText += `──────────────────\n`;
    menuText += `ℹ️ Digite o *número* da opção desejada.`;

    // Send logo image if configured
    if (logoImage && logoImage.startsWith('data:image')) {
        try {
            const base64Data = logoImage.split(',')[1];
            const mimeType = logoImage.split(';')[0].split(':')[1];
            await sock.sendMessage(jid, {
                image: Buffer.from(base64Data, 'base64'),
                caption: menuText,
                mimetype: mimeType
            });
            await logMessage(contactId, 'assistant', `[Imagem] ${menuText}`);
        } catch (imgErr) {
            console.error("Error sending logo image:", imgErr);
            await sendAndLogText(sock, jid, contactId, menuText);
        }
    } else {
        await sendAndLogText(sock, jid, contactId, menuText);
    }
};

const getNumberEmoji = (num: number): string => {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    if (num >= 0 && num <= 9) return emojis[num];
    return `*${num}*`;
};

const getCategoryDefaultEmoji = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('portfólio') || lower.includes('portfolio') || lower.includes('imóve')) return '🏠';
    if (lower.includes('terreno') || lower.includes('construção') || lower.includes('construcao')) return '🏗️';
    if (lower.includes('minha casa') || lower.includes('mcmv') || lower.includes('vida')) return '🏡';
    if (lower.includes('parceri') || lower.includes('corretor')) return '🤝';
    if (lower.includes('serviço') || lower.includes('servico') || lower.includes('corretagem')) return '💼';
    if (lower.includes('status') || lower.includes('acompanha')) return '📊';
    if (lower.includes('recado') || lower.includes('outro') || lower.includes('contato')) return '📝';
    if (lower.includes('locação') || lower.includes('locacao') || lower.includes('aluguel')) return '🔑';
    if (lower.includes('venda') || lower.includes('compra')) return '💰';
    if (lower.includes('financ')) return '🏦';
    if (lower.includes('dúvida') || lower.includes('duvida') || lower.includes('faq')) return '❓';
    if (lower.includes('simula')) return '📝';
    return '📁';
};

const handleMenuOption = async (sock: any, jid: string, index: number, contactId: number | null) => {
    try {
        const categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
        const category = categories[index - 1];
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Opção inválida. Digite *MENU* para voltar.");
            return;
        }

        userCategoryContext.set(jid, category.id);
        await displaySubcategories(sock, jid, category.id, contactId);
    } catch (e) {
        console.error("DB Error:", e);
        await sendAndLogText(sock, jid, contactId, "❌ Erro ao buscar categoria. Digite *MENU* para voltar.");
    }
};

const displaySubcategories = async (sock: any, jid: string, categoryId: number, contactId: number | null) => {
    const category = db.prepare('SELECT * FROM category WHERE id = ?').get(categoryId) as any;
    const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(categoryId) as any[];

    // Buscar nome do contato para subcategoria "Falar com"
    let contatoHumano = '';
    try {
        const config = db.prepare('SELECT contatoHumano FROM config WHERE id = 1').get() as any;
        contatoHumano = config?.contatoHumano || '';
    } catch { }

    const catEmoji = category.emoji || '📂';
    let catText = `${catEmoji} *${category.name}*\n`;
    catText += `──────────────────\n`;
    if (subcategories.length > 0) {
        subcategories.forEach((sub: any, index: number) => {
            const subEmoji = sub.emoji || '▸';
            let displayName = sub.name;
            // Se é subcategoria "Falar com", substituir pelo nome do contato
            if (sub.name.toLowerCase().includes('falar com') && contatoHumano) {
                displayName = `Falar com ${contatoHumano}`;
            }
            catText += `${getNumberEmoji(index + 1)} ${subEmoji} ${displayName}\n`;
        });
        catText += `──────────────────\n`;
        catText += `↩️ Digite *VOLTAR* para o menu.`;
    } else {
        catText += `Em breve mais opções aqui!\n\nDigite *VOLTAR* para o menu.`;
    }
    await sendAndLogText(sock, jid, contactId, catText);
};

const handleSubCategoryOption = async (sock: any, jid: string, categoryId: number, subIndex: number, contactId: number | null) => {
    try {
        const category = db.prepare('SELECT * FROM category WHERE id = ?').get(categoryId) as any;
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Categoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(categoryId) as any[];
        const sub = subcategories[subIndex - 1];

        if (!sub) {
            await sendAndLogText(sock, jid, contactId, "❌ Subcategoria inválida. Digite *VOLTAR* para voltar.");
            return;
        }

        userCategoryContext.delete(jid);

        const specialType = isSpecialSubcategory(sub.name, category.name);
        if (specialType === 'simulacao' || specialType === 'corretor' || specialType === 'processos' || specialType === 'locacao') {
            await startForm(sock, jid, contactId, specialType);
            return;
        }
        if (specialType === 'duvidas') {
            await handleDuvidas(sock, jid, contactId);
            return;
        }
        if (specialType === 'contato') {
            await sendHumanContact(sock, jid, contactId);
            return;
        }

        const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
        if (items.length > 0) {
            userSubcategoryContext.set(jid, { categoryId, subcategoryIndex: subIndex });
            let itemsText = `📂 *${sub.name}*\n\nEscolha um item:\n`;
            items.forEach((item: any, idx: number) => {
                itemsText += `*${idx + 1}* - ${item.name}\n`;
            });
            itemsText += `\nDigite *VOLTAR* para voltar.`;
            await sendAndLogText(sock, jid, contactId, itemsText);
        } else {
            await sendAndLogText(sock, jid, contactId, `📂 *${sub.name}*\n\nNenhum item cadastrado nesta subcategoria.\n\nDigite *VOLTAR* para voltar.`);
        }
    } catch (e) {
        console.error('Error reading subcategory:', e);
        await sendAndLogText(sock, jid, contactId, "❌ Erro ao buscar informações. Digite *MENU* para voltar.");
    }
};

const handleItemOption = async (sock: any, jid: string, categoryId: number, subcategoryIndex: number, itemIndex: number, contactId: number | null) => {
    try {
        const category = db.prepare('SELECT * FROM category WHERE id = ?').get(categoryId) as any;
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Categoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(categoryId) as any[];
        const sub = subcategories[subcategoryIndex - 1];
        if (!sub) {
            await sendAndLogText(sock, jid, contactId, "❌ Subcategoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
        const item = items[itemIndex - 1];
        if (!item) {
            await sendAndLogText(sock, jid, contactId, "❌ Item inválido. Digite *VOLTAR* para voltar.");
            return;
        }

        userSubcategoryContext.delete(jid);
        await sendItemWithImages(sock, jid, contactId, item);
    } catch (e) {
        console.error('Error reading item:', e);
        await sendAndLogText(sock, jid, contactId, "❌ Erro ao buscar informações. Digite *MENU* para voltar.");
    }
};

const sendItemWithImages = async (sock: any, jid: string, contactId: number | null, item: any) => {
    // Enviar imagens primeiro (se existirem)
    if (item.imageUrls) {
        const images = item.imageUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < images.length && i < 10; i++) {
            try {
                const imgUrl = images[i].trim();
                if (imgUrl.startsWith('data:')) {
                    const base64Data = imgUrl.split(',')[1];
                    const mimeType = imgUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                    await sock.sendMessage(jid, {
                        image: Buffer.from(base64Data, 'base64'),
                        mimetype: mimeType
                    });
                } else if (imgUrl.startsWith('http')) {
                    await sock.sendMessage(jid, { image: { url: imgUrl } });
                }
            } catch (imgErr) {
                console.error(`Error sending image ${i + 1}:`, imgErr);
            }
        }
    }

    // Enviar documentos (se existirem)
    if (item.documentUrls) {
        const docs = item.documentUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < docs.length && i < 5; i++) {
            try {
                const docUrl = docs[i].trim();
                if (docUrl.startsWith('data:')) {
                    const base64Data = docUrl.split(',')[1];
                    const mimeType = docUrl.split(';')[0].split(':')[1] || 'application/pdf';
                    // Determinar extensão pelo mimetype
                    const extMap: Record<string, string> = {
                        'application/pdf': '.pdf',
                        'application/msword': '.doc',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                        'application/vnd.ms-excel': '.xls',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                        'text/plain': '.txt',
                        'text/html': '.html',
                    };
                    const ext = extMap[mimeType] || '.pdf';
                    const fileName = `${item.name || 'Documento'}_${i + 1}${ext}`;
                    await sock.sendMessage(jid, {
                        document: Buffer.from(base64Data, 'base64'),
                        mimetype: mimeType,
                        fileName: fileName,
                    });
                } else if (docUrl.startsWith('http')) {
                    await sock.sendMessage(jid, {
                        document: { url: docUrl },
                        mimetype: 'application/pdf',
                        fileName: docUrl.split('/').pop() || 'documento.pdf',
                    });
                }
            } catch (docErr) {
                console.error(`Error sending document ${i + 1}:`, docErr);
            }
        }
    }

    // Enviar vídeos (se existirem)
    if (item.videoUrls) {
        const videos = item.videoUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < videos.length && i < 2; i++) {
            try {
                const vidUrl = videos[i].trim();
                if (vidUrl.startsWith('data:')) {
                    const base64Data = vidUrl.split(',')[1];
                    const mimeType = vidUrl.split(';')[0].split(':')[1] || 'video/mp4';
                    await sock.sendMessage(jid, {
                        video: Buffer.from(base64Data, 'base64'),
                        mimetype: mimeType,
                    });
                } else if (vidUrl.startsWith('http')) {
                    await sock.sendMessage(jid, { video: { url: vidUrl } });
                }
            } catch (vidErr) {
                console.error(`Error sending video ${i + 1}:`, vidErr);
            }
        }
    }

    // Enviar texto com informações
    const text = formatItemMessage(item);
    await sendAndLogText(sock, jid, contactId, text);
};

const formatItemMessage = (item: any) => {
    let out = `📌 *${item.title || item.name}*\n\n`;
    if (item.description) out += `${item.description}\n\n`;
    if (item.empresa) out += `🏢 Empresa: ${item.empresa}\n`;
    if (item.contato) out += `📞 Contato: ${item.contato}\n`;
    if (item.email) out += `📧 E-mail: ${item.email}\n`;
    if (item.endereco) out += `📍 Endereço: ${item.endereco}\n`;
    if (item.price) out += `💰 Valor: ${item.price}\n`;
    if (item.locationLink) out += `\n🗺️ Localização: ${item.locationLink}\n`;
    if (item.contactLink) out += `📱 Link Contato: ${item.contactLink}\n`;
    if (item.webLink) out += `🌐 Site: ${item.webLink}\n`;
    out += `\nDigite *VOLTAR* para voltar ou *MENU* para o início.`;
    return out.trim();
};

const sendHumanContact = async (sock: any, jid: string, contactId: number | null) => {
    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        const contatoHumano = config?.contatoHumano;
        const atendimentoPhones = config?.atendimentoPhones;

        // Responder ao cliente
        await sendAndLogText(sock, jid, contactId, '✅ Já notifiquei a equipe! Em instantes alguém vai falar com você. 😊');

        if (contatoHumano || atendimentoPhones) {
            let msg = 'Enquanto isso, aqui está o contato direto:\n';
            if (contatoHumano) msg += `${contatoHumano}\n`;
            if (atendimentoPhones) msg += `${atendimentoPhones}\n`;
            await sendAndLogText(sock, jid, contactId, msg.trim());
        }

        // Notificar o dono via WhatsApp
        const phone = getPhoneFromJid(jid);
        const contact = db.prepare('SELECT * FROM contact WHERE jid = ?').get(jid) as any;
        const contactName = contact?.name || 'Cliente';

        // Pegar resumo das últimas mensagens
        const recentMsgs = db.prepare('SELECT content, role FROM message_log WHERE contactId = ? ORDER BY timestamp DESC LIMIT 5').all(contactId) as any[];
        const summary = recentMsgs.reverse().map((m: any) => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`).join('\n');

        if (contactId) {
            createLeadTicket(contactId, 'atendimento', summary);
        }
        await notifyOwner(sock, 'atendimento', contactName, phone, contact?.profilePicUrl, summary);
    } catch (e) {
        console.error('Error in sendHumanContact:', e);
        await sendAndLogText(sock, jid, contactId, 'Desculpe, houve um erro ao notificar a equipe. Por favor, tente novamente.');
    }
};

const startForm = async (sock: any, jid: string, contactId: number | null, formType: 'simulacao' | 'corretor' | 'processos' | 'locacao') => {
    const steps = FORM_STEPS[formType];
    const firstStep = steps[0];
    const prompts = FORM_PROMPTS[formType] as Record<string, string>;

    userFormStates.set(jid, { type: formType, step: 0, data: {} });
    await sendAndLogText(sock, jid, contactId, prompts[firstStep]);
};

const handleFormStep = async (sock: any, jid: string, contactId: number | null, input: string, state: FormState) => {
    const steps = FORM_STEPS[state.type];
    const currentField = steps[state.step];
    const prompts = FORM_PROMPTS[state.type] as Record<string, string>;

    state.data[currentField] = input;
    state.step++;

    // Corretor form: skip nome_imobiliaria if user answered "não" to tem_imobiliaria
    if (state.type === 'corretor' && currentField === 'tem_imobiliaria') {
        const answer = input.toLowerCase().trim();
        if (answer === 'não' || answer === 'nao' || answer === 'n') {
            state.data['nome_imobiliaria'] = 'Não possui';
            state.step++; // Skip nome_imobiliaria step
        }
    }

    if (state.step >= steps.length) {
        userFormStates.delete(jid);
        await completeForm(sock, jid, contactId, state);
        return;
    }

    const nextField = steps[state.step];
    await sendAndLogText(sock, jid, contactId, prompts[nextField]);
};

const completeForm = async (sock: any, jid: string, contactId: number | null, state: FormState) => {
    if (state.type === 'simulacao') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'simulacao',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                cpf: state.data.cpf,
                endereco: state.data.endereco,
                renda: state.data.renda,
                ocupacao: state.data.ocupacao,
            })
        );
        await sendAndLogText(sock, jid, contactId,
            `✅ *Simulação registrada com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• CPF: ${state.data.cpf}\n` +
            `• Endereço: ${state.data.endereco}\n` +
            `• Renda: ${state.data.renda}\n` +
            `• Ocupação: ${state.data.ocupacao}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'corretor') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_corretor',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                tem_imobiliaria: state.data.tem_imobiliaria,
                nome_imobiliaria: state.data.nome_imobiliaria,
            })
        );
        const imobInfo = state.data.nome_imobiliaria === 'Não possui'
            ? 'Não'
            : `Sim - ${state.data.nome_imobiliaria}`;
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Corretor realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• Imobiliária: ${imobInfo}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'locacao') {
        const locValue = state.data.localizacao?.toLowerCase() === 'pular' ? '' : state.data.localizacao;
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_locacao',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                email: state.data.email,
                endereco: state.data.endereco,
                localizacao: locValue,
            })
        );
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Locação/Venda realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome/Empresa: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• E-mail: ${state.data.email}\n` +
            `• Endereço: ${state.data.endereco}\n` +
            (locValue ? `• Localização: ${locValue}\n` : '') +
            `\nEm breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'processos') {
        const cpf = state.data.cpf?.replace(/\D/g, '');
        const nomeConfirmacao = state.data.nome_confirmacao?.toLowerCase();

        const forms = db.prepare(`SELECT * FROM form WHERE type = 'atendimento_interno'`).all() as any[];
        let found: any = null;

        for (const f of forms) {
            try {
                const parsed = JSON.parse(f.data || '{}');
                const parsedCpf = (parsed.cpf || '').replace(/\D/g, '');
                if (parsedCpf === cpf && parsed.nome?.toLowerCase().includes(nomeConfirmacao)) {
                    found = parsed;
                    break;
                }
            } catch { }
        }

        if (found) {
            // Mapear status para label legível
            const STATUS_LABELS: Record<string, string> = {
                'atendido': '🔵 Atendido',
                'cadastrado': '🔷 Cadastrado',
                'em_negociacao': '🟡 Em negociação',
                'locado': '🟣 Locado',
                'finalizado': '⚫ Finalizado',
                'contrato_elaborado': '🔮 Contrato Elaborado',
                'pendente': '🟠 Pendente',
                'pago': '🟢 Pago',
                'concluido': '✅ Concluído',
            };

            const statusLabel = STATUS_LABELS[found.statusAtual] || found.statusAtual || 'Não definido';

            let message = `📂 *Consulta de Processo*\n\n`;
            message += `👤 *Nome:* ${found.nome || '-'}\n`;
            message += `📱 *Contato:* ${found.contato || '-'}\n`;
            message += `📧 *E-mail:* ${found.email || '-'}\n`;
            if (found.rg) message += `🪪 *RG:* ${found.rg}\n`;
            if (found.ocupacao) message += `💼 *Ocupação:* ${found.ocupacao}\n`;
            if (found.renda) message += `� *Renda:* ${found.renda}\n`;
            if (found.endereco) message += `🏠 *Endereço:* ${found.endereco}\n`;
            message += `\n📊 *Status Atual:* ${statusLabel}\n`;

            if (found.processos) {
                message += `\n📋 *Processos:*\n${found.processos}\n`;
            }

            // Última atualização de status
            if (found.statusHistorico && found.statusHistorico.length > 0) {
                const ultimo = found.statusHistorico[found.statusHistorico.length - 1];
                const dataUltimo = new Date(ultimo.data).toLocaleDateString('pt-BR');
                message += `\n🕐 *Última atualização:* ${dataUltimo}`;
                if (ultimo.info) message += `\n📝 *Info:* ${ultimo.info}`;
            }

            message += `\n\nDigite *MENU* para voltar.`;

            await sendAndLogText(sock, jid, contactId, message);
        } else {
            await sendAndLogText(sock, jid, contactId,
                `❌ Nenhum processo encontrado para o CPF informado.\n\n` +
                `Verifique os dados ou entre em contato com o atendimento.\n\nDigite *MENU* para voltar.`
            );
        }
    }
};

const handleDuvidas = async (sock: any, jid: string, contactId: number | null) => {
    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        const faqText = config?.faqText;

        if (faqText) {
            await sendAndLogText(sock, jid, contactId, `❓ *Dúvidas Frequentes*\n\n${faqText}\n\nDigite *MENU* para voltar.`);
        } else {
            await sendAndLogText(sock, jid, contactId, `❓ *Dúvidas Frequentes*\n\nEm breve teremos mais informações aqui.\n\nDigite *MENU* para voltar.`);
        }
    } catch (e) {
        console.error('Error fetching FAQ:', e);
        await sendAndLogText(sock, jid, contactId, 'Erro ao buscar dúvidas. Digite *MENU* para voltar.');
    }
};

const isSpecialSubcategory = (subName: string, categoryName?: string): 'simulacao' | 'corretor' | 'processos' | 'duvidas' | 'locacao' | 'contato' | null => {
    const lowerSub = subName.toLowerCase();
    const lowerCat = categoryName ? categoryName.toLowerCase() : '';

    if (lowerSub.includes('simulação') || lowerSub.includes('simulacao') || lowerCat.includes('simulação') || lowerCat.includes('simulacao')) return 'simulacao';
    if (lowerSub.includes('corretor') || lowerSub.includes('cadastro de corretor') || lowerCat.includes('corretor')) return 'corretor';
    if (lowerSub.includes('processo') || lowerCat.includes('processo')) return 'processos';
    if (lowerSub.includes('dúvida') || lowerSub.includes('duvida') || lowerCat.includes('dúvida') || lowerCat.includes('duvida')) return 'duvidas';
    if (lowerSub.includes('falar com') || lowerCat.includes('falar com')) return 'contato';

    // Apenas "Cadastro Locação/Venda" ou similar - não "Locações Disponíveis"
    if ((lowerSub.includes('cadastro') && (lowerSub.includes('locação') || lowerSub.includes('locacao') || lowerSub.includes('venda'))) ||
        (lowerCat.includes('cadastro') && (lowerCat.includes('locação') || lowerCat.includes('locacao') || lowerCat.includes('venda')))) {
        return 'locacao';
    }
    return null;
};

// Listen to internal event to trigger this handler
eventBus.on('message.received', ({ msg, sock }) => {
    handleMessage(msg, sock);
});

/**
 * aiTestHandler.ts — Handler do "Treinar IA" que replica o flow.ts
 *
 * Simula o fluxo COMPLETO do bot (saudação, menu, navegação numérica,
 * voltar, e fallback para IA com Function Calling), garantindo que a
 * tela "Treinar IA" se comporte IDENTICAMENTE ao WhatsApp real.
 *
 * O frontend envia { message, history, sessionContext } e recebe
 * { responses, sessionContext } com o contexto atualizado.
 */

import db from '../infrastructure/database';
import aiService from '../infrastructure/AiService';
import { TOOL_DEFINITIONS, SESSION_TIMEOUT } from '../bot/modules/constants';
import { formatItemMessage } from '../bot/modules/menuNavigation';
import { parseImageUrls, isSpecialSubcategory } from '../bot/modules/helpers';

// Emojis numéricos para o menu
const NUM_EMOJIS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const getEmoji = (n: number) => n >= 0 && n <= 9 ? NUM_EMOJIS[n] : `*${n}*`;

// Padrões de saudação — idêntico ao constants.ts
const GREETING_RE = /^(oi|olá|ola|eai|eae|e ai|hey|hi|hello|boa tarde|bom dia|boa noite|tudo bem|td bem|salve|fala|opa|oie|oii|oiii)$/i;

// ── Interface do contexto de sessão ──
interface SessionContext {
    categoryId: number | null;
    subcategoryId: number | null;
    subcategoryIndex: number | null;
    lastWelcome?: number; // timestamp da última saudação
}

// ── Helper: texto do Menu Principal (igual ao menuNavigation.ts) ──
function buildMainMenu() {
    const categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
    let menuText = `📋 *MENU PRINCIPAL*\n`;
    menuText += `──────────────────\n`;
    categories.forEach((cat: any, idx: number) => {
        menuText += `${getEmoji(idx + 1)} ${cat.emoji || '📁'} ${cat.name}\n`;
    });
    menuText += `──────────────────\n`;
    menuText += `ℹ️ Digite o *número* da opção desejada.`;

    const config = db.prepare('SELECT logoImage FROM config WHERE id = 1').get() as any;
    const images: string[] = [];
    if (config?.logoImage && config.logoImage.startsWith('data:image')) {
        images.push(config.logoImage);
    }
    return { text: menuText, images };
}

// ── Helper: texto das subcategorias de uma categoria ──
function buildSubcategories(categoryId: number) {
    const category = db.prepare('SELECT * FROM category WHERE id = ?').get(categoryId) as any;
    const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(categoryId) as any[];

    const catEmoji = category?.emoji || '📂';
    let catText = `${catEmoji} *${category?.name}*\n`;
    catText += `──────────────────\n`;
    if (subcategories.length > 0) {
        subcategories.forEach((sub: any, index: number) => {
            const subEmoji = sub.emoji || '▸';
            catText += `${getEmoji(index + 1)} ${subEmoji} ${sub.name}\n`;
        });
        catText += `──────────────────\n`;
        catText += `↩️ Digite *VOLTAR* para o menu.`;
    } else {
        catText += `Em breve mais opções aqui!\n\nDigite *VOLTAR* para o menu.`;
    }
    return catText;
}

// ── Helper: texto dos itens de uma subcategoria ──
function buildItems(subcategoryId: number) {
    const sub = db.prepare('SELECT * FROM subcategory WHERE id = ?').get(subcategoryId) as any;
    const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(subcategoryId) as any[];
    if (items.length > 0) {
        let itemsText = `📂 *${sub?.name}*\n\nEscolha um item:\n`;
        items.forEach((item: any, idx: number) => {
            itemsText += `*${idx + 1}* - ${item.name}\n`;
        });
        itemsText += `\nDigite *VOLTAR* para voltar.`;
        return itemsText;
    }
    return `📂 *${sub?.name}*\n\nNenhum item cadastrado nesta subcategoria.\n\nDigite *VOLTAR* para voltar.`;
}

/**
 * Handler principal do /ai-test.
 * Replica a lógica EXATA do flow.ts para garantir que o Treinar IA
 * se comporte identicamente ao WhatsApp.
 */
export async function handleAiTest(req: any, res: any) {
    try {
        const { message, history, sessionContext } = req.body;
        if (!message) return res.status(400).json({ error: 'message é obrigatório' });

        const lower = message.toLowerCase().trim();
        const responseMessages: any[] = [];

        // Estado de sessão vindo do frontend
        let ctx: SessionContext = sessionContext || { categoryId: null, subcategoryId: null, subcategoryIndex: null };

        // ── COMANDO ESPECIAL: Saudação inicial ao abrir a tela ──
        if (message === '/bot-greeting') {
            const config = db.prepare('SELECT welcomeMessage, logoImage FROM config WHERE id = 1').get() as any;
            const text = config?.welcomeMessage || `Olá, Cliente! Tudo bem? Em que posso te ajudar? 😊`;
            const images: string[] = [];
            if (config?.logoImage && config.logoImage.startsWith('data:image')) {
                images.push(config.logoImage);
            }
            ctx = { categoryId: null, subcategoryId: null, subcategoryIndex: null, lastWelcome: Date.now() };
            return res.json({
                responses: [{ type: 'text', content: text, images: images.length > 0 ? images : undefined }],
                sessionContext: ctx
            });
        }

        // ── VOLTAR ──
        if (lower === 'voltar' || lower === 'back' || lower === 'v') {
            if (ctx.subcategoryId) {
                ctx.subcategoryId = null;
                ctx.subcategoryIndex = null;
                responseMessages.push({ type: 'text', content: buildSubcategories(ctx.categoryId!) });
            } else if (ctx.categoryId) {
                ctx.categoryId = null;
                const menu = buildMainMenu();
                responseMessages.push({ type: 'text', content: menu.text, images: menu.images.length > 0 ? menu.images : undefined });
            } else {
                const menu = buildMainMenu();
                responseMessages.push({ type: 'text', content: menu.text, images: menu.images.length > 0 ? menu.images : undefined });
            }
            return res.json({ responses: responseMessages, sessionContext: ctx });
        }

        // ── MENU EXPLÍCITO ──
        if (lower === 'menu' || lower === 'inicio' || lower === 'início') {
            ctx = { categoryId: null, subcategoryId: null, subcategoryIndex: null };
            const menu = buildMainMenu();
            responseMessages.push({ type: 'text', content: menu.text, images: menu.images.length > 0 ? menu.images : undefined });
            return res.json({ responses: responseMessages, sessionContext: ctx });
        }

        // ── SELEÇÃO NUMÉRICA ──
        const numMatch = lower.match(/^(\d+)$/);

        // Nível 3: Itens (contexto de subcategoria ativo)
        if (ctx.subcategoryId && numMatch) {
            const index = Number(numMatch[1]);
            const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(ctx.subcategoryId) as any[];
            const item = items[index - 1];
            if (item) {
                const text = formatItemMessage(item);
                const images = parseImageUrls(item.imageUrls);
                responseMessages.push({ type: 'item', content: text, images: images.length > 0 ? images : undefined });
            } else {
                responseMessages.push({ type: 'text', content: '❌ Opção inválida. Digite *VOLTAR* para voltar.' });
            }
            return res.json({ responses: responseMessages, sessionContext: ctx });
        }

        // Nível 2: Subcategorias (contexto de categoria ativo)
        if (ctx.categoryId && !ctx.subcategoryId && numMatch) {
            const index = Number(numMatch[1]);
            const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(ctx.categoryId) as any[];
            const sub = subcategories[index - 1];
            if (sub) {
                const category = db.prepare('SELECT * FROM category WHERE id = ?').get(ctx.categoryId) as any;
                const specialType = isSpecialSubcategory(sub.name, category?.name);

                if (specialType === 'contato') {
                    const config = db.prepare('SELECT contatoHumano FROM config WHERE id = 1').get() as any;
                    responseMessages.push({ type: 'text', content: `✅ Já notifiquei a equipe! Em instantes alguém vai falar com você. 😊\n\nContato: ${config?.contatoHumano || 'Não configurado'}` });
                    ctx.categoryId = null;
                } else if (specialType === 'duvidas') {
                    const config = db.prepare('SELECT faqText FROM config WHERE id = 1').get() as any;
                    responseMessages.push({ type: 'text', content: `❓ *Dúvidas Frequentes*\n\n${config?.faqText || 'Em breve.'}\n\nDigite *MENU* para voltar.` });
                    ctx.categoryId = null;
                } else if (specialType === 'simulacao' || specialType === 'corretor' || specialType === 'processos' || specialType === 'locacao') {
                    responseMessages.push({ type: 'text', content: `[Simulação] Iniciando formulário de *${specialType}*.\n(No WhatsApp real, o bot faria as perguntas passo a passo.)` });
                    ctx.categoryId = null;
                } else {
                    // Subcategoria normal → listar itens
                    const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
                    if (items.length > 0) {
                        ctx.subcategoryId = sub.id;
                        ctx.subcategoryIndex = index;
                        responseMessages.push({ type: 'text', content: buildItems(sub.id) });
                    } else {
                        responseMessages.push({ type: 'text', content: `📂 *${sub.name}*\n\nNenhum item nesta subcategoria.\n\nDigite *VOLTAR* para voltar.` });
                    }
                }
            } else {
                responseMessages.push({ type: 'text', content: '❌ Opção inválida. Digite *VOLTAR* para voltar.' });
            }
            return res.json({ responses: responseMessages, sessionContext: ctx });
        }

        // Nível 1: Menu Principal (sem contexto ativo)
        if (!ctx.categoryId && !ctx.subcategoryId && numMatch) {
            const index = Number(numMatch[1]);
            const categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
            const category = categories[index - 1];
            if (category) {
                ctx.categoryId = category.id;
                responseMessages.push({ type: 'text', content: buildSubcategories(category.id) });
            } else {
                responseMessages.push({ type: 'text', content: '❌ Opção inválida. Digite *MENU* para voltar.' });
            }
            return res.json({ responses: responseMessages, sessionContext: ctx });
        }

        // ── SAUDAÇÃO ──
        if (GREETING_RE.test(lower)) {
            const now = Date.now();
            const lastWelcome = ctx.lastWelcome || 0;
            if (now - lastWelcome > SESSION_TIMEOUT) {
                ctx.lastWelcome = now;
                const config = db.prepare('SELECT welcomeMessage, logoImage FROM config WHERE id = 1').get() as any;
                const text = config?.welcomeMessage || `Olá! Tudo bem? Em que posso te ajudar? 😊`;
                const images: string[] = [];
                if (config?.logoImage && config.logoImage.startsWith('data:image')) images.push(config.logoImage);
                responseMessages.push({ type: 'text', content: text, images: images.length > 0 ? images : undefined });

                // O WhatsApp REAL não envia o menu imediatamente na saudação e não reseta o contexto.
                // Apenas envia a saudação e aguarda a próxima interação do usuário.
                return res.json({ responses: responseMessages, sessionContext: ctx });
            }
            // Se já enviou saudação recentemente (ex: usuário disse "Tudo bem" logo após o "oi"),
            // ignora a saudação hardcoded e deixa a mensagem cair no fallback da IA (exatamente como no flow.ts).
        }

        // ── FALLBACK: IA COM FUNCTION CALLING ──
        const safeHistory = Array.isArray(history) ? history.map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content || ''
        })) : [];

        const result = await aiService.getAiResponseWithTools(message, TOOL_DEFINITIONS, safeHistory);

        if (result.text) {
            responseMessages.push({ type: 'text', content: result.text });
        }

        // Simula tools acionadas pela IA
        if (result.toolCalls && result.toolCalls.length > 0) {
            for (const tc of result.toolCalls) {
                if (tc.name === 'enviar_menu_principal') {
                    ctx = { categoryId: null, subcategoryId: null, subcategoryIndex: null };
                    const menu = buildMainMenu();
                    responseMessages.push({ type: 'text', content: menu.text, images: menu.images.length > 0 ? menu.images : undefined });
                } else if (tc.name === 'mostrar_categoria') {
                    const catName = tc.args.nome_categoria || '';
                    const cat = db.prepare('SELECT * FROM category WHERE LOWER(name) LIKE ?').get(`%${catName.toLowerCase()}%`) as any;
                    if (cat) {
                        ctx.categoryId = cat.id;
                        ctx.subcategoryId = null;
                        responseMessages.push({ type: 'text', content: buildSubcategories(cat.id) });
                    } else {
                        responseMessages.push({ type: 'text', content: `Não encontrei a categoria "${catName}".` });
                    }
                } else if (tc.name === 'mostrar_subcategoria') {
                    const subName = tc.args.nome_subcategoria || '';
                    const sub = db.prepare('SELECT s.* FROM subcategory s JOIN category c ON s.categoryId = c.id WHERE s.enabledInBot = 1 AND LOWER(s.name) LIKE ?').get(`%${subName.toLowerCase()}%`) as any;
                    if (sub) {
                        ctx.categoryId = sub.categoryId;
                        ctx.subcategoryId = sub.id;
                        responseMessages.push({ type: 'text', content: buildItems(sub.id) });
                    } else {
                        responseMessages.push({ type: 'text', content: `Não encontrei "${subName}".` });
                    }
                } else if (tc.name === 'mostrar_item') {
                    const itemName = tc.args.nome_item || '';
                    const item = db.prepare('SELECT * FROM item WHERE enabled = 1 AND LOWER(name) LIKE ?').get(`%${itemName.toLowerCase()}%`) as any;
                    if (item) {
                        const text = formatItemMessage(item);
                        const images = parseImageUrls(item.imageUrls);
                        responseMessages.push({ type: 'item', content: text, images: images.length > 0 ? images : undefined });
                    } else {
                        responseMessages.push({ type: 'text', content: `Não encontrei "${itemName}".` });
                    }
                } else if (tc.name === 'iniciar_formulario') {
                    responseMessages.push({ type: 'text', content: `[Simulação] Iniciando formulário *${tc.args.tipo}*.\n(No WhatsApp real, seria passo a passo.)` });
                } else if (tc.name === 'enviar_contato_humano') {
                    const config = db.prepare('SELECT contatoHumano FROM config WHERE id = 1').get() as any;
                    responseMessages.push({ type: 'text', content: `✅ Já notifiquei a equipe!\n\nContato: ${config?.contatoHumano || 'Não configurado'}` });
                } else if (tc.name === 'enviar_faq') {
                    const config = db.prepare('SELECT faqText FROM config WHERE id = 1').get() as any;
                    responseMessages.push({ type: 'text', content: `❓ *Dúvidas Frequentes*\n\n${config?.faqText || 'Nenhum FAQ.'}` });
                }
            }
        }

        if (responseMessages.length === 0) {
            responseMessages.push({ type: 'text', content: 'Desculpe, não entendi. Digite *MENU* para ver as opções.' });
        }

        res.json({ responses: responseMessages, sessionContext: ctx });
    } catch (err: any) {
        console.error('POST /ai-test error:', err);
        res.status(500).json({ error: err.message });
    }
}

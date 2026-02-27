/**
 * flow.ts — Handler principal do Bot (versão modular)
 * 
 * Responsabilidades:
 * 1. Receber mensagens do WhatsApp
 * 2. Rotear para o módulo correto com base no contexto
 * 3. Coordenar o fluxo entre Bot (URA) e Bot+IA
 * 
 * Módulos:
 * - dedup.ts           → Deduplicação de mensagens
 * - operatorCommands.ts → Comandos do operador (fromMe)
 * - menuNavigation.ts   → Menu, categorias, subcategorias, itens
 * - formHandler.ts      → Formulários interativos
 * - specialActions.ts   → FAQ, contato humano, notificações
 * - aiRouter.ts         → IA com Function Calling
 * - constants.ts        → Constantes, Tools, Prompts
 * - helpers.ts          → Funções utilitárias e estado em memória
 */

import { WAMessage } from '@whiskeysockets/baileys';
import db from '../infrastructure/database';
import eventBus from '../infrastructure/EventBus';

// Módulos
import { isDuplicateById, isDuplicateByText } from './modules/dedup';
import { handleOperatorMessage } from './modules/operatorCommands';
import { sendWelcome, sendMainMenu, handleMenuOption, handleSubCategoryOption, handleItemOption } from './modules/menuNavigation';
import { handleFormStep } from './modules/formHandler';
import { notifyOwner, createLeadTicket } from './modules/specialActions';
import { routeToAI } from './modules/aiRouter';
import { GREETING_PATTERNS, SESSION_TIMEOUT } from './modules/constants';
import {
    upsertContact, logMessage, sendAndLogText, addToHistory, parseMenuSelection,
    getPhoneFromJid, userFormStates, userCategoryContext, userSubcategoryContext,
    welcomedUsers, conversationHistory
} from './modules/helpers';

// Re-exportar para connection.ts
export { sendMainMenu } from './modules/menuNavigation';
export { userFormStates, userCategoryContext, userSubcategoryContext, conversationHistory, welcomedUsers } from './modules/helpers';

// ─── Variável de conexão ───
let currentSock: any = null;

export const reinitializeConnection = (sock: any) => {
    currentSock = sock;
    console.log("[Flow] Conexão reinicializada com novo socket.");
};

// ─── Handler Principal ───
export const handleMessage = async (msg: WAMessage, sock: any) => {
    currentSock = sock;
    const jid = msg.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;

    const msgId = msg.key.id || '';
    if (isDuplicateById(msgId)) return;

    // Extrair texto
    const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || msg.message?.videoMessage?.caption
        || '';
    if (!text) return;

    const name = msg.pushName || 'Cliente';
    const lower = text.toLowerCase().trim();
    const normalized = text.trim();

    console.log(`[Flow] 📥 Recebida mensagem de ${jid} (${name}): "${normalized}"`);

    if (isDuplicateByText(jid, lower)) return;

    // Emitir para o dashboard
    eventBus.emit('message.received', { jid, name, text: normalized, timestamp: new Date().toISOString() });

    // ─── 1. Mensagens do operador (fromMe) ───
    if (msg.key.fromMe) {
        await handleOperatorMessage(sock, jid, lower, normalized, name);
        return;
    }

    // ─── 2. Contato + Log ───
    let profilePicUrl: string | undefined;
    try { profilePicUrl = await sock.profilePictureUrl(jid, 'image'); } catch { }
    const contact = upsertContact(jid, name, profilePicUrl);
    const contactId = contact.id;
    logMessage(contactId, 'user', normalized);
    addToHistory(jid, 'user', normalized);

    // Verificar se o bot está pausado para este contato
    const contactData = db.prepare('SELECT botPaused FROM contact WHERE id = ?').get(contactId) as any;
    if (contactData?.botPaused === 1) {
        console.log(`[Flow] Bot pausado para ${jid}, ignorando...`);
        return;
    }

    // ─── Business Hours Check ───
    try {
        const bhConfig = db.prepare('SELECT businessHoursEnabled, businessHoursStart, businessHoursEnd, businessDays, outsideHoursMessage FROM config WHERE id = 1').get() as any;
        if (bhConfig?.businessHoursEnabled === 1) {
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const currentDay = now.getDay(); // 0=Sun, 1=Mon...
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const allowedDays = (bhConfig.businessDays || '1,2,3,4,5').split(',').map(Number);
            const startTime = bhConfig.businessHoursStart || '09:00';
            const endTime = bhConfig.businessHoursEnd || '18:00';

            if (!allowedDays.includes(currentDay) || currentTime < startTime || currentTime > endTime) {
                const msg = bhConfig.outsideHoursMessage || 'Nosso horário de atendimento é de segunda a sexta, das 09:00 às 18:00.';
                await sendAndLogText(sock, jid, contactId, msg);
                console.log(`[Flow] Fora do horário comercial para ${jid}`);
                return;
            }
        }
    } catch (e) { console.error('[Flow] Erro ao verificar horário comercial:', e); }

    // ─── 3. Cancelar formulário ───
    if (lower === 'cancelar' || lower === 'cancel') {
        if (userFormStates.has(jid)) {
            userFormStates.delete(jid);
            await sendAndLogText(sock, jid, contactId, '✅ Formulário cancelado. Digite *MENU* para ver as opções.');
            return;
        }
    }

    // ─── 4. Formulário em andamento ───
    if (userFormStates.has(jid)) {
        const state = userFormStates.get(jid)!;
        await handleFormStep(sock, jid, contactId, normalized, state);
        return;
    }

    // ─── 5. Voltar ───
    if (lower === 'voltar' || lower === 'back' || lower === 'v') {
        if (userSubcategoryContext.has(jid)) {
            const ctx = userSubcategoryContext.get(jid)!;
            userSubcategoryContext.delete(jid);
            userCategoryContext.set(jid, ctx.categoryId);
            const { displaySubcategories } = await import('./modules/menuNavigation');
            await displaySubcategories(sock, jid, ctx.categoryId, contactId);
            return;
        }
        if (userCategoryContext.has(jid)) {
            userCategoryContext.delete(jid);
            await sendMainMenu(sock, jid, name, contactId);
            return;
        }
        await sendMainMenu(sock, jid, name, contactId);
        return;
    }

    // ─── 6. Menu explícito ───
    if (lower === 'menu' || lower === 'inicio' || lower === 'início') {
        userCategoryContext.delete(jid);
        userSubcategoryContext.delete(jid);
        await sendMainMenu(sock, jid, name, contactId);
        return;
    }

    // ─── 7. Seleção numérica (contexto de subcategoria → item) ───
    if (userSubcategoryContext.has(jid)) {
        const subCtx = userSubcategoryContext.get(jid)!;
        const sel = parseMenuSelection(lower);
        if (sel.type === 'category') {
            await handleItemOption(sock, jid, subCtx.categoryId, subCtx.subcategoryIndex, sel.index, contactId);
            return;
        }
    }

    // ─── 8. Seleção numérica (contexto de categoria → subcategoria) ───
    if (userCategoryContext.has(jid)) {
        const catId = userCategoryContext.get(jid)!;
        const sel = parseMenuSelection(lower);
        if (sel.type === 'category') {
            await handleSubCategoryOption(sock, jid, catId, sel.index, contactId);
            return;
        }
    }

    // ─── 8.5. Seleção numérica (Menu Principal) ───
    if (!userCategoryContext.has(jid) && !userSubcategoryContext.has(jid)) {
        const sel = parseMenuSelection(lower);
        console.log(`[Flow] Menu Principal numérico: lower="${lower}" => parsed: `, sel);
        if (sel.type === 'category') {
            console.log(`[Flow] Acionando handleMenuOption para a opção ${sel.index}`);
            await handleMenuOption(sock, jid, sel.index, contactId);
            return;
        }
    }

    // ─── 9. Saudação (primeira interação) ───
    if (GREETING_PATTERNS.test(lower)) {
        const lastWelcome = welcomedUsers.get(jid) || 0;
        const now = Date.now();
        if (now - lastWelcome > SESSION_TIMEOUT) {
            welcomedUsers.set(jid, now);
            await sendWelcome(sock, jid, name, contactId);

            // Notificar lead na primeira interação
            const phone = getPhoneFromJid(jid);
            await notifyOwner(sock, 'lead', name, phone, profilePicUrl, `Nova conversa iniciada por ${name}`);
            createLeadTicket(contactId, 'lead', `Saudação: ${normalized}`);
            return;
        }
    }

    // ─── 10. Verificar palavras-chave de atendimento humano ───
    try {
        const config = db.prepare('SELECT humanKeywords, isAiEnabled FROM config WHERE id = 1').get() as any;
        const humanKeywords = config?.humanKeywords;
        if (humanKeywords) {
            const keywords = humanKeywords.split(',').map((k: string) => k.trim().toLowerCase());
            if (keywords.some((kw: string) => lower.includes(kw))) {
                const { sendHumanContact } = await import('./modules/specialActions');
                await sendHumanContact(sock, jid, contactId);
                return;
            }
        }

        // ─── 11. Modo BOT (URA) — IA desligada ───
        if (config?.isAiEnabled === 0) {
            await sendAndLogText(sock, jid, contactId, 'Desculpe, não entendi. Veja nossas opções:');
            await sendMainMenu(sock, jid, name, contactId);
            return;
        }
    } catch (e) {
        console.error("[Flow] Erro ao verificar config:", e);
    }

    // ─── 12. Modo BOT+IA — Function Calling ───
    try {
        await routeToAI(sock, jid, name, contactId, normalized);
    } catch (error) {
        console.error("[Flow] Erro na IA:", error);
        await sendAndLogText(sock, jid, contactId, 'Desculpe, tive um problema ao processar sua mensagem. Digite *MENU* para ver as opções.');
    }
};

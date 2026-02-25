import db from '../../infrastructure/database';
import aiService from '../../infrastructure/AiService';
import eventBus from '../../infrastructure/EventBus';
import { sendAndLogText, addToHistory, conversationHistory, userCategoryContext, userSubcategoryContext } from './helpers';
import { TOOL_DEFINITIONS, FORM_STEPS } from './constants';
import { sendMainMenu, displaySubcategories, sendItemWithImages, handleSubCategoryOption } from './menuNavigation';
import { startForm } from './formHandler';
import { handleDuvidas, sendHumanContact } from './specialActions';

// ─── Executor de Tools ───
const executeToolCall = async (
    toolName: string, args: Record<string, any>,
    sock: any, jid: string, name: string, contactId: number | null
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
                const cat = categories.find((c: any) => c.name.toLowerCase().includes(catName.toLowerCase()));
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

// ─── Rotear para IA com Function Calling ───
export const routeToAI = async (
    sock: any, jid: string, name: string, contactId: number | null, normalized: string
): Promise<void> => {
    console.log(`[Flow→AI] Enviando para IA: "${normalized}"`);
    eventBus.emit('bot.log', `[AI+Tools] Processing: ${normalized}`);
    const history = conversationHistory.get(jid) || [];

    const result = await aiService.getAiResponseWithTools(
        normalized,
        TOOL_DEFINITIONS,
        history.slice(0, -1)
    );

    console.log(`[Flow←AI] Resultado: text=${result.text ? `"${result.text.substring(0, 80)}..."` : 'null'}, tools=${result.toolCalls.length}`);

    // Se a IA escolheu executar tools
    if (result.toolCalls.length > 0) {
        if (result.text) {
            addToHistory(jid, 'assistant', result.text);
            await sendAndLogText(sock, jid, contactId, result.text);
        }
        for (const tc of result.toolCalls) {
            console.log(`[AI Tool] ${tc.name}(${JSON.stringify(tc.args)})`);
            const executed = await executeToolCall(tc.name, tc.args, sock, jid, name, contactId);
            if (!executed) {
                await sendAndLogText(sock, jid, contactId, `Desculpe, não consegui executar essa ação. Digite *MENU* para ver as opções.`);
            }
        }
        return;
    }

    // Se a IA respondeu com texto
    if (result.text) {
        addToHistory(jid, 'assistant', result.text);
        await sendAndLogText(sock, jid, contactId, result.text);
        return;
    }

    // Fallback
    await sendAndLogText(sock, jid, contactId, `Desculpe, não entendi. Digite *MENU* para ver as opções disponíveis.`);
};

import db from '../../infrastructure/database';
import {
    sendAndLogText, sendText, logMessage, addToHistory, getPhoneFromJid,
    isSpecialSubcategory, userCategoryContext, userSubcategoryContext
} from './helpers';
import { sendMainMenu, sendItemWithImages } from './menuNavigation';
import { startForm } from './formHandler';
import { handleDuvidas, sendHumanContact } from './specialActions';

// ─── Handler de Mensagens do Operador (fromMe) ───
export const handleOperatorMessage = async (
    sock: any, jid: string, lower: string, normalized: string, name: string
): Promise<boolean> => {
    const contact = db.prepare('SELECT id, botPaused FROM contact WHERE jid = ?').get(jid) as any;
    if (!contact) return true; // Sem contato, ignora

    const config = db.prepare('SELECT pauseCommands, resumeCommands, docCommands, menuCommands, docsMessage, docsFiles, notificationPhone, isAiEnabled FROM config WHERE id = 1').get() as any;

    const checkCommand = (commandsString: string) => {
        if (!commandsString) return false;
        const cmdList = commandsString.split(',').map(c => c.trim().toLowerCase());
        return cmdList.includes(lower);
    };

    // 1. Pausar IA
    if (checkCommand(config.pauseCommands)) {
        db.prepare('UPDATE contact SET botPaused = 1 WHERE id = ?').run(contact.id);
        console.log(`[Flow - Operador] IA Pausada secretamente via Comando! Cliente: ${jid}`);
        return true;
    }

    // 2. Retomar IA
    if (checkCommand(config.resumeCommands)) {
        db.prepare('UPDATE contact SET botPaused = 0 WHERE id = ?').run(contact.id);
        console.log(`[Flow - Operador] IA Retomada secretamente via Comando! Cliente: ${jid}`);
        return true;
    }

    // 3. Comandos Dinâmicos Customizados
    const customCommands = db.prepare('SELECT * FROM custom_command').all() as any[];
    let triggeredCustom = false;

    for (const cmd of customCommands) {
        if (checkCommand(cmd.triggers)) {
            if (cmd.isActive === 0) {
                console.log(`[Flow - Operador] Comando Dinâmico '${cmd.triggers}' Acionado, porém está marcado como INATIVO.`);
                return true;
            }

            triggeredCustom = true;
            console.log(`[Flow - Operador] Comando Dinâmico Acionado: ${cmd.triggers}`);

            // Envia texto
            if (cmd.textMessage) {
                await sendAndLogText(sock, jid, contact.id, cmd.textMessage);
            }

            // Envia Arquivos
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
                                await sock.sendMessage(jid, { document: buffer, mimetype, fileName: file.name });
                                console.log(`[Flow - Operador] Anexo '${file.name}' enviado!`);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[Flow - Operador] Erro ao enviar anexos do Comando:`, e);
                }
            }

            // Vínculo de Item
            if (cmd.linkedItemId) {
                const item = db.prepare('SELECT * FROM item WHERE id = ?').get(cmd.linkedItemId) as any;
                if (item) {
                    await sendItemWithImages(sock, jid, contact.id, item);
                    console.log(`[Flow - Operador] Relé disparou Card do Item: ${item.name}`);
                }
            }

            // Vínculo de Subcategoria
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
            break;
        }
    }

    if (triggeredCustom) return true;

    // 4. /listarcomandos
    if (lower === '/listarcomandos') {
        let report = `*⚡ Seus Comandos Invisíveis*\n\n`;
        report += `*Nativos:*\n`;
        report += `⏸️ Pausar IA: ${config.pauseCommands || 'Não conf.'}\n`;
        report += `▶️ Retomar IA: ${config.resumeCommands || 'Não conf.'}\n`;
        report += `📋 Mostrar Menu: ${config.menuCommands || 'Não conf.'}\n\n`;
        report += `*Atalhos Customizados (${customCommands.length}):*\n`;
        if (customCommands.length === 0) {
            report += `Nenhum atalho criado no painel ainda.`;
        } else {
            customCommands.forEach(cmd => {
                let fileCount = 0;
                try { if (cmd.fileData) { fileCount = JSON.parse(cmd.fileData).length; } } catch { }
                const activeIcon = cmd.isActive === 0 ? '🔴 (Inativo)' : '🟢';
                report += `📌 *${cmd.triggers}* ${activeIcon}\n`;
                report += `└ ${cmd.textMessage ? '📝 Tem texto' : '🚫 Sem texto'} | 📎 ${fileCount} arquivo(s)\n`;
            });
        }
        await sendAndLogText(sock, jid, contact.id, report);
        console.log(`[Flow - Operador] O Operador puxou a lista de comandos.`);
        return true;
    }

    // 5. Menu via comando
    if (checkCommand(config.menuCommands)) {
        userCategoryContext.delete(jid);
        userSubcategoryContext.delete(jid);
        await sendMainMenu(sock, jid, name, contact.id);
        console.log(`[Flow - Operador] Menu Injetado via Comando Direto!`);
        return true;
    }

    // Mensagem normal do operador (log only)
    logMessage(contact.id, 'assistant', normalized);
    addToHistory(jid, 'assistant', normalized);
    return true;
};

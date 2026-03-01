import db from '../../infrastructure/database';
import { getSock } from '../connection';
import { delay } from '@whiskeysockets/baileys';
import fs from 'fs';
import { sendItemWithImages } from './menuNavigation';
import { isSpecialSubcategory, userSubcategoryContext } from './helpers';
import { startForm } from './formHandler';
import { handleDuvidas, sendHumanContact } from './specialActions';

// Helper for random integer between min and max
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Ensure phone numbers are correctly formatted for WhatsApp
function formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return null; // Invalid
    if (clean.length === 10) clean = `55${clean}`; // Missing DDD and 9
    else if (clean.length === 11) clean = `55${clean}`; // BR format 55 + 11 digits
    else if (!clean.startsWith('55') && clean.length > 11) clean = `55${clean}`;
    return `${clean}@s.whatsapp.net`;
}

class MarketingWorker {
    private isProcessing = false;

    constructor() {
        // Run the worker loop every 10 seconds checking for eligible messages
        setInterval(() => this.processQueue(), 10000);
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const sock = getSock();
            if (!sock) return;

            // ─── Auto-iniciar campanhas agendadas cujo horário já chegou ───
            const scheduledCampaigns = db.prepare(
                "SELECT * FROM marketing_campaign WHERE status = 'scheduled' AND scheduledAt IS NOT NULL"
            ).all() as any[];

            for (const sc of scheduledCampaigns) {
                const scheduledTime = new Date(sc.scheduledAt).getTime();
                if (Date.now() >= scheduledTime) {
                    db.prepare("UPDATE marketing_campaign SET status = 'running' WHERE id = ?").run(sc.id);
                    console.log(`[Marketing] Campanha agendada #${sc.id} "${sc.name}" iniciada automaticamente`);
                }
            }

            // ─── Processar agendamentos múltiplos (marketing_schedule) ───
            const pendingSchedules = db.prepare(
                "SELECT s.*, t.name as templateName, t.messageContent, t.imagePath FROM marketing_schedule s LEFT JOIN marketing_template t ON s.templateId = t.id WHERE s.status = 'pending'"
            ).all() as any[];

            for (const sched of pendingSchedules) {
                // Montar datetime completo a partir de date + time
                const scheduledDateTime = new Date(`${sched.scheduledDate}T${sched.scheduledTime}`).getTime();
                if (Date.now() >= scheduledDateTime) {
                    try {
                        // Criar campanha real a partir do template
                        const phones: string[] = JSON.parse(sched.selectedPhones || '[]');
                        if (phones.length === 0 || !sched.messageContent) {
                            db.prepare("UPDATE marketing_schedule SET status = 'failed' WHERE id = ?").run(sched.id);
                            continue;
                        }

                        db.transaction(() => {
                            // 1. Criar a campanha
                            const result = db.prepare(
                                'INSERT INTO marketing_campaign (name, messageContent, imagePath, minDelay, maxDelay, status) VALUES (?, ?, ?, ?, ?, ?)'
                            ).run(
                                `[Agendado] ${sched.templateName || 'Sem nome'}`,
                                sched.messageContent,
                                sched.imagePath || null,
                                sched.minDelay || 30,
                                sched.maxDelay || 90,
                                'running' // Já inicia rodando
                            );
                            const campaignId = result.lastInsertRowid;

                            // 2. Enfileirar os telefones selecionados
                            const insertQueue = db.prepare('INSERT INTO marketing_queue (campaignId, phoneNumber, contactName, status) VALUES (?, ?, ?, ?)');
                            for (const phone of phones) {
                                insertQueue.run(campaignId, phone, null, 'pending');
                            }

                            // 3. Atualizar o schedule linkando à campanha criada
                            db.prepare("UPDATE marketing_schedule SET status = 'running', campaignId = ? WHERE id = ?").run(campaignId, sched.id);
                        })();

                        console.log(`[Marketing] Agendamento #${sched.id} executado → campanha criada com ${phones.length} contatos`);
                    } catch (err: any) {
                        console.error(`[Marketing] Falha ao processar agendamento #${sched.id}:`, err);
                        db.prepare("UPDATE marketing_schedule SET status = 'failed' WHERE id = ?").run(sched.id);
                    }
                }
            }

            // Find all running campaigns
            const runningCampaigns = db.prepare('SELECT * FROM marketing_campaign WHERE status = ?').all('running') as any[];

            // ─── Enforce: Não enviar fora do horário comercial (8h-20h) ───
            const currentHour = new Date().getHours();
            if (currentHour < 8 || currentHour >= 20) {
                // Fora do horário comercial — não processa envios
                return;
            }

            for (const campaign of runningCampaigns) {
                // Check when the last message was sent for this campaign
                const lastSent = db.prepare('SELECT sentAt FROM marketing_queue WHERE campaignId = ? AND status = ? ORDER BY sentAt DESC LIMIT 1').get(campaign.id, 'sent') as any;

                let timeSinceLastSendMs = Infinity;
                if (lastSent && lastSent.sentAt) {
                    timeSinceLastSendMs = Date.now() - new Date(lastSent.sentAt).getTime();
                }

                // If scheduledFor is not enforced per lead, we calculate the next allowed time based on random delay since lastSent
                // If it's the first message (timeSinceLastSendMs === Infinity), send immediately.

                let shouldSendNext = true;
                if (timeSinceLastSendMs !== Infinity) {
                    const minDelayMs = Math.max((campaign.minDelay || 30), 30) * 1000; // Enforce mín 30s anti-ban
                    const maxDelayMs = Math.max((campaign.maxDelay || 90), 30) * 1000;
                    const randomDelayMs = getRandomInt(minDelayMs, maxDelayMs);

                    if (timeSinceLastSendMs < randomDelayMs) {
                        shouldSendNext = false; // Still waiting for the random delay to elapse
                    }
                }

                if (shouldSendNext) {
                    // Pick the next pending lead
                    const nextLead = db.prepare('SELECT * FROM marketing_queue WHERE campaignId = ? AND status = ? ORDER BY id ASC LIMIT 1').get(campaign.id, 'pending') as any;

                    if (nextLead) {
                        const jid = formatPhoneNumber(nextLead.phoneNumber);

                        if (!jid) {
                            // Invalid phone number format
                            db.prepare('UPDATE marketing_queue SET status = ?, errorLog = ? WHERE id = ?').run('failed', 'Invalid phone format', nextLead.id);
                            continue;
                        }

                        // Prepare text (replace variables like {{nome}})
                        let textParams = campaign.messageContent;
                        if (nextLead.contactName) {
                            textParams = textParams.replace(/\{\{nome\}\}/gi, nextLead.contactName.split(' ')[0]);
                        } else {
                            // If no name, remove the variable gracefully or fallback
                            textParams = textParams.replace(/\{\{nome\}\}/gi, 'cliente');
                        }

                        // === Processamento de Comandos Dinâmicos ===
                        const customCommands = db.prepare('SELECT * FROM custom_command WHERE isActive = 1').all() as any[];
                        let attachedFiles: any[] = [];
                        let linkedItemIds: number[] = [];
                        let linkedSubcatIds: number[] = [];

                        for (const cmd of customCommands) {
                            if (!cmd.triggers) continue;
                            const triggers = cmd.triggers.split(',').map((t: string) => t.trim());
                            let triggered = false;

                            for (const t of triggers) {
                                if (textParams.includes(t)) {
                                    triggered = true;
                                    if (cmd.textMessage) {
                                        textParams = textParams.replace(t, cmd.textMessage);
                                    } else {
                                        textParams = textParams.replace(t, '');
                                    }
                                }
                            }

                            if (triggered) {
                                if (cmd.fileData) {
                                    try {
                                        const files = JSON.parse(cmd.fileData);
                                        attachedFiles.push(...files);
                                    } catch (e) { }
                                }
                                if (cmd.linkedItemId) linkedItemIds.push(cmd.linkedItemId);
                                if (cmd.linkedSubcategoryId) linkedSubcatIds.push(cmd.linkedSubcategoryId);
                            }
                        }
                        textParams = textParams.trim();

                        try {
                            // Build the message payload
                            const msgPayload: any = {};

                            if (campaign.imagePath && fs.existsSync(campaign.imagePath)) {
                                const ext = campaign.imagePath.split('.').pop()?.toLowerCase() || '';

                                if (['mp4', 'avi', 'mov'].includes(ext)) {
                                    msgPayload.video = { url: campaign.imagePath };
                                    msgPayload.caption = textParams;
                                } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
                                    msgPayload.document = { url: campaign.imagePath };
                                    msgPayload.fileName = campaign.imagePath.split(/[\/\\]/).pop() || 'Documento';
                                    msgPayload.mimetype = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
                                    msgPayload.caption = textParams;
                                } else {
                                    msgPayload.image = { url: campaign.imagePath };
                                    msgPayload.caption = textParams;
                                }
                            } else if (textParams.length > 0) {
                                msgPayload.text = textParams;
                            }

                            // Send presence update to simulate human
                            await sock.presenceSubscribe(jid);
                            await delay(500);
                            await sock.sendPresenceUpdate('composing', jid);
                            await delay(getRandomInt(1500, 3000));
                            await sock.sendPresenceUpdate('paused', jid);

                            // Dispatch main message only if it has content
                            if (Object.keys(msgPayload).length > 0) {
                                await sock.sendMessage(jid, msgPayload);
                                console.log(`[Marketing] Sent main message to ${jid} for campaign ${campaign.id}`);
                                await delay(1000);
                            }

                            // ===== Enviar anexos do comando dinâmico =====
                            if (attachedFiles.length > 0) {
                                for (const file of attachedFiles) {
                                    if (file.data) {
                                        const matches = file.data.match(/^data:(.+);base64,(.*)$/);
                                        if (matches && matches.length === 3) {
                                            const mimetype = matches[1];
                                            const base64Data = matches[2];
                                            const buffer = Buffer.from(base64Data, 'base64');
                                            await sock.sendMessage(jid, { document: buffer, mimetype, fileName: file.name });
                                            console.log(`[Marketing] Anexo de comando '${file.name}' enviado para ${jid}`);
                                            await delay(1000);
                                        }
                                    }
                                }
                            }

                            // Verifica contato para contexto do menu
                            const contactRecord = db.prepare('SELECT id FROM contact WHERE jid = ?').get(jid) as any;
                            const contactId = contactRecord ? contactRecord.id : null;

                            // ===== Enviar Item vinculado =====
                            for (const itemId of linkedItemIds) {
                                const item = db.prepare('SELECT * FROM item WHERE id = ?').get(itemId) as any;
                                if (item) {
                                    await sendItemWithImages(sock, jid, contactId, item);
                                    console.log(`[Marketing] Enviou Item: ${item.name} para ${jid}`);
                                    await delay(1000);
                                }
                            }

                            // ===== Enviar Subcategoria vinculada =====
                            for (const subId of linkedSubcatIds) {
                                const sub = db.prepare('SELECT * FROM subcategory WHERE id = ?').get(subId) as any;
                                if (sub) {
                                    const cat = db.prepare('SELECT name FROM category WHERE id = ?').get(sub.categoryId) as any;
                                    const specialType = isSpecialSubcategory(sub.name, cat?.name);

                                    if (specialType === 'simulacao' || specialType === 'corretor' || specialType === 'processos' || specialType === 'locacao') {
                                        await startForm(sock, jid, contactId, specialType);
                                    } else if (specialType === 'duvidas') {
                                        await handleDuvidas(sock, jid, contactId);
                                    } else if (specialType === 'contato') {
                                        await sendHumanContact(sock, jid, contactId);
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
                                            await sock.sendMessage(jid, { text: itemsText });
                                        } else {
                                            await sock.sendMessage(jid, { text: `📂 *${sub.name}*\n\nNenhum item cadastrado nesta subcategoria.\n\nDigite *VOLTAR* para voltar.` });
                                        }
                                    }
                                    console.log(`[Marketing] Enviou Lógica de Subcategoria: ${sub.name} para ${jid}`);
                                    await delay(1000);
                                }
                            }

                            // Update queue record
                            db.prepare('UPDATE marketing_queue SET status = ?, sentAt = ? WHERE id = ?').run('sent', new Date().toISOString(), nextLead.id);
                        } catch (err: any) {
                            console.error(`[Marketing] Failed to send message to ${jid}:`, err);
                            db.prepare('UPDATE marketing_queue SET status = ?, errorLog = ? WHERE id = ?').run('failed', err.message || 'Unknown error', nextLead.id);
                        }
                    } else {
                        // Queue empty for this campaign. Mark as completed.
                        db.prepare('UPDATE marketing_campaign SET status = ? WHERE id = ?').run('completed', campaign.id);
                        console.log(`[Marketing] Campaign ${campaign.id} completed.`);
                    }
                }
            }
        } catch (e) {
            console.error('[Marketing] Worker error:', e);
        } finally {
            this.isProcessing = false;
        }
    }
}

// Export singleton instance
export const marketingWorker = new MarketingWorker();

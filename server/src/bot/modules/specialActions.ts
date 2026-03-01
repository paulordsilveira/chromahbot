import db from '../../infrastructure/database';
import { sendAndLogText, getPhoneFromJid, logMessage } from './helpers';

// ─── Notificação ao dono ───
export const notifyOwner = async (sock: any, type: 'lead' | 'atendimento', contactName: string, contactPhone: string, profilePicUrl?: string, summary?: string) => {
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

        if (profilePicUrl) {
            try {
                await sock.sendMessage(ownerJid, { image: { url: profilePicUrl }, caption: msg });
                console.log(`[Notify] ${type} enviado COM FOTO para ${ownerPhone}: ${contactName}`);
                return;
            } catch (imgErr) {
                console.warn(`[Notify] Falha ao enviar foto, enviando como texto:`, imgErr);
            }
        }

        await sock.sendMessage(ownerJid, { text: msg });
        console.log(`[Notify] ${type} enviado para ${ownerPhone}: ${contactName}`);
    } catch (err) {
        console.error('[Notify] Erro ao notificar dono:', err);
    }
};

// ─── Lead Ticket (com deduplicação: não cria duplicata se já existe ticket aberto para o mesmo contato) ───
export const createLeadTicket = (contactId: number, type: 'lead' | 'atendimento', summary?: string) => {
    try {
        // Verificar se já existe ticket aberto (não Finalizado/closed) para este contato
        const existing = db.prepare(
            "SELECT id, summary FROM lead_ticket WHERE contactId = ? AND status NOT IN ('Finalizado', 'closed') ORDER BY notifiedAt DESC LIMIT 1"
        ).get(contactId) as any;

        if (existing) {
            // Ticket aberto já existe — atualizar summary com nova interação
            const updatedSummary = existing.summary
                ? `${existing.summary}\n---\n${summary || 'Nova interação'}`
                : summary || 'Nova interação';
            db.prepare('UPDATE lead_ticket SET summary = ?, notifiedAt = datetime(\'now\') WHERE id = ?')
                .run(updatedSummary, existing.id);
            console.log(`[LeadTicket] Interação adicionada ao ticket #${existing.id} (contactId: ${contactId})`);
        } else {
            // Nenhum ticket aberto — criar novo
            db.prepare('INSERT INTO lead_ticket (contactId, type, summary) VALUES (?, ?, ?)').run(contactId, type, summary || null);
            console.log(`[LeadTicket] Novo ticket criado para contactId: ${contactId}`);
        }
    } catch (err) {
        console.error('[LeadTicket] Erro ao criar/atualizar ticket:', err);
    }
};

// ─── Enviar Contato Humano ───
export const sendHumanContact = async (sock: any, jid: string, contactId: number | null) => {
    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        const contatoHumano = config?.contatoHumano;
        const atendimentoPhones = config?.atendimentoPhones;

        await sendAndLogText(sock, jid, contactId, '✅ Já notifiquei a equipe! Em instantes alguém vai falar com você. 😊');

        if (contatoHumano || atendimentoPhones) {
            let msg = 'Enquanto isso, aqui está o contato direto:\n';
            if (contatoHumano) msg += `${contatoHumano}\n`;
            if (atendimentoPhones) msg += `${atendimentoPhones}\n`;
            await sendAndLogText(sock, jid, contactId, msg.trim());
        }

        const phone = getPhoneFromJid(jid);
        const contact = db.prepare('SELECT * FROM contact WHERE jid = ?').get(jid) as any;
        const contactName = contact?.name || 'Cliente';

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

// ─── FAQ (Dúvidas Frequentes) ───
export const handleDuvidas = async (sock: any, jid: string, contactId: number | null) => {
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

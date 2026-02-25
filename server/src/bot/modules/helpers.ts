import db from '../../infrastructure/database';
import { MAX_HISTORY } from './constants';

// ─── Estado em memória ───
import { FormState } from './constants';

export const userFormStates = new Map<string, FormState>();
export const userCategoryContext = new Map<string, number>();
export const userSubcategoryContext = new Map<string, { categoryId: number; subcategoryIndex: number }>();
export const welcomedUsers = new Map<string, number>();
export const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();

// ─── Funções de envio ───
export const sendText = async (sock: any, jid: string, text: string) => {
    await sock.sendMessage(jid, { text });
};

export const getPhoneFromJid = (jid: string) => {
    const base = jid.split('@')[0] ?? jid;
    return base.replace(/\D/g, '') || base;
};

export const upsertContact = (jid: string, name: string, profilePicUrl?: string): { id: number; jid: string; name: string } => {
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

export const logMessage = (contactId: number | null, role: 'user' | 'assistant' | 'system', content: string) => {
    if (contactId) {
        db.prepare('INSERT INTO message_log (contactId, content, role) VALUES (?, ?, ?)').run(contactId, content, role);
    }
};

export const sendAndLogText = async (sock: any, jid: string, contactId: number | null, text: string) => {
    await sendText(sock, jid, text);
    await logMessage(contactId, 'assistant', text);
};

export function addToHistory(jid: string, role: 'user' | 'assistant', content: string) {
    if (!conversationHistory.has(jid)) conversationHistory.set(jid, []);
    const hist = conversationHistory.get(jid)!;
    hist.push({ role, content });
    if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
}

export const parseMenuSelection = (raw: string) => {
    const trimmed = raw.trim();
    const catMatch = trimmed.match(/^(\d+)$/);
    if (catMatch) {
        return { type: 'category' as const, index: Number(catMatch[1]) };
    }
    return { type: 'none' as const };
};

export const getNumberEmoji = (num: number): string => {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    if (num >= 0 && num <= 9) return emojis[num];
    return `*${num}*`;
};

export const getCategoryDefaultEmoji = (name: string): string => {
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

export const isSpecialSubcategory = (subName: string, categoryName?: string): 'simulacao' | 'corretor' | 'processos' | 'duvidas' | 'locacao' | 'contato' | null => {
    const lowerSub = subName.toLowerCase();
    const lowerCat = categoryName ? categoryName.toLowerCase() : '';

    if (lowerSub.includes('simulação') || lowerSub.includes('simulacao') || lowerCat.includes('simulação') || lowerCat.includes('simulacao')) return 'simulacao';
    if (lowerSub.includes('corretor') || lowerSub.includes('cadastro de corretor') || lowerCat.includes('corretor')) return 'corretor';
    if (lowerSub.includes('processo') || lowerCat.includes('processo')) return 'processos';
    if (lowerSub.includes('dúvida') || lowerSub.includes('duvida') || lowerCat.includes('dúvida') || lowerCat.includes('duvida')) return 'duvidas';
    if (lowerSub.includes('falar com') || lowerCat.includes('falar com')) return 'contato';

    if ((lowerSub.includes('cadastro') && (lowerSub.includes('locação') || lowerSub.includes('locacao') || lowerSub.includes('venda'))) ||
        (lowerCat.includes('cadastro') && (lowerCat.includes('locação') || lowerCat.includes('locacao') || lowerCat.includes('venda')))) {
        return 'locacao';
    }
    return null;
};

import { DEDUP_TTL, TEXT_DEDUP_TTL } from './constants';

const processedMessages = new Map<string, number>();
const processedTexts = new Map<string, number>();

// Limpar mensagens expiradas periodicamente
setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of processedMessages) {
        if (now - ts > DEDUP_TTL) processedMessages.delete(key);
    }
    for (const [key, ts] of processedTexts) {
        if (now - ts > TEXT_DEDUP_TTL) processedTexts.delete(key);
    }
}, 30_000);

export const isDuplicateById = (msgId: string): boolean => {
    if (processedMessages.has(msgId)) return true;
    processedMessages.set(msgId, Date.now());
    return false;
};

export const isDuplicateByText = (jid: string, text: string): boolean => {
    const trimmed = text.toLowerCase().trim();

    // Seleções numéricas de menu (1-9) nunca são deduplicadas — o usuário
    // pode enviar "1" para selecionar a categoria e logo depois "1" de novo
    // para selecionar a subcategoria. Isso é legítimo e não deve ser filtrado.
    if (/^\d+$/.test(trimmed)) return false;

    const textKey = `${jid}:${trimmed}`;
    if (processedTexts.has(textKey)) return true;
    processedTexts.set(textKey, Date.now());
    return false;
};

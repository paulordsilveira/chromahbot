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
    const textKey = `${jid}:${text.toLowerCase().trim()}`;
    if (processedTexts.has(textKey)) return true;
    processedTexts.set(textKey, Date.now());
    return false;
};

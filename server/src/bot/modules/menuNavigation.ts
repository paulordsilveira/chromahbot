import db from '../../infrastructure/database';
import {
    sendAndLogText, sendText, logMessage, getNumberEmoji,
    getCategoryDefaultEmoji, isSpecialSubcategory,
    userCategoryContext, userSubcategoryContext, parseImageUrls
} from './helpers';
import { startForm } from './formHandler';
import { handleDuvidas, sendHumanContact } from './specialActions';

// ─── Welcome (mensagem de boas-vindas + logo) ───
export const sendWelcome = async (sock: any, jid: string, name: string, contactId: number | null) => {
    let welcomeMsg = '';
    let logoImage: string | null = null;

    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        if (config?.welcomeMessage) welcomeMsg = config.welcomeMessage;
        if (config?.logoImage) logoImage = config.logoImage;
    } catch (e) {
        console.error('[Flow] DB Error (welcome):', e);
    }

    const text = welcomeMsg || `Olá, ${name}! Tudo bem? Em que posso te ajudar? 😊`;

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

// ─── Menu Principal ───
export const sendMainMenu = async (sock: any, jid: string, name: string, contactId: number | null) => {
    let categories: any[] = [];
    let logoImage: string | null = null;
    let assistantName: string | null = null;

    try {
        categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
        const config = db.prepare('SELECT logoImage, assistantName FROM config WHERE id = 1').get() as any;
        if (config?.logoImage) logoImage = config.logoImage;
        if (config?.assistantName) assistantName = config.assistantName;
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
    if (assistantName) {
        menuText += `\nOu digite "${assistantName}" para voltar a falar com assistente.`;
    }

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

// ─── Display Subcategorias ───
export const displaySubcategories = async (sock: any, jid: string, categoryId: number, contactId: number | null) => {
    const category = db.prepare('SELECT * FROM category WHERE id = ?').get(categoryId) as any;
    const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(categoryId) as any[];

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

// ─── Handle Menu Option ───
// Processa a seleção numérica do Menu Principal, buscando a categoria pelo índice.
export const handleMenuOption = async (sock: any, jid: string, index: number, contactId: number | null) => {
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

// ─── Handle SubCategory Option ───
export const handleSubCategoryOption = async (sock: any, jid: string, categoryId: number, subIndex: number, contactId: number | null) => {
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

// ─── Handle Item Option ───
export const handleItemOption = async (sock: any, jid: string, categoryId: number, subcategoryIndex: number, itemIndex: number, contactId: number | null) => {
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

// ─── Enviar Item com Imagens/Documentos/Vídeos ───
export const sendItemWithImages = async (sock: any, jid: string, contactId: number | null, item: any) => {
    // Enviar imagens usando parseImageUrls (suporta JSON e newline)
    const images = parseImageUrls(item.imageUrls);
    for (let i = 0; i < images.length && i < 10; i++) {
        try {
            const imgUrl = images[i];
            if (imgUrl.startsWith('data:')) {
                // Imagem em Base64
                const base64Data = imgUrl.split(',')[1];
                const mimeType = imgUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                await sock.sendMessage(jid, { image: Buffer.from(base64Data, 'base64'), mimetype: mimeType });
            } else if (imgUrl.startsWith('http')) {
                // Imagem por URL
                await sock.sendMessage(jid, { image: { url: imgUrl } });
            }
        } catch (imgErr) {
            console.error(`Error sending image ${i + 1}:`, imgErr);
        }
    }

    // Enviar documentos
    if (item.documentUrls) {
        const docs = item.documentUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < docs.length && i < 5; i++) {
            try {
                const docUrl = docs[i].trim();
                if (docUrl.startsWith('data:')) {
                    const base64Data = docUrl.split(',')[1];
                    const mimeType = docUrl.split(';')[0].split(':')[1] || 'application/pdf';
                    const extMap: Record<string, string> = {
                        'application/pdf': '.pdf', 'application/msword': '.doc',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                        'application/vnd.ms-excel': '.xls',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                        'text/plain': '.txt', 'text/html': '.html',
                    };
                    const ext = extMap[mimeType] || '.pdf';
                    const fileName = `${item.name || 'Documento'}_${i + 1}${ext}`;
                    await sock.sendMessage(jid, { document: Buffer.from(base64Data, 'base64'), mimetype: mimeType, fileName });
                } else if (docUrl.startsWith('http')) {
                    await sock.sendMessage(jid, { document: { url: docUrl }, mimetype: 'application/pdf', fileName: docUrl.split('/').pop() || 'documento.pdf' });
                }
            } catch (docErr) {
                console.error(`Error sending document ${i + 1}:`, docErr);
            }
        }
    }

    // Enviar vídeos
    if (item.videoUrls) {
        const videos = item.videoUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < videos.length && i < 2; i++) {
            try {
                const vidUrl = videos[i].trim();
                if (vidUrl.startsWith('data:')) {
                    const base64Data = vidUrl.split(',')[1];
                    const mimeType = vidUrl.split(';')[0].split(':')[1] || 'video/mp4';
                    await sock.sendMessage(jid, { video: Buffer.from(base64Data, 'base64'), mimetype: mimeType });
                } else if (vidUrl.startsWith('http')) {
                    await sock.sendMessage(jid, { video: { url: vidUrl } });
                }
            } catch (vidErr) {
                console.error(`Error sending video ${i + 1}:`, vidErr);
            }
        }
    }

    // Enviar texto
    const text = formatItemMessage(item);
    await sendAndLogText(sock, jid, contactId, text);
};

/**
 * Formata a mensagem de texto de um item para exibição no WhatsApp.
 * Exportada para que possa ser reutilizada no endpoint /ai-test do Treinar IA.
 */
export const formatItemMessage = (item: any) => {
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

import { WAMessage } from '@whiskeysockets/baileys';
import eventBus from '../infrastructure/EventBus';
import db from '../infrastructure/database';

const sendText = async (sock: any, jid: string, text: string) => {
    await sock.sendMessage(jid, { text });
};

const getPhoneFromJid = (jid: string) => {
    const base = jid.split('@')[0] ?? jid;
    return base.replace(/\D/g, '') || base;
};

interface FormState {
    type: 'simulacao' | 'corretor' | 'processos' | 'locacao';
    step: number;
    data: Record<string, string>;
}

const userFormStates = new Map<string, FormState>();
const userCategoryContext = new Map<string, number>();
const userSubcategoryContext = new Map<string, { categoryOrder: number; subcategoryIndex: number }>();

const FORM_STEPS = {
    simulacao: ['nome', 'contato', 'cpf', 'endereco', 'renda', 'ocupacao'],
    corretor: ['nome', 'contato', 'tem_imobiliaria', 'nome_imobiliaria'],
    processos: ['cpf', 'nome_confirmacao'],
    locacao: ['nome', 'contato', 'email', 'endereco', 'localizacao'],
};

const FORM_PROMPTS = {
    simulacao: {
        nome: '📝 *Simulação MCMV*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        cpf: 'Informe seu *CPF*:',
        endereco: 'Informe seu *endereço completo*:',
        renda: 'Informe sua *renda mensal* (ex: R$ 3.000,00):',
        ocupacao: 'Informe sua *ocupação/profissão*:',
    },
    corretor: {
        nome: '📝 *Cadastro de Corretor Parceiro*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        tem_imobiliaria: 'Possui *imobiliária*? Digite *SIM* ou *NÃO*:',
        nome_imobiliaria: 'Qual o *nome da imobiliária*?',
    },
    processos: {
        cpf: '🔍 *Consulta de Processos*\n\nPor favor, informe seu *CPF*:',
        nome_confirmacao: 'Para confirmar, informe seu *nome completo*:',
    },
    locacao: {
        nome: '🏠 *Cadastro de Locação/Venda*\n\nPor favor, informe seu *nome ou empresa*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        email: 'Informe seu *e-mail*:',
        endereco: 'Informe o *endereço completo* do imóvel:',
        localizacao: 'Informe o *link de localização* (Google Maps) ou digite "pular":',
    },
};

const upsertContact = (jid: string, name: string, profilePicUrl?: string): { id: number; jid: string; name: string } => {
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

const logMessage = (contactId: number | null, role: 'user' | 'assistant' | 'system', content: string) => {
    if (contactId) {
        db.prepare('INSERT INTO message_log (contactId, content, role) VALUES (?, ?, ?)').run(contactId, content, role);
    }
};

const sendAndLogText = async (sock: any, jid: string, contactId: number | null, text: string) => {
    await sendText(sock, jid, text);
    await logMessage(contactId, 'assistant', text);
};

const parseMenuSelection = (raw: string) => {
    const trimmed = raw.trim();
    const subMatch = trimmed.match(/^(\d+)\.(\d+)$/);
    if (subMatch) {
        return {
            type: 'subcategory' as const,
            categoryOrder: Number(subMatch[1]),
            subOrder: Number(subMatch[2])
        };
    }

    const catMatch = trimmed.match(/^(\d+)$/);
    if (catMatch) {
        return { type: 'category' as const, categoryOrder: Number(catMatch[1]) };
    }

    return { type: 'none' as const };
};

const formatSubCategoryMessage = (sub: any) => {
    let out = `📌 *${sub.title || sub.name}*\n\n`;

    if (sub.text) {
        out += `${sub.text}\n\n`;
    } else if (sub.description) {
        out += `${sub.description}\n\n`;
    }

    if (typeof sub.price === 'number') {
        out += `Valor: ${sub.price}\n`;
    }

    const links: Array<{ label: string; value?: string | null }> = [
        { label: 'Localização', value: sub.locationLink },
        { label: 'Contato', value: sub.contactLink },
        { label: 'Página', value: sub.webLink }
    ];

    for (const link of links) {
        if (link.value) {
            out += `${link.label}: ${link.value}\n`;
        }
    }

    if (sub.imageUrls) {
        out += `\nImagens: ${sub.imageUrls}`;
    }

    return out.trim();
};

// Main Flow Handler
export const handleMessage = async (msg: WAMessage, sock: any) => {
    if (!msg.key.remoteJid || !msg.message) return;

    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const name = msg.pushName || "Cliente";

    console.log(`Received from ${jid}: ${text}`);

    try {
        const normalized = text.trim();
        const lower = normalized.toLowerCase();

        let profilePicUrl: string | undefined;
        try {
            profilePicUrl = await sock.profilePictureUrl(jid, 'image');
        } catch (e) {
            // User may not have a profile picture
        }

        const contact = upsertContact(jid, name, profilePicUrl);
        logMessage(contact.id, 'user', normalized);

        if (lower === 'menu' || lower === 'oi' || lower === 'olá' || lower === 'ola' || lower === 'inicio' || lower === 'início' || lower === 'cancelar') {
            userFormStates.delete(jid);
            userCategoryContext.delete(jid);
            userSubcategoryContext.delete(jid);
            await sendMainMenu(sock, jid, name, contact.id);
            return;
        }

        if (lower === 'voltar') {
            userFormStates.delete(jid);
            if (userSubcategoryContext.has(jid)) {
                const ctx = userSubcategoryContext.get(jid)!;
                userSubcategoryContext.delete(jid);
                userCategoryContext.set(jid, ctx.categoryOrder);
                await handleMenuOption(sock, jid, ctx.categoryOrder, contact.id);
                return;
            }
            userCategoryContext.delete(jid);
            await sendMainMenu(sock, jid, name, contact.id);
            return;
        }

        if (lower === 'contato') {
            await sendHumanContact(sock, jid, contact.id);
            return;
        }

        const formState = userFormStates.get(jid);
        if (formState) {
            await handleFormStep(sock, jid, contact.id, normalized, formState);
            return;
        }

        const selection = parseMenuSelection(normalized);
        console.log(`Selection parsed:`, selection, `| subContext:`, userSubcategoryContext.get(jid), `| catContext:`, userCategoryContext.get(jid));
        if (selection.type === 'category') {
            const subContext = userSubcategoryContext.get(jid);
            if (subContext) {
                console.log(`Calling handleItemOption with subContext:`, subContext);
                await handleItemOption(sock, jid, subContext.categoryOrder, subContext.subcategoryIndex, selection.categoryOrder, contact.id);
                return;
            }
            const categoryContext = userCategoryContext.get(jid);
            if (categoryContext) {
                await handleSubCategoryOption(sock, jid, categoryContext, selection.categoryOrder, contact.id);
            } else {
                await handleMenuOption(sock, jid, selection.categoryOrder, contact.id);
            }
            return;
        }

        eventBus.emit('bot.log', `AI processing for: ${normalized}`);
        await sendAndLogText(sock, jid, contact.id, `Você disse: "${normalized}". \n\nDigite *MENU* para ver as opções.`);
    } catch (error) {
        console.error("Error in handler:", error);
    }
};

const sendMainMenu = async (sock: any, jid: string, name: string, contactId: number | null) => {
    let customMessage = '';
    let categories: any[] = [];
    let logoImage: string | null = null;

    try {
        categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        if (config?.welcomeMessage) customMessage = config.welcomeMessage;
        if (config?.logoImage) logoImage = config.logoImage;
    } catch (e) {
        console.error("DB Error:", e);
    }

    let menuText = `👋 Olá *${name}*! Sou o *Assistente Corretando*. ${customMessage}\n\n`;
    menuText += `📋 *MENU PRINCIPAL*\n`;
    menuText += `──────────────────\n`;

    categories.forEach((cat: any, idx: number) => {
        const emoji = cat.emoji || getCategoryDefaultEmoji(cat.name);
        menuText += `${getNumberEmoji(cat.order)} ${emoji} ${cat.name}\n`;
    });

    menuText += `──────────────────\n`;
    menuText += `ℹ️ Digite o *número* da opção desejada.`;

    // Send logo image if configured
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

const getNumberEmoji = (num: number): string => {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    if (num >= 0 && num <= 9) return emojis[num];
    return `*${num}*`;
};

const getCategoryDefaultEmoji = (name: string): string => {
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

const handleMenuOption = async (sock: any, jid: string, option: number, contactId: number | null) => {
    try {
        const category = db.prepare('SELECT * FROM category WHERE "order" = ?').get(option) as any;
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Opção inválida. Digite *MENU* para voltar.");
            return;
        }

        const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(category.id) as any[];

        userCategoryContext.set(jid, option);

        const catEmoji = category.emoji || '📂';
        let catText = `${catEmoji} *${category.name}*\n`;
        catText += `──────────────────\n`;
        if (subcategories.length > 0) {
            subcategories.forEach((sub: any, index: number) => {
                const subEmoji = sub.emoji || '▸';
                catText += `${getNumberEmoji(index + 1)} ${subEmoji} ${sub.name}\n`;
            });
            catText += `──────────────────\n`;
            catText += `↩️ Digite *VOLTAR* para o menu.`;
        } else {
            catText += `Em breve mais opções aqui!\n\nDigite *VOLTAR* para o menu.`;
        }
        await sendAndLogText(sock, jid, contactId, catText);
    } catch (e) {
        console.error("DB Error:", e);
        await sendAndLogText(sock, jid, contactId, "❌ Erro ao buscar categoria. Digite *MENU* para voltar.");
    }
};

const handleSubCategoryOption = async (sock: any, jid: string, categoryOrder: number, subIndex: number, contactId: number | null) => {
    try {
        const category = db.prepare('SELECT * FROM category WHERE "order" = ?').get(categoryOrder) as any;
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Categoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(category.id) as any[];
        const sub = subcategories[subIndex - 1];
        
        if (!sub) {
            await sendAndLogText(sock, jid, contactId, "❌ Subcategoria inválida. Digite *VOLTAR* para voltar.");
            return;
        }

        userCategoryContext.delete(jid);

        const specialType = isSpecialSubcategory(sub.name);
        if (specialType === 'simulacao' || specialType === 'corretor' || specialType === 'processos' || specialType === 'locacao') {
            await startForm(sock, jid, contactId, specialType);
            return;
        }
        if (specialType === 'duvidas') {
            await handleDuvidas(sock, jid, contactId);
            return;
        }

        const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
        console.log(`handleSubCategoryOption: Found ${items.length} items for sub ${sub.id}`);
        if (items.length > 0) {
            userSubcategoryContext.set(jid, { categoryOrder, subcategoryIndex: subIndex });
            console.log(`Set subContext for ${jid}:`, { categoryOrder, subcategoryIndex: subIndex });
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

const handleItemOption = async (sock: any, jid: string, categoryOrder: number, subcategoryIndex: number, itemIndex: number, contactId: number | null) => {
    try {
        console.log(`handleItemOption called: categoryOrder=${categoryOrder}, subcategoryIndex=${subcategoryIndex}, itemIndex=${itemIndex}`);
        
        const category = db.prepare('SELECT * FROM category WHERE "order" = ?').get(categoryOrder) as any;
        console.log(`Category found:`, category);
        if (!category) {
            await sendAndLogText(sock, jid, contactId, "❌ Categoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const subcategories = db.prepare('SELECT * FROM subcategory WHERE categoryId = ? AND enabledInBot = 1 ORDER BY "order" ASC').all(category.id) as any[];
        console.log(`Subcategories found: ${subcategories.length}`, subcategories.map((s: any) => ({ id: s.id, name: s.name, order: s.order })));
        const sub = subcategories[subcategoryIndex - 1];
        console.log(`Selected sub (index ${subcategoryIndex - 1}):`, sub);
        if (!sub) {
            await sendAndLogText(sock, jid, contactId, "❌ Subcategoria inválida. Digite *MENU* para voltar.");
            return;
        }

        const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? AND enabled = 1 ORDER BY id ASC').all(sub.id) as any[];
        console.log(`Items found for subcategory ${sub.id}: ${items.length}`, items.map((i: any) => ({ id: i.id, name: i.name, enabled: i.enabled })));
        const item = items[itemIndex - 1];
        console.log(`Selected item (index ${itemIndex - 1}):`, item);
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

const sendItemWithImages = async (sock: any, jid: string, contactId: number | null, item: any) => {
    // Enviar imagens primeiro (se existirem)
    if (item.imageUrls) {
        const images = item.imageUrls.split('\n').filter((url: string) => url.trim());
        for (let i = 0; i < images.length && i < 10; i++) {
            try {
                const imgUrl = images[i].trim();
                if (imgUrl.startsWith('data:')) {
                    // Base64 image
                    const base64Data = imgUrl.split(',')[1];
                    const mimeType = imgUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                    await sock.sendMessage(jid, {
                        image: Buffer.from(base64Data, 'base64'),
                        mimetype: mimeType
                    });
                } else if (imgUrl.startsWith('http')) {
                    // URL image
                    await sock.sendMessage(jid, { image: { url: imgUrl } });
                }
            } catch (imgErr) {
                console.error(`Error sending image ${i + 1}:`, imgErr);
            }
        }
    }

    // Enviar texto com informações
    const text = formatItemMessage(item);
    await sendAndLogText(sock, jid, contactId, text);
};

const formatItemMessage = (item: any) => {
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

const sendHumanContact = async (sock: any, jid: string, contactId: number | null) => {
    try {
        const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
        const contatoHumano = config?.contatoHumano;
        const atendimentoPhones = config?.atendimentoPhones;

        if (contatoHumano || atendimentoPhones) {
            let msg = 'Contato do atendimento:\n';
            if (contatoHumano) msg += `${contatoHumano}\n`;
            if (atendimentoPhones) msg += `${atendimentoPhones}\n`;
            await sendAndLogText(sock, jid, contactId, msg.trim());
            return;
        }

        await sendAndLogText(sock, jid, contactId, 'No momento não há contato configurado.');
    } catch (e) {
        console.error('Error reading config:', e);
        await sendAndLogText(sock, jid, contactId, 'No momento não há contato configurado.');
    }
};

const startForm = async (sock: any, jid: string, contactId: number | null, formType: 'simulacao' | 'corretor' | 'processos' | 'locacao') => {
    const steps = FORM_STEPS[formType];
    const firstStep = steps[0];
    const prompts = FORM_PROMPTS[formType] as Record<string, string>;

    userFormStates.set(jid, { type: formType, step: 0, data: {} });
    await sendAndLogText(sock, jid, contactId, prompts[firstStep]);
};

const handleFormStep = async (sock: any, jid: string, contactId: number | null, input: string, state: FormState) => {
    const steps = FORM_STEPS[state.type];
    const currentField = steps[state.step];
    const prompts = FORM_PROMPTS[state.type] as Record<string, string>;

    state.data[currentField] = input;
    state.step++;

    // Corretor form: skip nome_imobiliaria if user answered "não" to tem_imobiliaria
    if (state.type === 'corretor' && currentField === 'tem_imobiliaria') {
        const answer = input.toLowerCase().trim();
        if (answer === 'não' || answer === 'nao' || answer === 'n') {
            state.data['nome_imobiliaria'] = 'Não possui';
            state.step++; // Skip nome_imobiliaria step
        }
    }

    if (state.step >= steps.length) {
        userFormStates.delete(jid);
        await completeForm(sock, jid, contactId, state);
        return;
    }

    const nextField = steps[state.step];
    await sendAndLogText(sock, jid, contactId, prompts[nextField]);
};

const completeForm = async (sock: any, jid: string, contactId: number | null, state: FormState) => {
    if (state.type === 'simulacao') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'simulacao',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                cpf: state.data.cpf,
                endereco: state.data.endereco,
                renda: state.data.renda,
                ocupacao: state.data.ocupacao,
            })
        );
        await sendAndLogText(sock, jid, contactId, 
            `✅ *Simulação registrada com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• CPF: ${state.data.cpf}\n` +
            `• Endereço: ${state.data.endereco}\n` +
            `• Renda: ${state.data.renda}\n` +
            `• Ocupação: ${state.data.ocupacao}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'corretor') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_corretor',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                tem_imobiliaria: state.data.tem_imobiliaria,
                nome_imobiliaria: state.data.nome_imobiliaria,
            })
        );
        const imobInfo = state.data.nome_imobiliaria === 'Não possui' 
            ? 'Não' 
            : `Sim - ${state.data.nome_imobiliaria}`;
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Corretor realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• Imobiliária: ${imobInfo}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'locacao') {
        const locValue = state.data.localizacao?.toLowerCase() === 'pular' ? '' : state.data.localizacao;
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_locacao',
            JSON.stringify({
                nome: state.data.nome,
                contato: state.data.contato,
                email: state.data.email,
                endereco: state.data.endereco,
                localizacao: locValue,
            })
        );
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Locação/Venda realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome/Empresa: ${state.data.nome}\n` +
            `• Contato: ${state.data.contato}\n` +
            `• E-mail: ${state.data.email}\n` +
            `• Endereço: ${state.data.endereco}\n` +
            (locValue ? `• Localização: ${locValue}\n` : '') +
            `\nEm breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'processos') {
        const cpf = state.data.cpf?.replace(/\D/g, '');
        const nomeConfirmacao = state.data.nome_confirmacao?.toLowerCase();

        const forms = db.prepare(`SELECT * FROM form WHERE type = 'atendimento_interno'`).all() as any[];
        let found: any = null;

        for (const f of forms) {
            try {
                const parsed = JSON.parse(f.data || '{}');
                const parsedCpf = (parsed.cpf || '').replace(/\D/g, '');
                if (parsedCpf === cpf && parsed.nome?.toLowerCase().includes(nomeConfirmacao)) {
                    found = parsed;
                    break;
                }
            } catch {}
        }

        if (found) {
            // Mapear status para label legível
            const STATUS_LABELS: Record<string, string> = {
                'atendido': '🔵 Atendido',
                'cadastrado': '🔷 Cadastrado',
                'em_negociacao': '🟡 Em negociação',
                'locado': '🟣 Locado',
                'finalizado': '⚫ Finalizado',
                'contrato_elaborado': '🔮 Contrato Elaborado',
                'pendente': '🟠 Pendente',
                'pago': '🟢 Pago',
                'concluido': '✅ Concluído',
            };
            
            const statusLabel = STATUS_LABELS[found.statusAtual] || found.statusAtual || 'Não definido';
            
            let message = `📂 *Consulta de Processo*\n\n`;
            message += `👤 *Nome:* ${found.nome || '-'}\n`;
            message += `📱 *Contato:* ${found.contato || '-'}\n`;
            message += `📧 *E-mail:* ${found.email || '-'}\n`;
            if (found.rg) message += `🪪 *RG:* ${found.rg}\n`;
            if (found.ocupacao) message += `💼 *Ocupação:* ${found.ocupacao}\n`;
            if (found.renda) message += `� *Renda:* ${found.renda}\n`;
            if (found.endereco) message += `🏠 *Endereço:* ${found.endereco}\n`;
            message += `\n📊 *Status Atual:* ${statusLabel}\n`;
            
            if (found.processos) {
                message += `\n📋 *Processos:*\n${found.processos}\n`;
            }
            
            // Última atualização de status
            if (found.statusHistorico && found.statusHistorico.length > 0) {
                const ultimo = found.statusHistorico[found.statusHistorico.length - 1];
                const dataUltimo = new Date(ultimo.data).toLocaleDateString('pt-BR');
                message += `\n🕐 *Última atualização:* ${dataUltimo}`;
                if (ultimo.info) message += `\n📝 *Info:* ${ultimo.info}`;
            }
            
            message += `\n\nDigite *MENU* para voltar.`;
            
            await sendAndLogText(sock, jid, contactId, message);
        } else {
            await sendAndLogText(sock, jid, contactId,
                `❌ Nenhum processo encontrado para o CPF informado.\n\n` +
                `Verifique os dados ou entre em contato com o atendimento.\n\nDigite *MENU* para voltar.`
            );
        }
    }
};

const handleDuvidas = async (sock: any, jid: string, contactId: number | null) => {
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

const isSpecialSubcategory = (subName: string): 'simulacao' | 'corretor' | 'processos' | 'duvidas' | 'locacao' | null => {
    const lower = subName.toLowerCase();
    if (lower.includes('simulação') || lower.includes('simulacao')) return 'simulacao';
    if (lower.includes('corretor') || lower.includes('cadastro de corretor')) return 'corretor';
    if (lower.includes('processo')) return 'processos';
    if (lower.includes('dúvida') || lower.includes('duvida')) return 'duvidas';
    // Apenas "Cadastro Locação/Venda" ou similar - não "Locações Disponíveis"
    if ((lower.includes('cadastro') && (lower.includes('locação') || lower.includes('locacao') || lower.includes('venda')))) return 'locacao';
    return null;
};

// Listen to internal event to trigger this handler
eventBus.on('message.received', ({ msg, sock }) => {
    handleMessage(msg, sock);
});

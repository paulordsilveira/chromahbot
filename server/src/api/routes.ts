import { Router } from 'express';
import db from '../infrastructure/database';
import aiService from '../infrastructure/AiService';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/config', (_req, res) => {
  try {
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    console.log('[GET /config] Retornando config:', {
      systemPrompt: config?.systemPrompt?.substring(0, 60) || '(vazio)',
      assistantContext: config?.assistantContext?.substring(0, 60) || '(vazio)',
      documentacao: config?.documentacao ? `${config.documentacao.length} chars` : '(vazio)',
      faqText: config?.faqText?.substring(0, 60) || '(vazio)',
    });
    res.json(config || {});
  } catch (err) {
    console.error('GET /config error:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.put('/config', (req, res) => {
  try {
    const data = req.body ?? {};
    console.log('[PUT /config] ====== RECEBENDO DADOS ======');
    console.log('[PUT /config] Raw Request Body:', req.body);
    console.log('[PUT /config] Campos recebidos:', Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null && data[k] !== ''));
    console.log('[PUT /config] Cerebro IA:', {
      systemPrompt: data.systemPrompt ? `"${data.systemPrompt.substring(0, 60)}..."` : `(${typeof data.systemPrompt})`,
      assistantContext: data.assistantContext ? `"${data.assistantContext.substring(0, 60)}..."` : `(${typeof data.assistantContext})`,
      documentacao: data.documentacao ? `${data.documentacao.length} chars` : `(${typeof data.documentacao})`,
      faqText: data.faqText ? `"${data.faqText.substring(0, 60)}..."` : `(${typeof data.faqText})`,
    });

    db.prepare(`
      UPDATE config SET
        welcomeMessage = COALESCE(?, welcomeMessage),
        welcomeImageUrl = COALESCE(?, welcomeImageUrl),
        logoImage = COALESCE(?, logoImage),
        documentacao = COALESCE(?, documentacao),
        whatsappLink = COALESCE(?, whatsappLink),
        openaiApiKey = COALESCE(?, openaiApiKey),
        geminiApiKey = COALESCE(?, geminiApiKey),
        deepseekApiKey = COALESCE(?, deepseekApiKey),
        groqApiKey = COALESCE(?, groqApiKey),
        activeAiProvider = COALESCE(?, activeAiProvider),
        systemPrompt = COALESCE(?, systemPrompt),
        assistantContext = COALESCE(?, assistantContext),
        faqText = COALESCE(?, faqText),
        atendimentoPhones = COALESCE(?, atendimentoPhones),
        contatoHumano = COALESCE(?, contatoHumano),
        openRouterApiKey = COALESCE(?, openRouterApiKey),
        selectedModel = COALESCE(?, selectedModel),
        notificationPhone = COALESCE(?, notificationPhone),
        humanKeywords = COALESCE(?, humanKeywords),
        pauseCommands = COALESCE(?, pauseCommands),
        resumeCommands = COALESCE(?, resumeCommands),
        docCommands = COALESCE(?, docCommands),
        menuCommands = COALESCE(?, menuCommands),
        docsMessage = COALESCE(?, docsMessage),
        docsFiles = COALESCE(?, docsFiles),
        isAiEnabled = COALESCE(?, isAiEnabled),
        botNumber = COALESCE(?, botNumber)
      WHERE id = 1
    `).run(
      data.welcomeMessage || null, data.welcomeImageUrl || null, data.logoImage || null,
      data.documentacao || null, data.whatsappLink || null, data.openaiApiKey || null,
      data.geminiApiKey || null, data.deepseekApiKey || null, data.groqApiKey || null,
      data.activeAiProvider || null, data.systemPrompt || null, data.assistantContext || null,
      data.faqText || null, data.atendimentoPhones || null, data.contatoHumano || null,
      data.openRouterApiKey || null, data.selectedModel || null,
      data.notificationPhone || null, data.humanKeywords || null,
      data.pauseCommands || null, data.resumeCommands || null,
      data.docCommands || null, data.menuCommands || null,
      data.docsMessage || null, data.docsFiles || null,
      data.isAiEnabled !== undefined ? (data.isAiEnabled ? 1 : 0) : null,
      data.botNumber || null
    );

    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    console.log('[PUT /config] ✅ Salvo no banco:', {
      systemPrompt: config?.systemPrompt?.substring(0, 60) || '(vazio)',
      assistantContext: config?.assistantContext?.substring(0, 60) || '(vazio)',
      documentacao: config?.documentacao ? `${config.documentacao.length} chars` : '(vazio)',
      faqText: config?.faqText?.substring(0, 60) || '(vazio)',
    });
    console.log('[PUT /config] ============================');
    res.json(config);
  } catch (err) {
    console.error('PUT /config error:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

router.get('/categories', (_req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM category ORDER BY "order" ASC').all() as any[];
    const subcategories = db.prepare('SELECT * FROM subcategory ORDER BY "order" ASC').all() as any[];
    const result = categories.map(cat => ({
      ...cat,
      subcategories: subcategories.filter(s => s.categoryId === cat.id)
    }));
    res.json(result);
  } catch (err) {
    console.error('GET /categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', (req, res) => {
  try {
    const data = req.body ?? {};
    const maxOrder = db.prepare('SELECT MAX("order") as m FROM category').get() as { m: number | null };
    const order = data.order ?? ((maxOrder?.m ?? 0) + 1);
    const result = db.prepare('INSERT INTO category (name, "order") VALUES (?, ?)').run(data.name, order);
    res.json({ id: result.lastInsertRowid, name: data.name, order });
  } catch (err) {
    console.error('POST /categories error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};
    db.prepare('UPDATE category SET name = ?, "order" = ? WHERE id = ?').run(data.name, data.order, id);
    res.json({ id, name: data.name, order: data.order });
  } catch (err) {
    console.error('PUT /categories error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM subcategory WHERE categoryId = ?').run(id);
    db.prepare('DELETE FROM category WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /categories error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.post('/categories/:categoryId/subcategories', (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const data = req.body ?? {};
    const maxOrder = db.prepare('SELECT MAX("order") as m FROM subcategory WHERE categoryId = ?').get(categoryId) as { m: number | null };
    const order = data.order ?? ((maxOrder?.m ?? 0) + 1);
    const result = db.prepare(`
      INSERT INTO subcategory (name, emoji, "order", categoryId, enabledInBot)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.name, data.emoji || null, order, categoryId, data.enabledInBot !== false ? 1 : 0);
    res.json({ id: result.lastInsertRowid, name: data.name, emoji: data.emoji || null, order, categoryId, enabledInBot: data.enabledInBot !== false });
  } catch (err) {
    console.error('POST /subcategories error:', err);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

router.put('/subcategories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};
    db.prepare(`
      UPDATE subcategory SET
        name = COALESCE(?, name),
        emoji = COALESCE(?, emoji),
        "order" = COALESCE(?, "order"),
        enabledInBot = ?
      WHERE id = ?
    `).run(data.name, data.emoji, data.order, data.enabledInBot !== false ? 1 : 0, id);
    res.json({ id, ...data });
  } catch (err) {
    console.error('PUT /subcategories error:', err);
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
});

router.delete('/subcategories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM item WHERE subcategoryId = ?').run(id);
    db.prepare('DELETE FROM form WHERE subCategoryId = ?').run(id);
    db.prepare('DELETE FROM subcategory WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /subcategories error:', err);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

router.get('/items', (_req, res) => {
  try {
    const items = db.prepare('SELECT * FROM item ORDER BY name ASC').all();
    res.json(items);
  } catch (err) {
    console.error('GET /items global error:', err);
    res.status(500).json({ error: 'Failed to fetch all items' });
  }
});

router.get('/subcategories/:subcategoryId/items', (req, res) => {
  try {
    const subcategoryId = Number(req.params.subcategoryId);
    const items = db.prepare('SELECT * FROM item WHERE subcategoryId = ? ORDER BY id ASC').all(subcategoryId);
    res.json(items);
  } catch (err) {
    console.error('GET /items error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.post('/subcategories/:subcategoryId/items', (req, res) => {
  try {
    const subcategoryId = Number(req.params.subcategoryId);
    const data = req.body ?? {};
    const result = db.prepare(`
      INSERT INTO item (subcategoryId, name, title, description, price, locationLink, contactLink, webLink, imageUrls, videoUrls, documentUrls, empresa, contato, email, endereco, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subcategoryId, data.name, data.title || null, data.description || null,
      data.price || null, data.locationLink || null, data.contactLink || null,
      data.webLink || null, data.imageUrls || null, data.videoUrls || null, data.documentUrls || null,
      data.empresa || null, data.contato || null, data.email || null, data.endereco || null,
      data.enabled !== false ? 1 : 0
    );
    res.json({ id: result.lastInsertRowid, subcategoryId, ...data });
  } catch (err) {
    console.error('POST /items error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put('/items/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};
    db.prepare(`
      UPDATE item SET
        name = COALESCE(?, name),
        title = ?,
        description = ?,
        price = ?,
        locationLink = ?,
        contactLink = ?,
        webLink = ?,
        imageUrls = ?,
        videoUrls = ?,
        documentUrls = ?,
        empresa = ?,
        contato = ?,
        email = ?,
        endereco = ?,
        enabled = ?
      WHERE id = ?
    `).run(
      data.name, data.title, data.description, data.price,
      data.locationLink, data.contactLink, data.webLink, data.imageUrls,
      data.videoUrls, data.documentUrls,
      data.empresa, data.contato, data.email, data.endereco,
      data.enabled !== false ? 1 : 0, id
    );
    res.json({ id, ...data });
  } catch (err) {
    console.error('PUT /items error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/items/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM item WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /items error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

router.get('/contacts', (_req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM contact ORDER BY updatedAt DESC').all() as any[];
    const result = contacts.map(c => {
      const messages = db.prepare('SELECT * FROM message_log WHERE contactId = ? ORDER BY timestamp DESC LIMIT 10').all(c.id);
      return { ...c, messages };
    });
    res.json(result);
  } catch (err) {
    console.error('GET /contacts error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.get('/forms', (_req, res) => {
  try {
    const forms = db.prepare('SELECT * FROM form ORDER BY createdAt DESC').all();
    res.json(forms);
  } catch (err) {
    console.error('GET /forms error:', err);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

router.post('/forms', (req, res) => {
  try {
    const data = req.body ?? {};
    const result = db.prepare('INSERT INTO form (type, data, subCategoryId) VALUES (?, ?, ?)').run(
      data.type, JSON.stringify(data.data), data.subCategoryId || null
    );
    res.json({ id: result.lastInsertRowid, ...data });
  } catch (err) {
    console.error('POST /forms error:', err);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

router.put('/forms/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};
    db.prepare('UPDATE form SET type = ?, data = ? WHERE id = ?').run(
      data.type, JSON.stringify(data.data), id
    );
    res.json({ id, ...data });
  } catch (err) {
    console.error('PUT /forms error:', err);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

router.delete('/forms/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM form WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /forms error:', err);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// ===================== Lead Tickets =====================

router.get('/lead-tickets', (_req, res) => {
  try {
    const tickets = db.prepare(`
      SELECT lt.*, c.name as contactName, c.phone as contactPhone, c.profilePicUrl, c.jid
      FROM lead_ticket lt
      JOIN contact c ON lt.contactId = c.id
      ORDER BY lt.notifiedAt DESC
    `).all() as any[];
    res.json(tickets);
  } catch (err) {
    console.error('GET /lead-tickets error:', err);
    res.status(500).json({ error: 'Failed to fetch lead tickets' });
  }
});

router.put('/lead-tickets/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (status === 'attended' || status === 'closed') {
      db.prepare(`UPDATE lead_ticket SET status = ?, attendedAt = datetime('now') WHERE id = ?`).run(status, id);
    } else {
      db.prepare('UPDATE lead_ticket SET status = ? WHERE id = ?').run(status, id);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /lead-tickets status error:', err);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// ===================== CRM =====================

router.get('/crm', (_req, res) => {
  try {
    // Get contacts (leads from bot)
    const contacts = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM message_log WHERE contactId = c.id) as messageCount,
        (SELECT content FROM message_log WHERE contactId = c.id ORDER BY timestamp DESC LIMIT 1) as lastMessage
      FROM contact c 
      ORDER BY c.updatedAt DESC
    `).all() as any[];

    // Get forms (atendimento_interno)
    const forms = db.prepare(`
      SELECT * FROM form WHERE type = 'atendimento_interno' ORDER BY createdAt DESC
    `).all() as any[];

    // Parse form data and unify format
    const formClients = forms.map((f: any) => {
      let parsed = {};
      try { parsed = JSON.parse(f.data || '{}'); } catch { }
      return {
        id: `form_${f.id}`,
        formId: f.id,
        origem: 'formulario',
        nome: (parsed as any).nome || '',
        contato: (parsed as any).contato || '',
        cpf: (parsed as any).cpf || '',
        email: (parsed as any).email || '',
        statusAtual: (parsed as any).statusAtual || 'atendido',
        statusHistorico: (parsed as any).statusHistorico || [],
        observacao: (parsed as any).observacao || '',
        createdAt: f.createdAt,
        type: 'form',
        profilePicUrl: null,
        ...parsed,
      };
    });

    // Format contacts
    const contactClients = contacts.map((c: any) => ({
      id: `contact_${c.id}`,
      contactId: c.id,
      origem: 'bot',
      nome: c.name || c.phone || '',
      contato: c.phone || '',
      profilePicUrl: c.profilePicUrl || null,
      statusAtual: c.statusAtual || 'atendido',
      statusHistorico: c.statusHistorico ? JSON.parse(c.statusHistorico) : [],
      observacao: c.observacao || '',
      createdAt: c.createdAt,
      messageCount: c.messageCount,
      lastMessage: c.lastMessage,
      type: 'contact',
    }));

    // Combine and sort by date
    const all = [...formClients, ...contactClients].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(all);
  } catch (err) {
    console.error('GET /crm error:', err);
    res.status(500).json({ error: 'Failed to fetch CRM data' });
  }
});

router.put('/crm/:type/:id/status', (req, res) => {
  try {
    const { type, id } = req.params;
    const { statusAtual, statusHistorico } = req.body;

    if (type === 'contact') {
      db.prepare('UPDATE contact SET statusAtual = ?, statusHistorico = ?, updatedAt = datetime("now") WHERE id = ?')
        .run(statusAtual, JSON.stringify(statusHistorico), Number(id));
    } else if (type === 'form') {
      // Get current form data and update status
      const form = db.prepare('SELECT * FROM form WHERE id = ?').get(Number(id)) as any;
      if (form) {
        let data = {};
        try { data = JSON.parse(form.data || '{}'); } catch { }
        const updated = { ...data, statusAtual, statusHistorico };
        db.prepare('UPDATE form SET data = ? WHERE id = ?').run(JSON.stringify(updated), Number(id));
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /crm status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.put('/crm/:type/:id/observacao', (req, res) => {
  try {
    const { type, id } = req.params;
    const { observacao } = req.body;

    if (type === 'contact') {
      db.prepare('UPDATE contact SET observacao = ?, updatedAt = datetime("now") WHERE id = ?')
        .run(observacao, Number(id));
    } else if (type === 'form') {
      const form = db.prepare('SELECT * FROM form WHERE id = ?').get(Number(id)) as any;
      if (form) {
        let data = {};
        try { data = JSON.parse(form.data || '{}'); } catch { }
        const updated = { ...data, observacao };
        db.prepare('UPDATE form SET data = ? WHERE id = ?').run(JSON.stringify(updated), Number(id));
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /crm observacao error:', err);
    res.status(500).json({ error: 'Failed to update observacao' });
  }
});

router.get('/crm/contact/:id/messages', (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const messages = db.prepare(`
      SELECT * FROM message_log 
      WHERE contactId = ? 
      ORDER BY timestamp ASC
    `).all(contactId);

    res.json(messages);
  } catch (err) {
    console.error('GET /crm/contact/:id/messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ===================== IA Improve Text =====================

router.post('/improve-text', async (req, res) => {
  try {
    const { text, fieldType } = req.body;
    if (!text || !fieldType) {
      return res.status(400).json({ error: 'text and fieldType are required' });
    }

    // Buscar config atual para dar contexto à IA
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    const empresaNome = config?.welcomeMessage?.match(/\*(.*?)\*/)?.[1] || 'a empresa';

    const prompts: Record<string, string> = {
      systemPrompt: `Você é um especialista em criar System Prompts para assistentes virtuais de WhatsApp empresariais.

TAREFA: Reescreva e melhore o System Prompt abaixo para que o assistente virtual funcione de forma otimizada.

REGRAS DO SYSTEM PROMPT IDEAL:
- Defina claramente o papel do assistente (quem ele é, qual empresa representa)
- Estabeleça limites claros (o que pode e não pode fazer)
- Defina o tom de comunicação (profissional, amigável, direto)
- Inclua regras sobre quando encaminhar para atendimento humano
- Mencione que deve usar as informações da documentação e FAQ para responder
- Inclua regra para NUNCA inventar informações
- Mantenha texto puro sem markdown
- Retorne APENAS o System Prompt melhorado, sem explicações

CONTEXTO: O assistente é da empresa "${empresaNome}".`,

      assistantContext: `Você é um especialista em design de personalidade e UX conversacional para chatbots de WhatsApp.

TAREFA: Refine o contexto de personalidade abaixo para criar uma identidade conversacional marcante e consistente.

O BOM CONTEXTO DE PERSONALIDADE DEVE TER:
- Tom de voz definido (formal/informal/misto)
- Estilo de comunicação (direto, detalhista, empático)
- Uso de emojis (quando sim, quando não, exemplos)
- Comprimento ideal das respostas  
- Como lidar com reclamações e frustrações
- Como saudar e se despedir
- Palavras e expressões que deve/não deve usar
- Mantenha texto puro sem markdown
- Retorne APENAS o contexto melhorado, sem explicações

CONTEXTO: O assistente é da empresa "${empresaNome}".`,

      documentacao: `Você é um especialista em organização de conhecimento para bases de IA (RAG/Knowledge Base).

TAREFA: Reorganize e melhore a documentação abaixo para que um assistente de IA consiga extrair informações rapidamente e responder perguntas dos clientes com precisão.

A DOCUMENTAÇÃO OTIMIZADA PARA IA DEVE:
- Organizar em seções temáticas claras (Sobre a Empresa, Serviços, Diferenciais, Processos, Horários, Contato)
- Cada seção com tópicos objetivos
- Incluir dados específicos (preços, prazos, condições) quando presentes
- Eliminar redundâncias
- Usar marcadores (• ou -) para listas
- Usar * para negritar termos importantes
- Manter linguagem clara e direta
- Retorne APENAS a documentação melhorada, sem explicações`,

      faqText: `Você é um especialista em FAQ (Perguntas Frequentes) otimizado para WhatsApp.

TAREFA: Reescreva e organize o FAQ abaixo para máxima clareza quando enviado via WhatsApp.

O FAQ IDEAL PARA WHATSAPP DEVE:
- Cada pergunta começar com 📌 em negrito (*pergunta*)
- Resposta logo abaixo, clara e concisa (2-3 linhas máx)
- Usar emojis relevantes (✅ ❓ 📍 ⏰ 💰 📞 🔗)
- Separar perguntas com linha em branco
- Agrupar por tema se houver muitas perguntas
- Incluir ao final: "Não encontrou sua dúvida? Digite *CONTATO* para falar com um atendente."
- Retorne APENAS o FAQ melhorado, sem explicações`
    };

    const systemInstruction = prompts[fieldType] || prompts.documentacao;
    const improved = await aiService.getAiResponse(`${systemInstruction}\n\nTexto original:\n${text}`);

    res.json({ improved });
  } catch (err: any) {
    console.error('POST /improve-text error:', err);
    res.status(500).json({ error: err.message || 'Failed to improve text' });
  }
});


// ==========================================
// CRUD: Custom Commands (Comandos Dinâmicos do Operador)
// ==========================================

router.get('/commands', (_req, res) => {
  try {
    const commands = db.prepare('SELECT * FROM custom_command ORDER BY id DESC').all();
    res.json(commands);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/commands', (req, res) => {
  try {
    const { triggers, textMessage, fileData, isActive, linkedSubcategoryId, linkedItemId } = req.body;
    if (!triggers) return res.status(400).json({ error: 'Triggers (palavras de comando) são obrigatórios.' });

    const activeVal = isActive === undefined ? 1 : (isActive ? 1 : 0);
    const stmt = db.prepare('INSERT INTO custom_command (triggers, textMessage, fileData, isActive, linkedSubcategoryId, linkedItemId) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(triggers, textMessage || null, fileData || '[]', activeVal, linkedSubcategoryId || null, linkedItemId || null);

    const newCmd = db.prepare('SELECT * FROM custom_command WHERE id = ?').get(info.lastInsertRowid);
    res.json(newCmd);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/commands/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { triggers, textMessage, fileData, isActive, linkedSubcategoryId, linkedItemId } = req.body;
    if (!triggers) return res.status(400).json({ error: 'Triggers são obrigatórios.' });

    const activeVal = isActive === undefined ? 1 : (isActive ? 1 : 0);
    const stmt = db.prepare('UPDATE custom_command SET triggers = ?, textMessage = ?, fileData = ?, isActive = ?, linkedSubcategoryId = ?, linkedItemId = ? WHERE id = ?');
    stmt.run(triggers, textMessage || null, fileData || '[]', activeVal, linkedSubcategoryId || null, linkedItemId || null, id);

    const updatedCmd = db.prepare('SELECT * FROM custom_command WHERE id = ?').get(id);
    res.json(updatedCmd);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/commands/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM custom_command WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


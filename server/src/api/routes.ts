import { Router } from 'express';
import db from '../infrastructure/database';
import aiService from '../infrastructure/AiService';
import { connectToWhatsApp, disconnectWhatsApp } from '../bot/connection';

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

// ===================== Bot Connection Control =====================

router.post('/bot/connect', async (_req, res) => {
  try {
    await connectToWhatsApp();
    res.json({ ok: true, message: 'Connection requested' });
  } catch (err: any) {
    console.error('POST /bot/connect error:', err);
    res.status(500).json({ error: 'Failed to connect bot', details: err.message });
  }
});

router.post('/bot/disconnect', async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ ok: true, message: 'Disconnection requested' });
  } catch (err: any) {
    console.error('POST /bot/disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect bot', details: err.message });
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
        botNumber = COALESCE(?, botNumber),
        businessHoursEnabled = COALESCE(?, businessHoursEnabled),
        businessHoursStart = COALESCE(?, businessHoursStart),
        businessHoursEnd = COALESCE(?, businessHoursEnd),
        businessDays = COALESCE(?, businessDays),
        outsideHoursMessage = COALESCE(?, outsideHoursMessage)
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
      data.botNumber || null,
      data.businessHoursEnabled !== undefined ? (data.businessHoursEnabled ? 1 : 0) : null,
      data.businessHoursStart || null,
      data.businessHoursEnd || null,
      data.businessDays || null,
      data.outsideHoursMessage || null
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
    // Check if new status is considered an "Atendido" or "Finalizado" behavior for sync logic
    // We assume based on names, but let's be flexible and allow dynamic updates
    if (status === 'Atendido' || status === 'Finalizado' || status === 'closed' || status === 'attended') {
      db.prepare(`UPDATE lead_ticket SET status = ?, attendedAt = datetime('now') WHERE id = ?`).run(status, id);
    } else {
      db.prepare('UPDATE lead_ticket SET status = ? WHERE id = ?').run(status, id);
    }

    // --- CRM Sync Logic ---
    // Update CRM contact status when ticket status changes
    const ticket = db.prepare('SELECT contactId FROM lead_ticket WHERE id = ?').get(id) as any;
    if (ticket && ticket.contactId) {
      const contact = db.prepare('SELECT statusHistorico FROM contact WHERE id = ?').get(ticket.contactId) as any;
      if (contact) {
        let newCrmStatus = '';
        if (status === 'Atendido' || status === 'attended') newCrmStatus = 'em_negociacao';
        if (status === 'Finalizado' || status === 'closed') newCrmStatus = 'finalizado';

        if (newCrmStatus) {
          let historico = [];
          try { historico = JSON.parse(contact.statusHistorico || '[]'); } catch { }
          historico.push({
            status: newCrmStatus,
            data: new Date().toISOString(),
            info: 'Atualizado via tela Leads & Tickets'
          });

          db.prepare('UPDATE contact SET statusAtual = ?, statusHistorico = ?, updatedAt = datetime("now") WHERE id = ?')
            .run(newCrmStatus, JSON.stringify(historico), ticket.contactId);
        }
      }
    }
    // ----------------------

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /lead-tickets status error:', err);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// ===================== Lead Ticket Statuses =====================

router.get('/lead-status', (_req, res) => {
  try {
    const statuses = db.prepare('SELECT * FROM lead_ticket_status ORDER BY "order" ASC').all();
    res.json(statuses);
  } catch (err) {
    console.error('GET /lead-status error:', err);
    res.status(500).json({ error: 'Failed to fetch lead valid statuses' });
  }
});

router.post('/lead-status', (req, res) => {
  try {
    const { name, color } = req.body;
    const maxOrder = db.prepare('SELECT MAX("order") as maxOrder FROM lead_ticket_status').get() as any;
    const order = (maxOrder?.maxOrder || 0) + 1;

    const info = db.prepare('INSERT INTO lead_ticket_status (name, color, "order") VALUES (?, ?, ?)')
      .run(name, color || 'bg-ch-surface-2 text-ch-text', order);

    res.json({ id: info.lastInsertRowid, name, color, order });
  } catch (err) {
    console.error('POST /lead-status error:', err);
    res.status(500).json({ error: 'Failed to create lead status' });
  }
});

router.put('/lead-status/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body; // array of IDs in new order
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid payload' });

    const updateOrder = db.prepare('UPDATE lead_ticket_status SET "order" = ? WHERE id = ?');
    db.transaction(() => {
      orderedIds.forEach((id, index) => {
        updateOrder.run(index + 1, id);
      });
    })();

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /lead-status/reorder error:', err);
    res.status(500).json({ error: 'Failed to reorder statuses' });
  }
});

router.put('/lead-status/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    const id = Number(req.params.id);

    // update tickets that currently use this name if name changes
    const oldStatus = db.prepare('SELECT name FROM lead_ticket_status WHERE id = ?').get(id) as any;
    if (oldStatus && oldStatus.name !== name) {
      db.prepare('UPDATE lead_ticket SET status = ? WHERE status = ?').run(name, oldStatus.name);
    }

    db.prepare('UPDATE lead_ticket_status SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /lead-status/:id error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/lead-status/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const statusInfo = db.prepare('SELECT name FROM lead_ticket_status WHERE id = ?').get(id) as any;
    if (statusInfo) {
      // Fallback pending to first available or standard "Pendente"
      db.prepare('UPDATE lead_ticket SET status = "Pendente" WHERE status = ?').run(statusInfo.name);
    }
    db.prepare('DELETE FROM lead_ticket_status WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /lead-status/:id error:', err);
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

router.post('/lead-tickets/:id/summarize', async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = db.prepare('SELECT contactId, summary FROM lead_ticket WHERE id = ?').get(ticketId) as any;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const messages = db.prepare('SELECT role, content FROM message_log WHERE contactId = ? ORDER BY timestamp ASC').all(ticket.contactId) as any[];
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'No messages to summarize' });

    const conversationData = messages.map(m => `[${m.role === 'user' ? 'Cliente' : 'Assistente'}]: ${m.content}`).join('\n');
    const promptContext = ticket.summary
      ? `HISTÓRICO DE RESUMO ANTERIOR:\n${ticket.summary}\n\n---\nNOVAS MENSAGENS PARA ATUALIZAR O RESUMO HISTÓRICO:\n${conversationData}`
      : `CONVERSA:\n${conversationData}`;

    const summaryPrompt = `Atue como um analista de dados de CRM. Sua tarefa é criar/atualizar um resumo conciso e em tópicos da conversa entre o cliente e o assistente a seguir.
Caso exista um "HISTÓRICO DE RESUMO ANTERIOR", não repita do zero, mas crie uma pequena linha do tempo ou apenas adicione quais foram os últimos desdobramentos.
O resumo não deve ter mais do que 4 frases ou tópicos curtos. Foco total em intenção de compra, dúvidas principais e status da tratativa.
Textos Fornecidos:
${promptContext}`;

    try {
      const summary = await aiService.getAiResponse(summaryPrompt);
      db.prepare('UPDATE lead_ticket SET summary = ? WHERE id = ?').run(summary, ticketId);
      res.json({ summary });
    } catch (aiErr: any) {
      console.error('AI Summarize Error:', aiErr);
      res.status(500).json({ error: 'AI Error: ' + aiErr.message });
    }
  } catch (err: any) {
    console.error('POST /lead-tickets summarize error:', err);
    res.status(500).json({ error: 'Failed to summarize ticket' });
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

      // --- Lead Ticket Sync Logic ---
      // Update pending tickets if CRM card is moved
      let newTicketStatus = '';
      if (statusAtual === 'em_negociacao') newTicketStatus = 'Atendido';
      if (['finalizado', 'concluido', 'locado'].includes(statusAtual)) newTicketStatus = 'Finalizado';

      if (newTicketStatus) {
        if (newTicketStatus === 'Atendido' || newTicketStatus === 'Finalizado') {
          db.prepare(`UPDATE lead_ticket SET status = ?, attendedAt = datetime('now') WHERE contactId = ? AND status != 'Finalizado' AND status != 'closed'`)
            .run(newTicketStatus, Number(id));
        } else {
          db.prepare(`UPDATE lead_ticket SET status = ? WHERE contactId = ? AND status != 'Finalizado' AND status != 'closed'`)
            .run(newTicketStatus, Number(id));
        }
      }
      // ------------------------------
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

// ===================== Dashboard Metrics =====================

router.get('/metrics', (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const totalContacts = (db.prepare('SELECT COUNT(*) as c FROM contact').get() as any).c;
    const totalMessages = (db.prepare('SELECT COUNT(*) as c FROM message_log').get() as any).c;
    const todayMessages = (db.prepare('SELECT COUNT(*) as c FROM message_log WHERE timestamp >= ?').get(todayStart) as any).c;
    const weekMessages = (db.prepare('SELECT COUNT(*) as c FROM message_log WHERE timestamp >= ?').get(weekStart) as any).c;
    const todayLeads = (db.prepare("SELECT COUNT(*) as c FROM lead_ticket WHERE notifiedAt >= ?").get(todayStart) as any).c;
    const weekLeads = (db.prepare("SELECT COUNT(*) as c FROM lead_ticket WHERE notifiedAt >= ?").get(weekStart) as any).c;
    const totalForms = (db.prepare('SELECT COUNT(*) as c FROM form').get() as any).c;

    // Messages per day (last 7 days)
    const dailyMessages = db.prepare(`
      SELECT DATE(timestamp) as day, COUNT(*) as count, role 
      FROM message_log WHERE timestamp >= ? GROUP BY day, role ORDER BY day ASC
    `).all(weekStart) as any[];

    // Popular categories (top 5 by items viewed)
    const topCategories = db.prepare(`
      SELECT c.name, c.emoji, COUNT(ml.id) as mentions
      FROM category c
      LEFT JOIN message_log ml ON ml.content LIKE '%' || c.name || '%' AND ml.role = 'assistant'
      GROUP BY c.id ORDER BY mentions DESC LIMIT 5
    `).all() as any[];

    // Forms by type
    const formsByType = db.prepare(`
      SELECT type, COUNT(*) as count FROM form GROUP BY type ORDER BY count DESC
    `).all();

    // Active contacts today
    const activeToday = (db.prepare(`
      SELECT COUNT(DISTINCT contactId) as c FROM message_log WHERE timestamp >= ?
    `).get(todayStart) as any).c;

    // AI vs URA usage
    const config = db.prepare('SELECT isAiEnabled FROM config WHERE id = 1').get() as any;

    res.json({
      totalContacts, totalMessages, todayMessages, weekMessages,
      todayLeads, weekLeads, totalForms, activeToday,
      isAiEnabled: config?.isAiEnabled !== 0,
      dailyMessages, topCategories, formsByType,
    });
  } catch (err) {
    console.error('GET /metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ===================== Tags =====================

router.get('/tags', (_req, res) => {
  try {
    const tags = db.prepare('SELECT * FROM tag ORDER BY name ASC').all();
    res.json(tags);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/tags', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const result = db.prepare('INSERT INTO tag (name, color) VALUES (?, ?)').run(name, color || '#00bcd4');
    res.json({ id: result.lastInsertRowid, name, color: color || '#00bcd4' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/tags/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    db.prepare('UPDATE tag SET name = ?, color = ? WHERE id = ?').run(name, color, Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/tags/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM contact_tag WHERE tagId = ?').run(id);
    db.prepare('DELETE FROM tag WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Contact tags
router.get('/contacts/:contactId/tags', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.* FROM tag t JOIN contact_tag ct ON ct.tagId = t.id WHERE ct.contactId = ?
    `).all(Number(req.params.contactId));
    res.json(tags);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/contacts/:contactId/tags/:tagId', (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO contact_tag (contactId, tagId) VALUES (?, ?)').run(Number(req.params.contactId), Number(req.params.tagId));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/contacts/:contactId/tags/:tagId', (req, res) => {
  try {
    db.prepare('DELETE FROM contact_tag WHERE contactId = ? AND tagId = ?').run(Number(req.params.contactId), Number(req.params.tagId));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== Quick Replies (Templates) =====================

router.get('/quick-replies', (_req, res) => {
  try {
    const replies = db.prepare('SELECT * FROM quick_reply ORDER BY shortcut ASC').all();
    res.json(replies);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/quick-replies', (req, res) => {
  try {
    const { shortcut, title, content, category } = req.body;
    if (!shortcut || !title || !content) return res.status(400).json({ error: 'shortcut, title e content são obrigatórios' });
    const result = db.prepare('INSERT INTO quick_reply (shortcut, title, content, category) VALUES (?, ?, ?, ?)').run(shortcut, title, content, category || 'geral');
    res.json({ id: result.lastInsertRowid, shortcut, title, content, category: category || 'geral' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/quick-replies/:id', (req, res) => {
  try {
    const { shortcut, title, content, category } = req.body;
    db.prepare('UPDATE quick_reply SET shortcut = ?, title = ?, content = ?, category = ? WHERE id = ?').run(shortcut, title, content, category || 'geral', Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/quick-replies/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM quick_reply WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== Scheduled Messages =====================

router.get('/scheduled-messages', (_req, res) => {
  try {
    const messages = db.prepare(`
      SELECT sm.*, c.name as contactName, c.phone as contactPhone 
      FROM scheduled_message sm 
      LEFT JOIN contact c ON sm.contactId = c.id 
      ORDER BY sm.scheduledAt ASC
    `).all();
    res.json(messages);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/scheduled-messages', (req, res) => {
  try {
    const { contactId, targetJid, message, scheduledAt, isBroadcast, broadcastTagId } = req.body;
    if (!message || !scheduledAt) return res.status(400).json({ error: 'message e scheduledAt são obrigatórios' });
    const result = db.prepare(`
      INSERT INTO scheduled_message (contactId, targetJid, message, scheduledAt, isBroadcast, broadcastTagId) VALUES (?, ?, ?, ?, ?, ?)
    `).run(contactId || null, targetJid || null, message, scheduledAt, isBroadcast ? 1 : 0, broadcastTagId || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/scheduled-messages/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM scheduled_message WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ===================== AI Training Mode =====================

router.post('/ai-test', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message é obrigatório' });

    const response = await aiService.getAiResponse(message);
    res.json({ response });
  } catch (err: any) {
    console.error('POST /ai-test error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== Export Data =====================

router.get('/export/:type', (req, res) => {
  try {
    const { type } = req.params;
    const format = (req.query.format as string) || 'json';
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'contacts':
        data = db.prepare('SELECT id, name, phone, statusAtual, observacao, createdAt, updatedAt FROM contact ORDER BY name ASC').all() as any[];
        filename = 'contatos';
        break;
      case 'messages':
        data = db.prepare(`
          SELECT ml.id, c.name as contactName, c.phone, ml.content, ml.role, ml.timestamp
          FROM message_log ml JOIN contact c ON ml.contactId = c.id ORDER BY ml.timestamp DESC LIMIT 1000
        `).all() as any[];
        filename = 'mensagens';
        break;
      case 'forms':
        data = db.prepare('SELECT * FROM form ORDER BY createdAt DESC').all() as any[];
        filename = 'formularios';
        break;
      case 'leads':
        data = db.prepare(`
          SELECT lt.*, c.name, c.phone FROM lead_ticket lt JOIN contact c ON lt.contactId = c.id ORDER BY lt.notifiedAt DESC
        `).all() as any[];
        filename = 'leads';
        break;
      default:
        return res.status(400).json({ error: 'Tipo inválido. Use: contacts, messages, forms, leads' });
    }

    if (format === 'csv') {
      if (data.length === 0) return res.status(200).send('');
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send('\uFEFF' + csv); // BOM for Excel UTF-8
    }

    res.json(data);
  } catch (err: any) {
    console.error('GET /export error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

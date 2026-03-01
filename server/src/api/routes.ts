import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import db from '../infrastructure/database';
import Database from 'better-sqlite3';  // Para importação de .db externos
import aiService from '../infrastructure/AiService';
import { connectToWhatsApp, disconnectWhatsApp } from '../bot/connection';
import { TOOL_DEFINITIONS } from '../bot/modules/constants';

const router = Router();
const uploadDb = multer({ dest: os.tmpdir() });

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
        outsideHoursMessage = COALESCE(?, outsideHoursMessage),
        assistantName = COALESCE(?, assistantName)
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
      data.outsideHoursMessage || null,
      data.assistantName || null
    );

    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    console.log('[PUT /config] âœ… Salvo no banco:', {
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
    // Busca tickets com dados do contato
    const tickets = db.prepare(`
      SELECT lt.*, c.name as contactName, c.phone as contactPhone, c.profilePicUrl, c.jid
      FROM lead_ticket lt
      JOIN contact c ON lt.contactId = c.id
      ORDER BY lt.notifiedAt DESC
    `).all() as any[];
    // Inclui as últimas 50 mensagens de cada contato para exibir no bloco do lead
    const ticketsWithMessages = tickets.map((t: any) => {
      const messages = db.prepare(
        'SELECT id, content, role, timestamp FROM message_log WHERE contactId = ? ORDER BY timestamp DESC LIMIT 50'
      ).all(t.contactId);
      return { ...t, messages: messages.reverse() };
    });
    res.json(ticketsWithMessages);
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
      ? `HISTÃ“RICO DE RESUMO ANTERIOR:\n${ticket.summary}\n\n---\nNOVAS MENSAGENS PARA ATUALIZAR O RESUMO HISTÃ“RICO:\n${conversationData}`
      : `CONVERSA:\n${conversationData}`;

    const summaryPrompt = `Atue como um analista de dados de CRM. Sua tarefa Ã© criar/atualizar um resumo conciso e em tÃ³picos da conversa entre o cliente e o assistente a seguir.
Caso exista um "HISTÃ“RICO DE RESUMO ANTERIOR", nÃ£o repita do zero, mas crie uma pequena linha do tempo ou apenas adicione quais foram os Ãºltimos desdobramentos.
O resumo nÃ£o deve ter mais do que 4 frases ou tÃ³picos curtos. Foco total em intenÃ§Ã£o de compra, dÃºvidas principais e status da tratativa.
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

    // Buscar config atual para dar contexto Ã  IA
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() as any;
    const empresaNome = config?.welcomeMessage?.match(/\*(.*?)\*/)?.[1] || 'a empresa';

    const prompts: Record<string, string> = {
      systemPrompt: `VocÃª Ã© um especialista em criar System Prompts para assistentes virtuais de WhatsApp empresariais.

TAREFA: Reescreva e melhore o System Prompt abaixo para que o assistente virtual funcione de forma otimizada.

REGRAS DO SYSTEM PROMPT IDEAL:
- Defina claramente o papel do assistente (quem ele Ã©, qual empresa representa)
- EstabeleÃ§a limites claros (o que pode e nÃ£o pode fazer)
- Defina o tom de comunicaÃ§Ã£o (profissional, amigÃ¡vel, direto)
- Inclua regras sobre quando encaminhar para atendimento humano
- Mencione que deve usar as informaÃ§Ãµes da documentaÃ§Ã£o e FAQ para responder
- Inclua regra para NUNCA inventar informaÃ§Ãµes
- Mantenha texto puro sem markdown
- Retorne APENAS o System Prompt melhorado, sem explicaÃ§Ãµes

CONTEXTO: O assistente Ã© da empresa "${empresaNome}".`,

      assistantContext: `VocÃª Ã© um especialista em design de personalidade e UX conversacional para chatbots de WhatsApp.

TAREFA: Refine o contexto de personalidade abaixo para criar uma identidade conversacional marcante e consistente.

O BOM CONTEXTO DE PERSONALIDADE DEVE TER:
- Tom de voz definido (formal/informal/misto)
- Estilo de comunicaÃ§Ã£o (direto, detalhista, empÃ¡tico)
- Uso de emojis (quando sim, quando nÃ£o, exemplos)
- Comprimento ideal das respostas  
- Como lidar com reclamaÃ§Ãµes e frustraÃ§Ãµes
- Como saudar e se despedir
- Palavras e expressÃµes que deve/nÃ£o deve usar
- Mantenha texto puro sem markdown
- Retorne APENAS o contexto melhorado, sem explicaÃ§Ãµes

CONTEXTO: O assistente Ã© da empresa "${empresaNome}".`,

      documentacao: `VocÃª Ã© um especialista em organizaÃ§Ã£o de conhecimento para bases de IA (RAG/Knowledge Base).

TAREFA: Reorganize e melhore a documentaÃ§Ã£o abaixo para que um assistente de IA consiga extrair informaÃ§Ãµes rapidamente e responder perguntas dos clientes com precisÃ£o.

A DOCUMENTAÃ‡ÃƒO OTIMIZADA PARA IA DEVE:
- Organizar em seÃ§Ãµes temÃ¡ticas claras (Sobre a Empresa, ServiÃ§os, Diferenciais, Processos, HorÃ¡rios, Contato)
- Cada seÃ§Ã£o com tÃ³picos objetivos
- Incluir dados especÃ­ficos (preÃ§os, prazos, condiÃ§Ãµes) quando presentes
- Eliminar redundÃ¢ncias
- Usar marcadores (â€¢ ou -) para listas
- Usar * para negritar termos importantes
- Manter linguagem clara e direta
- Retorne APENAS a documentaÃ§Ã£o melhorada, sem explicaÃ§Ãµes`,

      faqText: `VocÃª Ã© um especialista em FAQ (Perguntas Frequentes) otimizado para WhatsApp.

TAREFA: Reescreva e organize o FAQ abaixo para mÃ¡xima clareza quando enviado via WhatsApp.

O FAQ IDEAL PARA WHATSAPP DEVE:
- Cada pergunta comeÃ§ar com ðŸ“Œ em negrito (*pergunta*)
- Resposta logo abaixo, clara e concisa (2-3 linhas mÃ¡x)
- Usar emojis relevantes (âœ… â“ ðŸ“ â° ðŸ’° ðŸ“ž ðŸ”—)
- Separar perguntas com linha em branco
- Agrupar por tema se houver muitas perguntas
- Incluir ao final: "NÃ£o encontrou sua dÃºvida? Digite *CONTATO* para falar com um atendente."
- Retorne APENAS o FAQ melhorado, sem explicaÃ§Ãµes`
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
// CRUD: Custom Commands (Comandos DinÃ¢micos do Operador)
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
    if (!triggers) return res.status(400).json({ error: 'Triggers (palavras de comando) sÃ£o obrigatÃ³rios.' });

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
    if (!triggers) return res.status(400).json({ error: 'Triggers sÃ£o obrigatÃ³rios.' });

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
    if (!name) return res.status(400).json({ error: 'Nome obrigatÃ³rio' });
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
    if (!shortcut || !title || !content) return res.status(400).json({ error: 'shortcut, title e content sÃ£o obrigatÃ³rios' });
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
    if (!message || !scheduledAt) return res.status(400).json({ error: 'message e scheduledAt sÃ£o obrigatÃ³rios' });
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
// O handler completo foi extraído para aiTestHandler.ts para replicar
// o fluxo EXATO do flow.ts (menu, navegação, saudação, IA + Function Calling).
import { handleAiTest } from './aiTestHandler';
router.post('/ai-test', handleAiTest);

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
        return res.status(400).json({ error: 'Tipo invÃ¡lido. Use: contacts, messages, forms, leads' });
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

// ==========================================
// MARKETING ROUTES
// ==========================================

import fs from 'fs';
import path from 'path';
import { getSock } from '../bot/connection';
import { delay } from '@whiskeysockets/baileys';
import { sendItemWithImages } from '../bot/modules/menuNavigation';
import { isSpecialSubcategory, userSubcategoryContext } from '../bot/modules/helpers';
import { startForm } from '../bot/modules/formHandler';
import { handleDuvidas, sendHumanContact } from '../bot/modules/specialActions';

function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return null;
  if (clean.length === 10) clean = `55${clean}`;
  else if (clean.length === 11) clean = `55${clean}`;
  else if (!clean.startsWith('55') && clean.length > 11) clean = `55${clean}`;
  return `${clean}@s.whatsapp.net`;
}

// Upload Media
router.post('/marketing/upload-media', (req, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) return res.status(400).json({ error: 'Filename and base64 are required' });

    const base64Data = base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const ext = path.extname(filename) || '.bin';
    const safeName = `camp_media_${Date.now()}${ext}`;

    const uploadDir = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, base64Data, 'base64');

    res.json({ success: true, path: filePath });
  } catch (err: any) {
    console.error('POST /marketing/upload-media error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Marketing Templates
router.get('/marketing/templates', (_req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM marketing_template ORDER BY id DESC').all();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/marketing/templates', (req, res) => {
  try {
    const { name, messageContent, imagePath } = req.body;
    if (!name || !messageContent) return res.status(400).json({ error: 'Name and messageContent required' });

    const stmt = db.prepare('INSERT INTO marketing_template (name, messageContent, imagePath) VALUES (?, ?, ?)');
    const info = stmt.run(name, messageContent, imagePath || null);

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/marketing/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM marketing_template WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar template existente (edição)
router.put('/marketing/templates/:id', (req, res) => {
  try {
    const { name, messageContent, imagePath } = req.body;
    if (!name || !messageContent) return res.status(400).json({ error: 'Name and messageContent required' });
    db.prepare('UPDATE marketing_template SET name = ?, messageContent = ?, imagePath = ? WHERE id = ?')
      .run(name, messageContent, imagePath || null, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Custom Commands (for Marketing insert)
router.get('/marketing/commands', (_req, res) => {
  try {
    const commands = db.prepare('SELECT id, triggers FROM custom_command WHERE isActive = 1').all();
    res.json(commands);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Marketing Message
router.post('/marketing/test', async (req, res) => {
  try {
    const { phoneNumber, messageContent, imagePath } = req.body;
    if (!phoneNumber || !messageContent) return res.status(400).json({ error: 'Phone and message required' });

    const sock = getSock();
    if (!sock) return res.status(500).json({ error: 'WhatsApp not connected' });

    const jid = formatPhoneNumber(phoneNumber);
    if (!jid) return res.status(400).json({ error: 'Invalid phone number format' });

    let textParams = messageContent.replace(/\{\{nome\}\}/gi, 'Teste');

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

    const msgPayload: any = {};
    if (imagePath && fs.existsSync(imagePath)) {
      const ext = imagePath.split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'avi', 'mov'].includes(ext)) {
        msgPayload.video = { url: imagePath };
        msgPayload.caption = textParams;
      } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
        msgPayload.document = { url: imagePath };
        msgPayload.fileName = imagePath.split(/[\/\\]/).pop() || 'Documento';
        msgPayload.mimetype = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
        msgPayload.caption = textParams;
      } else {
        msgPayload.image = { url: imagePath };
        msgPayload.caption = textParams;
      }
    } else if (textParams.length > 0) {
      msgPayload.text = textParams;
    }

    if (Object.keys(msgPayload).length > 0) {
      await sock.sendMessage(jid, msgPayload);
      await delay(1000);
    }

    if (attachedFiles.length > 0) {
      for (const file of attachedFiles) {
        if (file.data) {
          const matches = file.data.match(/^data:(.+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            const mimetype = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            await sock.sendMessage(jid, { document: buffer, mimetype, fileName: file.name });
            await delay(1000);
          }
        }
      }
    }

    const contactRecord = db.prepare('SELECT id FROM contact WHERE jid = ?').get(jid) as any;
    const contactId = contactRecord ? contactRecord.id : null;

    for (const itemId of linkedItemIds) {
      const item = db.prepare('SELECT * FROM item WHERE id = ?').get(itemId) as any;
      if (item) {
        await sendItemWithImages(sock, jid, contactId, item);
        await delay(1000);
      }
    }

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
            items.forEach((item: any, idx: number) => itemsText += `*${idx + 1}* - ${item.name}\n`);
            itemsText += `\nDigite *VOLTAR* para voltar.`;
            await sock.sendMessage(jid, { text: itemsText });
          } else {
            await sock.sendMessage(jid, { text: `📂 *${sub.name}*\n\nNenhum item cadastrado nesta subcategoria.\n\nDigite *VOLTAR* para voltar.` });
          }
        }
        await delay(1000);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('POST /marketing/test error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Lista todos os leads de marketing (fonte unificada) ───
router.get('/marketing/leads', (_req, res) => {
  try {
    const leads = db.prepare('SELECT * FROM marketing_lead ORDER BY id DESC').all();
    res.json(leads);
  } catch (err: any) {
    console.error('GET /marketing/leads error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload CSV de leads de marketing (com novos campos) ───
router.post('/marketing/csv-upload', (req, res) => {
  try {
    const { leads } = req.body; // Array de { name, phoneNumber, neighborhood, category, state, city, email, address, website }
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'Leads array is required' });
    }

    // Prepared statement com todos os campos disponíveis
    const insertLead = db.prepare(
      `INSERT OR IGNORE INTO marketing_lead (name, phoneNumber, source, neighborhood, category, state, city, email, address, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let insertedCount = 0;

    db.transaction(() => {
      for (const lead of leads) {
        const info = insertLead.run(
          lead.name || null,
          lead.phoneNumber,
          'csv',
          lead.neighborhood || null,
          lead.category || null,
          lead.state || null,
          lead.city || null,
          lead.email || null,
          lead.address || null,
          lead.website || null
        );
        if (info.changes > 0) insertedCount++;
      }
    })();

    res.json({ success: true, inserted: insertedCount });
  } catch (err: any) {
    console.error('POST /marketing/csv-upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Importação de .db externo (scraper) → marketing_lead (importação estruturada) ───
// Abre o banco externo em modo readonly, lê apenas as colunas relevantes
// e insere na tabela marketing_lead do chromah.db
router.post('/marketing/import-db', uploadDb.single('file'), (req, res) => {
  try {
    const dbFilePath = req.file?.path || req.body?.dbPath || path.resolve(__dirname, '../../../data/scraper.db');

    // Verificar se o arquivo existe
    if (!fs.existsSync(dbFilePath)) {
      return res.status(400).json({ error: `Arquivo não encontrado: ${dbFilePath}` });
    }

    // Abrir banco externo em modo somente leitura
    const externalDb = new Database(dbFilePath, { readonly: true });

    // Buscar tabelas disponíveis para detectar a estrutura
    const tables = externalDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    // Tentar encontrar a tabela de dados (establishments ou a primeira tabela com phone_number)
    let targetTable = 'establishments';
    if (!tableNames.includes(targetTable)) {
      // Procurar qualquer tabela com coluna phone_number ou phoneNumber
      for (const tn of tableNames) {
        const cols = externalDb.prepare(`PRAGMA table_info(${tn})`).all() as { name: string }[];
        if (cols.some(c => c.name === 'phone_number' || c.name === 'phoneNumber')) {
          targetTable = tn;
          break;
        }
      }
    }

    // Detectar colunas disponíveis na tabela alvo
    const availableCols = externalDb.prepare(`PRAGMA table_info(${targetTable})`).all() as { name: string }[];
    const colNames = availableCols.map(c => c.name);

    // Construir SELECT com colunas que existem no banco externo
    const colMapping: Record<string, string> = {
      'title': 'name', 'name': 'name',
      'phone_number': 'phoneNumber', 'phoneNumber': 'phoneNumber',
      'category': 'category',
      'state': 'state',
      'city': 'city',
      'neighborhood': 'neighborhood',
      'email': 'email',
      'address': 'address',
      'website': 'website'
    };

    // Selecionar colunas que existem
    const selectCols = Object.keys(colMapping).filter(c => colNames.includes(c));
    if (selectCols.length === 0) {
      externalDb.close();
      return res.status(400).json({ error: 'Nenhuma coluna compatível encontrada no banco externo' });
    }

    // Buscar registros com telefone válido
    const phoneCol = colNames.includes('phone_number') ? 'phone_number' : 'phoneNumber';
    const rows = externalDb.prepare(
      `SELECT ${selectCols.join(', ')} FROM ${targetTable} WHERE ${phoneCol} IS NOT NULL AND ${phoneCol} != ''`
    ).all() as any[];

    externalDb.close();

    // Inserir na marketing_lead com normalização
    const insertLead = db.prepare(
      `INSERT OR IGNORE INTO marketing_lead (name, phoneNumber, source, neighborhood, category, state, city, email, address, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let insertedCount = 0;

    db.transaction(() => {
      for (const row of rows) {
        const info = insertLead.run(
          row.title || row.name || null,
          row.phone_number || row.phoneNumber,
          'db_import',
          row.neighborhood || null,
          row.category || null,
          row.state || null,
          row.city || null,
          row.email || null,
          row.address || null,
          row.website || null
        );
        if (info.changes > 0) insertedCount++;
      }
    })();

    res.json({ success: true, inserted: insertedCount, total: rows.length });
  } catch (err: any) {
    console.error('POST /marketing/import-db error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Deletar lead de marketing ───
router.delete('/marketing/leads/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM marketing_lead WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Campaigns
router.get('/marketing/campaigns', (_req, res) => {
  try {
    const campaigns = db.prepare('SELECT * FROM marketing_campaign ORDER BY id DESC').all();
    // For each campaign, attach the stats from the queue
    const queueStats = db.prepare('SELECT campaignId, status, COUNT(*) as count FROM marketing_queue GROUP BY campaignId, status').all() as any[];

    const enrichedCampaigns = campaigns.map((c: any) => {
      const stats = queueStats.filter(s => s.campaignId === c.id);
      const total = stats.reduce((acc, s) => acc + s.count, 0);
      const sent = stats.find(s => s.status === 'sent')?.count || 0;
      const failed = stats.find(s => s.status === 'failed')?.count || 0;
      const pending = stats.find(s => s.status === 'pending')?.count || 0;

      return { ...c, stats: { total, sent, failed, pending } };
    });

    res.json(enrichedCampaigns);
  } catch (err: any) {
    console.error('GET /marketing/campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create Campaign
router.post('/marketing/campaigns', (req, res) => {
  try {
    const { name, messageContent, imagePath, minDelay, maxDelay, targetLeads, scheduledAt } = req.body;

    if (!name || !messageContent || !targetLeads || !Array.isArray(targetLeads) || targetLeads.length === 0) {
      return res.status(400).json({ error: 'Name, messageContent, and a non-empty targetLeads array are required' });
    }

    // Se tem agendamento, status inicia como 'scheduled'; senão 'paused' (manual)
    const initialStatus = scheduledAt ? 'scheduled' : 'paused';

    let campaignId: number | bigint = 0;
    db.transaction(() => {
      const result = db.prepare('INSERT INTO marketing_campaign (name, messageContent, imagePath, minDelay, maxDelay, status, scheduledAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(name, messageContent, imagePath || null, minDelay || 30, maxDelay || 90, initialStatus, scheduledAt || null);

      campaignId = result.lastInsertRowid;

      const insertQueue = db.prepare('INSERT INTO marketing_queue (campaignId, phoneNumber, contactName, status) VALUES (?, ?, ?, ?)');
      for (const lead of targetLeads) {
        insertQueue.run(campaignId, lead.phoneNumber, lead.name || null, 'pending');
      }
    })();

    res.json({ success: true, campaignId: Number(campaignId) });
  } catch (err: any) {
    console.error('POST /marketing/campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Campaign Status
router.put('/marketing/campaigns/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'paused', 'running', 'cancelled'

    if (!['paused', 'running', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    db.prepare('UPDATE marketing_campaign SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('PUT /marketing/campaigns/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Exportar dados da fila de uma campanha (para CSV no frontend) ───
router.get('/marketing/campaigns/:id/queue', (req, res) => {
  try {
    const { id } = req.params;
    const rows = db.prepare('SELECT * FROM marketing_queue WHERE campaignId = ? ORDER BY id').all(id);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /marketing/campaigns/:id/queue error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══ ROTAS DE AGENDAMENTOS MÚLTIPLOS ═══

// Listar todos os agendamentos com dados do template vinculado
router.get('/marketing/schedules', (_req, res) => {
  try {
    const schedules = db.prepare(`
      SELECT s.*, t.name as templateName, t.messageContent, t.imagePath
      FROM marketing_schedule s
      LEFT JOIN marketing_template t ON s.templateId = t.id
      ORDER BY s.scheduledDate ASC, s.scheduledTime ASC
    `).all();
    res.json(schedules);
  } catch (err: any) {
    console.error('GET /marketing/schedules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Criar um novo agendamento baseado em template
router.post('/marketing/schedules', (req, res) => {
  try {
    const { templateId, scheduledDate, scheduledTime, minDelay, maxDelay, targetFilters, selectedPhones } = req.body;
    if (!templateId || !scheduledDate || !scheduledTime || !selectedPhones?.length) {
      return res.status(400).json({ error: 'templateId, scheduledDate, scheduledTime e selectedPhones são obrigatórios' });
    }
    const result = db.prepare(
      'INSERT INTO marketing_schedule (templateId, scheduledDate, scheduledTime, minDelay, maxDelay, targetFilters, selectedPhones, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(templateId, scheduledDate, scheduledTime, minDelay || 30, maxDelay || 90, JSON.stringify(targetFilters || {}), JSON.stringify(selectedPhones), 'pending');
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    console.error('POST /marketing/schedules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Excluir um agendamento
router.delete('/marketing/schedules/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM marketing_schedule WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /marketing/schedules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// CLIENTES ROUTES (CRUD + Importação CSV / DB)
// ══════════════════════════════════════════════════

// ─── Lista todos os clientes ───
router.get('/clients', (_req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM client ORDER BY id DESC').all();
    res.json(clients);
  } catch (err: any) {
    console.error('GET /clients error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Adicionar cliente manualmente ───
router.post('/clients', (req, res) => {
  try {
    const { name, phoneNumber, category, state, city, neighborhood, email, address, website, notes } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'Telefone é obrigatório' });

    const result = db.prepare(
      `INSERT OR IGNORE INTO client (name, phoneNumber, source, category, state, city, neighborhood, email, address, website, notes)
       VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name || null, phoneNumber, category || null, state || null, city || null, neighborhood || null, email || null, address || null, website || null, notes || null);

    if (result.changes === 0) {
      return res.status(409).json({ error: 'Cliente com este telefone já existe' });
    }

    const newClient = db.prepare('SELECT * FROM client WHERE id = ?').get(result.lastInsertRowid);
    res.json(newClient);
  } catch (err: any) {
    console.error('POST /clients error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Editar cliente ───
router.put('/clients/:id', (req, res) => {
  try {
    const { name, phoneNumber, category, state, city, neighborhood, email, address, website, notes } = req.body;
    db.prepare(
      `UPDATE client SET name=?, phoneNumber=?, category=?, state=?, city=?, neighborhood=?, email=?, address=?, website=?, notes=? WHERE id=?`
    ).run(name || null, phoneNumber, category || null, state || null, city || null, neighborhood || null, email || null, address || null, website || null, notes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM client WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Remover cliente ───
router.delete('/clients/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM client WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /clients/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Importar CSV → tabela client ───
router.post('/clients/csv-upload', (req, res) => {
  try {
    const { leads } = req.body; // Array de { name, phoneNumber, category, state, city, neighborhood, email, address, website, notes }
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'Array de clientes é obrigatório' });
    }

    const insertClient = db.prepare(
      `INSERT OR IGNORE INTO client (name, phoneNumber, source, category, state, city, neighborhood, email, address, website, notes)
       VALUES (?, ?, 'csv', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let insertedCount = 0;

    db.transaction(() => {
      for (const c of leads) {
        const info = insertClient.run(
          c.name || null, c.phoneNumber, c.category || null,
          c.state || null, c.city || null, c.neighborhood || null,
          c.email || null, c.address || null, c.website || null, c.notes || null
        );
        if (info.changes > 0) insertedCount++;
      }
    })();

    res.json({ success: true, inserted: insertedCount });
  } catch (err: any) {
    console.error('POST /clients/csv-upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Importar .db externo → tabela client (mesma lógica do marketing) ───
router.post('/clients/import-db', uploadDb.single('file'), (req, res) => {
  try {
    const dbFilePath = req.file?.path || req.body?.dbPath || path.resolve(__dirname, '../../../data/scraper.db');

    if (!fs.existsSync(dbFilePath)) {
      return res.status(400).json({ error: `Arquivo não encontrado: ${dbFilePath}` });
    }

    const externalDb = new Database(dbFilePath, { readonly: true });

    // Detectar tabela alvo
    const tables = externalDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    let targetTable = 'establishments';
    if (!tables.some(t => t.name === targetTable)) {
      for (const t of tables) {
        const cols = externalDb.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[];
        if (cols.some(c => c.name === 'phone_number' || c.name === 'phoneNumber')) {
          targetTable = t.name;
          break;
        }
      }
    }

    const availableCols = externalDb.prepare(`PRAGMA table_info(${targetTable})`).all() as { name: string }[];
    const colNames = availableCols.map(c => c.name);
    const phoneCol = colNames.includes('phone_number') ? 'phone_number' : 'phoneNumber';

    const selectCols = ['title', 'name', 'phone_number', 'phoneNumber', 'category', 'state', 'city', 'neighborhood', 'email', 'address', 'website']
      .filter(c => colNames.includes(c));

    const rows = externalDb.prepare(
      `SELECT ${selectCols.join(', ')} FROM ${targetTable} WHERE ${phoneCol} IS NOT NULL AND ${phoneCol} != ''`
    ).all() as any[];

    externalDb.close();

    const insertClient = db.prepare(
      `INSERT OR IGNORE INTO client (name, phoneNumber, source, category, state, city, neighborhood, email, address, website)
       VALUES (?, ?, 'db_import', ?, ?, ?, ?, ?, ?, ?)`
    );
    let insertedCount = 0;

    db.transaction(() => {
      for (const row of rows) {
        const info = insertClient.run(
          row.title || row.name || null,
          row.phone_number || row.phoneNumber,
          row.category || null,
          row.state || null, row.city || null, row.neighborhood || null,
          row.email || null, row.address || null, row.website || null
        );
        if (info.changes > 0) insertedCount++;
      }
    })();

    res.json({ success: true, inserted: insertedCount, total: rows.length });
  } catch (err: any) {
    console.error('POST /clients/import-db error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

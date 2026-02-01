import { Router } from 'express';
import db from '../infrastructure/database';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/config', (_req, res) => {
  try {
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
    res.json(config || {});
  } catch (err) {
    console.error('GET /config error:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.put('/config', (req, res) => {
  try {
    const data = req.body ?? {};
    db.prepare(`
      UPDATE config SET
        welcomeMessage = COALESCE(?, welcomeMessage),
        welcomeImageUrl = ?,
        logoImage = ?,
        documentacao = ?,
        whatsappLink = ?,
        openaiApiKey = ?,
        geminiApiKey = ?,
        deepseekApiKey = ?,
        groqApiKey = ?,
        activeAiProvider = COALESCE(?, activeAiProvider),
        systemPrompt = ?,
        assistantContext = ?,
        faqText = ?,
        atendimentoPhones = ?,
        contatoHumano = ?
      WHERE id = 1
    `).run(
      data.welcomeMessage, data.welcomeImageUrl, data.logoImage,
      data.documentacao, data.whatsappLink, data.openaiApiKey,
      data.geminiApiKey, data.deepseekApiKey, data.groqApiKey,
      data.activeAiProvider, data.systemPrompt, data.assistantContext,
      data.faqText, data.atendimentoPhones, data.contatoHumano
    );
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
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
      INSERT INTO item (subcategoryId, name, title, description, price, locationLink, contactLink, webLink, imageUrls, empresa, contato, email, endereco, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subcategoryId, data.name, data.title || null, data.description || null,
      data.price || null, data.locationLink || null, data.contactLink || null,
      data.webLink || null, data.imageUrls || null, data.empresa || null,
      data.contato || null, data.email || null, data.endereco || null,
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
        empresa = ?,
        contato = ?,
        email = ?,
        endereco = ?,
        enabled = ?
      WHERE id = ?
    `).run(
      data.name, data.title, data.description, data.price,
      data.locationLink, data.contactLink, data.webLink, data.imageUrls,
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

export default router;

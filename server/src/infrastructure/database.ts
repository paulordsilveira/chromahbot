import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../data/chromah.db');
const db = Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    welcomeMessage TEXT DEFAULT 'Olá! Seja bem-vindo ao assistente virtual.',
    welcomeImageUrl TEXT,
    logoImage TEXT,
    openaiApiKey TEXT,
    geminiApiKey TEXT,
    deepseekApiKey TEXT,
    groqApiKey TEXT,
    activeAiProvider TEXT DEFAULT 'gemini',
    systemPrompt TEXT,
    assistantContext TEXT,
    documentacao TEXT,
    faqText TEXT,
    atendimentoPhones TEXT,
    whatsappLink TEXT,
    contatoHumano TEXT
  );

  CREATE TABLE IF NOT EXISTS category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT,
    "order" INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subcategory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT,
    "order" INTEGER DEFAULT 0,
    categoryId INTEGER NOT NULL,
    enabledInBot INTEGER DEFAULT 1,
    FOREIGN KEY (categoryId) REFERENCES category(id)
  );

  CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategoryId INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    price TEXT,
    locationLink TEXT,
    contactLink TEXT,
    webLink TEXT,
    imageUrls TEXT,
    empresa TEXT,
    contato TEXT,
    email TEXT,
    endereco TEXT,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subcategoryId) REFERENCES subcategory(id)
  );

  CREATE TABLE IF NOT EXISTS contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    profilePicUrl TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contactId INTEGER NOT NULL,
    content TEXT,
    role TEXT DEFAULT 'user',
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contactId) REFERENCES contact(id)
  );

  CREATE TABLE IF NOT EXISTS form (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    data TEXT,
    subCategoryId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subCategoryId) REFERENCES subcategory(id)
  );
`);

// Migrations for existing databases
const addColumnIfNotExists = (table: string, column: string, type: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
};

addColumnIfNotExists('contact', 'profilePicUrl', 'TEXT');
addColumnIfNotExists('config', 'logoImage', 'TEXT');
addColumnIfNotExists('config', 'documentacao', 'TEXT');
addColumnIfNotExists('config', 'whatsappLink', 'TEXT');
addColumnIfNotExists('category', 'emoji', 'TEXT');
addColumnIfNotExists('subcategory', 'emoji', 'TEXT');
addColumnIfNotExists('item', 'videoUrls', 'TEXT');
addColumnIfNotExists('item', 'documentUrls', 'TEXT');
addColumnIfNotExists('config', 'openRouterApiKey', 'TEXT');
addColumnIfNotExists('config', 'selectedModel', 'TEXT');

// CRM columns for contact
addColumnIfNotExists('contact', 'statusAtual', "TEXT DEFAULT 'atendido'");
addColumnIfNotExists('contact', 'statusHistorico', 'TEXT');
addColumnIfNotExists('contact', 'observacao', 'TEXT');

// Lead/Notification system
addColumnIfNotExists('config', 'notificationPhone', 'TEXT');
addColumnIfNotExists('config', 'humanKeywords', 'TEXT');
addColumnIfNotExists('config', 'pauseCommands', 'TEXT');
addColumnIfNotExists('config', 'resumeCommands', 'TEXT');
addColumnIfNotExists('config', 'docCommands', 'TEXT');
addColumnIfNotExists('config', 'menuCommands', 'TEXT');
addColumnIfNotExists('config', 'docsMessage', 'TEXT');
addColumnIfNotExists('config', 'docsFiles', 'TEXT');
addColumnIfNotExists("config", "isAiEnabled", "INTEGER DEFAULT 1");
addColumnIfNotExists('config', 'botNumber', 'TEXT');
addColumnIfNotExists('config', 'assistantName', "TEXT DEFAULT 'Mobius'");
addColumnIfNotExists('contact', 'botPaused', 'INTEGER DEFAULT 0');

// Lead tickets table
db.exec(`
  CREATE TABLE IF NOT EXISTS lead_ticket (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contactId INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    summary TEXT,
    notifiedAt TEXT DEFAULT (datetime('now')),
    attendedAt TEXT,
    FOREIGN KEY (contactId) REFERENCES contact(id)
  );

  CREATE TABLE IF NOT EXISTS lead_ticket_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'bg-ch-cyan/20 text-ch-cyan',
    "order" INTEGER DEFAULT 0
  );
`);

// Seed default statuses if empty
const existingLeadStatuses = db.prepare('SELECT COUNT(*) as count FROM lead_ticket_status').get() as { count: number };
if (existingLeadStatuses.count === 0) {
  const insertStatus = db.prepare('INSERT INTO lead_ticket_status (name, color, "order") VALUES (?, ?, ?)');
  const defaultStatuses = [
    ['Pendente', 'bg-amber-500/15 text-amber-400', 1],
    ['Atendido', 'bg-ch-cyan/15 text-ch-cyan', 2],
    ['Finalizado', 'bg-ch-muted/15 text-ch-muted', 3],
  ];
  for (const [name, color, order] of defaultStatuses) {
    insertStatus.run(name, color, order as number);
  }
}

// Convert old string statuses to the new capitalized names if running on v1 to v2 migration
db.prepare("UPDATE lead_ticket SET status = 'Pendente' WHERE status = 'pending'").run();
db.prepare("UPDATE lead_ticket SET status = 'Atendido' WHERE status = 'attended'").run();
db.prepare("UPDATE lead_ticket SET status = 'Finalizado' WHERE status = 'closed'").run();

// Custom Commands table
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_command (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    triggers TEXT NOT NULL,
    textMessage TEXT,
    fileData TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    linkedSubcategoryId INTEGER,
    linkedItemId INTEGER
  );
`);

addColumnIfNotExists('custom_command', 'isActive', 'INTEGER DEFAULT 1');
addColumnIfNotExists('custom_command', 'createdAt', 'TEXT');
addColumnIfNotExists('custom_command', 'linkedSubcategoryId', 'INTEGER');
addColumnIfNotExists('custom_command', 'linkedItemId', 'INTEGER');
db.prepare("UPDATE custom_command SET createdAt = datetime('now', 'localtime') WHERE createdAt IS NULL").run();

// ─── Tags system ───
db.exec(`
  CREATE TABLE IF NOT EXISTS tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#00bcd4',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_tag (
    contactId INTEGER NOT NULL,
    tagId INTEGER NOT NULL,
    PRIMARY KEY (contactId, tagId),
    FOREIGN KEY (contactId) REFERENCES contact(id),
    FOREIGN KEY (tagId) REFERENCES tag(id)
  );
`);

// ─── Scheduled Messages ───
db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contactId INTEGER,
    targetJid TEXT,
    message TEXT NOT NULL,
    scheduledAt TEXT NOT NULL,
    sentAt TEXT,
    status TEXT DEFAULT 'pending',
    isBroadcast INTEGER DEFAULT 0,
    broadcastTagId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (contactId) REFERENCES contact(id),
    FOREIGN KEY (broadcastTagId) REFERENCES tag(id)
  );
`);

// ─── Quick Replies (Templates) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS quick_reply (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shortcut TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'geral',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Marketing Module ───
db.exec(`
  CREATE TABLE IF NOT EXISTS marketing_campaign (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    messageContent TEXT NOT NULL,
    imagePath TEXT,
    minDelay INTEGER DEFAULT 30,
    maxDelay INTEGER DEFAULT 90,
    status TEXT DEFAULT 'paused', -- 'paused', 'running', 'scheduled', 'completed', 'cancelled'
    scheduledAt TEXT, -- ISO date/time para agendamento (null = imediato)
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketing_lead (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phoneNumber TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'csv', -- 'csv', 'scraper'
    neighborhood TEXT,
    category TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS marketing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaignId INTEGER NOT NULL,
    phoneNumber TEXT NOT NULL,
    contactName TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    scheduledFor TEXT,
    sentAt TEXT,
    errorLog TEXT,
    FOREIGN KEY (campaignId) REFERENCES marketing_campaign(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS marketing_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    messageContent TEXT NOT NULL,
    imagePath TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  -- Tabela para agendamentos múltiplos baseados em templates
  CREATE TABLE IF NOT EXISTS marketing_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    templateId INTEGER NOT NULL,
    scheduledDate TEXT NOT NULL,
    scheduledTime TEXT NOT NULL,
    minDelay INTEGER DEFAULT 30,
    maxDelay INTEGER DEFAULT 90,
    targetFilters TEXT,
    selectedPhones TEXT,
    status TEXT DEFAULT 'pending',
    campaignId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (templateId) REFERENCES marketing_template(id) ON DELETE CASCADE
  );
`);

// ─── Migrações: Novas colunas em marketing_lead (importação estruturada) ───
addColumnIfNotExists('marketing_lead', 'state', 'TEXT');       // Estado geográfico (ex: "SP")
addColumnIfNotExists('marketing_lead', 'city', 'TEXT');        // Cidade (ex: "São Paulo")
addColumnIfNotExists('marketing_lead', 'email', 'TEXT');       // E-mail de contato
addColumnIfNotExists('marketing_lead', 'address', 'TEXT');     // Endereço completo
addColumnIfNotExists('marketing_lead', 'website', 'TEXT');     // Website do lead

// ─── Tabela de Clientes (mesma estrutura do marketing_lead, propósito diferente) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS client (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phoneNumber TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'manual',       -- 'manual', 'csv', 'db_import'
    category TEXT,
    state TEXT,
    city TEXT,
    neighborhood TEXT,
    email TEXT,
    address TEXT,
    website TEXT,
    notes TEXT,                          -- observações livres sobre o cliente
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Índices para performance nos filtros geográficos ───
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ml_state ON marketing_lead(state);
  CREATE INDEX IF NOT EXISTS idx_ml_city ON marketing_lead(city);
  CREATE INDEX IF NOT EXISTS idx_ml_neighborhood ON marketing_lead(neighborhood);
  CREATE INDEX IF NOT EXISTS idx_ml_phone ON marketing_lead(phoneNumber);
  CREATE INDEX IF NOT EXISTS idx_cl_state ON client(state);
  CREATE INDEX IF NOT EXISTS idx_cl_city ON client(city);
  CREATE INDEX IF NOT EXISTS idx_cl_neighborhood ON client(neighborhood);
  CREATE INDEX IF NOT EXISTS idx_cl_phone ON client(phoneNumber);
`);

// ─── Business Hours ───
addColumnIfNotExists('config', 'businessHoursEnabled', 'INTEGER DEFAULT 0');
addColumnIfNotExists('config', 'businessHoursStart', "TEXT DEFAULT '09:00'");
addColumnIfNotExists('config', 'businessHoursEnd', "TEXT DEFAULT '18:00'");
addColumnIfNotExists('config', 'businessDays', "TEXT DEFAULT '1,2,3,4,5'");
addColumnIfNotExists('config', 'outsideHoursMessage', "TEXT DEFAULT 'Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 09:00 às 18:00. Sua mensagem será respondida no próximo dia útil.'");

// Migração: adicionar scheduledAt para campanhas agendadas
addColumnIfNotExists('marketing_campaign', 'scheduledAt', 'TEXT');

const existingConfig = db.prepare('SELECT id FROM config WHERE id = 1').get();
if (!existingConfig) {
  db.prepare(`INSERT INTO config (id, welcomeMessage, activeAiProvider) VALUES (1, 'Olá! Seja bem-vindo à ChromaH — soluções digitais conscientes. Como posso ajudar?', 'gemini')`).run();
}

const existingCategories = db.prepare('SELECT COUNT(*) as count FROM category').get() as { count: number };
if (existingCategories.count === 0) {
  const insertCat = db.prepare('INSERT INTO category (name, "order") VALUES (?, ?)');
  const categories = [
    ['Soluções IA', 1],
    ['Automações', 2],
    ['Consultoria', 3],
    ['Recursos', 4],
    ['Suporte', 5],
  ];
  for (const [name, order] of categories) {
    insertCat.run(name, order);
  }

}

export default db;

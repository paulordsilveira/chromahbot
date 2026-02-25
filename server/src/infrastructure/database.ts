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
`);

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

// ─── Business Hours ───
addColumnIfNotExists('config', 'businessHoursEnabled', 'INTEGER DEFAULT 0');
addColumnIfNotExists('config', 'businessHoursStart', "TEXT DEFAULT '09:00'");
addColumnIfNotExists('config', 'businessHoursEnd', "TEXT DEFAULT '18:00'");
addColumnIfNotExists('config', 'businessDays', "TEXT DEFAULT '1,2,3,4,5'");
addColumnIfNotExists('config', 'outsideHoursMessage', "TEXT DEFAULT 'Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 09:00 às 18:00. Sua mensagem será respondida no próximo dia útil.'");

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

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../data/corretando.db');
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

const existingConfig = db.prepare('SELECT id FROM config WHERE id = 1').get();
if (!existingConfig) {
  db.prepare(`INSERT INTO config (id, welcomeMessage, activeAiProvider) VALUES (1, 'Olá! Seja bem-vindo ao assistente virtual da Corretando. Como posso ajudar hoje?', 'gemini')`).run();
}

const existingCategories = db.prepare('SELECT COUNT(*) as count FROM category').get() as { count: number };
if (existingCategories.count === 0) {
  const insertCat = db.prepare('INSERT INTO category (name, "order") VALUES (?, ?)');
  const categories = [
    ['Portfólio de Imóveis', 1],
    ['Terreno e Construção', 2],
    ['Minha Casa Minha Vida', 3],
    ['Parcerias (Corretores)', 4],
    ['Serviços de Corretagem', 5],
    ['Status / Acompanhamento', 6],
    ['Recados / Outros', 7],
  ];
  for (const [name, order] of categories) {
    insertCat.run(name, order);
  }

}

export default db;

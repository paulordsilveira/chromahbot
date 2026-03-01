/**
 * auth.ts — Configuração do Better Auth para o ChromaH Bot
 * 
 * Responsabilidades:
 * 1. Configurar a instância Better Auth com banco SQLite existente
 * 2. Gerenciar autenticação via email/senha
 * 3. Gerenciar sessões de usuários
 * 4. Criar tabelas de auth automaticamente (user, session, account, verification)
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// IMPORTANTE: Carregar .env ANTES de qualquer acesso a process.env
// Este módulo é importado antes do dotenv.config() no server.ts
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';

// Usa o mesmo diretório de banco de dados do projeto
const authDbPath = path.resolve(__dirname, '../../data/chromah.db');

// Garante que o diretório data exista
const dataDir = path.dirname(authDbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

console.log('[Auth] Inicializando Better Auth...');
console.log('[Auth] DB Path:', authDbPath);
console.log('[Auth] Secret definido:', !!process.env.BETTER_AUTH_SECRET);
console.log('[Auth] Base URL:', process.env.BETTER_AUTH_URL || 'http://localhost:3020');

/**
 * Instância principal do Better Auth
 * - Usa o mesmo arquivo SQLite do projeto (chromah.db)
 * - Email/senha habilitado por padrão
 * - Sessões gerenciadas automaticamente via cookies
 */
export const auth = betterAuth({
    // Conexão com o banco SQLite existente (better-sqlite3)
    database: new Database(authDbPath),

    // URL base do servidor (Better Auth precisa saber a URL para gerar links)
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3020',

    // Chave secreta para criptografia de sessões
    secret: process.env.BETTER_AUTH_SECRET || 'dev-fallback-secret-chromah-bot-2026',

    // Origens confiáveis para proteção CSRF
    trustedOrigins: (process.env.TRUSTED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

    // Autenticação por email/senha (habilitada por padrão)
    emailAndPassword: {
        enabled: true,
        // Requisitos mínimos de senha
        minPasswordLength: 6,
    },

    // Configurações de sessão
    session: {
        // Tempo de expiração do cookie (7 dias)
        expiresIn: 60 * 60 * 24 * 7,
        // Atualiza o cookie quando faltam 1 dia para expirar
        updateAge: 60 * 60 * 24,
    },
});

console.log('[Auth] Better Auth inicializado com sucesso!');

/**
 * Migração programática — cria tabelas Better Auth automaticamente
 * Tabelas criadas: user, session, account, verification
 * Usa a API oficial getMigrations() do Better Auth
 */
(async () => {
    try {
        const { getMigrations } = await import('better-auth/db/migration');
        const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

        if (toBeCreated.length > 0 || toBeAdded.length > 0) {
            console.log('[Auth] Tabelas a criar:', toBeCreated.map(t => t.table).join(', ') || 'nenhuma');
            console.log('[Auth] Colunas a adicionar:', toBeAdded.length > 0 ? toBeAdded.map(a => `${a.table}.${a.fields?.[0]?.fieldName || '?'}`).join(', ') : 'nenhuma');
            await runMigrations();
            console.log('[Auth] ✅ Migrações executadas com sucesso!');
        } else {
            console.log('[Auth] ✅ Todas as tabelas de auth já existem.');
        }
    } catch (error) {
        console.error('[Auth] ❌ Erro ao executar migrações:', error);
    }
})();

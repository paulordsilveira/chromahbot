/**
 * auth.ts — Configuração do Better Auth para o ChromaH Bot
 * 
 * Responsabilidades:
 * 1. Configurar a instância Better Auth com banco SQLite existente
 * 2. Gerenciar autenticação via email/senha
 * 3. Gerenciar sessões de usuários
 * 4. Criar tabelas de auth automaticamente (user, session, account, verification)
 * 5. Bloquear registro após o primeiro admin (sistema single-owner)
 * 6. Auto-associar o primeiro usuário como ownerId na config
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// IMPORTANTE: Carregar .env ANTES de qualquer acesso a process.env
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

// Instância separada do DB para consultas de auth (evita conflitos com o DB principal)
const authDb = new Database(authDbPath);

/**
 * Instância principal do Better Auth
 * - Usa o mesmo arquivo SQLite do projeto (chromah.db)
 * - Email/senha habilitado
 * - Sessões gerenciadas via cookies (7 dias)
 */
export const auth = betterAuth({
    // Conexão com o banco SQLite existente (better-sqlite3)
    database: authDb,

    // URL base do servidor
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3020',

    // Chave secreta para criptografia de sessões
    secret: process.env.BETTER_AUTH_SECRET || 'dev-fallback-secret-chromah-bot-2026',

    // Origens confiáveis para proteção CSRF
    trustedOrigins: (process.env.TRUSTED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

    // Autenticação por email/senha
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
    },

    // Configurações de sessão
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 dias
        updateAge: 60 * 60 * 24,      // Renova a cada 1 dia
    },

    // ─── Hooks: Controle de registro single-owner ───
    hooks: {
        before: [
            {
                // Hook executado ANTES do sign-up
                matcher(context) {
                    return context.path === '/sign-up/email';
                },
                async handler(ctx) {
                    try {
                        // Verifica se já existe um owner na config
                        const config = authDb.prepare('SELECT ownerId FROM config WHERE id = 1').get() as any;

                        if (config?.ownerId) {
                            // Já tem admin registrado — bloqueia novo registro
                            console.log('[Auth] ❌ Tentativa de registro bloqueada — admin já existe');
                            throw new Error('Registro desabilitado. Apenas o administrador pode acessar o sistema.');
                        }
                    } catch (error: any) {
                        if (error.message.includes('Registro desabilitado')) {
                            // Re-throw para retornar ao cliente como erro
                            throw error;
                        }
                        // Tabela config pode não existir ainda, ignora
                        console.log('[Auth] Primeira execução — permitindo registro inicial');
                    }
                    return { context: ctx };
                },
            },
        ],
        after: [
            {
                // Hook executado DEPOIS do sign-up
                matcher(context) {
                    return context.path === '/sign-up/email';
                },
                async handler(ctx) {
                    try {
                        // Pega o usuário recém-criado da resposta
                        const body = ctx.context.responseBody;
                        if (body && typeof body === 'object' && 'user' in body) {
                            const userId = (body as any).user?.id;
                            if (userId) {
                                // Associa este usuário como owner dos dados na config
                                authDb.prepare('UPDATE config SET ownerId = ? WHERE id = 1').run(userId);
                                console.log(`[Auth] ✅ Usuário ${userId} definido como owner/admin dos dados`);
                            }
                        }
                    } catch (error) {
                        console.error('[Auth] Erro ao definir owner:', error);
                    }
                    return { context: ctx };
                },
            },
        ],
    },
});

console.log('[Auth] Better Auth inicializado com sucesso!');

/**
 * Migração programática — cria tabelas Better Auth automaticamente
 * Tabelas criadas: user, session, account, verification
 */
(async () => {
    try {
        const { getMigrations } = await import('better-auth/db/migration');
        const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

        if (toBeCreated.length > 0 || toBeAdded.length > 0) {
            console.log('[Auth] Tabelas a criar:', toBeCreated.map(t => t.table).join(', ') || 'nenhuma');
            await runMigrations();
            console.log('[Auth] ✅ Migrações executadas com sucesso!');
        } else {
            console.log('[Auth] ✅ Tabelas de auth já existem.');
        }
    } catch (error) {
        console.error('[Auth] ❌ Erro ao executar migrações:', error);
    }
})();

/**
 * Verifica se um userId é o owner (admin) dos dados
 * Usado pelo middleware de autenticação para validar acesso
 */
export function isOwner(userId: string): boolean {
    try {
        const config = authDb.prepare('SELECT ownerId FROM config WHERE id = 1').get() as any;
        return config?.ownerId === userId;
    } catch {
        return false;
    }
}

/**
 * Retorna o ownerId atual do sistema (ou null se ninguém registrou ainda)
 */
export function getOwnerId(): string | null {
    try {
        const config = authDb.prepare('SELECT ownerId FROM config WHERE id = 1').get() as any;
        return config?.ownerId || null;
    } catch {
        return null;
    }
}

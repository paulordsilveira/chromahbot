/**
 * auth.ts — Configuração do Better Auth para o ChromaH Bot
 * 
 * Responsabilidades:
 * 1. Configurar a instância Better Auth com banco SQLite existente
 * 2. Gerenciar autenticação via email/senha
 * 3. Gerenciar sessões de usuários
 * 4. Criar tabelas de auth automaticamente (user, session, account, verification)
 */
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
import path from 'path';

// Usa o mesmo diretório de banco de dados do projeto
const authDbPath = path.resolve(__dirname, '../../data/chromah.db');

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
    secret: process.env.BETTER_AUTH_SECRET,

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

/**
 * authClient.ts — Cliente Better Auth para o frontend React
 * 
 * Responsabilidades:
 * 1. Criar instância do cliente Better Auth apontando para a API
 * 2. Exportar métodos de autenticação (signIn, signUp, signOut, useSession)
 * 3. Gerenciar sessão do usuário via cookies
 * 
 * Uso: importar { authClient } em qualquer componente React
 */
import { createAuthClient } from 'better-auth/react';

// URL base da API — carregada das variáveis de ambiente do Vite
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3020';

/**
 * Instância do cliente Better Auth para React
 * - Gerencia login, registro, logout, e estado da sessão
 * - Usa cookies para manter a sessão entre recarregamentos
 * - Hook useSession() para acessar dados do usuário logado
 */
export const authClient = createAuthClient({
    baseURL,
});

// Exportações de conveniência para uso direto nos componentes
export const { signIn, signUp, signOut, useSession } = authClient;

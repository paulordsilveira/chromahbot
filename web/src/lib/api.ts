/**
 * api.ts — Instância centralizada do Axios
 * 
 * Responsabilidades:
 * 1. Criar instância axios com baseURL dinâmica (via variável de ambiente)
 * 2. Configurar withCredentials para enviar cookies de sessão
 * 3. Interceptor de resposta para redirecionar ao login quando 401
 * 4. Exportar API_URL para uso direto quando necessário
 * 
 * Uso: importar { api, API_URL } de '@/lib/api' em todas as páginas
 */
import axios from 'axios';

// URL base da API — carregada das variáveis de ambiente do Vite
export const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

/**
 * Instância Axios configurada com:
 * - baseURL: URL da API com prefixo /api
 * - withCredentials: true — envia cookies de sessão Better Auth
 * - timeout: 30 segundos
 */
export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Necessário para enviar cookies de sessão Better Auth
    timeout: 30000,
});

/**
 * Interceptor de resposta — trata erros 401 (não autenticado)
 * Redireciona automaticamente para a página de login
 */
api.interceptors.response.use(
    // Sucesso: retorna normalmente
    (response) => response,
    // Erro: verifica se é 401 para redirecionar
    (error) => {
        if (error.response?.status === 401) {
            // Redireciona para login se a sessão expirou
            // Evita redirecionar se já está na página de login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

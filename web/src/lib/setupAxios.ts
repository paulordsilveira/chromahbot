/**
 * setupAxios.ts — Configuração global do Axios
 * 
 * Este módulo configura o axios globalmente para:
 * 1. Enviar cookies de sessão com todas as requisições (withCredentials)
 * 2. Redirecionar para login em caso de 401 (sessão expirada)
 * 
 * IMPORTANTE: Deve ser importado uma vez no main.tsx antes de qualquer requisição
 */
import axios from 'axios';

// Garante que TODOS os requests axios enviem cookies de sessão
axios.defaults.withCredentials = true;

// Interceptor global — redireciona para login em caso de 401
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

/**
 * authMiddleware.ts — Middleware de proteção de rotas da API
 * 
 * Responsabilidades:
 * 1. Verificar se o usuário está autenticado via sessão Better Auth
 * 2. Bloquear requisições não autenticadas com status 401
 * 3. Passar informações do usuário para as rotas protegidas
 * 
 * Uso: aplicado em todas as rotas /api/* exceto /api/auth/*
 */
import { Request, Response, NextFunction } from 'express';
import { auth } from '../infrastructure/auth';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Middleware que verifica se a requisição possui uma sessão válida.
 * - Se autenticado: adiciona `req.user` e `req.session` e segue adiante
 * - Se não autenticado: retorna 401 Unauthorized
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        // Converte os headers do Node.js para formato compatível com Better Auth
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            res.status(401).json({
                error: 'Não autenticado',
                message: 'Você precisa estar logado para acessar este recurso.'
            });
            return;
        }

        // Adiciona dados de sessão e usuário ao request para uso nas rotas
        (req as any).user = session.user;
        (req as any).session = session.session;

        next();
    } catch (error) {
        console.error('[Auth Middleware] Erro ao verificar sessão:', error);
        res.status(401).json({
            error: 'Sessão inválida',
            message: 'Sua sessão expirou ou é inválida. Faça login novamente.'
        });
    }
}

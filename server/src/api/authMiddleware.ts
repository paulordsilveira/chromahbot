/**
 * authMiddleware.ts — Middleware de proteção de rotas da API
 * 
 * Responsabilidades:
 * 1. Verificar se o usuário está autenticado via sessão Better Auth
 * 2. Verificar se o usuário é o owner (admin) dos dados
 * 3. Bloquear acesso de não-owners com 403
 * 4. Passar informações do usuário para as rotas protegidas
 * 
 * Uso: aplicado em todas as rotas /api/* exceto /api/auth/*
 */
import { Request, Response, NextFunction } from 'express';
import { auth, isOwner, getOwnerId } from '../infrastructure/auth';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Middleware que verifica:
 * 1. Se o usuário tem sessão válida (autenticado)
 * 2. Se o usuário é o owner/admin dos dados
 * 
 * Se não autenticado → 401
 * Se autenticado mas não é owner → 403
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        // Verifica sessão Better Auth
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

        // Verifica se é o owner (admin) dos dados
        const ownerId = getOwnerId();

        if (ownerId && !isOwner(session.user.id)) {
            // Existe um owner, mas não é este usuário
            res.status(403).json({
                error: 'Acesso negado',
                message: 'Apenas o administrador pode acessar este painel.'
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

/**
 * server.ts — Ponto de entrada principal do servidor
 * 
 * Responsabilidades:
 * 1. Configurar Express com CORS restrito por variável de ambiente
 * 2. Montar rotas Better Auth para autenticação (/api/auth/*)
 * 3. Proteger rotas da API com middleware de autenticação
 * 4. Bridge entre EventBus interno e Socket.IO para o frontend
 * 5. Inicializar bot WhatsApp e marketing worker
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../infrastructure/auth';
import { requireAuth } from './authMiddleware';
import eventBus from '../infrastructure/EventBus';
import routes from './routes';
import '../bot/connection'; // Inicializa conexão com WhatsApp
import '../bot/modules/marketingWorker'; // Inicializa worker de marketing

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const httpServer = createServer(app);

// ─── Domínios permitidos via variável de ambiente ───
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim());

// ─── Socket.IO com CORS restrito ───
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true, // Necessário para cookies de sessão
    }
});

// ─── CORS restrito para Express ───
app.use(cors({
    origin: allowedOrigins,
    credentials: true, // Necessário para cookies de sessão Better Auth
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Rotas Better Auth (públicas — login, registro, etc.) ───
// IMPORTANTE: Montar ANTES do body parser para que Better Auth gerencie o proprio parsing
app.all('/api/auth/*splat', toNodeHandler(auth));

// ─── Rotas da API protegidas por autenticação ───
app.use('/api', requireAuth, routes);

// ─── Estado do bot para novos clientes Socket.IO ───
let currentQrCode: string | null = null;
let currentBotStatus: string = 'disconnected';
let currentBotUser: any = null;

// ─── Socket.IO — conexão de clientes frontend ───
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Envia estado atual ao novo cliente
    socket.emit('bot.status', currentBotStatus);
    if (currentQrCode) {
        socket.emit('bot.qr', currentQrCode);
    }
    if (currentBotUser) {
        socket.emit('bot.user', currentBotUser);
    }
});

// ─── EventBus → Socket.IO bridge ───
// QR Code recebido do bot → envia para todos os clientes frontend
eventBus.on('bot.qr', (qrCode) => {
    currentQrCode = qrCode;
    currentBotStatus = 'qrcode';
    io.emit('bot.qr', qrCode);
    io.emit('bot.status', 'qrcode');
});

// Status da conexão alterado → atualiza estado e notifica frontend
eventBus.on('bot.status', (status) => {
    currentBotStatus = status;
    if (status === 'connected') {
        currentQrCode = null;
    } else if (status === 'disconnected') {
        currentBotUser = null;
    }
    io.emit('bot.status', status);
});

// Informações do usuário do bot → envia para frontend
eventBus.on('bot.user', (user) => {
    currentBotUser = user;
    io.emit('bot.user', user);
});

// Logs do bot → envia para frontend
eventBus.on('bot.log', (log) => {
    io.emit('bot.log', log);
});

// ─── Iniciar servidor ───
const PORT = process.env.PORT || 3020;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`Auth URL: ${process.env.BETTER_AUTH_URL || 'http://localhost:3020'}`);
});

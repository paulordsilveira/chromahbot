import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import eventBus from '../infrastructure/EventBus';
import routes from './routes';
import '../bot/connection'; // Initialize bot connection logic

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev, restrict in prod
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api', routes);

let currentQrCode: string | null = null;
let currentBotStatus: string = 'disconnected';

// Socket.io integration
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.emit('bot.status', currentBotStatus);
    if (currentQrCode) {
        socket.emit('bot.qr', currentQrCode);
    }
});

// EventBus -> Socket.io bridging
eventBus.on('bot.qr', (qrCode) => {
    currentQrCode = qrCode;
    currentBotStatus = 'qrcode';
    io.emit('bot.qr', qrCode);
    io.emit('bot.status', 'qrcode');
});

eventBus.on('bot.status', (status) => {
    currentBotStatus = status;
    if (status === 'connected') {
        currentQrCode = null;
    }
    io.emit('bot.status', status);
});

eventBus.on('bot.log', (log) => {
    io.emit('bot.log', log);
});

const PORT = process.env.PORT || 3020;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

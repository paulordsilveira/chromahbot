import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    ConnectionState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import eventBus from '../infrastructure/EventBus';
import path from 'path';
import './flow'; // Import to register listeners

const AUTH_FOLDER = path.resolve(__dirname, '../../auth_info');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`Using Baileys v${version.join('.')} (Latest: ${isLatest})`);
    eventBus.emit('bot.log', `Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
        },
        logger: P({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR Received');
            eventBus.emit('bot.qr', qr);
            eventBus.emit('bot.status', 'qrcode');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
            eventBus.emit('bot.log', `Connection closed, reconnecting: ${shouldReconnect}`);
            eventBus.emit('bot.status', 'disconnected');

            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Successfully opened connection!');
            eventBus.emit('bot.status', 'connected');
            eventBus.emit('bot.log', 'Successfully opened connection!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Initial message handler placeholder
    sock.ev.on('messages.upsert', async m => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe) {
                    eventBus.emit('message.received', { msg, sock });
                }
            }
        }
    });

    return sock;
}

// Start connection
connectToWhatsApp();

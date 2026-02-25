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

let currentSock: any = null;

async function connectToWhatsApp() {
    // Limpar sock anterior para evitar listeners duplicados
    if (currentSock) {
        try {
            currentSock.ev.removeAllListeners('messages.upsert');
            currentSock.ev.removeAllListeners('connection.update');
            currentSock.ev.removeAllListeners('creds.update');
        } catch (e) {
            // ignore
        }
    }

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

    currentSock = sock;

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

            const user = sock.user;
            if (user) {
                (async () => {
                    let profilePicUrl = null;
                    try {
                        profilePicUrl = await sock.profilePictureUrl(user.id);
                    } catch (e) {
                        console.log('Could not fetch bot profile pic');
                    }
                    eventBus.emit('bot.user', {
                        id: user.id,
                        name: user.name,
                        pic: profilePicUrl
                    });
                })();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message handler
    sock.ev.on('messages.upsert', async m => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                eventBus.emit('message.received', { msg, sock });
            }
        }
    });

    return sock;
}

// Start connection
connectToWhatsApp();


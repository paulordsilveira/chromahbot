# Baileys - WhatsApp Web API Reference

Baileys is a powerful, socket-based TypeScript/JavaScript library for interacting with the WhatsApp Web API. It does not use browser automation (like Puppeteer or Selenium), making it faster and more resource-efficient.

---

## 🚀 Key Features
- **Socket-based:** Direct interaction with WhatsApp servers via WebSockets.
- **Lightweight:** No heavy browser dependencies.
- **Event-driven:** Asynchronous architecture using standard EventEmitter patterns.
- **Multi-Device Support:** Compatible with the latest "Linked Devices" feature.
- **Comprehensive:** Supports text, media (images, video, documents), buttons, lists, and presence updates.

---

## 📦 Installation

Install Baileys using your preferred package manager. Requires Node.js 17+.

```bash
# npm
npm install @whiskeysockets/baileys

# yarn
yarn add @whiskeysockets/baileys

# pnpm
pnpm add @whiskeysockets/baileys
```

---

## 🛠 Basic Usage & Connection

The following example demonstrates how to initialize the connection, handle authentication, and listen for the QR code.

```typescript
import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';

async function connectToWhatsApp() {
    // 1. Setup Authentication State
    // Stores session data in the 'auth_info' folder
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // 2. Fetch Latest Version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

    // 3. Initialize Socket
    const sock = makeWASocket({
        version,
        printQRInTerminal: true, // Displays QR in terminal for scanning
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
        },
        logger: P({ level: 'silent' }) // Change to 'debug' or 'info' for logs
    });

    // 4. Handle Connection Updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp(); // Re-run connection logic
            }
        } else if (connection === 'open') {
            console.log('Successfully opened connection!');
        }
    });

    // 5. Save Credentials
    // Important: This event must be handled to persist the session
    sock.ev.on('creds.update', saveCreds);

    return sock;
}

connectToWhatsApp();
```

---

## 📩 Sending Messages

Baileys makes it easy to send various message types to a JID (e.g., `1234567890@s.whatsapp.net`).

### Text Message
```typescript
await sock.sendMessage(jid, { text: 'Hello from Baileys!' });
```

### Media Message (Image/Video)
```typescript
await sock.sendMessage(jid, { 
    image: { url: 'https://example.com/image.jpg' }, 
    caption: 'Check this out!' 
});

// Or from local buffer
await sock.sendMessage(jid, { 
    video: fs.readFileSync('./video.mp4'), 
    caption: 'Local video' 
});
```

### Document Message
```typescript
await sock.sendMessage(jid, { 
    document: { url: 'https://example.com/file.pdf' }, 
    mimetype: 'application/pdf', 
    fileName: 'document.pdf' 
});
```

### Location Message
```typescript
await sock.sendMessage(jid, { 
    location: { degreesLatitude: -23.533773, degreesLongitude: -46.625290 } 
});
```

---

## 📥 Handling Incoming Messages

Listen for the `messages.upsert` event to receive new messages.

```typescript
sock.ev.on('messages.upsert', async m => {
    console.log('New message received:', JSON.stringify(m, undefined, 2));

    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        const from = msg.key.remoteJid;

        console.log(`Message from ${from}: ${text}`);

        // Simple Auto-reply
        if (text?.toLowerCase() === 'ping') {
            await sock.sendMessage(from!, { text: 'pong' });
        }
    }
});
```

---

## 🟢 Presence & Status
Update your presence (typing, online, recording).

```typescript
// Set status to 'Typing...'
await sock.sendPresenceUpdate('composing', jid);

// Set status to 'Online'
await sock.sendPresenceUpdate('available');
```

---

## ⚠️ Important Considerations
1. **Authentication:** Never share your `auth_info` folder. It contains sensitive keys that allow anyone to access your WhatsApp account.
2. **Rate Limiting:** Sending messages too quickly or to many unknown contacts can result in a ban. Use delays between messages.
3. **Pino Logger:** Baileys uses `pino` for logging. You can adjust the verbosity in the `makeWASocket` configuration.
4. **Dependencies:** Ensure you have `@hapi/boom` and `pino` installed if you use the example snippets.

---

## 🔗 Official Resources
- **GitHub Repository:** [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- **Documentation/Wiki:** [baileys.wiki](https://baileys.wiki/)

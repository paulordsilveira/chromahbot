import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// URL do servidor — carregada das variáveis de ambiente do Vite
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020';

interface SocketContextType {
    socket: Socket | null;
    botStatus: string;
    qrCode: string | null;
    botUser: { id?: string; name?: string; pic?: string | null } | null;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    botStatus: 'disconnected',
    qrCode: null,
    botUser: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [botStatus, setBotStatus] = useState<string>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [botUser, setBotUser] = useState<any>(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket server');
        });

        newSocket.on('bot.status', (status: string) => {
            console.log('Bot Status:', status);
            setBotStatus(status);
            if (status === 'connected') {
                setQrCode(null);
            }
        });

        newSocket.on('bot.qr', (qr: string) => {
            console.log('QR Received');
            setQrCode(qr);
            setBotStatus('qrcode');
        });

        newSocket.on('bot.user', (user: any) => {
            console.log('Bot User received:', user);
            setBotUser(user);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, botStatus, qrCode, botUser }}>
            {children}
        </SocketContext.Provider>
    );
};

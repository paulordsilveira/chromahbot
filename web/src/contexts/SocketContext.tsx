import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3020';

interface SocketContextType {
    socket: Socket | null;
    botStatus: string;
    qrCode: string | null;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    botStatus: 'disconnected',
    qrCode: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [botStatus, setBotStatus] = useState<string>('disconnected');
    const [qrCode, setQrCode] = useState<string | null>(null);

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

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, botStatus, qrCode }}>
            {children}
        </SocketContext.Provider>
    );
};

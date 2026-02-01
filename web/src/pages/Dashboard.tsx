import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Wifi, WifiOff, Smartphone } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const { botStatus, qrCode } = useSocket();

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">Dashboard Corretando</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm md:text-base">Status do Bot</p>
                        <p className={`text-lg md:text-xl font-bold ${botStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            {botStatus.toUpperCase()}
                        </p>
                    </div>
                    {botStatus === 'connected' ? <Wifi className="text-green-500" size={28} /> : <WifiOff className="text-yellow-500" size={28} />}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md max-w-md mx-auto text-center">
                <h2 className="text-lg md:text-xl font-semibold mb-4 dark:text-white">Conexão WhatsApp</h2>
                {botStatus === 'connected' ? (
                    <div className="flex flex-col items-center py-6 md:py-10">
                        <Smartphone size={48} className="text-green-500 mb-4 md:w-16 md:h-16" />
                        <p className="text-green-600 dark:text-green-400 font-medium">Bot Conectado com Sucesso!</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        {qrCode ? (
                            <>
                                <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm md:text-base">Escaneie o QR Code abaixo para conectar:</p>
                                <div className="bg-white p-2 border dark:border-gray-600 rounded">
                                    <QRCodeSVG value={qrCode} size={window.innerWidth < 640 ? 200 : 256} />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 md:h-64">
                                <Activity className="animate-spin text-blue-500 mb-4" size={40} />
                                <p className="dark:text-gray-300">Aguardando QR Code...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

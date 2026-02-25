import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3020/api';

const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

export const Dashboard: React.FC = () => {
    const { botStatus, qrCode, botUser } = useSocket();
    const [botNumber, setBotNumber] = useState('');
    const [savingNumber, setSavingNumber] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const { data } = await axios.get(`${API_URL}/config`);
                if (data?.botNumber) setBotNumber(data.botNumber);
            } catch (err) {
                console.error("Falha ao carregar configuração");
            }
        };
        loadConfig();
    }, []);

    const handleSaveNumber = async (num: string) => {
        setSavingNumber(true);
        try {
            await axios.put(`${API_URL}/config`, { botNumber: num });
        } catch (e) {
            console.error(e);
        }
        setSavingNumber(false);
    };

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-ch-text">
                Conexão WPP | <span className="bg-gradient-to-r from-ch-cyan to-ch-purple bg-clip-text text-transparent">ChromaH</span>
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className={`glass rounded-2xl p-4 md:p-6 flex items-center justify-between border ${botStatus === 'connected' ? 'border-glow-cyan glow-cyan' : 'border-ch-border'}`}>
                    <div>
                        <p className="text-ch-muted mb-1 text-sm md:text-base">Status do Bot</p>
                        <p className={`text-lg md:text-xl font-bold ${botStatus === 'connected' ? 'text-ch-cyan' : 'text-yellow-400'}`}>
                            {botStatus === 'connected' ? '● CONECTADO' : botStatus.toUpperCase()}
                        </p>
                    </div>
                    {botStatus === 'connected'
                        ? <Wifi className="text-ch-cyan" size={28} />
                        : <WifiOff className="text-yellow-400" size={28} />
                    }
                </div>
            </div>

            <div className="glass rounded-2xl p-4 md:p-6 border border-ch-border max-w-md mx-auto text-center">
                <h2 className="text-lg md:text-xl font-semibold mb-4 text-ch-text flex items-center justify-center gap-2">
                    <WhatsAppIcon size={22} className="text-emerald-400" />
                    WhatsApp
                </h2>
                {botStatus === 'connected' ? (
                    <div className="flex flex-col items-center py-6 md:py-10">
                        {/* Avatar/LED pulsante */}
                        <div className="relative w-32 h-32 mb-5">
                            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                            <div className="absolute inset-0 rounded-full bg-emerald-400/10" style={{ boxShadow: '0 0 30px rgba(52, 211, 153, 0.4)' }} />
                            <div className="relative w-full h-full rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center overflow-hidden">
                                {botUser?.pic ? (
                                    <img src={botUser.pic} alt={botUser?.name || 'Bot'} className="w-full h-full object-cover" />
                                ) : (
                                    <WhatsAppIcon size={50} className="text-emerald-400" />
                                )}
                            </div>
                            <div className="absolute top-2 right-2 w-5 h-5">
                                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                                <div className="relative w-5 h-5 rounded-full bg-emerald-400 border-2 border-ch-surface" />
                            </div>
                        </div>

                        <p className="text-emerald-400 font-bold text-xl mb-1">{botUser?.name || 'WhatsApp Conectado!'}</p>
                        <p className="text-ch-muted text-sm mb-8">Pronto para receber mensagens</p>

                        <div className="w-full max-w-xs text-left bg-ch-surface-2 p-4 rounded-2xl border border-ch-border">
                            <label className="block text-sm font-semibold text-ch-text mb-2">
                                Número WPP Em Uso
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Ex: 5511999999999"
                                    value={botNumber}
                                    onChange={(e) => setBotNumber(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNumber(botNumber)}
                                    className="w-full bg-ch-bg border border-ch-border text-ch-text rounded-xl px-4 py-3 focus:border-ch-purple focus:ring-1 focus:ring-ch-purple focus:outline-none transition-colors"
                                />
                                <button
                                    onClick={() => handleSaveNumber(botNumber)}
                                    disabled={savingNumber}
                                    className="px-4 py-3 bg-ch-purple text-white font-medium rounded-xl hover:bg-ch-cyan transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center shrink-0"
                                >
                                    {savingNumber ? '...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        {qrCode ? (
                            <>
                                <p className="mb-4 text-ch-muted text-sm md:text-base">Escaneie o QR Code abaixo para conectar:</p>
                                <div className="bg-white p-3 rounded-xl shadow-lg">
                                    <QRCodeSVG value={qrCode} size={window.innerWidth < 640 ? 200 : 256} />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 md:h-64">
                                <Activity className="animate-spin text-ch-purple mb-4" size={40} />
                                <p className="text-ch-muted">Aguardando QR Code...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

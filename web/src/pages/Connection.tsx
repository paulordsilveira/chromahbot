import React, { useState } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldAlert, Zap, PowerOff, RefreshCw, Smartphone, Users } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3020'}/api`;

export const Connection: React.FC = () => {
    const { botStatus, qrCode, botUser } = useSocket();
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        setLoading(true);
        try {
            await axios.post(API_URL + '/bot/connect');
        } catch (e) {
            console.error('Failed to trigger connection', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp? O bot irá parar de responder a todos os clientes.')) {
            return;
        }

        setLoading(true);
        try {
            await axios.post(API_URL + '/bot/disconnect');
        } catch (e) {
            console.error('Failed to disconnect', e);
        } finally {
            setLoading(false);
        }
    };

    const isConnected = botStatus === 'connected' || botStatus === 'open';

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-ch-text flex items-center gap-2">
                <Smartphone className="text-ch-cyan" size={32} /> Conexão WhatsApp
            </h1>
            <p className="text-ch-muted">
                Gerencie a conexão do seu robô escaneando o QR Code ou desconectando sua sessão.
            </p>

            <div className="glass rounded-2xl p-6 md:p-8 border border-ch-border flex flex-col md:flex-row items-center gap-8 justify-between">

                <div className="flex-1 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-ch-text">Status Atual</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <div className={"w-3 h-3 rounded-full " + (isConnected ? 'bg-emerald-500' : botStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500')} />
                            <span className="text-ch-text font-medium text-lg">
                                {isConnected ? 'Conectado' : botStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                            </span>
                        </div>
                    </div>

                    {isConnected && botUser && (
                        <div className="flex items-center gap-4 bg-ch-surface p-4 rounded-xl border border-ch-border max-w-md">
                            {botUser.pic ? (
                                <img src={botUser.pic} alt="Profile" className="w-14 h-14 rounded-full border border-ch-border shadow-md" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-ch-surface-2 flex items-center justify-center border border-ch-border">
                                    <Users size={24} className="text-ch-muted" />
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-ch-text text-lg">{botUser.name || 'Bot Conectado'}</p>
                                <p className="text-sm text-ch-muted">{botUser.id?.split('@')[0] || ''}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4 pt-4">
                        {isConnected ? (
                            <button onClick={handleDisconnect} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold rounded-xl transition-all border border-red-500/20">
                                <PowerOff size={20} /> Desconectar Robô
                            </button>
                        ) : (
                            <button onClick={handleConnect} disabled={loading || botStatus === 'connecting'} className="flex items-center gap-2 px-6 py-3 gradient-btn text-ch-bg font-semibold rounded-xl transition-all shadow-lg hover:shadow-ch-cyan/20">
                                <RefreshCw size={20} className={loading || botStatus === 'connecting' ? 'animate-spin' : ''} />
                                {botStatus === 'connecting' ? 'Conectando...' : 'Gerar Novo QR'}
                            </button>
                        )}
                    </div>
                </div>

                {!isConnected && (
                    <div className="flex flex-col items-center gap-4 bg-ch-surface p-6 rounded-3xl border border-ch-border shadow-xl min-w-[280px]">
                        {qrCode ? (
                            <>
                                <div className="bg-white p-4 rounded-2xl">
                                    <QRCodeCanvas value={qrCode} size={200} />
                                </div>
                                <p className="text-ch-muted text-sm text-center">
                                    Escaneie com o <b>WhatsApp</b> <br />(WhatsApp ▸ Aparelhos Conectados)
                                </p>
                            </>
                        ) : botStatus === 'connecting' ? (
                            <div className="flex flex-col items-center gap-4 p-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ch-cyan" />
                                <p className="text-ch-cyan font-medium animate-pulse">Solicitando QR Code...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 p-8 text-center text-ch-muted">
                                <ShieldAlert size={48} className="text-ch-surface-border mb-2 opacity-50" />
                                <p>Sessão inativa.</p>
                                <p className="text-xs">Clique em "Gerar Novo QR" para iniciar.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="glass rounded-2xl p-6 border border-ch-border flex gap-4">
                <Zap className="text-ch-purple shrink-0 mt-1" size={24} />
                <div className="space-y-2">
                    <h3 className="font-bold text-ch-text text-lg">Por que meu WhatsApp fica desconectando?</h3>
                    <p className="text-ch-muted text-sm leading-relaxed">
                        Manter o celular conectado na internet (Wi-Fi de preferência) melhora a estabilidade. O WhatsApp tenta manter a sessão do robô ativa mesmo que o aparelho principal perca conexão temporariamente, mas se as chaves da sessão forem revogadas no aparelho principal pelo próprio WhatsApp, o robô terá que ser lido (QR Code) novamente.
                    </p>
                </div>
            </div>
        </div>
    );
};
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronRight, User, MessageCircle } from 'lucide-react';

const API_URL = 'http://localhost:3020/api';

type MessageLog = {
  id: number;
  content: string;
  role: string;
  timestamp: string;
};

type Contact = {
  id: number;
  name?: string | null;
  phone: string;
  jid?: string;
  profilePicUrl?: string | null;
  updatedAt: string;
  messages?: MessageLog[];
};

export const Leads: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await axios.get(`${API_URL}/contacts`);
        setContacts(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Falha ao carregar leads.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(lower) ||
      c.phone?.toLowerCase().includes(lower) ||
      c.messages?.some(m => m.content.toLowerCase().includes(lower))
    );
  });

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold dark:text-white">Leads / Conversas</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">{filteredContacts.length} contatos</div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou mensagem..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-96 border dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded">{error}</div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:text-gray-300">Carregando...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-500 dark:text-gray-400">Nenhum lead encontrado.</div>
        ) : (
          filteredContacts.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div 
                className="flex items-center gap-3 md:gap-4 p-3 md:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleExpand(c.id)}
              >
                {c.profilePicUrl ? (
                  <img 
                    src={c.profilePicUrl} 
                    alt={c.name || 'Avatar'} 
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0 ${c.profilePicUrl ? 'hidden' : ''}`}>
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base md:text-lg dark:text-white truncate">{c.name || 'Sem nome'}</div>
                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1 md:gap-2">
                    <span className="flex items-center gap-1"><User size={12} /> {c.phone}</span>
                    <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1"><MessageCircle size={12} /> {c.messages?.length || 0}</span>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-400">Última atividade</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{new Date(c.updatedAt).toLocaleDateString()}</div>
                </div>
                <button className="text-gray-400 dark:text-gray-500 p-1 md:p-2">
                  {expanded.includes(c.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>

              {expanded.includes(c.id) && c.messages && c.messages.length > 0 && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 md:p-4 max-h-80 md:max-h-96 overflow-y-auto">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Histórico da Conversa</div>
                  <div className="space-y-2">
                    {[...c.messages].reverse().map((m) => (
                      <div 
                        key={m.id} 
                        className={`p-2 md:p-3 rounded-lg max-w-[90%] md:max-w-[80%] ${
                          m.role === 'user' 
                            ? 'bg-blue-100 dark:bg-blue-900/50 ml-auto text-right' 
                            : 'bg-white dark:bg-gray-800 border dark:border-gray-700'
                        }`}
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {m.role === 'user' ? 'Cliente' : 'Bot'} • {new Date(m.timestamp).toLocaleString()}
                        </div>
                        <div className="whitespace-pre-wrap text-xs md:text-sm dark:text-gray-200">{m.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

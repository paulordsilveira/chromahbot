/**
 * Login.tsx — Tela de autenticação (Login/Registro)
 * 
 * Responsabilidades:
 * 1. Formulário de login com email/senha
 * 2. Formulário de registro com nome/email/senha
 * 3. Alternância entre modos login e registro
 * 4. Redirecionamento após login bem-sucedido
 * 5. Exibição de erros de autenticação
 * 
 * Design: tema dark neon consistente com o projeto (cyan, magenta, purple)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp } from '../lib/authClient';
import { LogIn, UserPlus, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export function Login() {
    // Modo atual: 'login' ou 'register'
    const [mode, setMode] = useState<'login' | 'register'>('login');
    // Campos do formulário
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Estado do UI
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    /**
     * handleSubmit — Processa login ou registro conforme o modo ativo
     * Usa signIn.email ou signUp.email do Better Auth client
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'login') {
                // Tenta fazer login com email/senha
                const result = await signIn.email({
                    email,
                    password,
                });
                if (result.error) {
                    setError(result.error.message || 'Email ou senha incorretos.');
                } else {
                    // Login bem-sucedido → redireciona para o Dashboard
                    navigate('/');
                }
            } else {
                // Tenta registrar novo usuário
                const result = await signUp.email({
                    name,
                    email,
                    password,
                });
                if (result.error) {
                    setError(result.error.message || 'Erro ao criar conta. Tente novamente.');
                } else {
                    // Registro bem-sucedido → redireciona para o Dashboard
                    navigate('/');
                }
            }
        } catch (err: any) {
            console.error('[Login] Erro:', err);
            setError('Erro de conexão. Verifique se o servidor está rodando.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-ch-bg flex items-center justify-center p-4">
            {/* Container central com glassmorphism */}
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    {/* Ícone animado com gradiente */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-btn mb-4 glow-cyan">
                        <span className="text-4xl">⚡</span>
                    </div>
                    <h1 className="text-3xl font-bold text-ch-text">
                        Chroma<span className="text-ch-cyan">H</span>
                    </h1>
                    <p className="text-ch-muted mt-2 text-sm">
                        {mode === 'login'
                            ? 'Acesse o painel administrativo'
                            : 'Crie sua conta para começar'}
                    </p>
                </div>

                {/* Card do formulário */}
                <div className="glass rounded-2xl p-8 border border-ch-border glow-cyan">
                    {/* Tabs Login / Registro */}
                    <div className="flex gap-1 mb-6 bg-ch-bg rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                                ${mode === 'login'
                                    ? 'bg-ch-surface-2 text-ch-cyan border-glow-cyan'
                                    : 'text-ch-muted hover:text-ch-text'}`}
                        >
                            <LogIn size={16} />
                            Entrar
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                                ${mode === 'register'
                                    ? 'bg-ch-surface-2 text-ch-cyan border-glow-cyan'
                                    : 'text-ch-muted hover:text-ch-text'}`}
                        >
                            <UserPlus size={16} />
                            Registrar
                        </button>
                    </div>

                    {/* Mensagem de erro */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-ch-magenta/10 border border-ch-magenta/30 flex items-start gap-2">
                            <AlertCircle size={18} className="text-ch-magenta mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-ch-magenta">{error}</p>
                        </div>
                    )}

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Campo Nome (apenas no registro) */}
                        {mode === 'register' && (
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-ch-muted mb-1.5">
                                    Nome completo
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required={mode === 'register'}
                                    placeholder="Seu nome"
                                    className="w-full px-4 py-3 bg-ch-bg border border-ch-border rounded-xl text-ch-text placeholder-ch-muted/50 
                                             focus:outline-none focus:border-ch-cyan/50 focus:ring-1 focus:ring-ch-cyan/20 transition-all"
                                />
                            </div>
                        )}

                        {/* Campo Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-ch-muted mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="seu@email.com"
                                className="w-full px-4 py-3 bg-ch-bg border border-ch-border rounded-xl text-ch-text placeholder-ch-muted/50 
                                         focus:outline-none focus:border-ch-cyan/50 focus:ring-1 focus:ring-ch-cyan/20 transition-all"
                            />
                        </div>

                        {/* Campo Senha */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-ch-muted mb-1.5">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                                    className="w-full px-4 py-3 pr-12 bg-ch-bg border border-ch-border rounded-xl text-ch-text placeholder-ch-muted/50 
                                             focus:outline-none focus:border-ch-cyan/50 focus:ring-1 focus:ring-ch-cyan/20 transition-all"
                                />
                                {/* Botão toggle visibilidade da senha */}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ch-muted hover:text-ch-text transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Botão de submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl font-semibold text-black transition-all duration-300 
                                     gradient-btn hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                                     flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-ch-muted/50 text-xs mt-6">
                    ChromaH Bot © {new Date().getFullYear()} — Painel Administrativo
                </p>
            </div>
        </div>
    );
}

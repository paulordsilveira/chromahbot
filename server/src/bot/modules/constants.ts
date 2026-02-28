import { ToolDefinition } from '../../infrastructure/AiService';

// ─── Padrões de saudação ───
export const GREETING_PATTERNS = /^(oi|olá|ola|eai|eae|e ai|hey|hi|hello|boa tarde|bom dia|boa noite|tudo bem|td bem|salve|fala|opa|oie|oii|oiii)$/i;

// ─── Timeouts ───
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min → nova sessão
export const MAX_HISTORY = 10;
export const DEDUP_TTL = 10_000; // 10 segundos para IDs
export const TEXT_DEDUP_TTL = 3_000; // 3 segundos para mesmo texto

// ─── Formulários ───
export interface FormState {
    type: 'simulacao' | 'corretor' | 'processos' | 'locacao';
    step: number;
    data: Record<string, string>;
}

export const FORM_STEPS: Record<string, string[]> = {
    simulacao: ['nome', 'contato', 'cpf', 'endereco', 'renda', 'ocupacao'],
    corretor: ['nome', 'contato', 'tem_imobiliaria', 'nome_imobiliaria'],
    processos: ['cpf', 'nome_confirmacao'],
    locacao: ['nome', 'contato', 'email', 'endereco', 'localizacao'],
};

export const FORM_PROMPTS: Record<string, Record<string, string>> = {
    simulacao: {
        nome: '📝 *Simulação MCMV*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        cpf: 'Informe seu *CPF*:',
        endereco: 'Informe seu *endereço completo*:',
        renda: 'Informe sua *renda mensal* (ex: R$ 3.000,00):',
        ocupacao: 'Informe sua *ocupação/profissão*:',
    },
    corretor: {
        nome: '📝 *Cadastro de Corretor Parceiro*\n\nPor favor, informe seu *nome completo*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        tem_imobiliaria: 'Possui *imobiliária*? Digite *SIM* ou *NÃO*:',
        nome_imobiliaria: 'Qual o *nome da imobiliária*?',
    },
    processos: {
        cpf: '🔍 *Consulta de Processos*\n\nPor favor, informe seu *CPF*:',
        nome_confirmacao: 'Para confirmar, informe seu *nome completo*:',
    },
    locacao: {
        nome: '🏠 *Cadastro de Locação/Venda*\n\nPor favor, informe seu *nome ou empresa*:',
        contato: 'Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:',
        email: 'Informe seu *e-mail*:',
        endereco: 'Informe o *endereço completo* do imóvel:',
        localizacao: 'Informe o *link de localização* (Google Maps) ou digite "pular":',
    },
};

// ─── Tool Definitions para Function Calling ───
export const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'enviar_menu_principal',
        description: 'Envia o menu principal mostrando TODAS as categorias disponíveis. Use quando: o cliente pedir "menu", "catálogo", "opções", "o que vocês fazem", "quais categorias", "outras categorias", "ver tudo", ou qualquer variação pedindo para ver a lista completa de serviços/categorias. NUNCA use em saudações simples como "oi" ou "olá", nem quando o cliente chamar você apenas pelo seu nome.',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'mostrar_categoria',
        description: 'Mostra as subcategorias de UMA categoria específica. Use quando o cliente demonstrar interesse em um TEMA da categoria ou quando ele aceitar a sua sugestão (ex: você sugeriu "Quer ver a categoria X?" e o cliente disse "Sim", use esta tool enviando o nome da categoria X).',
        parameters: {
            type: 'object',
            properties: {
                nome_categoria: { type: 'string', description: 'Nome EXATO da categoria conforme existe no catálogo' }
            },
            required: ['nome_categoria']
        }
    },
    {
        name: 'mostrar_subcategoria',
        description: 'Mostra os itens de uma subcategoria específica. Use quando o cliente demonstrar interesse no assunto da subcategoria ou quando ele aceitar sua sugestão de mostrá-la (ex: você ofereceu mostrar e ele disse "Sim", dispare a tool).',
        parameters: {
            type: 'object',
            properties: {
                nome_subcategoria: { type: 'string', description: 'Nome da subcategoria' }
            },
            required: ['nome_subcategoria']
        }
    },
    {
        name: 'mostrar_item',
        description: 'Mostra detalhes completos de um item específico (produto/serviço). Use quando o usuário pedir detalhes sobre algo específico.',
        parameters: {
            type: 'object',
            properties: {
                nome_item: { type: 'string', description: 'Nome do item a ser exibido' }
            },
            required: ['nome_item']
        }
    },
    {
        name: 'iniciar_formulario',
        description: 'Inicia um formulário de cadastro. Use quando o usuário quiser se cadastrar, fazer uma simulação, ou registrar informações.',
        parameters: {
            type: 'object',
            properties: {
                tipo: {
                    type: 'string',
                    description: 'Tipo do formulário',
                    enum: ['simulacao', 'corretor', 'processos', 'locacao']
                }
            },
            required: ['tipo']
        }
    },
    {
        name: 'enviar_contato_humano',
        description: 'Encaminha o contato de um atendente humano. Use quando o usuário pedir para falar com uma pessoa real, atendente, ou suporte humano.',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'enviar_faq',
        description: 'Envia as perguntas frequentes (FAQ). Use quando o usuário tiver dúvidas gerais sobre a empresa ou serviços.',
        parameters: { type: 'object', properties: {}, required: [] }
    }
];

// ─── Status Labels ───
export const STATUS_LABELS: Record<string, string> = {
    'atendido': '🔵 Atendido',
    'cadastrado': '🔷 Cadastrado',
    'em_negociacao': '🟡 Em negociação',
    'locado': '🟣 Locado',
    'finalizado': '⚫ Finalizado',
    'contrato_elaborado': '🔮 Contrato Elaborado',
    'pendente': '🟠 Pendente',
    'pago': '🟢 Pago',
    'concluido': '✅ Concluído',
};

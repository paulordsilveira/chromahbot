# Corretando Bot - Documentação Técnica

## Visão Geral

O **Corretando** é um sistema de automação de atendimento via WhatsApp para imobiliárias e corretores de imóveis. O projeto é dividido em duas partes principais:

- **Servidor (Server)**: API Node.js/Express com bot WhatsApp integrado usando biblioteca Baileys
- **Cliente (Web)**: Interface administrativa React para gerenciamento do bot

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Web)                            │
│  ┌─────────┐  ┌──────────┐  ┌──────┐  ┌──────┐  ┌──────────┐ │
│  │Dashboard│  │Categorias │  │ CRM  │  │Leads │  │Configuraç│ │
│  └────┬────┘  └─────┬────┘  └──┬───┘  └──┬───┘  └────┬─────┘ │
└───────┼─────────────┼───────────┼────────┼────────────┼────────┘
        │             │           │        │            │
        └─────────────┴───────────┴────────┴────────────┘
                              │
                        Socket / HTTP
                              │
┌─────────────────────────────┴────────────────────────────────┐
│                      SERVIDOR (Node.js)                       │
│  ┌────────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   Baileys Bot  │◄───►│  Event Bus   │◄───►│   API REST  │  │
│  │  (WhatsApp)    │     │              │     │  (Express)  │  │
│  └───────┬────────┘     └──────────────┘     └──────┬──────┘  │
│          │                                         │         │
│          └────────────────┬────────────────────────┘         │
│                           │                                    │
│                    ┌──────┴──────┐                            │
│                    │   SQLite    │                            │
│                    │  Database   │                            │
│                    └─────────────┘                            │
└───────────────────────────────────────────────────────────────┘
```

---

## Bibliotecas e Dependências

### Servidor (Node.js/Express)

| Biblioteca | Versão | Descrição |
|------------|--------|-----------|
| `@whiskeysockets/baileys` | ^7.0.0-rc.9 | API WhatsApp Web |
| `@google/generative-ai` | ^0.24.1 | Integração Google Gemini |
| `openai` | ^6.16.0 | Integração OpenAI/Groq/DeepSeek |
| `better-sqlite3` | ^11.10.0 | Banco de dados SQLite |
| `express` | ^5.2.1 | Framework web |
| `socket.io` | ^4.8.3 | WebSocket para tempo real |
| `pino` | ^10.3.0 | Logger |
| `dotenv` | ^17.2.3 | Variáveis de ambiente |
| `cors` | ^2.8.6 | CORS |
| `qrcode-terminal` | ^0.12.0 | QR Code no terminal |

### Cliente (React/Vite)

| Biblioteca | Versão | Descrição |
|------------|--------|-----------|
| `react` | ^19.2.0 | Framework UI |
| `react-dom` | ^19.2.0 | React DOM |
| `react-router-dom` | ^7.13.0 | Roteamento |
| `axios` | ^1.13.3 | HTTP Client |
| `socket.io-client` | ^4.8.3 | WebSocket Client |
| `lucide-react` | ^0.563.0 | Ícones |
| `qrcode.react` | ^4.2.0 | QR Code React |
| `tailwindcss` | ^4.0.0 | Estilização CSS |
| `vite` | ^7.2.4 | Build tool |
| `typescript` | ~5.9.3 | TypeScript |

---

## Workflow do Projeto

### 1. Fluxo de Conexão WhatsApp

```
Iniciar Servidor
       │
       ▼
┌──────────────────┐
│ Baileys Connection│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────┐
│   QR Code gerado  │────►│ Exibir no Terminal │
│   (event: bot.qr) │     │ + Interface Web   │
└────────┬─────────┘     └─────────────────┘
         │
         ▼
┌──────────────────┐
│  Usuário scaneia  │
│  QR Code          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Connection: open│
│  (event: bot.status)│
└────────┬─────────┘
         │
         ▼
    ┌────────┐
    │ Bot    │
    │ Ativo  │
    └────────┘
```

### 2. Fluxo de Mensagens Recebidas

```
Usuário envia mensagem
         │
         ▼
┌──────────────────────────────────────────┐
│  sock.ev.on('messages.upsert')          │
│  Evento: message.received                │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  handleMessage(msg, sock)                │
│  - Extrai JID, texto, nome               │
│  - Upsert contato no banco               │
│  - Loga mensagem                          │
└────────┬─────────────────────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ Verifica comandos      │
    │ especiais:             │
    │ - menu, oi, ola       │
    │ - voltar              │
    │ - contato             │
    │ - cancelar            │
    └────────┬───────────────┘
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
┌────────────┐  ┌────────────────────────────────┐
│Formulário  │  │ Menu/Navegação                │
│em andamen- │  │ - Categoria → Subcategoria   │
│to?         │  │ - Item                        │
└────┬───────┘  └────────────┬───────────────────┘
     │                       │
     ▼                       ▼
┌──────────────┐      ┌──────────────────────┐
│ handleForm   │      │ Menu principal      │
│ Step()       │      │ ou submenu          │
└──────────────┘      └──────────────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │ IA (fallback)   │
                     │ aiService.get   │
                     │ AiResponse()    │
                     └──────────────────┘
```

### 3. Fluxo de Menu

```
sendMainMenu()
     │
     ├─► Buscar categorias no DB
     │        │
     │        ▼
     │   ┌──────────────────┐
     │   │ Categoria 1    │────► 1️⃣ 📁 Nome
     │   │ Categoria 2    │────► 2️⃣ 🏗️ Nome
     │   │ Categoria 3    │────► 3️⃣ 🏡 Nome
     │   │ ...             │────► ...
     │   └──────────────────┘
     │
     └─► Enviar menu formatado

Usuário digita número
        │
        ▼
handleMenuOption()
        │
        ▼
displaySubcategories()
        │
        ▼
Usuário seleciona subcategoria
        │
        ▼
handleSubCategoryOption()
        │
        ├─► Special Subcategory?
        │      ├─► simulacao → startForm('simulacao')
        │      ├─► corretor   → startForm('corretor')
        │      ├─► processos  → startForm('processos')
        │      ├─► locacao    → startForm('locacao')
        │      └─► duvidas    → handleDuvidas()
        │
        └─► Itens disponíveis?
               ├─► Sim: userSubcategoryContext.set() + lista itens
               └─► Não: mensagem "Nenhum item"

Usuário seleciona item
        │
        ▼
handleItemOption()
        │
        ▼
sendItemWithImages()
        │
        ├─► Envia imagens (até 10)
        └─► Envia texto com detalhes
```

### 4. Fluxo de Formulários

```
startForm(type)
     │
     ├─► type: 'simulacao' | 'corretor' | 'processos' | 'locacao'
     │
     └─► userFormStates.set(jid, { type, step: 0, data: {} })
           │
           ▼
        Pergunta 1º campo
              │
              ▼
handleFormStep()
              │
              ├─► Salva campo atual
              ├─► step++
              │
              ├─► "corretor" + "tem_imobiliaria" = "não"?
              │      └─► Pula campo nome_imobiliaria
              │
              └─► step >= total?
                    ├─► Sim: completeForm()
                    └─► Não: Pergunta próximo campo

completeForm()
     │
     ├─► INSERT INTO form (type, data)
     │
     └─► Envia mensagem de sucesso
```

### 5. Fluxo da IA

```
aiService.getAiResponse(message)
     │
     ├─► Buscar config (provider, api keys)
     │
     ├─► systemPrompt + contexto + documentação
     │
     └─► switch(provider)
           ├─► 'gemini'     → callGemini()
           ├─► 'openai'     → callOpenAI()
           ├─► 'groq'       → callOpenAI(groq)
           ├─► 'deepseek'   → callOpenAI(deepseek)
           └─► 'openrouter' → callOpenAI(openrouter)
```

---

## Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `config` | Configurações globais do sistema |
| `category` | Categorias do menu principal |
| `subcategory` | Subcategorias dentro de categorias |
| `item` | Itens específicos (imóveis, serviços) |
| `contact` | Contatos que interagiram com o bot |
| `message_log` | Histórico de mensagens |
| `form` | Formulários enviados |

### Schema Detalhado

#### config
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK (sempre 1) |
| welcomeMessage | TEXT | Mensagem de boas-vindas |
| logoImage | TEXT | Imagem/logo em base64 |
| openaiApiKey | TEXT | Chave API OpenAI |
| geminiApiKey | TEXT | Chave API Gemini |
| deepseekApiKey | TEXT | Chave API DeepSeek |
| groqApiKey | TEXT | Chave API Groq |
| openRouterApiKey | TEXT | Chave API OpenRouter |
| activeAiProvider | TEXT | Provedor de IA ativo |
| selectedModel | TEXT | Modelo selecionado |
| systemPrompt | TEXT | Prompt do sistema para IA |
| assistantContext | TEXT | Contexto adicional do assistente |
| documentacao | TEXT | Documentação para IA |
| faqText | TEXT | Dúvidas frequentes |
| atendimentoPhones | TEXT | Telefones de atendimento |
| whatsappLink | TEXT | Link direto WhatsApp |
| contatoHumano | TEXT | Nome do atendente humano |

#### category
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| name | TEXT | Nome da categoria |
| emoji | TEXT | Emoji associado |
| "order" | INTEGER | Ordem de exibição |

#### subcategory
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| name | TEXT | Nome da subcategoria |
| emoji | TEXT | Emoji associado |
| "order" | INTEGER | Ordem de exibição |
| categoryId | INTEGER | FK para category |
| enabledInBot | INTEGER | Se exibe no bot (0/1) |

#### item
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| subcategoryId | INTEGER | FK para subcategory |
| name | TEXT | Nome/identificador |
| title | TEXT | Título exibido |
| description | TEXT | Descrição detalhada |
| price | TEXT | Valor/preço |
| locationLink | TEXT | Link de localização |
| contactLink | TEXT | Link de contato |
| webLink | TEXT | Link da página web |
| imageUrls | TEXT | URLs de imagens (uma por linha) |
| videoUrls | TEXT | URLs de vídeos |
| documentUrls | TEXT | URLs de documentos |
| empresa | TEXT | Nome da empresa |
| contato | TEXT | Contato |
| email | TEXT | E-mail |
| endereco | TEXT | Endereço |
| enabled | INTEGER | Se está ativo (0/1) |

#### contact
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| jid | TEXT | ID WhatsApp único |
| name | TEXT | Nome do contato |
| phone | TEXT | Número de telefone |
| profilePicUrl | TEXT | URL foto de perfil |
| statusAtual | TEXT | Status atual no CRM |
| statusHistorico | TEXT | JSON com histórico de status |
| observacao | TEXT | Observações internas |
| createdAt | TEXT | Data de criação |
| updatedAt | TEXT | Data de atualização |

#### message_log
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| contactId | INTEGER | FK para contact |
| content | TEXT | Conteúdo da mensagem |
| role | TEXT | 'user' ou 'assistant' |
| timestamp | TEXT | Data/hora |

#### form
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| type | TEXT | Tipo (simulacao, cadastro_corretor, etc) |
| data | TEXT | JSON com os dados |
| subCategoryId | INTEGER | FK opcional para subcategory |
| createdAt | TEXT | Data de criação |

---

## Funções Principais

### Server - bot/flow.ts

| Função | Descrição |
|--------|-----------|
| `handleMessage(msg, sock)` | Processa qualquer mensagem recebida |
| `sendMainMenu(sock, jid, name, contactId)` | Envia menu principal |
| `handleMenuOption(sock, jid, index, contactId)` | Processa opção do menu |
| `displaySubcategories(sock, jid, categoryId, contactId)` | Exibe subcategorias |
| `handleSubCategoryOption(sock, jid, categoryId, subIndex, contactId)` | Processa subcategoria |
| `handleItemOption(sock, jid, categoryId, subIndex, itemIndex, contactId)` | Processa seleção de item |
| `sendItemWithImages(sock, jid, contactId, item)` | Envia item com imagens |
| `startForm(sock, jid, contactId, formType)` | Inicia formulário |
| `handleFormStep(sock, jid, contactId, input, state)` | Processa etapa do formulário |
| `completeForm(sock, jid, contactId, state)` | Finaliza formulário |
| `handleDuvidas(sock, jid, contactId)` | Responde dúvidas frequentes |
| `sendHumanContact(sock, jid, contactId)` | Envia contato humano |
| `isSpecialSubcategory(subName)` | Detecta tipo especial de subcategoria |
| `upsertContact(jid, name, profilePicUrl)` | Cria/atualiza contato |
| `logMessage(contactId, role, content)` | Registra mensagem |
| `sendAndLogText(sock, jid, contactId, text)` | Envia e registra |
| `parseMenuSelection(raw)` | Parserselection numérica |

### Server - bot/connection.ts

| Função | Descrição |
|--------|-----------|
| `connectToWhatsApp()` | Inicializa conexão WhatsApp |

### Server - infrastructure/AiService.ts

| Função | Descrição |
|--------|-----------|
| `getAiResponse(userMessage, history)` | Obtém resposta da IA |
| `callGemini(apiKey, model, systemPrompt, userMessage)` | Chama Gemini |
| `callOpenAI(apiKey, model, systemPrompt, userMessage, baseURL)` | Chama OpenAI/Groq/DeepSeek |

### Server - infrastructure/database.ts

| Função | Descrição |
|--------|-----------|
| `db` (instância) | Conexão SQLite |

### Server - api/routes.ts

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/config` | GET/PUT | Configurações |
| `/api/categories` | GET/POST | Categorias |
| `/api/categories/:id` | PUT/DELETE | Categoria específica |
| `/api/categories/:categoryId/subcategories` | POST | Subcategorias |
| `/api/subcategories/:id` | PUT/DELETE | Subcategoria específica |
| `/api/subcategories/:subcategoryId/items` | GET/POST | Itens |
| `/api/items/:id` | PUT/DELETE | Item específico |
| `/api/contacts` | GET | Contatos |
| `/api/forms` | GET/POST | Formulários |
| `/api/forms/:id` | PUT/DELETE | Formulário específico |
| `/api/crm` | GET | Dados CRM |
| `/api/crm/:type/:id/status` | PUT | Atualiza status |
| `/api/crm/:type/:id/observacao` | PUT | Atualiza observação |

---

## Contextos de Estado

O bot mantém três mapas em memória:

1. **userFormStates** (Map<string, FormState>)
   - Usuários que estão preenchendo formulários
   - Chave: JID do WhatsApp
   - Valor: Estado atual do formulário

2. **userCategoryContext** (Map<string, number>)
   - Usuários que selecionaram uma categoria
   - Chave: JID do WhatsApp
   - Valor: ID da categoria selecionada

3. **userSubcategoryContext** (Map<string, {categoryId, subcategoryIndex}>)
   - Usuários que estão em uma subcategoria com itens
   - Chave: JID do WhatsApp
   - Valor: ID da categoria + índice da subcategoria

---

## Palavras-chave de Comando

| Comando | Ação |
|---------|------|
| menu | Retorna ao menu principal |
| oi, olá, ola | Inicia conversa |
| inicio, início | Retorna ao menu |
| cancelar | Cancela ação atual |
| voltar | Volta ao nível anterior |
| contato | Envia contato humano |

---

## Interface Web - Páginas

### Dashboard
- Status do bot (conectado/desconectado)
- QR Code para conexão WhatsApp
- Atualização em tempo real via Socket

### Categorias
- CRUD de categorias, subcategorias e itens
- Upload de imagens (até 10), vídeos (até 2), documentos (até 5)
- Editor de texto WhatsApp (negrito, itálico, riscado)
- Emoji picker

### Configurações
- Boas-vindas (mensagem + logo)
- Atendimento (contato humano, telefones, link WhatsApp)
- IA (provedor ativo, API keys, prompts)
- Documentação (para IA)
- FAQ (dúvidas frequentes)

### Leads/Conversas
- Lista de contatos
- Histórico de conversas
- Busca por nome/telefone/mensagem

### Formulários
- Atendimento Interno (CRM)
- Simulação MCMV
- Cadastro Corretor
- Locação/Venda

### CRM
- Visualização Kanban e Tabela
- Status: Atendido, Cadastrado, Em negociação, Locado, Finalizado, etc.
- Histórico de mudanças
- Observações

---

## Como Executar

### Servidor
```bash
cd server
npm install
npm run dev
```

### Cliente
```bash
cd web
npm install
npm run dev
```

O servidor estará disponível em `http://localhost:3020`
O cliente estará disponível em `http://localhost:5173`

---

## Proposta: Conversa Orgânica com IA Antes do Menu

### Problema Atual

O bot apresenta um **menu rígido** imediatamente após a saudação inicial, forcing o usuário a navegar por opções numeradas. Isso pode parecer impersonal e limitar a capacidade da IA de entender as necessidades reais do cliente.

### Solução Proposta: Modo Conversacional Inicial

#### 1. Fase de Descoberta (Pré-menu)

Quando o usuário envia uma mensagem inicial (`oi`, `menu`, ou qualquer mensagem):

1. **IA inicia conversa contextual** em vez de mostrar menu:
   ```
   IA: "Olá! Sou o assistente da [Empresa]. Como posso ajudar você hoje? 
        Posso falar sobre imóveis disponíveis, simular financiamento, 
        tirar dúvidas sobre processos, ou qualquer outra coisa!"
   ```

2. **IA analiza intenção** usando:
   - Keywords na mensagem do usuário
   - Contexto da conversa
   - Histórico de interações anteriores (se disponível)

3. **Se intenção clara** → Direciona para menu específico ou ação:
   - "Quero alugar um apartamento" → Menu Locação
   - "Preciso fazer uma simulação" → Formulário Simulação
   - "Meu processo está em qual fase?" → Consulta Processos

4. **Se intenção unclear** → Oferece ajuda contextual:
   ```
   IA: "Fique à vontade para me contar o que procura! 
        Posso te ajudar com:"
        [ botões inline ]
        • Ver imóveis disponíveis
        • Simular financiamento
        • Falar com um corretor
        • Outras dúvidas
   ```

#### 2. Implementação Técnica

**Modificações em `flow.ts`:**

```typescript
// Novo estado para modo conversacional
const userConversationMode = new Map<string, {
    started: boolean;
    intentDetected: boolean;
    lastIntent?: string;
}>();

// Nova função para detecção de intenção
const detectIntent = async (message: string, history: any[]): Promise<{
    intent: 'menu' | 'simulacao' | 'corretor' | 'processos' | 'duvidas' | 'locacao' | 'human' | null;
    confidence: number;
    response?: string;
}> => {
    // Usar IA para detectar intenção
    // Retornar intent + confidence
};

// Modificar handleMessage
const handleMessage = async (msg: WAMessage, sock: any) => {
    // ... código existente ...
    
    const convMode = userConversationMode.get(jid);
    
    if (!convMode?.started) {
        // Primeira interação - modo conversa
        userConversationMode.set(jid, { started: true });
        
        // Se mensagem for comando explícito, ir direto pro menu
        if (['menu', 'inicio'].includes(lower)) {
            await sendMainMenu(sock, jid, name, contactId);
            return;
        }
        
        // Caso contrário, analisar intenção
        const intent = await detectIntent(normalized);
        
        if (intent.confidence > 0.7 && intent.intent !== 'menu') {
            // Intenção clara - direcionar
            switch (intent.intent) {
                case 'simulacao':
                    await startForm(sock, jid, contactId, 'simulacao');
                    return;
                case 'corretor':
                    await startForm(sock, jid, contactId, 'corretor');
                    return;
                // ... outros casos
            }
        }
        
        // Intenção unclear - resposta conversacional + menu opcional
        const conversationStart = await aiService.getConversationStart(
            normalized, 
            name,
            history
        );
        
        await sendAndLogText(sock, jid, contactId, conversationStart);
        return;
    }
    
    // Modo conversa ativo - verificar se usuário quer menu
    if (normalized === 'menu' || normalized === 'ver menu') {
        userConversationMode.delete(jid);
        await sendMainMenu(sock, jid, name, contactId);
        return;
    }
    
    // Continuar conversa normal
    // ... código existente com IA
};
```

**Nova função em `AiService.ts`:**

```typescript
async getConversationStart(userMessage: string, userName: string, history: any[]): Promise<string> {
    const config = await this.getConfig();
    
    const systemPrompt = `
    Você é um assistente virtual amigável e profissional de uma imobiliária.
    Nome do usuário: ${userName}
    
    Instruções:
    1. Responda de forma conversacional e natural
    2. Não seja muito longo - seja direto mas friendly
    3. Ofereça ajuda contextual baseada na mensagem do usuário
    4. Se a intenção for clara, indique que vai direcionar para a área correta
    5. Sempre termine perguntando se quer ver as opções do menu ou já prefere seguir com algo específico
    
    Contexto da empresa: ${config.assistantContext || ''}
    `;
    
    // Usar IA para gerar resposta inicial
    return await this.callIA(config, systemPrompt, userMessage);
}
```

#### 3. Benefícios

| Benefício | Descrição |
|-----------|-----------|
| Experiência mais natural | Cliente se sente ouvido antes de navegar |
| Maior engajamento | Menos bounce rate |
| Coleta de dados | IA aprende sobre preferências |
| Flexibilidade | Handles queries fora do menu |
| Profissionalismo | Aparenta ser mais sofisticado |

#### 4. Configurações Adicionais

Adicionar na tabela `config`:

| Campo | Descrição |
|-------|-----------|
| conversationalMode | boolean - Ativar/desativar modo conversa |
| conversationRounds | number - Rodadas de conversa antes de sugerir menu |
| intentConfidence | number - Threshold de confiança (0-1) |
| conversationPrompt | TEXT - Prompt customizado para modo conversa |

#### 5. Exemplo de Fluxo

```
Usuário: Oi
IA: Oi João! 👋 Seja bem-vindo à [Empresa]! 
     Como posso te ajudar hoje? Posso te mostrar nossos imóveis,
     te ajudar com uma simulação de financiamento, ou tirar
     qualquer dúvida que você tenha!

Usuário: to procurando um ap pra alugar
IA: Perfeito! 🎯
    Temos várias opções de apartamentos para locação!
    Você procura quantos quartos? Tem alguma região preferida
     ou faixa de preço em mente?
     
     Se preferir, posso te mostrar nosso portfólio completo:
     [1] Ver imóveis disponíveis
     [2] Falar com um corretor
     [3] Fazer simulação

Usuário: 1
IA: [Envia menu de locação]
```

---

## Conclusão

Esta proposta transforma o bot de um menu rígido em um assistente conversacional que:
1. Cumprimeta o cliente de forma natural
2. Entende a intenção antes de direcionar
3. Oferece experiência personalizada
4. Mantém a opção de menu disponível quando necessário
5. Coleta dados valiosos sobre as necessidades do cliente

A implementação pode ser gradual - iniciando com o modo conversacional opcional e tornando-o o padrão após testes.

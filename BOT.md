# Documentação Técnica - Corretando Bot

## Visão Geral

O **Corretando** é um sistema de automação de atendimento via WhatsApp para imobiliárias e corretores de imóveis. O projeto é dividido em duas partes:

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

## Banco de Dados

### Tabelas Principais

#### 1. `config`
Configurações globais do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK (sempre 1) |
| welcomeMessage | TEXT | Mensagem de boas-vindas |
| logoImage | TEXT | Imagem/logo em base64 |
| openaiApiKey | TEXT | Chave API OpenAI |
| geminiApiKey | TEXT | Chave API Gemini |
| deepseekApiKey | TEXT | Chave API DeepSeek |
| groqApiKey | TEXT | Chave API Groq |
| activeAiProvider | TEXT | Provedor de IA ativo |
| systemPrompt | TEXT | Prompt do sistema para IA |
| assistantContext | TEXT | Contexto adicional do assistente |
| documentacao | TEXT | Documentação para IA |
| faqText | TEXT | Dúvidas frequentes |
| atendimentoPhones | TEXT | Telefones de atendimento |
| whatsappLink | TEXT | Link direto WhatsApp |
| contatoHumano | TEXT | Nome do atendente humano |

#### 2. `category`
Categorias do menu principal do bot.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| name | TEXT | Nome da categoria |
| emoji | TEXT | Emoji associado |
| order | INTEGER | Ordem de exibição |

#### 3. `subcategory`
Subcategorias dentro de cada categoria.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| name | TEXT | Nome da subcategoria |
| emoji | TEXT | Emoji associado |
| order | INTEGER | Ordem de exibição |
| categoryId | INTEGER | FK para category |
| enabledInBot | INTEGER | Se exibe no bot (0/1) |

#### 4. `item`
Itens específicos dentro de subcategorias (imóveis, serviços, etc).

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
| videoUrls | TEXT | URLs de vídeos (uma por linha) |
| documentUrls | TEXT | URLs de documentos |
| empresa | TEXT | Nome da empresa |
| contato | TEXT | Contato |
| email | TEXT | E-mail |
| endereco | TEXT | Endereço |
| enabled | INTEGER | Se está ativo (0/1) |

#### 5. `contact`
Contatos que interagiram com o bot.

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

#### 6. `message_log`
Histórico de mensagens trocadas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| contactId | INTEGER | FK para contact |
| content | TEXT | Conteúdo da mensagem |
| role | TEXT | 'user' ou 'assistant' |
| timestamp | TEXT | Data/hora |

#### 7. `form`
Formulários enviados pelo bot.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | PK autoincrement |
| type | TEXT | Tipo (simulacao, cadastro_corretor, etc) |
| data | TEXT | JSON com os dados |
| subCategoryId | INTEGER | FK opcional para subcategory |
| createdAt | TEXT | Data de criação |

---

## Fluxo do Bot (flow.ts)

### Arquivos Principais do Bot

#### `connection.ts` - Conexão WhatsApp

```typescript
// Função principal de conexão
async function connectToWhatsApp()
```

**Responsabilidades:**
- Inicializar conexão com WhatsApp usando Baileys
- Gerenciar autenticação com credenciais armazenadas em arquivo
- Exibir QR Code no terminal para escaneamento
- Reconectar automaticamente em caso de desconexão
- Emitir eventos para o EventBus

**Eventos Emitidos:**
- `bot.qr` - QR Code gerado para conexão
- `bot.status` - Status da conexão ('connected', 'disconnected', 'qrcode')
- `bot.log` - Logs de atividade do bot

**Eventos Recebidos:**
- `message.received` - Nova mensagem recebida (aciona handleMessage)

---

#### `flow.ts` - Lógica de Conversa

##### Funções Principais

```typescript
// Envia mensagem de texto
const sendText = async (sock: any, jid: string, text: string)

// Extrai telefone do JID WhatsApp
const getPhoneFromJid = (jid: string) => string

// Gerencia contato (cria ou atualiza)
const upsertContact = (jid, name, profilePicUrl) => { id, jid, name }

// Registra mensagem no banco
const logMessage = (contactId, role, content)

// Envia e registra mensagem
const sendAndLogText = async (sock, jid, contactId, text)
```

##### Estados de Formulário

O bot mantém estados de formulário em memória:

```typescript
interface FormState {
    type: 'simulacao' | 'corretor' | 'processos' | 'locacao';
    step: number;
    data: Record<string, string>;
}
```

**Formulários Suportados:**

1. **Simulação** (simulacao)
   - Campos: nome, contato, cpf, endereco, renda, ocupacao

2. **Cadastro Corretor** (corretor)
   - Campos: nome, contato, tem_imobiliaria, nome_imobiliaria

3. **Consulta Processos** (processos)
   - Campos: cpf, nome_confirmacao
   - Busca em `form` com tipo `atendimento_interno`

4. **Locação/Venda** (locacao)
   - Campos: nome, contato, email, endereco, localizacao

##### Funções de Menu

```typescript
// Envia menu principal
const sendMainMenu = async (sock, jid, name, contactId)

// Retorna emoji numérico
const getNumberEmoji = (num) => string

// Retorna emoji padrão por nome de categoria
const getCategoryDefaultEmoji = (name) => string
```

##### Handlers de Opções

```typescript
// Processa opção do menu principal
const handleMenuOption = async (sock, jid, option, contactId)

// Processa opção de subcategoria
const handleSubCategoryOption = async (sock, jid, categoryOrder, subIndex, contactId)

// Processa opção de item
const handleItemOption = async (sock, jid, categoryOrder, subcategoryIndex, itemIndex, contactId)
```

##### Funções de Formulário

```typescript
// Inicia um novo formulário
const startForm = async (sock, jid, contactId, formType)

// Processa cada etapa do formulário
const handleFormStep = async (sock, jid, contactId, input, state)

// Finaliza e salva o formulário
const completeForm = async (sock, jid, contactId, state)

// Envia contato humano
const sendHumanContact = async (sock, jid, contactId)
```

##### Funções Auxiliares

```typescript
// Detecta tipo de subcategoria especial
const isSpecialSubcategory = (subName) => 'simulacao' | 'corretor' | 'processos' | 'duvidas' | 'locacao' | null

// Formata mensagem de item
const formatItemMessage = (item) => string

// Envia item com imagens
const sendItemWithImages = async (sock, jid, contactId, item)

// Processa dúvidas frequentes
const handleDuvidas = async (sock, jid, contactId)
```

##### Função Principal

```typescript
// Processa qualquer mensagem recebida
export const handleMessage = async (msg: WAMessage, sock: any)
```

**Fluxo de Processamento:**

1. Extrai JID, texto e nome do remetente
2. Normaliza texto (trim, lowercase)
3. Faz upsert do contato no banco
4. Loga mensagem do usuário
5. Verifica comandos especiais:
   - `menu`, `oi`, `olá`, `inicio`, `cancelar` → Menu principal
   - `voltar` → Volta ao nível anterior
   - `contato` → Envia contato humano
6. Se há formulário em andamento → Processa etapa
7. Se há seleção de menu → Processa opção
8. Caso contrário → Responde genericamente

---

## API REST (routes.ts)

### Endpoints Disponíveis

#### Configuração

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/config` | Obtém configurações |
| PUT | `/api/config` | Atualiza configurações |

#### Categorias

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/categories` | Lista categorias com subcategorias |
| POST | `/api/categories` | Cria categoria |
| PUT | `/api/categories/:id` | Atualiza categoria |
| DELETE | `/api/categories/:id` | Remove categoria |

#### Subcategorias

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/categories/:categoryId/subcategories` | Cria subcategoria |
| PUT | `/api/subcategories/:id` | Atualiza subcategoria |
| DELETE | `/api/subcategories/:id` | Remove subcategoria |

#### Itens

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/subcategories/:subcategoryId/items` | Lista itens |
| POST | `/api/subcategories/:subcategoryId/items` | Cria item |
| PUT | `/api/items/:id` | Atualiza item |
| DELETE | `/api/items/:id` | Remove item |

#### Contatos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/contacts` | Lista contatos com mensagens |

#### Formulários

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/forms` | Lista formulários |
| POST | `/api/forms` | Cria formulário |
| PUT | `/api/forms/:id` | Atualiza formulário |
| DELETE | `/api/forms/:id` | Remove formulário |

#### CRM

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/crm` | Lista clientes (forms + contacts) |
| PUT | `/api/crm/:type/:id/status` | Atualiza status |
| PUT | `/api/crm/:type/:id/observacao` | Atualiza observação |

---

## Interface Web

### Páginas

#### 1. Dashboard (`Dashboard.tsx`)

- Exibe status do bot (conectado/desconectado)
- QR Code para conexão WhatsApp
- Atualização em tempo real via Socket

#### 2. Categorias (`Categories.tsx`)

**Funcionalidades:**
- Criar/editar/excluir categorias
- Criar/editar/excluir subcategorias
- Criar/editar/excluir itens
- Upload de imagens (até 10)
- Upload de vídeos (até 2)
- Upload de documentos (até 5)
- Editor de texto WhatsApp (negrito, itálico, riscado)
- Emoji picker
- Arrastar e soltar arquivos
- Visualização inline de mídias

#### 3. Configurações (`Settings.tsx`)

**Seções:**
- Boas-vindas (mensagem + logo)
- Atendimento (contato humano, telefones, link WhatsApp)
- IA (provedor ativo, API keys, prompts)
- Documentação (para IA)
- FAQ (dúvidas frequentes)

#### 4. Leads/Conversas (`Leads.tsx`)

- Lista de contatos que interagiram com o bot
- Busca por nome, telefone ou mensagem
- Expandir para ver histórico de conversa
- Exibe última atividade

#### 5. Formulários (`Forms.tsx`)

**Abas:**
- **Atendimento Interno**: Cadastro completo de cliente com status, origem, processos
- **Simulação**: Dados de simulação MCMV
- **Cadastro Corretor**: Dados de parceiros corretores
- **Locação/Venda**: Cadastro de imóveis para locação/venda

**Funcionalidades:**
- CRUD completo
- Upload de arquivos internos
- Histórico de status com timestamps
- Busca por nome, CPF, contato

#### 6. CRM (`CRM.tsx`)

**Visualizações:**
- Kanban (colunas por status)
- Tabela

**Status Disponíveis:**
- Atendido (🔵)
- Cadastrado (🔷)
- Em negociação (🟡)
- Locado (🟣)
- Finalizado (⚫)
- Contrato Elaborado (🔮)
- Pendente (🟠)
- Pago (🟢)
- Concluído (✅)

**Funcionalidades:**
- Filtrar por status e origem
- Alterar status com informações adicionais
- Histórico de mudanças
- Exibir observações

---

## Fluxos de Conversa

### 1. Boas-Vindas e Menu Principal

```
Bot: 👋 Olá *Nome*! Sou o *Assistente Corretando*. [mensagem personalizada]

📋 *MENU PRINCIPAL*
──────────────────
1️⃣ 📁 Portfólio de Imóveis
2️⃣ 🏗️ Terreno e Construção
3️⃣ 🏡 Minha Casa Minha Vida
4️⃣ 🤝 Parcerias (Corretores)
5️⃣ 💼 Serviços de Corretagem
6️⃣ 📊 Status / Acompanhamento
7️⃣ 📝 Recados / Outros
──────────────────
ℹ️ Digite o *número* da opção desejada.
```

### 2. Navegação por Categorias

```
Usuário: 1
Bot: 📂 *Portfólio de Imóveis*
──────────────────
1️⃣ ▸ Apartamentos
2️⃣ ▸ Casas
3️⃣ ▸ Terrenos
──────────────────
↩️ Digite *VOLTAR* para o menu.
```

### 3. Formulário de Simulação

```
Bot: 📝 *Simulação MCMV*

Por favor, informe seu *nome completo*:

Usuário: João Silva
Bot: Informe seu *contato (WhatsApp)* no formato (00) 00000-0000:
[...repetir para cada campo...]

Bot: ✅ *Simulação registrada com sucesso!*
```

### 4. Consulta de Processos

```
Bot: 🔍 *Consulta de Processos*

Por favor, informe seu *CPF*:

Usuário: 123.456.789-00
Bot: Para confirmar, informe seu *nome completo*:

Usuário: João Silva
Bot: [Busca no banco e exibe status]
```

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
   - Valor: Ordem da categoria selecionada

3. **userSubcategoryContext** (Map<string, {categoryOrder, subcategoryIndex}>)
   - Usuários que estão em uma subcategoria com itens
   - Chave: JID do WhatsApp
   - Valor: Categoria + índice da subcategoria

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

## Tecnologias Utilizadas

### Servidor
- **Runtime**: Node.js
- **Framework**: Express.js
- **WhatsApp**: Baileys
- **Banco de Dados**: SQLite (better-sqlite3)
- **Logger**: Pino

### Cliente
- **Framework**: React 18
- **Build**: Vite
- **Estilização**: TailwindCSS
- **Roteamento**: React Router
- **Ícones**: Lucide React
- **HTTP**: Axios
- **QR Code**: qrcode.react

---

## Variáveis de Ambiente

O servidor utiliza:
- `PORT` (padrão: 3020)
- Credenciais armazenadas em `server/auth_info/`

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

import db from '../../infrastructure/database';
import { sendAndLogText, userFormStates } from './helpers';
import { FORM_STEPS, FORM_PROMPTS, STATUS_LABELS, FormState } from './constants';

// ─── Iniciar Formulário ───
export const startForm = async (sock: any, jid: string, contactId: number | null, formType: 'simulacao' | 'corretor' | 'processos' | 'locacao') => {
    const steps = FORM_STEPS[formType];
    const firstStep = steps[0];
    const prompts = FORM_PROMPTS[formType];

    userFormStates.set(jid, { type: formType, step: 0, data: {} });
    await sendAndLogText(sock, jid, contactId, prompts[firstStep]);
};

// ─── Processar Etapa do Formulário ───
// Recebe o input do usuário e avança no formulário step-by-step.
// Se o usuário digitar "voltar", "menu" ou "cancelar", sai do formulário.
export const handleFormStep = async (sock: any, jid: string, contactId: number | null, input: string, state: FormState) => {
    const lower = input.toLowerCase().trim();

    // Permitir escapar de um formulário com comandos de navegação
    if (lower === 'cancelar' || lower === 'cancel' || lower === 'voltar' || lower === 'menu') {
        userFormStates.delete(jid);
        await sendAndLogText(sock, jid, contactId, '✅ Formulário cancelado. Digite *MENU* para ver as opções.');
        return;
    }

    const steps = FORM_STEPS[state.type];
    const currentField = steps[state.step];
    const prompts = FORM_PROMPTS[state.type];

    state.data[currentField] = input;
    state.step++;

    // Corretor: pular nome_imobiliaria se "não"
    if (state.type === 'corretor' && currentField === 'tem_imobiliaria') {
        const answer = input.toLowerCase().trim();
        if (answer === 'não' || answer === 'nao' || answer === 'n') {
            state.data['nome_imobiliaria'] = 'Não possui';
            state.step++;
        }
    }

    if (state.step >= steps.length) {
        userFormStates.delete(jid);
        await completeForm(sock, jid, contactId, state);
        return;
    }

    const nextField = steps[state.step];
    await sendAndLogText(sock, jid, contactId, prompts[nextField]);
};

// ─── Completar Formulário ───
const completeForm = async (sock: any, jid: string, contactId: number | null, state: FormState) => {
    if (state.type === 'simulacao') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'simulacao',
            JSON.stringify({
                nome: state.data.nome, contato: state.data.contato, cpf: state.data.cpf,
                endereco: state.data.endereco, renda: state.data.renda, ocupacao: state.data.ocupacao,
            })
        );
        await sendAndLogText(sock, jid, contactId,
            `✅ *Simulação registrada com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n• Contato: ${state.data.contato}\n• CPF: ${state.data.cpf}\n` +
            `• Endereço: ${state.data.endereco}\n• Renda: ${state.data.renda}\n• Ocupação: ${state.data.ocupacao}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'corretor') {
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_corretor',
            JSON.stringify({
                nome: state.data.nome, contato: state.data.contato,
                tem_imobiliaria: state.data.tem_imobiliaria, nome_imobiliaria: state.data.nome_imobiliaria,
            })
        );
        const imobInfo = state.data.nome_imobiliaria === 'Não possui' ? 'Não' : `Sim - ${state.data.nome_imobiliaria}`;
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Corretor realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome: ${state.data.nome}\n• Contato: ${state.data.contato}\n• Imobiliária: ${imobInfo}\n\n` +
            `Em breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'locacao') {
        const locValue = state.data.localizacao?.toLowerCase() === 'pular' ? '' : state.data.localizacao;
        db.prepare('INSERT INTO form (type, data) VALUES (?, ?)').run(
            'cadastro_locacao',
            JSON.stringify({
                nome: state.data.nome, contato: state.data.contato,
                email: state.data.email, endereco: state.data.endereco, localizacao: locValue,
            })
        );
        await sendAndLogText(sock, jid, contactId,
            `✅ *Cadastro de Locação/Venda realizado com sucesso!*\n\n` +
            `📋 Dados recebidos:\n` +
            `• Nome/Empresa: ${state.data.nome}\n• Contato: ${state.data.contato}\n` +
            `• E-mail: ${state.data.email}\n• Endereço: ${state.data.endereco}\n` +
            (locValue ? `• Localização: ${locValue}\n` : '') +
            `\nEm breve entraremos em contato.\n\nDigite *MENU* para voltar.`
        );
    } else if (state.type === 'processos') {
        const cpf = state.data.cpf?.replace(/\D/g, '');
        const nomeConfirmacao = state.data.nome_confirmacao?.toLowerCase();

        const forms = db.prepare(`SELECT * FROM form WHERE type = 'atendimento_interno'`).all() as any[];
        let found: any = null;

        for (const f of forms) {
            try {
                const parsed = JSON.parse(f.data || '{}');
                const parsedCpf = (parsed.cpf || '').replace(/\D/g, '');
                if (parsedCpf === cpf && parsed.nome?.toLowerCase().includes(nomeConfirmacao)) {
                    found = parsed;
                    break;
                }
            } catch { }
        }

        if (found) {
            const statusLabel = STATUS_LABELS[found.statusAtual] || found.statusAtual || 'Não definido';

            let message = `📂 *Consulta de Processo*\n\n`;
            message += `👤 *Nome:* ${found.nome || '-'}\n`;
            message += `📱 *Contato:* ${found.contato || '-'}\n`;
            message += `📧 *E-mail:* ${found.email || '-'}\n`;
            if (found.rg) message += `🪪 *RG:* ${found.rg}\n`;
            if (found.ocupacao) message += `💼 *Ocupação:* ${found.ocupacao}\n`;
            if (found.renda) message += `💵 *Renda:* ${found.renda}\n`;
            if (found.endereco) message += `🏠 *Endereço:* ${found.endereco}\n`;
            message += `\n📊 *Status Atual:* ${statusLabel}\n`;

            if (found.processos) {
                message += `\n📋 *Processos:*\n${found.processos}\n`;
            }

            if (found.statusHistorico && found.statusHistorico.length > 0) {
                const ultimo = found.statusHistorico[found.statusHistorico.length - 1];
                const dataUltimo = new Date(ultimo.data).toLocaleDateString('pt-BR');
                message += `\n🕐 *Última atualização:* ${dataUltimo}`;
                if (ultimo.info) message += `\n📝 *Info:* ${ultimo.info}`;
            }

            message += `\n\nDigite *MENU* para voltar.`;
            await sendAndLogText(sock, jid, contactId, message);
        } else {
            await sendAndLogText(sock, jid, contactId,
                `❌ Nenhum processo encontrado para o CPF informado.\n\nVerifique os dados ou entre em contato com o atendimento.\n\nDigite *MENU* para voltar.`
            );
        }
    }
};

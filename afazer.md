Vamos realizar algumas mudanças

No src/admin web
em Whatsapp / Leads & Tickets, vamos mudar o nome para Leads & Tickets, faz mais sentido

Em Configurações vamos adicionar um aba chamada Leads & Tickets para adicionar algumas funcionalidades

1 - Botão Criar Status Leads /Botão Remover = vai criar status lead para como já existem em #root > div > div.flex-1.flex.flex-col.min-w-0 > main > div > div:nth-child(3) > div > button:nth-child(3), assim podemos adicionar e remover. Certifique-se de adicionar no banco de dados se os outros tiverem sido tambem, tem mais logica. 
2 - Botão Organizar Status Lead = Botão vai mostrar um modal da forma que a ordem deve ser, vai arrastar de um lado para outro e vai ficar exemplo:

1 - atendimento, 2 qualificado 3 recuperado

Tudo conforme a necessidade do usuário.

Apos isso em 

em Whatsapp / Leads & Tickets:

alterar o botão em #root > div > div.flex-1.flex.flex-col.min-w-0 > main > div > div.space-y-3 > div:nth-child(1) > div.border-t.border-ch-border.bg-ch-bg.p-3.md\:p-4 > div.flex.gap-2.flex-wrap > button.px-4.py-2.bg-ch-cyan\/20.text-ch-cyan.rounded-lg.sm.font-bold.hover\:bg-ch-cyan\/30.transition-colors.flex.items-center.gap-1 para que ele um modal para alterar os status e confirmar. 

Ao lado desse botão incluir o botão = Resumir com IA, que vai ler a conserva e ela vai ser resumida e guardada para caso seja recuperada, se caso seja necessário resumir novamente a ia não deve pegar do começo, ela deve pegar do resumo e continuar de forma histórica, isso deve ser mostrado em um modal 

faça isso lendo as informações de Gemini.md e faça o plano


editar template em marketing
adicionar mecamina de teste de agendamento

em leads e tickets as conversas tem ser acessada dentro do bloco do lead mesmo
E juntas as interações, o momento toda nova sessão gera um lead novo, se for do mesmo numero não há necessidade 

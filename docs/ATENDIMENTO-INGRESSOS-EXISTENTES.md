# Atendimento com ingressos já emitidos

No Admin, em Pedidos do evento > Detalhes do pedido, use Ver ingressos / baixar PDF. São exibidos os códigos originais, sem chamar issue_tickets nem criar pedidos/pagamentos. Há PDF individual e de todos os ingressos válidos. O nome do comprador também abre essa consulta.

Enviar pelo WhatsApp do comprador prepara links protegidos de 24 horas e abre o número informado no pedido (DDD e país normalizados). O operador confere e envia no WhatsApp; o site não envia mensagens automaticamente. Cada link permite abrir o QR original e salvar o PDF. Sem telefone válido, deve-se salvar o PDF e confirmar o contato. Ingressos utilizados, cancelados e pedidos não confirmados/em revisão não são compartilhados.

Migração incremental 028_existing_ticket_support.sql: adiciona uma RPC restrita a Admin/organizador autorizado no evento e a regra de recuperação por e-mail confirmado. Não modifica funções atuais, tickets, pedidos, pagamentos, QRs ou usuários. Homologar e aplicar somente com autorização explícita. Pré-requisitos: 027 já instalada, helper verified_customer_email com perfil ativo/e-mail confirmado/conta não anônima; can_access_event com escopo de organização e perfil ativo. Reenvios são rastreáveis por ticket_shares.created_by/created_at e não invalidam links anteriores.

Rollback: docs/ROLLBACK-028-existing-ticket-support.sql. Remove somente a função e a política novas; links já enviados expiram em até 24 horas e continuam sujeitos à confirmação e ao estado do ingresso.

Compra rápida: acesso pelo mesmo navegador enquanto a sessão anônima persistir. Após 028, uma conta ativa com e-mail confirmado igual ao da compra pode recuperar os pedidos aprovados em Meus ingressos em outro aparelho. CPF ou e-mail digitado sem verificação não dão acesso. O cadastro não transfere nem altera a propriedade do pedido. O envio de e-mail automático continua dependendo do provedor e não é prometido por esta alteração.

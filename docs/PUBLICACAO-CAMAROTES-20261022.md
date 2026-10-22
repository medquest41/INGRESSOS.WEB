# Publicação de camarotes — 22/10/2026

Autorização do usuário: publicação, migração e atualização do backend. A retomada de `ingressos-testes` foi autorizada separadamente. Nenhuma cobrança real foi feita.

## Auditoria e compatibilidade

- GitHub e Render estavam em `e268760`; a publicação parte dessa revisão, preservando as correções recentes de portaria e recorte.
- Produção: projeto Supabase `oavpsfcosidlvoinbjst`; homologação: `cjbfafohovoajexwevpi`.
- Produção tinha participantes no pedido, mas faltavam `tickets.holder`, `tickets.ticket_number`, compartilhamento, outbox e reconciliação 014. A migração 027 foi revisada para adicionar apenas os pré-requisitos necessários, dentro da mesma transação. Não foram reaplicados pacotes antigos nem corrigidas pendências alheias de organização/atividade.
- As definições substituídas são preservadas em `ingressos_migration_audit.function_snapshots`, com RLS e sem acesso de anon/authenticated. O rollback restaura as definições auditadas; recusa downgrade destrutivo quando já existem camarotes/pedidos.
- O backend publicado era um arquivo Checkout Pro diferente do `index.ts` do repositório. O backup foi baixado antes de alterar. A adaptação está em `supabase/deployment/payments-checkout-pro.ts`: essa é a fonte efetivamente publicada no painel da função `payments`. O `supabase/functions/payments/index.ts` anterior permanece como referência do fluxo inline; não deve substituir cegamente a função Checkout Pro em produção.

## Comportamento do backend publicado

Ingressos comuns conservam os caminhos atuais de Pix/Checkout Pro. Para camarotes, a reserva é estendida uma única vez para 32 minutos ao iniciar pagamento; o Pix recebe a mesma expiração, e a preferência de cartão usa a validade do pedido. A chave Pix continua idempotente por pedido.

O backend consulta o provedor, confere vendedor, ambiente, valor, moeda e referência do pedido e chama `reconcile_camarote_payment`, restrita a service_role. A rotina serializa por evento/pedido, emite N QR uma única vez e coloca aprovações tardias ou cobranças divergentes em revisão. Rejeição/cancelamento liberam reservas, e estorno/chargeback invalidam os QR correspondentes. Não há aprovação por sinalização do frontend.

## Verificações realizadas

- 89 testes automatizados passaram após a adaptação, incluindo execução local do backend real com banco e provedor simulados. O teste SQL específico foi repetido após acrescentar RLS no backup.
- Build do frontend passou; a interface foi testada anteriormente em 390 e 1366 px, com três testes de navegador passando na pasta existente.
- A migração foi aplicada primeiro no Supabase de homologação, retomado com autorização.
- Teste transacional no PostgreSQL real: reserva, ausência de QR antes do pagamento, oito QR distintos, confirmação repetida sem duplicação, uma entrada e sete pulseiras restantes. Dados e configuração dessa simulação foram revertidos.
- Concorrência real com dois compradores anônimos sintéticos e conexões PostgreSQL **6977** e **6978**: a primeira transação reteve a reserva por 20 segundos; a segunda aguardou e recebeu “Estoque insuficiente”. Resultado: um pedido, zero QR sem pagamento. Os dados sintéticos foram arquivados e os perfis de teste desativados, sem apagar histórico.
- Migração de produção concluída e verificada: **17 pedidos, 14 ingressos e 2 eventos antes e depois**. `authenticated` não pode executar a confirmação de pagamento.
- Backend publicado pelo painel Supabase; após recarregar, a fonte salva coincidiu integralmente com o arquivo revisado.

## Limites e operação

Não foram efetuados Pix/cartão reais nem usado o leitor físico da portaria. O provedor foi simulado nos testes de backend; a assinatura, reconciliação, reprocessamento e invalidação foram exercitados sem cobrança. Entrega de e-mail depende do worker/provedor existente e não foi configurada por esta alteração; Meus Ingressos, PDF e compartilhamento individual são os acessos principais.

O resultado final do build/deploy do Render e a revisão publicada devem ser registrados no relatório externo de entrega. Criar um camarote de teste em um evento real não faz parte da publicação; o organizador cadastra os espaços, preços, pulseiras e posições no Admin.

Em caso de problema, bloqueie novas vendas de camarotes. Depois de haver pedidos, mantenha a leitura e a portaria compatíveis; não restaure o backend anterior nem reverta o schema sem auditoria dos pedidos existentes.

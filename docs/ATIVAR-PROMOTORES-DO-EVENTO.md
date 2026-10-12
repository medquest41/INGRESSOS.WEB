# Promotores de vendas de eventos

Recurso independente de promotores da plataforma. Atualização incremental: `supabase/migrations/024_event_sales_promoters.sql`.

## Ativação pendente no Supabase

Executar a atualização primeiro no projeto de teste, conferir o cadastro de um convidado e depois aplicar no projeto oficial. Não requer alterações em chaves nem pagamentos reais. A publicação das telas não instala a atualização do banco.

## Uso

Organizador abre Gerenciar evento → Promotores do evento, informa o nome, escolhe percentual ou valor fixo e copia o convite. A pessoa cria/usa sua conta, confirma o e-mail e aceita a comissão. Seu link aparece em Minhas divulgações, também acessível por Meus ingressos.

Percentual em cima dos ingressos após descontos, sem taxa de plataforma. Fixo por unidade: mesa/camarote é uma unidade. Comissão limitada ao valor líquido dos ingressos. Somente pedidos aprovados e sem revisão entram nos totais. Estornos/cancelamentos saem dos totais. Compras pela própria conta não geram comissão. O organizador paga diretamente; a plataforma não transfere nem desconta dinheiro por esta funcionalidade.

Atribuição preserva o promotor e a condição do convite na criação do pedido. Desativar impede novos pedidos pelo link e preserva os antigos. O link precisa estar presente na compra; não há rastreamento entre aparelhos ou fora do link.

## Validação feita

PostgreSQL isolado via PGlite: instalação SQL, permissões, aceite, tentativa de assumir convite já usado, vínculo ao evento, compras próprias, percentual/fixo, revisão/estorno, desativação e tabelas privadas. Telas testadas com serviços simulados em computador e celular; nenhuma conta, convite ou pagamento real foi criado nesses testes.

Para repetir o teste do banco, instalar @electric-sql/pglite em um diretório de testes e informar o caminho de dist/index.js na variável PGLITE_MODULE antes de executar tests/event-sales-db.mjs. O teste usa banco em memória.

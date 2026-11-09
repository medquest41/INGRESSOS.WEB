# Gerar ingresso — venda local sem taxa

Estado: implementação e testes locais concluídos. Migração 029 não aplicada em produção; frontend desta função ainda não publicado.

## Comportamento

- Botão dourado **Gerar ingresso**, no topo da gestão do evento, junto de Falar no WhatsApp. Acesso por administrador ou organizador responsável; financeiro, portaria e clientes não emitem.
- Escolha de um ingresso cadastrado. Categorias numeradas usam o mapa e a lista existentes, filtrados para a categoria escolhida. Unidade inteira e estoque exclusivo; uma venda da Mesa 16 não consome a Mesa 15. Escolha recolhível após selecionar o número.
- Nome do ingresso e valor por unidade editáveis lado a lado na venda. O catálogo público permanece igual. A numeração da unidade continua visível quando o nome é personalizado. Identidade, CPF, telefone, e-mail e nascimento opcionais; dados fornecidos são validados.
- O organizador confirma dinheiro recebido e conferência presencial das regras do evento. Não há chamada ao Mercado Pago ou cobrança online. Taxa da plataforma é zero. Valor cadastrado e valor declarado são preservados no snapshot para auditoria.
- Banco autoriza, bloqueia evento/unidade, verifica estoque/reservas e gera pedido e QR Codes na mesma transação. Reutiliza `issue_tickets`, `batch_open`, `batch_remaining`, os PDFs, compartilhamento e portaria. Repetição da mesma tentativa retorna os mesmos ingressos; alteração da tentativa é rejeitada.
- Venda local consome estoque também para compras online e não produz repasse financeiro. Cancelamento pelo responsável só é possível enquanto não houver entrada utilizada. Não altera a proteção dos pagamentos online recebidos.
- Tipo legado `table` continua emitindo seu QR de grupo; mesas modernas com ingressos individuais usam `camarote` e `reservationKind=table`, conforme o cadastro existente. O formulário explica a modalidade antiga.

## Arquivos

UI: `LocalSaleForm.jsx/.css`, `EventAdminContext.jsx/.css`, `CamaroteMap.jsx`, `Admin.jsx`.

Serviços/estado: `localSales.js`, `localSale.js`, `EventStore.jsx`, `LocalEventStore.jsx`, `fees.js`.

Banco: `supabase/migrations/029_local_sales.sql`, `docs/ROLLBACK-029-local-sales.sql`.

Testes: `local-sale.test.js`, `local-sale-sql.test.js`, `local-sale.spec.js`, `playwright.local-sales.config.js`.

## Validação e limites

12 testes unitários/SQL/apresentação e 8 fluxos de navegador aprovados, com dados sintéticos: celular/desktop, PDFs originais, 4 e 15 QR Codes distintos, 16 números, edição de título/valor preservando catálogo, CPF opcional inválido, perfis sem permissão e estoque após emissão. SQL executado em PGlite com cadeia de migrações de teste, autorização, tentativas concorrentes na instância local, idempotência, cancelamento, check-in único e rollback preservando ingressos.

Não equivale a teste de concorrência com conexões independentes em PostgreSQL de produção. Não foram emitidos ingressos reais ou realizadas cobranças/contatos no WhatsApp. Compilação local usa configuração pública fictícia apenas para validar o código; não publicar `dist` local. Render usa suas variáveis já configuradas.

## Aplicação controlada

1. Exige autorização explícita para a migração de produção, conforme a instrução do projeto. Confirmar o projeto correto e obter backup das definições atuais, antes de executar SQL.
2. Executar `PRECHECK-029-local-sales.sql`, somente leitura. Conferir migração 027, função de proteção atual, ausência de outra versão 029/RPC e permissões. A migração cria as funções e um gatilho, e salva a definição anterior de `protect_recorded_payment` no esquema de auditoria. Conferir essa definição com o comportamento de produção antes da aplicação; não substituir alterações alheias.
3. Homologar em ambiente separado. Aplicar somente `029_local_sales.sql`, em transação. Ela não cria uma venda e não remove pedidos/ingressos.
4. Publicar exclusivamente os arquivos deste pacote, a partir da versão `bf4dfb2`, preservando atualizações concorrentes. Testar com usuário responsável em homologação antes de uma emissão real explicitamente autorizada.
5. Em erro, suspender a publicação e aplicar `ROLLBACK-029-local-sales.sql`. Ele desabilita novas emissões, restaura a proteção anterior e preserva pedidos, QR Codes e auditoria. Mantém a proteção contra repasses quando já existem vendas locais. Reverter frontend separadamente.

# Quantidade de mesas, seleção por combo e mapa limpo — 06/11/2026

## Base e escopo
Checkout existente publication-camarotes comparado com origin/main em 9311562 (fetch sem diferença). A pasta D:\SITE-INGRESSOS\ingressos-local permanece na versão antiga e8e6099; não foi sobrescrita. Esta atualização é incremental sobre 9311562 e não recria o projeto.

## Como usar depois da publicação autorizada
1. Admin → evento → Ingressos e preços → abrir COMBO VIP (ou criar um ingresso do tipo Mesa VIP inteira).
2. Preencher preço da mesa inteira e ingressos gerados por unidade. Em Mesas deste ingresso, informar Quantidade total de mesas e Primeiro número da mesa.
3. Clicar Criar mesas numeradas e depois Salvar ingressos e preços/evento. Ex.: 10 mesas, a partir de 1, quatro ingressos por mesa.
4. O cartão do combo abre apenas suas mesas, sem misturar camarotes ou outros combos. Cliente compara a planta original, escolhe Mesa 01…10 na lateral e continua ao checkout existente com uma unidade e quatro ingressos inclusos.
5. A quantidade pode aumentar sem recriar mesas. Redução ou mudança da numeração inicial é bloqueada para preservar unidades e histórico. Bloqueie a venda no cartão da mesa desejada quando necessário. Preços e inclusos das mesas já criadas são editados nos próprios cartões; o preço do seletor serve às novas mesas adicionadas.

## Estoque e preservação
A unidade original torna-se a primeira mesa, mantendo o MESMO ID, capacidade, ingressos inclusos e vínculos dos pedidos/QR existentes. O nome passa a indicar o número; snapshots dos pedidos antigos não são reemitidos. Se a unidade já tiver reserva/venda, ela continua consumindo o estoque dessa primeira mesa.
Cada mesa adicional recebe ID exclusivo e capacidade 1. Um novo registro inativo funciona somente como cartão de escolha do combo. Sua compra direta é recusada pelo backend; o frontend exige escolher uma mesa. O fluxo existente de reserva atômica, confirmação do pagamento, emissão idempotente e portaria continua sendo usado.
No teste SQL, a configuração de dez mesas preservou uma reserva anterior: a primeira continuou reservada e sobraram nove disponíveis. Foram verificados pagamento sintético confirmado, exatamente quatro QR únicos, reprocessamento sem duplicação, uso independente e estorno/cancelamento. Não foram feitas cobranças reais.

## Planta e remoção
Com imagem cadastrada, a planta pública é limpa por padrão. O Admin pode ativar Mostrar marcadores sobre a planta para o cliente. Sem imagem, o esquema anterior continua disponível.
No editor, selecione o marcador e use Delete/Backspace ou Remover do mapa. Desfazer remoção restaura a última marcação. Após salvar/reabrir, selecione a unidade pela lista de nomes no editor e use Recolocar no mapa. Isso não exclui o ingresso, não reduz estoque e não remove pedidos. A marcação ocultada continua independente da lista comercial.
Novas mesas não recebem uma posição pública inventada sobre a foto; sua numeração está disponível na lista. Se quiser marcadores, posicione cada mesa no editor e ative a exibição pública.

## Arquivos
- src/utils/numberedTables.js: configuração idempotente e preservação da primeira unidade.
- src/components/TableQuantityEditor.jsx: formulário de quantidade/numeração com mensagens em português.
- src/pages/Admin.jsx e src/components/TicketBatchEditor.jsx/.css: integração do cadastro e distinção do cartão seletor.
- src/utils/unitSelection.js e src/pages/Evento.jsx: roteamento por categoria explícita do combo.
- src/components/EventSeating.jsx, CamaroteMap.jsx/.css, UnitShoppingList.jsx e VenueMapEditor.jsx: categoria restrita, números, planta limpa, mostrar marcadores e remoção reversível.
- tests/numbered-tables.test.js, numbered-tables.spec.js, camarotes.test.js e seating-flow.spec.js: testes novos e expectativas atualizadas para a planta limpa.
- playwright.numbered-tables.config.js: execução dos novos fluxos locais.

## Validação e limites
125 testes gerais aprovados. Cinco testes novos de navegador (cadastro/salvar/recarregar/escolher/checkout em 390/1280, remoção/desfazer/persistência e opção de marcadores), sete de rotas existentes e 39 de regressão de mapas/Admin/PDF/suporte aprovados, total 51 casos únicos de navegador.
Build, lint e verificação de whitespace aprovados. Prévias usam dados e planta sintéticos.
Não houve edição do COMBO VIP real nem criação de dez mesas no evento de produção. A quantidade definitiva deve ser configurada pelo organizador e salva após publicação. Os testes locais não comprovam capacidade de carga em produção.

## Banco, aplicação e rollback
Não requer migração: usa os atributos JSON já preservados por save_event/mapEvent. Nenhuma alteração de schema ou função de pagamentos. O teste SQL exercitou save_event real em PGlite, incluindo a ordem de persistência para evitar colisão do nome do combo.
Nenhum push/deploy realizado nesta revisão. Esta nova implementação ainda não foi publicada.
Aplicar sobre a versão atual do GitHub, nunca substituindo-a pela pasta antiga de D:. Para rollback de frontend, restaurar somente os arquivos desta revisão a partir de 9311562, preservando os atributos JSON, IDs, mesas e pedidos no banco. Não apagar as mesas geradas nem executar SQL para desfazer vendas. O seletor permanece inativo, impedindo compra genérica direta na versão anterior. A primeira mesa e suas reservas continuam com o mesmo ID.
O ajuste anterior não publicado de tests/payment17.test.js não faz parte deste ZIP. Não inclui .env, credenciais, módulos, dist, .git, dumps ou dados privados.

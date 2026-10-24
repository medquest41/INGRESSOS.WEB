# Revisão da escolha de camarotes, mesas e grupos

## Problema corrigido
O catálogo público do Réveillon contém um ingresso legado CAMAROTE do tipo individual e unidades numeradas do tipo camarote. Clicar no legado permitia avançar sem escolher uma unidade. Agora um cadastro genérico correspondente a uma categoria com unidades numeradas abre o seletor; links antigos de checkout também pedem a seleção antes de mostrar o formulário. O checkout recebe o ID da unidade escolhida, quantidade 1 e mantém parâmetros de indicação/campanha. Ingressos individuais comuns e grupos sem unidades numeradas não são convertidos automaticamente.

## Melhorias
- Mapa e lista pesquisável na mesma janela; busca por nome/número, filtro de disponíveis, ordenação por preço, seleção destacada e estado vazio com limpeza de filtros.
- Resumo com ingressos inclusos, preço integral e total com taxa, usando o mesmo cálculo existente; cupons continuam no checkout.
- Marcadores com o número escrito no nome, quando o nome termina em número, evitando divergências de metadados antigos. Não altera nomes, IDs, posições ou pedidos no banco.
- Falha de disponibilidade informa erro, oferece nova consulta e bloqueia a continuação; IDs ausentes não usam estoque local como substituto. Venda/reserva permanece confirmada atomicamente pelo backend existente. Consulta continua a cada 15s enquanto o seletor está aberto; fechar desmonta o mapa e encerra essa consulta.
- Admin tem busca de ingressos/camarotes/mesas e Recolher todos. Filtrar mantém campos montados; erros limpam a busca para revelar o campo necessário. Ao digitar a correção, o destaque e a mensagem daquele campo são limpos.

## Arquivos
CamaroteMap, EventSeating, UnitShoppingList: escolha pública e disponibilidade. Evento e Checkout: interceptação de cadastros genéricos. unitSelection: classificação/busca/rótulo. Admin, TicketEditorTools e TicketBatchEditor: busca/recolhimento. eventSaveError: limpeza do erro ao corrigir. CSS e testes associados.

## Validação
36 testes de interface da suíte existente/ampliada e 3 fluxos nas páginas reais em modo local passaram (390/1280, CAMAROTE legado mesmo sem estoque próprio, URL antiga, ingresso comum, troca de categoria, PDF, Admin, disponibilidade desconhecida/falha/vendido). 12 testes unitários relevantes passaram. Build de produção com configuração pública sintética e lint passaram. Testes bloqueiam conexões externas; nenhuma cobrança real ou escrita no banco foi realizada.

## Limites e publicação
Sem migração de banco. Não repara nem reemite ingressos anteriores. Não interpreta uma foto com IA nem inventa unidades não cadastradas. Categorias/números/preços devem existir no cadastro; só é oferecido o estoque informado pelo backend. Esta revisão não constitui teste de carga de 100–500 compradores nem valida liquidação real de pagamentos. Referência de interação: https://help.ticketmaster.com/hc/en-us/articles/9786899270545-What-is-the-interactive-seat-map-and-how-do-I-use-it

Rollback: reverter este commit de interface. Nenhum rollback de dados é necessário. ZIP incremental desde cfec646, sem .env/.git/node_modules/dist/credenciais/banco. D: indisponível neste ambiente; arquivo entregue na pasta acessível do projeto.

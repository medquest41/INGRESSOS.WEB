# Menus dos quadros de relatórios — 09/11/2026

Cada quadro de Relatórios e Financeiro agora tem um botão de três pontos, com atalho para a lista correspondente:

- Vendas aprovadas: pedidos pagos confirmados (exclui pagamento em conferência).
- Taxas: os mesmos pedidos, com taxa da plataforma por pedido destacada, inclusive zero na venda local.
- Valor dos ingressos: os mesmos pedidos, com subtotal menos desconto destacado.
- Cancelados: pedidos cancelados e estornados, conforme a definição já usada pelo indicador.

O atalho preserva o evento em consulta. A visão geral mantém somente os eventos autorizados. Filtros ficam na URL, sobrevivem à atualização da página e podem ser removidos em Limpar filtros. Os grupos já abrem ao entrar por um atalho; detalhes individuais continuam recolhíveis. O acesso a CPF e suporte de ingressos mantém as permissões existentes. Os valores agregados, pagamentos e dados não foram alterados.

Arquivos: ReportSummaryCards.jsx/.css, orderReport.js, AdminOperations.jsx, Admin.jsx, EventOrderList.jsx; testes e configuração dedicados. Nenhuma migração.

Validação: 2 testes unitários e 3 fluxos de navegador com dados sintéticos aprovados (390/1280px, todos os indicadores, filtro após recarregar, limpar filtros, teclado Escape/foco, evento correto e visão geral financeira). Lint e build aprovados. Build local com parâmetros fictícios apenas para validação; dist não é publicado.

Rollback: reverter o commit do frontend. Sem alterações no banco e sem necessidade de SQL.

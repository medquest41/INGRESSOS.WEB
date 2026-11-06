# Correção de usabilidade das mesas e do novo ingresso — 06/11/2026

Base conferida: origin/main d7d8a30. A pasta D:\SITE-INGRESSOS\ingressos-local continua antiga e não foi sobrescrita.

## O que mudou
- Quantidade total de mesas aparece dentro dos campos do ingresso de mesa, no lugar do estoque exclusivo travado em 1. Campo com exemplo 16 e primeiro número configurável.
- Digitar 16 e clicar Salvar evento/Salvar ingressos e preços aplica a numeração automaticamente. Criar mesas numeradas tornou-se uma prévia opcional; não é obrigatório clicar nele antes de salvar.
- A configuração continua gerando unidades com capacidade individual 1. O estoque exclusivo não foi transformado em estoque genérico 16. Após salvar, o comprador vê Mesa 01…16 do próprio combo, junto à planta, com os quatro ingressos inclusos preservados.
- Rascunhos de quantidade não são persistidos no banco; são consumidos uma única vez e removidos antes do envio. Repetir a gravação não cria novas mesas.
- Adicionar tipo de ingresso insere o novo cartão no início da lista, imediatamente abaixo das ferramentas. Ele nasce aberto, recebe foco e rola ao nome. Os demais continuam recolhíveis. IDs e ordem comercial dos ingressos já cadastrados não são alterados; a inserção no topo é no rascunho do editor.

## Diagnóstico do cadastro real
Consulta somente de leitura aos campos públicos confirmou que MESA VIP+ 4 INGRESSOS VIP ainda tem uma unidade, modalidade camarote/reservationKind table e nenhuma numeração configurada. Por isso a lista comercial exibe somente uma opção. Não foram criadas 16 mesas reais por esta revisão: o organizador precisa informar o total e salvar. A captura enviada também contém o rótulo antigo (existente), ausente no pacote vigente; depois da atualização, recarregar a aba do Admin evita continuar usando a versão anterior em memória.

## Validação
126 testes gerais aprovados. Sete fluxos de mesas e sete fluxos de rotas/Admin aprovados em celular/desktop. Casos novos: digitar 16 e salvar sem prévia, obter exatamente 16 escolhas, selecionar Mesa 16 e chegar ao checkout com quatro ingressos; adicionar em lista de 20 ingressos, abrir no topo, focar, recolher/reabrir sem perder texto e adicionar novamente. Build, lint e diff --check aprovados.
Dados de teste são sintéticos. Não houve cobrança, edição do cadastro real ou reemissão de QR.

## Arquivos e aplicação
src/components/TableQuantityEditor.jsx; src/components/TicketBatchEditor.jsx/.css; src/pages/Admin.jsx; src/utils/numberedTables.js; tests/numbered-tables.test.js; tests/numbered-tables.spec.js; tests/unit-route.spec.js; este relatório.
Não requer migração nem mudança no backend de pagamentos. Aplicar sobre d7d8a30/GitHub atual; não usar a pasta antiga de D: como base. Para rollback, restaurar somente esses arquivos da base anterior; preservar mesas, IDs e pedidos no banco. A reversão da interface não exige apagar os números já criados.
Pacote incremental sem .env, segredos, .git, node_modules, dist ou dados de clientes. A alteração antiga de tests/payment17.test.js permanece fora desta revisão.

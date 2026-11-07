# Abertura programada e destaque dos camarotes — 06/11/2026

Base:31b3704. Ajusta o comportamento descrito pelo usuário para camarotes e lotes ainda fora da data.

- Mostra data/hora em dourado, no horário de Brasília, para ingressos ativos e com estoque cuja abertura está programada no futuro. Não inventa data para inativos, sem estoque, horários inválidos ou já ultrapassados.
- Cartão de categoria usa a primeira abertura das unidades reais somente enquanto todas as unidades ativas com estoque estiverem no futuro. Se houver alguma aberta, mantém a escolha de números. Sem alterar dados do cadastro.
- Lista mantém números programados visíveis com data e seleção bloqueada. Atualiza a consulta no horário salvo ou ao voltar à aba. O servidor continua decidindo estoque e abertura, incluindo lotes sequenciais, reservas e vendas concorrentes. A retirada do aviso no navegador não confirma pagamento nem reserva.
- O cartão legado “CAMAROTE” e as unidades padrão também passam a compartilhar o destaque de sua categoria. Editar/remover a indicação propaga somente na categoria correspondente.
- O Admin deve manter Disponível para venda marcado e definir o início efetivo nos ingressos/unidades. Ao editar início/fim no cartão principal, os horários são aplicados às unidades daquela categoria ao salvar; editar uma unidade individual mantém as demais. Bloqueio manual não é removido pelo relógio. As unidades podem ter datas diferentes; não foi alterado nenhum agendamento de produção.

Validação:15 testes unitários,4 testes de passagem de horário/lista mista em390/1280,2 testes de regressão das16mesas, lint e build. Sem compras reais. Sem alteração no banco, funções de pagamento ou emissão/QR. Não é teste de carga.

Rollback: reverter este commit de interface e republicar, sem exclusão de dados ou migrações.

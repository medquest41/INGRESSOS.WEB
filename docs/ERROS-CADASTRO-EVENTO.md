# Erros de cadastro do evento

Nomes repetidos de camarotes/mesas/grupos são validados antes do envio, com a mesma comparação de nomes normalizados do índice camarote_event_name_unique. Lotes individuais continuam podendo repetir nome.

No erro de campo, o Admin abre os blocos recolhidos, rola e foca o campo, marca em vermelho com aria-invalid e mostra explicação em português ao lado do campo. O resumo no topo continua visível. O erro do índice recebido do backend também é traduzido. Falhas de conexão, autorização e restrições técnicas conhecidas recebem mensagens em português sem SQL. Falhas sem campo identificável permanecem no alerta geral, pois não é possível apontar com segurança para um campo específico.

Verificação: 5 testes unitários passaram, 2 testes de navegador em 390/1280 passaram (abertura de dois níveis, foco real, cor vermelha e correção do nome), build e lint passaram. Sem alterações no banco ou em pedidos. Publicação pendente de autorização específica, junto ao pacote anterior.

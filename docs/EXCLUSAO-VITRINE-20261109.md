# Ingressos excluídos na página de vendas

O RPC existente `save_event` mantém os cadastros removidos com `active=false`. A vitrine listava esses cadastros como esgotados. `publicTicketOptions` agora omite cadastros inativos, mantendo os registros de pedidos e QR Codes intactos.

Exceção: o seletor inativo de uma categoria de mesas/camarotes pode aparecer quando há unidades numeradas ativas associadas. Nenhum pagamento usa esse seletor. Uma categoria sem unidades ativas não é reconstruída na vitrine.

Ingressos ativos esgotados ou agendados continuam visíveis. A remoção precisa ser confirmada pelo salvamento do evento, conforme o fluxo atual. Não há migração ou alteração de dados de produção.

Validação: 11 testes unitários de apresentação/abertura, lint e compilação aprovados. A compilação local usa configuração pública fictícia apenas para validar o código; os arquivos dist não são publicados. A Render usa sua configuração existente.

Rollback: reverter o commit desta correção e reconstruir o frontend. Não há rollback de banco.

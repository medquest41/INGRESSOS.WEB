# Estorno automático de camarote — recebimento de IPN

Pedido informado pelo usuário: b70bf8db-69a5-4cd8-9ab3-df5d91d3a1be. Consulta somente leitura encontrou status approved/payment_status approved, 15 ingressos emitidos, Camarote 15, pagamento 184906143807. Não houve liberação manual nem declaração de estorno baseada no relato do usuário.

Os logs filtrados por esse pagamento mostram notificações MercadoPago Feed v2.0 payment em POST ?id=184906143807&topic=payment recusadas com HTTP 401. Também há notificações WebHook v1.0 recusadas. O backend distinguia apenas type=payment/x-signature, tratando IPN legado como chamada de cliente sem sessão.

Correção preparada: reconhecer somente POST topic=payment com ID numérico, sem x-signature, como pista não confiável para consulta autenticada GET /v1/payments/{id}. Nunca usa status/valor/referência enviados no corpo. Confere ID retornado, vendedor da conta, ambiente e moeda; a reconciliação existente confere pedido, valor, identidade do pagamento e faz invalidação/estoque em transação. Assinatura inválida presente continua recusada, sem fallback. Chamadas do comprador continuam exigindo sessão. Não cria Pix, não solicita reembolso, não aplica migração e não marca refund arbitrariamente.

7 testes passaram: emissão e portaria de 8/10/15/30 QR e reprocessamento; provedor simulado; IPN de estorno; corpo falsificado; vendedor/ambiente incorretos; assinatura inválida; ID inválido. Lint passou.

Aplicação requer autorização específica de atualizar payments para essa correção de notificações e reconsultar o pagamento informado. Antes da atualização, comparar a fonte publicada com a base 1161604. Após publicar, reprocessar somente uma pista para o pagamento informado e consultar o banco: liberar apenas se o Mercado Pago confirmar estorno integral e todos os QR ficarem inválidos. Estorno parcial deve continuar em revisão, sem revender o espaço. Nenhuma transferência financeira deve ser executada.

Rollback: restaurar a fonte anterior da mesma função, preservando os estados de pedidos já reconciliados e o schema atual. ZIP não inclui segredos nem dados de banco. Fonte oficial do protocolo: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/resources/notifications/ipn

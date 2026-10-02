# Integrações preparadas — ainda não ativadas

## Supabase Auth e Postgres

- Cliente oficial em `src/services/supabase.js`, com login, cadastro, recuperação e leitura de dados.
- Migração inicial em `supabase/migrations/001_platform.sql`: organizações, perfis, eventos, lotes, pedidos, ingressos, cupons, auditoria, índices, políticas de leitura/edição e função transacional de check-in.
- As credenciais públicas entram em `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- A chave de serviço fica somente no servidor. Nunca usar prefixo VITE_ para segredos.
- Perfis não aceitam escrita do navegador. É necessário provisionar perfis de cliente após cadastro e criar o primeiro admin por operação confiável do servidor. Não confiar em role enviada em metadados de cadastro.
- A migração foi preparada e revisada estaticamente; não foi executada em banco remoto por falta de conexão. Testar as políticas com dois organizadores antes da produção.

## Mercado Pago

`server/mercadopago.mjs` contém criação de preferência Checkout Pro, consulta de pagamento e validação HMAC de webhook com limite de idade. É um adaptador de servidor, não um endpoint publicado.

Para concluir a integração:

1. Implantar um servidor/Edge Functions com autenticação Supabase e configurações HTTPS.
2. Implementar transação de reserva de estoque e cálculo de preços/cupons no banco; nunca aceitar total ou aprovação vindos do navegador.
3. Criar pedido pendente e preferência com `external_reference` do pedido. Direcionar o cliente ao checkout hospedado para PIX/cartão.
4. Publicar webhook; validar assinatura, consultar o pagamento na API e conferir vendedor, moeda, valor e referência. Validar repetição/idempotência antes de emitir ingressos.
5. Atualizar pedido e emitir códigos numa única transação. Tratar expiração de reserva, pagamento recusado, estorno, cancelamento e eventos repetidos.
6. Conectar os providers da interface ao adaptador remoto, adaptar identificadores/valores em centavos e migrar dados locais mediante backup. Não ativar parcialmente Auth remoto com dados sensíveis locais.
7. Validar confirmação de e-mail, recuperação de senha, entrega de ingresso, câmera em HTTPS, acesso concorrente entre dispositivos e políticas de cada perfil.

Não foram feitas chamadas de cobrança nem alteração de banco externo.

Referências oficiais consultadas:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid
- https://www.mercadopago.com.br/developers/en/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks
- https://github.com/mercadopago/openapi/blob/main/schemas/webhooks.yaml

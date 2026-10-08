# Atualização 14 — pagamento seguro no checkout

Base conferida: `D:\SITE-INGRESSOS\ingressos-local`, em 08/10/2026. Os arquivos da Atualização 13 de contas conferem integralmente com seu pacote; os arquivos de Pix/cartão conferem com o trabalho mais recente encontrado em `work/inline-payment` da conversa anterior. Esta entrega preserva ambos e não altera a taxa ou o snapshot de cada pedido.

Pix e cartão continuam na página de compra. Pix cria uma cobrança real no servidor e mostra QR, copia e cola, valor e validade. Cartão usa MercadoPago.js / Card Payment Brick, à vista, com suporte ao desafio 3DS já existente. O token privado nunca vai para o navegador. O ingresso só é emitido pela confirmação no banco após consulta segura ao Mercado Pago; pedidos gratuitos mantêm o fluxo anterior.

## Instalação

1. Extraia o ZIP em uma pasta separada, como `D:\SITE-INGRESSOS\NOVASATUALIZAÇÕESINGRESSOS\INGRESSOS-ATUALIZACAO-14`.
2. Abra PowerShell nessa pasta e execute `powershell -ExecutionPolicy Bypass -File .\INSTALAR-ATUALIZACAO-14.ps1`. O instalador verifica os arquivos antes de qualquer cópia; se encontrar outra versão, para e mostra os conflitos. Faz backup apenas dos arquivos substituídos. Não apaga pastas, não toca em `.env` e não executa SQL.
3. No Supabase **deste projeto**, confira as migrations já executadas. Esta base contém duas `011`: `011_inline_payment_attempts.sql` e `011_self_service_organizers_and_account_admin.sql`. Ambas devem estar instaladas, após 009 e 010. Não reaplique uma migration já executada. Não use `db push` para resolver essa numeração antiga; confira os nomes e aplique o SQL pelo editor.
4. Execute **uma vez** `ATIVAR-ATUALIZACAO-14.sql`, que é a cópia da nova migration `012_verified_inline_payments.sql`. Não execute também o arquivo 012 se já usou o SQL de ativação. Nenhuma migration foi aplicada remotamente nesta entrega.
5. Publique novamente a função `payments`, com os arquivos de `_shared` do projeto. Para receber webhooks sem JWT Supabase, a função precisa ser publicada com `supabase functions deploy payments --no-verify-jwt`. Isso permite chegar ao endpoint; ações de compradores continuam validando a sessão e webhooks continuam exigindo assinatura Mercado Pago.
6. Reinicie o site e use Ctrl+F5. Para o site publicado, faça o build e publique os arquivos do projeto conforme seu processo existente.

## Variáveis: somente nomes

No servidor Supabase: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID`, `MP_WEBHOOK_URL`, `MP_PUBLIC_KEY`, `PAYMENT_ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

`MP_WEBHOOK_URL` deve apontar para a função `payments` com `?action=webhook`, usando HTTPS. Configure notificações de **payment** na aplicação Mercado Pago. As credenciais, recebedor e chave pública devem pertencer à mesma aplicação/conta; a implementação exige pagamentos em produção (`live_mode=true`). `PAYMENT_ALLOWED_ORIGINS` contém as origens autorizadas, separadas por vírgula. A conta recebedora precisa estar habilitada para Pix.

No frontend: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`. Nenhuma credencial privada pode ser `VITE_`. `MP_RETURN_URL` é usado somente pelo adaptador antigo de redirecionamento; o checkout dentro da página não depende dele.

O ajuste `payments_enabled=true` no banco é necessário para abrir cobranças. Esta atualização não ativa esse ajuste automaticamente. Não compartilhe segredos no chat, no Git ou no ZIP.

## Estados e segurança

- Pendente/em processamento: reserva e cobrança ativas; ingresso indisponível.
- Aprovado: o banco confirmou a cobrança e emitiu o ingresso uma única vez.
- Recusado: pode tentar novamente enquanto a reserva continua válida. A tentativa anterior fica no histórico do servidor.
- Cancelado: não pague o Pix; consulte o pedido antes de iniciar nova compra.
- Expirado: não mostra QR Pix utilizável nem libera ingresso. A validade é calculada também no servidor.
- Em revisão/estornado: ingresso bloqueado na tela e no check-in; requer análise administrativa.

O webhook e a consulta do comprador usam a mesma reconciliação. Verificam recebedor, ambiente, moeda, valor, pedido, método e vínculo com a tentativa. A chave idempotente fica persistida; pedidos repetidos reutilizam a cobrança. Notificações atrasadas não desfazem aprovação. Assinatura inválida, cobrança de outra tentativa e valores divergentes não confirmam o pedido.

Cobranças antigas do Checkout Pro continuam sendo reconciliadas: pagamentos já vinculados ao pedido e reservas criadas antes desta migration mantêm validação de recebedor, valor e referência. Pedidos novos exigem a tentativa persistida. Essa compatibilidade também mantém o processamento de estornos dos pagamentos anteriores.

A reserva Pix é estendida para 32 minutos pelo fluxo anterior e é enviada como validade da cobrança. Aprovação recebida após expiração, cancelamento ou de tentativa antiga fica em revisão, sem emissão automática. Em falha de criação com resposta incerta, a tentativa permanece bloqueada contra nova cobrança; retome o Pix com a mesma chave. Para cartão com resposta incerta e sem ID conhecido, o administrador deve conferir o provedor antes de permitir outra tentativa. Tokens de cartão não são persistidos para repetição automática.

## Conferência antes de abrir vendas

Faça um Pix e um cartão na conta configurada; confira valor, QR/copia e cola, validade, status, confirmação via webhook com o navegador fechado e emissão única. Verifique também recusa, reserva expirada e pedido gratuito. Em 3DS, a confirmação visual do banco não substitui a confirmação do servidor. Falhas de reconciliação retornam erro para o Mercado Pago reenviar; casos em revisão exigem conferência/estorno administrativo, sem uma automação de estorno nesta entrega.

Validação local: 35 testes aprovados, build de produção com configuração pública sintética, sintaxe da função e lint dos arquivos alterados aprovados. A verificação global de lint encontra um aviso anterior em `AttractionEditor.jsx`, preservado nesta atualização. Não houve deploy, acesso ao banco remoto, cobrança real nem validação visual do SDK/3DS na conta do usuário.

Referências oficiais: [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix?scope=prod), [Card Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/default-rendering), [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod).

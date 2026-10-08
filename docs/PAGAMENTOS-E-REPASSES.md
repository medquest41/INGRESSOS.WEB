# Pagamentos e repasses — Atualização 12 incremental

Recebimento centralizado no Mercado Pago da plataforma. Os organizadores não precisam conectar uma conta Mercado Pago; os repasses são feitos manualmente por Pix ou transferência pela administração.

## Taxa por evento

Padrão: 10%, comprador paga. Somente o administrador principal pode mudar de 0 a 100% por evento, inclusive para 0%. Organizadores podem escolher quem paga, e não podem mudar o percentual, mesmo com permissões antigas. A taxa é aplicada após descontos. Pedidos novos guardam percentual e responsável; pedidos anteriores não são recalculados.

Exemplo com ingresso de R$ 50 e taxa de 10%:

| Opção | Comprador paga | Comissão plataforma | Base do repasse antes da tarifa Mercado Pago |
| --- | ---: | ---: | ---: |
| Comprador paga | R$ 55 | R$ 5 | R$ 50 |
| Organizador absorve | R$ 50 | R$ 5 | R$ 45 |

As tarifas do Mercado Pago são separadas da comissão e descontadas do saldo do organizador. Sem tarifa verificada, o painel mostra “A apurar” e não permite registrar o repasse. Pedidos antigos pagos exigem reconciliação da tarifa antes de registrar repasses; não é presumida tarifa zero.

## Instalação local

1. Use a instalação atual que já contém a Atualização 11. Esta entrega não inclui segredos, banco remoto nem outros projetos.
2. No SQL Editor do Supabase usado por esse projeto, execute **uma vez** `supabase/migrations/009_payment_fees_payouts.sql`. Ela depende das migrações anteriores, incluindo 008_event_platform_fee_and_safe_delete.sql, já existentes. Depois execute `010_owner_only_platform_fee.sql`. Se a migração 009 já foi aplicada, execute somente a 010. Não recrie o banco e não execute novamente as migrações antigas.
3. Extraia o pacote em `D:\SITE-INGRESSOS\NOVASATUALIZAÇÕESINGRESSOS\INGRESSOS-ATUALIZACAO-12`.
4. Copie as pastas `src`, `server` e `supabase` deste pacote sobre `D:\SITE-INGRESSOS\ingressos-local`, mesclando as pastas e substituindo somente os arquivos presentes. Não substitua a pasta inteira nem apague arquivos.
5. Abra o iniciador existente e atualize o navegador com Ctrl+F5. O endereço local continua `http://127.0.0.1:5188/`.

O pacote é incremental e contém apenas arquivos necessários para esta alteração. A correção de Visualizar está preservada no Admin.jsx.

## Ativar o Mercado Pago

O código está preparado, mas cobranças reais exigem publicação da função e configuração pelo titular da conta. Não envie tokens no chat, não coloque credenciais em `VITE_` e não altere credenciais de outro projeto.

Publique a função Supabase **payments**, incluindo `functions/_shared`. Exemplo via CLI já autenticada no projeto correto:

```sh
supabase functions deploy payments --no-verify-jwt
```

O webhook é público para receber o Mercado Pago e exige assinatura válida. As ações de checkout e status verificam a sessão do comprador dentro da função. A opção acima se aplica somente a essa função, que valida autenticação internamente; não desative autenticação de outras funções.

Cadastre estes segredos em **Edge Functions → Secrets**, no projeto correto:

- `MP_ACCESS_TOKEN`: token de produção da conta Mercado Pago da plataforma.
- `MP_WEBHOOK_SECRET`: segredo de assinatura de Webhooks fornecido pelo Mercado Pago.
- `MP_COLLECTOR_ID`: ID do vendedor dessa mesma conta.
- `MP_RETURN_URL`: URL HTTPS do site publicado, terminando em `/ingressos`.
- `MP_WEBHOOK_URL`: `https://SEU-PROJETO.supabase.co/functions/v1/payments?action=webhook`.
- `PAYMENT_ALLOWED_ORIGINS`: origens exatas separadas por vírgula, sem barra final; inclua `http://127.0.0.1:5188` e o domínio HTTPS publicado.

A função também utiliza as variáveis padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do servidor. Essas credenciais permanecem no ambiente da função.

Configure Webhooks de **pagamentos** na aplicação Mercado Pago com a URL acima. O site público deve estar publicado em HTTPS. Não utilize localhost como URL de retorno do Mercado Pago.

Depois de publicar, configurar e conferir o projeto, habilite pagamentos no SQL Editor:

```sql
update public.settings set value = 'true'::jsonb where key = 'payments_enabled';
```

Para suspender novas cobranças, volte esse valor para `false`. A suspensão também pausa a reconciliação do webhook; revise pagamentos pendentes ao reativar.

## Fluxo e confirmação

O checkout reserva o estoque por 15 minutos, utiliza o total calculado pelo banco e abre o Mercado Pago para escolha do pagamento. Pedidos gratuitos continuam sendo confirmados sem cobrança. Pedidos pagos recebem ingressos somente após consulta ao pagamento e validação da assinatura, vendedor, ambiente de produção, moeda, total, estoque e reserva no servidor. Retornar do Mercado Pago não confirma o pedido. Em Minha conta, “Atualizar pedidos” consulta o estado atual e “Pagar no Mercado Pago” permite retomar uma reserva válida.

## Repasses e estornos

Financeiro exibe comissão, tarifa verificada e saldo calculado por pedido. Somente administrador pode registrar um repasse, com referência de 3 a 200 caracteres. Esse registro não envia Pix e não realiza transferências. Confirme saldo liberado, extrato, eventuais estornos e contestações antes de transferir.

O painel não envia pedidos de estorno ao Mercado Pago. Notificações verificadas de estorno integral ou contestação cancelam os ingressos e colocam o pedido em revisão; notificações de estorno parcial bloqueiam novos repasses para reconciliação manual. O histórico de repasses realizados é preservado. Pagamentos confirmados não podem ser cancelados como uma simples reserva. Estornos devem ser feitos no Mercado Pago e reconciliados no banco antes de novos repasses. Notificações fora da reserva ou sem estoque não emitem ingressos; a função retorna erro para repetição da notificação e exige reconciliação/estorno pela administração. Antes de abrir vendas ao público, valide esses procedimentos e o webhook no ambiente publicado.

## Validação desta entrega

Testes locais usam banco PostgreSQL simulado e pagamentos sintéticos, sem movimentar dinheiro ou alterar o banco remoto. Cobrem cálculo, permissões, isolamento de dados, estoque, desconto, taxa imutável por pedido, confirmação idempotente, tarifa do provedor e repasse único. Lint e build foram validados. A função Edge e uma cobrança real ainda precisam de validação no servidor configurado.

Referências oficiais:

- [Mercado Pago — Checkout Pro](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview)
- [Supabase — segredos de funções](https://supabase.com/docs/guides/functions/secrets)
- [Supabase — autenticação](https://supabase.com/docs/guides/functions/auth-legacy-jwt)


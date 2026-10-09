# Ingressos Experiences — atualização 17

Pagamento **único por pedido**, com Pix e cartão dentro do checkout. Não há planos, assinatura, renovação automática ou endpoints de preapproval. A persistência do MedQuest foi consultada como referência; esta atualização mantém o esquema e as funcionalidades do Ingressos.

## Instalação e limites desta entrega

Faça backup do projeto. Extraia este ZIP na raiz do projeto atual (`D:\SITE-INGRESSOS\ingressos-local`), preservando as pastas `src`, `server` e `supabase`. O pacote é incremental: não substitui o projeto completo e não instala atualizações anteriores. Base conferida: atualizações 14/14.1 em diante, 16 + 16.1 + 16.2; correções visuais 16.3/16.4 encontradas também foram preservadas. Os arquivos da Home não são alterados neste pacote.

Nenhum SQL remoto, deploy, configuração de credenciais ou cobrança foi executado. Os testes usaram respostas sintéticas e PostgreSQL local. O Brick real, a entrega do webhook, a conta recebedora e o 3DS ainda precisam de homologação no seu ambiente. Não apresente a integração como ativa antes de concluir as etapas abaixo. E-mail de ingressos continua dependendo da função e do provedor de e-mail já previstos na 16.

## 1. Conferir e aplicar SQL, em ordem

Use o SQL Editor do Supabase do **Ingressos**, nunca o projeto MedQuest. Execute primeiro `VERIFICAR-PAGAMENTOS-17.sql` (somente leitura) e confira também o registro das migrations/SQL já aplicados. A presença de uma função não prova que todo um arquivo foi aplicado. Não foi presumido que 011, 012 ou 013 já estejam instalados remotamente.

Ordem exata dos arquivos existentes do projeto, quando ainda faltarem:

1. `001_platform.sql`
2. `002_production.sql`
3. `003_order_history_global_coupons.sql`
4. `004_preservation_reservation_limits.sql`
5. `005_primary_admin_email.sql`
6. `006_event_image_storage.sql` (funcionalidade de imagens existente)
7. `007_checkin_event_scope.sql`
8. `008_event_platform_fee_and_safe_delete.sql`
9. `009_payment_fees_payouts.sql`
10. `010_owner_only_platform_fee.sql`
11. `011_inline_payment_attempts.sql` **da correção 14.1**
12. `011_self_service_organizers_and_account_admin.sql` — é OUTRO arquivo; mantenha as duas 011.
13. `012_verified_inline_payments.sql` (ou o SQL equivalente `ATIVAR-ATUALIZACAO-14.sql`, uma vez).
14. `013_experience_participants_vip.sql` (ou `ATIVAR-ATUALIZACAO-16.sql`, uma vez).
15. **Novo:** `014_atomic_inline_payments.sql` (ou `ATIVAR-ATUALIZACAO-17.sql`).

Os arquivos ficam em `supabase/migrations/`. Não execute novamente 011/012 já aplicados: contêm criação de tabela/trigger/função sem proteção para reaplicação. Este ZIP preserva esses arquivos na base, sem copiá-los desnecessariamente. Se estiverem ausentes, restaure o pacote 14.1/pré-requisitos antes de avançar. Não use `supabase db push` para resolver a numeração histórica duplicada. A nova 014 é reaplicável e não muda cálculo de taxas, snapshots, participantes ou geração individual de QR.

## 2. Variáveis exatas

**Render Static Site — somente configuração pública:**

| Nome | Valor/configuração |
|---|---|
| `VITE_SUPABASE_URL` | URL HTTPS do projeto Ingressos |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública publishable do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Alternativa pública legada; use uma das duas chaves |
| `VITE_LOCAL_DEMO` | `false` |

Não configure access token, webhook secret ou service_role no Render Static Site. A public key Mercado Pago é entregue pela Edge Function autenticada; não precisa de `VITE_MP_PUBLIC_KEY`.

**Supabase Edge Functions → Secrets (ambiente seguro):**

| Nome | Uso |
|---|---|
| `MP_ACCESS_TOKEN` | Access token secreto da aplicação/conta recebedora |
| `MP_WEBHOOK_SECRET` | Assinatura secreta de Webhooks dessa aplicação |
| `MP_PUBLIC_KEY` | Public key pública do Mercado Pago, formato `APP_USR-UUID` ou `TEST-UUID`; precisa corresponder ao ambiente/token |
| `MP_COLLECTOR_ID` | ID numérico da conta recebedora; conferir na conta/API do Mercado Pago |
| `MP_ENVIRONMENT` | Exatamente `sandbox` na homologação ou `production` na operação real; sem valor, pagamentos ficam desabilitados |
| `MP_WEBHOOK_URL` | `https://SEU_PROJECT_REF.supabase.co/functions/v1/payments?action=webhook` |
| `PAYMENT_ALLOWED_ORIGINS` | Origens HTTPS exatas, separadas por vírgula; por exemplo domínio Render e domínio próprio, sem barra final/caminho |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` são os nomes usados pela função; o Supabase hospedado os disponibiliza no ambiente da Edge Function. `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser enviada ao navegador, colocada no ZIP, em Git ou em variável `VITE_`.

`MP_RETURN_URL` permanece compatível com o adaptador antigo de redirecionamento, mas **não é necessária para o pagamento inline**. Não há credenciais copiadas do MedQuest. A conta Mercado Pago deve estar habilitada para Pix e os métodos pretendidos.

## 3. Publicar a Edge Function e configurar Webhook

Somente depois de você optar por ativar no seu projeto:

```text
supabase functions deploy payments --project-ref SEU_PROJECT_REF --no-verify-jwt
```

Publique junto todos os módulos de `supabase/functions/_shared`. `supabase/config.toml` define `verify_jwt=false` **apenas para payments** porque o Mercado Pago não envia JWT Supabase. Se seu projeto já tem um config.toml personalizado, mescle esse bloco e preserve as outras funções. As ações `order`, `pay`, `poll` e `status` continuam exigindo sessão validada por `auth.getUser`; propriedade do pedido e perfil ativo são conferidos no servidor. Webhooks exigem HMAC válida, ID do pagamento no parâmetro `data.id` e consulta autenticada ao provedor.

Na aplicação Mercado Pago, abra **Suas integrações → Webhooks**, configure a URL acima e ative eventos **Pagamentos / payment** para o ambiente escolhido. Copie a assinatura secreta para `MP_WEBHOOK_SECRET` no Supabase. Configure URL e segredo no ambiente correto. A URL cadastrada contém `action=webhook`; o provedor adicionará `data.id`. Não aponte para o Render Static Site. O simulador do painel pode enviar IDs fictícios que não correspondem a um pedido: isso não aprova ingressos e pode retornar erro. Verifique uma notificação referente a pagamento de teste real do ambiente de homologação.

A assinatura aceita até cinco minutos de diferença; mensagens antigas ou alteradas são recusadas. Repetições válidas consultam o estado atual do pagamento e não emitem ingressos duplicados. Falha de reconciliação retorna erro para permitir nova entrega. Mantenha o endpoint e as credenciais funcionando para receber estornos e chargebacks mesmo se bloquear novas vendas.

## 4. Render e ativação

O frontend funciona como **Render Static Site**: build `npm ci && npm run build`, publicação `dist` e rewrite `/* → /index.html`, já previsto no projeto. A cobrança ocorre na Edge Function, não no Render. Adicione a origem pública exata a `PAYMENT_ALLOWED_ORIGINS`. Preserve os redirects/URLs de autenticação do Supabase. Compra sem conta depende de Anonymous Sign-Ins já documentado na 16.

Após conferir SQL, função, credenciais e origem, habilite `payments_enabled=true` pelo controle administrativo existente. Se usar o SQL Editor, a alteração explícita equivalente é:

```sql
update public.settings set value='true'::jsonb where key='payments_enabled';
```

Esse comando **não foi executado** nesta entrega. Comece em um projeto separado de homologação com `MP_ENVIRONMENT=sandbox` e credenciais/usuários de teste. Pagamentos `live_mode=false` são aceitos apenas nesse ambiente. Para produção, troque todas as credenciais pertinentes e use `production`; pagamentos de teste serão recusados. Nunca habilite sandbox em uma base de ingressos destinados a entrada real.

## Fluxo e segurança

- Pix: valor, comprador, referência e prazo vêm do pedido no banco. O QR e copia e cola aparecem dentro da página; o prazo da reserva é sincronizado com a cobrança (32 minutos ao iniciar, respeitando o mínimo de 30 do Mercado Pago). Expiração oculta o código e impede aprovação tardia automática.
- Cartão: MercadoPago.js/Card Payment Brick captura/tokeniza os dados. O backend recebe somente token, método, emissor, uma parcela e identidade do titular. PAN/CVV não são persistidos nem encaminhados pelo serviço. O desafio 3DS existente é preservado. A compra é única e à vista.
- Pedido continua `pending` enquanto a cobrança estiver `pending`, `in_process` ou `authorized`. `approved` só aparece ao comprador após aprovação validada e emissão no banco. Retorno do navegador ou URL não confirma pagamento.
- A função confere pagamento, recebedor, ambiente, BRL, valor integral, referência, método e vínculo com a tentativa. A nova RPC reúne verificação, estorno e emissão em uma transação com locks de estoque/pedido. Rotinas de confirmação só têm EXECUTE para service_role.
- Idempotência usa UUID persistido por tentativa; requisições simultâneas também recebem lease de criação por 60 segundos. Após erro/resposta perdida, o servidor procura a cobrança pela referência e metadado da tentativa e consulta seu ID no provedor. Não inventa aprovação e não cria outra chave enquanto o resultado for desconhecido.
- Erro definitivo 400/422 na primeira requisição pode liberar uma nova tentativa; timeout, erro 5xx ou conflito de idempotência permanece em verificação. Cartão com resultado desconhecido fica bloqueado enquanto consulta o provedor. Se nenhuma cobrança for encontrada e a reserva expirar, investigue no Mercado Pago antes de nova compra; não há cancelamento/estorno automático nem armazenamento do token do cartão para reenvio.
- `rejected` permite nova tentativa válida; `cancelled` bloqueia o pedido cancelado; `refunded` e `charged_back` bloqueiam ingressos; `expired` impede emissão tardia; `review` exige análise administrativa. Estorno parcial também bloqueia QR/check-in, inclusive se chegar antes da emissão. Aprovação de uma tentativa aposentada ou reserva expirada vai para revisão, sem novo ingresso.
- Pedidos gratuitos seguem o fluxo já existente: aprovação no servidor sem cobrança. A taxa da plataforma e o snapshot por pedido permanecem intactos; a tarifa do Mercado Pago vem da resposta verificada e não é inventada quando desconhecida.
- Desabilitar novas cobranças preserva a recepção de reversões; aprovações ainda dependem da configuração de aprovação do banco. Não desative/publicamente remova o webhook enquanto existirem pagamentos pendentes.

## Testes e homologação

Validação local: testes da aplicação e PostgreSQL/PGlite, handler HTTP da Edge Function com rede/banco simulados, interface Pix/cartão no Chrome com SDK simulado, inspeção estática e build de produção com chave pública sintética. Nenhum teste fez cobrança ou acessou seu banco remoto. Resultados detalhados em `docs/VALIDACAO-17.md`.

Para repetir, use Node 24 (o teste HTTP usa `stripTypeScriptTypes`), instale as dependências existentes com `npm ci` e execute:

```text
npm test
npm run lint
npx playwright test --config playwright.update17.config.js
npm run build
```

O build precisa das variáveis públicas do Supabase. Playwright precisa do Chrome e usa exclusivamente URLs/credenciais sintéticas com interceptação de requisições. O formulário de teste fica em `tests/fixtures`, fora do bundle de produção.

Homologação externa ainda necessária, por ação sua: Pix pendente e aprovado, cartão aprovado/recusado e desafio 3DS quando exigido, assinatura inválida, webhook repetido, reserva expirada, estorno parcial/total e chargeback. Em cada pedido pago, confira que não há ingresso/QR antes da aprovação e que existe um QR individual após aprovação. Confirme que pedidos de outro usuário não podem ser lidos/pagos. Teste também ingresso gratuito, participantes, taxa e check-in. Só passe para credenciais de produção depois desses resultados.

Documentação oficial consultada:

- [Pix e validade](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix)
- [Card Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/introduction)
- [Dados de envio do cartão](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/payment-submission)
- [Webhooks e assinatura](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks)
- [Configuração de autenticação Edge Functions](https://supabase.com/docs/guides/functions/function-configuration)

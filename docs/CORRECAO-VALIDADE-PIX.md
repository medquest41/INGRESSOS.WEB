# Correção do formato da validade do Pix — 24/10/2026

## Diagnóstico
O Mercado Pago recusou date_of_expiration. A função payments publicada envia expires_at diretamente do PostgreSQL em compras de camarote. Timestamps com seis casas fracionárias não são normalizados para o formato esperado pelo provedor. A fonte publicada foi copiada pelo editor e comparada: coincide com supabase/deployment/payments-checkout-pro.ts antes da alteração. Backup preservado separadamente; nenhuma versão local antiga substituiu o backend atual.

## Alteração
pixExpiration valida presença de fuso, interpreta o instante e serializa em UTC com três casas decimais e deslocamento explícito +00:00. Preserva o instante na precisão de milissegundos (descarta fração inferior a 1ms), sem prolongar reservas. A correção é aplicada à fonte Checkout Pro efetivamente utilizada e aos helpers inline de referência, preservando diferenças dos fluxos. Ingressos comuns do backend publicado continuam sem expiração adicional. Valores, chave Pix idempotente, reconciliação, validação do vendedor/pagamento e emissão permanecem iguais.

Erros de formato de data conhecidos recebem explicação em português no backend e no frontend. Não há instrução de pagar de novo quando um pagamento já foi efetuado.

## Verificação
13 testes passaram: datas PostgreSQL com microssegundos e offset, contrato do payload Pix, provedor simulado rejeitando formato não normalizado, fronteiras de pagamento, emissão SQL de 8/10/15/30 QR, reprocessamento idempotente e portaria. Build e lint passaram. A simulação é local; não houve cobrança real, criação de pedido em produção ou confirmação manual.

## Aplicação e rollback
Não requer migração. O arquivo a publicar é supabase/deployment/payments-checkout-pro.ts como index.ts da função payments. Não substituir pela implementação inline diferente de supabase/functions/payments/index.ts. Preservar configurações, segredos e autenticação atuais. Antes de publicar, comparar com o backup da função corrente. Para rollback, restaurar apenas a fonte anterior dessa mesma função; não reverter tabelas ou a reconciliação.

A revisão automática exigiu autorização específica para a função de produção. O usuário autorizou expressamente atualizar payments em ingressos-web. Após essa autorização, a função foi publicada pelo painel; a página foi recarregada e a fonte persistida coincidiu integralmente com a correção testada. Nenhuma migração, alteração de segredos ou cobrança foi feita. A confirmação de pagamento real e os 15 ingressos desta compra dependem do pagamento do usuário; não foram simulados em produção. Sem segredos ou arquivos de banco no ZIP incremental.

Referência oficial: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix?scope=prod
Formato exemplificado pelo provedor: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/expiration-date

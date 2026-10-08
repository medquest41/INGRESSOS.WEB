# Atualização 13 — Pix e cartão na compra do ingresso

O comprador escolhe Pix ou cartão no checkout do site. Pix exibe o QR Code, o código copia e cola e a validade ali mesmo. Cartão usa Card Payment Brick, o formulário seguro do Mercado Pago, inicialmente à vista. Quando o banco solicita confirmação adicional, o Status Screen Brick trata a etapa 3DS. O site consulta o status automaticamente e libera ingressos somente após confirmação no banco do projeto.

As regras de taxa e repasse da Atualização 12 permanecem: eventos novos começam em 10%, somente o administrador principal altera o percentual, o organizador escolhe quem paga, todas as vendas entram na conta Mercado Pago da plataforma e os repasses são manuais.

## Instalação

Esta entrega é incremental sobre a Atualização 12 com as migrações 009 e 010 já instaladas. Não reaplique essas migrações se já executadas. Não há alterações em outros projetos nem em credenciais.

1. Extraia em `D:\SITE-INGRESSOS\NOVASATUALIZAÇÕESINGRESSOS\INGRESSOS-ATUALIZACAO-13`.
2. No Supabase correto, execute **uma vez** `supabase/migrations/011_inline_payment_attempts.sql`.
3. Mescle `src`, `server` e `supabase` do pacote sobre `D:\SITE-INGRESSOS\ingressos-local`. Substitua somente os arquivos presentes, sem apagar pastas nem substituir `.env`.
4. Publique novamente a função Supabase **payments**, incluindo seus arquivos de `_shared`. O webhook continua na mesma função, protegido por assinatura; as ações do comprador continuam exigindo sessão validada internamente.
5. Reinicie o iniciador e use Ctrl+F5 em `http://127.0.0.1:5188/`.

## Configuração da conta

Na função **payments** do Supabase correto, adicione `MP_PUBLIC_KEY`, a chave **pública** da mesma aplicação Mercado Pago usada por `MP_ACCESS_TOKEN`. Não coloque um token privado nesse campo. A chave pública fica disponível para o formulário no navegador; o token privado permanece exclusivamente no servidor.

As configurações anteriores continuam necessárias: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID`, `MP_WEBHOOK_URL`, `PAYMENT_ALLOWED_ORIGINS`, além das variáveis padrão do Supabase no servidor e `payments_enabled=true` no banco. O fluxo dentro da página não precisa de `MP_RETURN_URL`; manter esse valor existente não altera o funcionamento. Pix exige uma chave Pix cadastrada no Mercado Pago do recebedor e a conta habilitada para cobranças.

Não misture as credenciais de outro projeto. Nenhum segredo deve ser enviado no chat ou incluído em `VITE_`. Antes de abrir vendas, valide a execução da função, o QR Code, o formulário de cartão, a confirmação do webhook e o desafio 3DS na aplicação configurada. A implementação atual exige resposta de pagamento em produção; os testes desta entrega são sintéticos e não efetuam cobranças reais.

## Validade, estoque e repetição

O Mercado Pago exige validade de pelo menos 30 minutos para o Pix via API Payments. Ao iniciar uma tentativa de pagamento, o servidor estende a reserva para 32 minutos e usa essa mesma validade na cobrança Pix. Antes de iniciar, permanece a reserva inicial de 15 minutos. O comprador vê a validade atualizada na tela.

A tentativa tem identificador único persistido pelo banco. Repetir a geração do Pix reutiliza a mesma tentativa; uma cobrança ativa impede iniciar outra forma de pagamento. Após uma recusa definitiva, uma nova tentativa pode ser criada. O banco guarda apenas referência, método e status, sem número do cartão, CVV ou token de cartão.

Se a geração for interrompida, retome o Pix pelo próprio botão ou por Minha conta. Se uma criação de cartão tiver resposta incerta, confira o pedido antes de fazer outra compra; não é criada uma nova tentativa enquanto a anterior permanece ativa. Não pague um código de pedido cancelado ou expirado. Pagamentos recebidos depois da validade, sem estoque ou com divergências precisam de reconciliação/estorno pela administração; não liberam ingressos automaticamente.

## Conferência

- Escolha um ingresso pago, preencha os dados e selecione Pix. “Continuar para pagamento” reserva o pedido e abre a área de pagamento na mesma página; “Gerar QR Code Pix” obtém o código real da conta configurada.
- Copie o código ou escaneie no aplicativo do banco. O valor exibido vem do pedido no servidor, incluindo a taxa configurada.
- Escolha cartão para carregar o formulário seguro. Esta versão permite pagamento à vista. Complete a confirmação do banco quando solicitada.
- Após confirmação no banco do projeto, abra Minha conta para conferir os ingressos. A resposta visual do provedor sozinha não libera o ingresso.
- Recarregar a página não gera nova cobrança automaticamente. Uma reserva existente pode ser retomada em Minha conta.

## Validação realizada

31 testes locais passaram, incluindo PostgreSQL simulado, permissão, cálculo, cobrança idempotente, isolamento do comprador, reserva sincronizada com Pix, bloqueio de formas simultâneas e confirmação condicionada ao banco. Lint dos arquivos alterados, verificação de sintaxe da função e build de produção passaram. Não houve deploy, cobrança real ou teste visual do SDK/3DS no ambiente do usuário; essa validação depende da conta e do servidor configurados.

Referências oficiais:

- [Mercado Pago — Pix, validade e QR Code](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix?scope=prod)
- [Mercado Pago — formulário de cartão](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/default-rendering)
- [Mercado Pago — confirmação 3DS](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/how-tos/integrate-3ds)

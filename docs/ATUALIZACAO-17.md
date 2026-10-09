# Atualização 17 — Pix no checkout

1. Faça uma cópia de segurança do projeto atual com 16 + 16.1 + 16.2 aplicadas.
2. Extraia este ZIP na raiz do projeto, substituindo somente os arquivos incluídos. Mantenha as outras pastas e arquivos.
3. Envie as alterações para o repositório usado pela Render e aguarde o deploy.
4. Mantenha as variáveis públicas Supabase existentes e a configuração SPA da Render. Não é necessário alterar SQL, taxas, autenticação ou publicar novamente a função.
5. Abra um evento pago, preencha o checkout e confirme os participantes. Clique em **Continuar para pagamento** e depois em **Gerar QR Code Pix**.
6. Confira valor, validade, QR Code e copia e cola. O status é consultado a cada 8 segundos; também existe **Verificar pagamento**. O ingresso só aparece após aprovação. Pedidos gratuitos seguem o fluxo existente sem cobrança.

O frontend chama a função Supabase `payments` no projeto configurado pelas variáveis públicas existentes, com `create_pix` e `status`, `orderId` e Bearer da sessão. O projeto esperado é `https://oavpsfcosidlvoinbjst.supabase.co`. Nenhum Access Token Mercado Pago ou service_role é enviado ao navegador.

Cartão permanece desabilitado: a função atualmente publicada não oferece criação de pagamento com token de cartão. A integração poderá ser concluída posteriormente.

Estados: pendente, em processamento, aprovado, recusado, cancelado, expirado, estornado e contestado recebem mensagens. As consultas preservam o código Pix já recebido. Prazo encerrado oculta o código e mantém a consulta para conciliar pagamentos realizados no limite do prazo.

Validação: build de produção com chave pública fictícia apenas para compilação; testes automatizados e lint. Não foi realizada cobrança real nem teste autenticado no Supabase de produção. Após deploy, valide um pedido Pix e um pedido gratuito. A função publicada continua responsável pela confirmação no banco e emissão dos ingressos.

Arquivos incluídos: checkout, painel de pagamento, serviço de integração, tela de ingressos, teste do contrato de chamadas e esta documentação. Sem mudanças de SQL/backend, sem .env, node_modules, dist ou .git.

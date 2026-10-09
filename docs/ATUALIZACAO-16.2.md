# Atualização 16.2 — organização do topo e textos públicos

Extraia `INGRESSOS-ATUALIZACAO-16.2.zip` diretamente sobre `D:\SITE-INGRESSOS\ingressos-local`, permitindo substituir os arquivos. Não crie uma pasta adicional dentro dela. Reinicie o servidor local. Se estiver usando Render, publique os arquivos pelo processo habitual e mantenha o rewrite `/*` para `/index.html`. Depois recarregue a página com Ctrl+F5.

O cabeçalho da Home estava fixo enquanto os seletores de idioma e país ocupavam o início normal da página. Isso causava sobreposição. Agora o topo usa três áreas separadas: cabeçalho, preferências e faixa promocional. No celular, os seletores ficam lado a lado, abaixo do cabeçalho; Entrar e o menu permanecem acessíveis.

A página `/eventos` também volta a mostrar o título de apresentação, descrição, botões e benefícios da Home. Esses textos haviam sido ocultados pelo modo catálogo. A faixa promocional agora repete dois grupos idênticos de cinco mensagens, sem lacuna na transição. Com movimento reduzido, todas aparecem estáticas, com quebra de linha. A aparência verde/dourada é preservada.

Este patch inclui a correção 16.1 de compatibilidade do campo opcional WhatsApp, para quem ainda não a extraiu. Não altera pagamentos, taxas, autenticação, pedidos, armazenamento ou migrations. Nenhum SQL novo é necessário para esta correção visual; os recursos de banco da atualização 16 continuam dependendo do SQL de ativação daquela atualização.

Validação: 9 testes Chrome aprovados, cobrindo 1440, 1024, 390 e 320 pixels, separação das áreas do topo, ausência de rolagem horizontal, textos, idioma e movimento reduzido, além das regressões de compra, login e VIP. Screenshots desktop/mobile foram inspecionados. Lint e build também passaram. Build com configuração pública sintética, sem acesso ao Supabase remoto.

O ZIP não contém `.env.local`, segredos, `node_modules`, `dist` ou `.git`.

# Atualização 16.3 — idioma e país no canto superior direito

Os seletores de idioma e país/região agora ficam dentro do cabeçalho, no canto superior direito. No celular, ficam alinhados à direita em uma segunda linha do próprio cabeçalho, sem sobrepor os botões. Os textos da Home e a faixa promocional continuam visíveis.

Extraia INGRESSOS-ATUALIZACAO-16.3.zip sobre D:\SITE-INGRESSOS\ingressos-local, permitindo substituir os arquivos, sem criar outra pasta dentro do projeto. Reinicie o servidor local e recarregue com Ctrl+F5. No Render, publique pelo processo habitual e preserve o rewrite /* para /index.html.

Este ajuste é incremental sobre a atualização 16.2. Não exige SQL novo.

Validação: 9 testes de navegador aprovados, incluindo larguras de 1440, 1024, 390 e 320 pixels. Lint e build aprovados. Nenhum serviço remoto foi alterado.

O ZIP não contém segredos, .env.local, node_modules, dist ou .git.

# Ingressos visíveis e destaques — 06/11/2026

## Base conferida
GitHub origin/main e checkout de trabalho: 53826c7, sem diferença de commits após fetch. A pasta D:\SITE-INGRESSOS\ingressos-local está no commit antigo e8e6099 e seus componentes de evento/editor diferem da versão atual. Nenhum arquivo dessa cópia antiga foi sobrescrito. Alterações feitas no checkout existente publication-camarotes alinhado ao GitHub.

## Alterações
- src/utils/ticketPresentation.js: separa grupos/unidades sem número dos camarotes/mesas numerados e define os destaques opcionais.
- src/pages/Evento.jsx: grupos e unidades sem número voltam à lista pública. Unidades físicas numeradas continuam no seletor de mapa/lista. Cadastros aposentados permanecem ocultos. Texto informa Grupo completo e quantidade inclusa, mantendo uma unidade no checkout.
- src/components/TicketBatchEditor.jsx: campo opcional Destaque na página de vendas. Opções: sem destaque, mais vendido, melhor custo-benefício, recomendado e oferta especial.
- src/pages/TicketHighlights.css: faixa e borda douradas responsivas.
- src/components/UnitShoppingList.jsx: destaque também na lista de unidades numeradas.
- tests/ticket-presentation.test.js e tests/unit-route.spec.js: cobertura de exibição, destaques, fluxo até checkout e regressão de seleção numerada.
- playwright.ticket-revision.config.js: execução das verificações de interface no servidor local da demonstração.

## Como usar após publicação autorizada
Admin → editar evento → Ingressos e preços → abrir o ingresso → Destaque na página de vendas → escolher → Salvar ingressos e preços/evento. Sem destaque remove a faixa. Mais vendido é uma escolha editorial do organizador, não um cálculo automático de vendas.

## Diagnóstico
O filtro anterior excluía todos os registros de modalidade camarote da lista principal, incluindo Grupo, que internamente usa essa modalidade para emitir vários QR Codes. A correção mostra grupos e unidades não numeradas diretamente, preservando a seleção das unidades físicas numeradas. O nome/ID do ingresso específico da imagem ainda não foi informado: não foi consultado nem alterado o cadastro de produção para confirmar se também existe outra causa, como cadastro não salvo ou período de venda.

## Verificação
- 122 testes gerais aprovados, incluindo emissão SQL local e controle de estoque.
- 44 testes únicos de navegador aprovados: 5 de rotas/grupos e 39 de mapa/editor/PDF/suporte. Quatro da suíte de 39 exigiam modo online simulado; passaram ao repetir apenas esses quatro com o provedor fictício correto. Nenhuma chamada foi feita a provedor real.
- Build e lint aprovados.
- Inspeção visual de 390 e 1280 pixels; sem rolagem horizontal. Prévias anexas usam dados sintéticos.

## Banco, publicação e rollback
Não exige migração: save_event já preserva os atributos extras do ingresso em ticket_types.details e mapEvent os recupera. Sem alterações no SQL, estoque, confirmação de pagamento, emissão de QR ou validação de portaria. Persistência real do novo destaque no Supabase de produção ainda não homologada.
Nenhum push, deploy ou alteração em produção realizado. Não houve cobrança nem pedido real.
Para publicar, usar a versão atual do GitHub como base e integrar estes arquivos; não substituir o repositório atual pela pasta antiga em D:. ZIP incremental, não projeto completo. Para reverter, restaurar somente os arquivos desta revisão a partir de 53826c7; o atributo opcional highlight armazenado é ignorado pela versão anterior, sem apagar dados ou ingressos. A alteração pré-existente em tests/payment17.test.js não pertence a esta revisão e não foi incluída.

## Complemento — adicionar ingresso e exemplo Mesa VIP
- src/pages/Admin.jsx limpa a busca, usa UUID para o novo rascunho e identifica o cartão recém-criado.
- src/components/TicketBatchEditor.jsx abre automaticamente somente o cartão novo, revela seções ancestrais, posiciona a tela e foca o nome. Não força reabertura após recolher manualmente; ingressos existentes seguem recolhidos.
- O exemplo sintético MESA VIP+ 4 INGRESSOS VIP, mesa inteira não numerada, aparece no catálogo e chega ao checkout com uma unidade e quatro ingressos inclusos. Uma mesa física com numeração continua no seletor de números, evitando comprar sem escolher a unidade.
- Sete testes de rotas/UI aprovados em 390/1280 pixels, incluindo busca ativa antes de adicionar, foco, recolher/reabrir, dados preservados, adição seguinte e caminho da mesa até checkout. Build e lint aprovados novamente. Os 122 testes gerais e 39 testes anteriores constam da revisão anterior desta mesma data.
- Sem publicação, cobrança, edição dos cadastros reais ou migração. O exemplo de teste não comprova o conteúdo atual do cadastro de produção: a conferência final no evento publicado continua pendente de publicação autorizada.
- Este ZIP v2 reúne também a revisão dos destaques; não exige instalar o ZIP anterior separadamente. Para rollback do complemento, restaurar apenas Admin.jsx e TicketBatchEditor.jsx à versão anterior à abertura automática; nenhum rascunho é salvo automaticamente.

# Editor de mapa: arraste, teclado, tamanho e novos itens

Implementado em 24/10/2026 sobre a versão 6478e75, comparada com origin/main antes da edição.

No Admin, abra Mapa do evento, camarotes e mesas. Arraste os marcadores com o mouse. Os eventos de ponteiro também suportam toque; em aparelhos físicos essa interação ainda precisa de conferência. Clique num marcador e use as setas do teclado: 1 pixel da imagem exibida por toque, Shift + seta para 10 pixels e Alt + seta para 0,25 pixel. As coordenadas são gravadas como percentuais com três casas decimais, mantendo a posição com o zoom ou a mudança de tela. O arraste preserva o ponto onde o marcador foi agarrado, sem saltar seu centro para o cursor. Cancelar o ponteiro restaura a posição de início desse arraste.

O marcador selecionado tem controle Tamanho do quadrado. O tamanho fica no campo mapSize dos detalhes do ingresso, em porcentagem da largura da planta. É individual e proporcional à imagem; o número e os cantos se ajustam com ele. Os controles anteriores de posição e Ajustar à tela foram preservados.

O menu de três pontos fica no canto superior direito do editor, inclusive antes de haver marcadores. Adicionar novo item abre um formulário com nome da categoria, nome opcional da unidade, quantidade, primeiro número opcional, preço integral, ingressos inclusos e tamanho inicial. Uma categoria existente é reutilizada; sem primeiro número, continua depois do maior número da categoria. Nomes duplicados e configurações inválidas são rejeitados antes de alterar o rascunho. Os itens são unidades exclusivas que usam o estoque/checkout/QR existentes. Não altera ingressos, quantidades ou preços dos itens anteriores.

Tudo fica no rascunho até Salvar evento/Salvar ingressos e preços. Nenhuma informação é extraída automaticamente da foto. A imagem enviada e o mapa compacto continuam funcionando.

Validação: 112 testes unitários/de banco e 24 testes de interface passaram. Cobertura nova: arraste em pixels com coordenadas fracionárias, limites, setas normal/Shift/Alt, alteração de tamanho individual, persistência após reabrir rascunho sintético, menu em celular 390px e desktop 1280px, continuação da numeração, rejeição de duplicados/configurações inválidas e persistência de mapSize pela RPC de banco usada no cadastro. Build e lint passaram. Capturas visuais conferidas. Não houve cobrança ou alteração de eventos, pedidos ou ingressos em produção nos testes. Safari/iOS e gesto de arraste em aparelho físico ainda não verificados.

Não há nova migração: save_event já preserva os detalhes JSON dos ingressos. Rollback: reverter esta revisão do frontend; mapSize pode permanecer no JSON, sendo ignorado pela versão anterior. Nunca restaurar banco nem alterar QR/pagamentos como rollback visual.

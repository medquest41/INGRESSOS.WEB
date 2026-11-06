# Publicação visual — 06/11/2026

Base: 4f8376a. Escopo autorizado: visual público, destaques por combo, zoom inicial do mapa, quantidade/numeração opcional de mesas e comemoração após compra confirmada.

- Página do evento: fachos de luz, estrelas, coroas/diamantes, LED nas bordas, sombras e inclinação dos cartões ao mouse. Atrações, mapa, localização e resumo recebem a mesma direção visual.
- Checkout/início/login/Meus Ingressos: painéis com LED, botões com relevo, foco visível e números/preços em relevo, mantendo campos e valores estáveis. A folha de QR e a imagem do QR não recebem movimento ou efeitos de contraste.
- Animação reduzida respeita o aparelho; botão permite pausar com preferência local. Pausa também fora da tela e com aba inativa. Sem biblioteca adicional de animação nem mídias pesadas.
- Destaques: herança para cartão principal e unidades da mesma oferta; alteração/remoção no editor atualiza o combo sem afetar ofertas diferentes.
- Mapa: zoom inicial100%–300% salvo com o evento no details existente. Cliente pode ajustar durante a seleção; reabertura usa a definição do organizador.
- Mesas: opção criar várias unidades numeradas ou manter a unidade sem numeração. Ingressos inclusos são separados da quantidade de mesas. Unidades já criadas não são apagadas.
- Comemoração: dados carregados do pedido precisam confirmar status aprovado, sem revisão e com ingresso válido; a rota sozinha não comprova pagamento. Modal com nome/local/evento, botão fechar, uma vez por pedido na sessão.

Validação da versão isolada: build e lint;13 testes unitários pertinentes;15 fluxos de navegador em390/1280 (zoom/reabertura, comemoração, estados de pedido,16mesas, redução de movimento, checkout e cadastro). Sem cobranças reais. As fotos e textos reais dependem do cadastro de cada evento. Não mede capacidade de100–500compradores simultâneos. O ciclo de compra real Pix/cartão não foi repetido para esta alteração visual.

Não inclui venda local, migração029, funções de pagamento ou qualquer SQL. Nenhuma migração necessária. Pedidos, valores, estoque, emissões e QR existentes preservados. Dados de clientes e segredos não incluídos no pacote.

Rollback: reverter o commit desta publicação por Git e publicar novamente. Não apagar dados do banco nem preferências/details de eventos. A versão anterior simplesmente ignora o novo zoom.

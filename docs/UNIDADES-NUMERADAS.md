# Camarotes e mesas VIP numerados

No Admin, edite o evento e abra **Criar camarotes e mesas VIP numerados**. Escolha categoria, quantidade (por exemplo 15 camarotes ou 20 mesas), início da numeração, preço integral e ingressos por unidade. Clique em Gerar. O formulário adiciona unidades ao rascunho; não publica nem altera os pedidos existentes.

Abra Mapa do evento e setores. A planta já enviada é reaproveitada. Escolha cada número e toque na posição real; também pode ajustar as coordenadas. Os números são gerados em grade: não há reconhecimento automático da geometria de uma imagem. Salve o evento para disponibilizar.

O cliente escolhe Camarotes ou Mesas VIP, toca no número disponível, confere identificação, preço integral e ingressos inclusos e continua ao checkout existente. O mapa pode ser ampliado e deslizado; há lista equivalente. Cada unidade tem estoque 1. A reserva atômica, expiração, confirmação backend e emissão de N QR exclusivos usam o fluxo reservado da migração 027 já instalada.

Mesas VIP novas usam internamente a mesma modalidade de estoque exclusivo, com reservationKind=table em details. As mesas antigas com QR único permanecem preservadas. Nenhuma migração adicional ou conversão de pedidos é necessária. Pedidos antigos comprados como Individual não são ampliados automaticamente.

Validação: build e lint; teste da criação de 15+20 unidades, nomes/IDs únicos, preço obrigatório, estoque 1 e prevenção de nomes repetidos; seleção de Camarote 15 e Mesa VIP 20 e indisponibilidade em navegador nas larguras 390/1280; testes SQL de reserva, confirmação idempotente, N QR, expiração e portaria. Sem cobranças reais. O posicionamento definitivo na planta e preços devem ser confirmados pelo organizador antes de salvar o evento real.

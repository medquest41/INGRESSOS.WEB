# Seleção de unidades em janela no site de compra

A página pública mostra uma faixa compacta com o botão Ver mapa e escolher número. O botão na seção de ingressos também abre a mesma janela. A janela exibe categorias, disponibilidade, mapa enviado pelo organizador, seleção por número e alternativa pela lista. Selecionar uma unidade mostra seu preço integral e quantidade de ingressos inclusos. Continuar para pagamento segue o checkout existente com o identificador da unidade e quantidade 1. Fechar ou Esc retorna à página; não cria pedido, reserva ou cobrança.

O mapa com imagem é ajustado proporcionalmente ao espaço disponível, limitado inicialmente a 420px/48vh de altura, com zoom e Ajustar à tela. O mapa do checkout também fica compacto. As posições e dimensões cadastradas dos marcadores não são alteradas. Controles de arraste do Admin permanecem separados.

Arquivos principais: EventSeating.jsx/CSS (janela pública), Evento.jsx (abertura pelo botão de compra), CamaroteMap.jsx/CSS (dimensão proporcional, zoom e texto do botão), testes seating-flow e map-editor-controls.

Sem migração, escrita no banco, cobrança, push ou deploy. Pacote cumulativo desde 6478e75, inclui os ajustes locais anteriores ainda pendentes de publicação. Reverter os commits de interface desfaz as alterações, sem rollback de dados. O diretório D: solicitado permanece indisponível neste ambiente; ZIP entregue na pasta do projeto acessível.

Validação concluída: 31 testes de interface passaram, incluindo seleção pública, fechamento por botão/Esc, reabertura, mapa compacto, revisão no checkout, PDF e controles do Admin. Mais 2 testes passaram após incluir a abertura pelo botão de compra externo à janela. Build e lint passaram. As imagens de homologação são sintéticas, sem cobranças reais.

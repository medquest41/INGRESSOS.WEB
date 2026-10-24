# Prévia compacta do mapa e localização

Mapa enviado pelo organizador aparece como miniatura à esquerda, com texto e botão para ampliar/escolher. O bloco ao lado mostra local, endereço, cidade e link do Google Maps já usado pelo evento. No celular, os blocos ficam empilhados. A imagem mantém proporção, sem corte; falha no carregamento preserva a seleção pela lista. Sem localização cadastrada, o bloco não aparece. Eventos sem unidades numeradas mantêm seu mapa de orientação e recebem o bloco de localização quando há dados.

Arquivos: EventSeating.jsx/CSS, novo EventLocationPreview.jsx, fixture e seating-preview.spec.js, configuração da suíte. Sem alteração no banco, pagamento ou estoque. 14 testes de interface passaram (390/1280, disposição, imagem/link, falha de imagem e seleção/checkout existentes), build e lint passaram. Sem cobranças reais.

Rollback: reverter o commit da interface, sem desfazer dados.

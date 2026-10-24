# Grupos com ingressos individuais e mapa

Publicação autorizada pelo usuário em 23/10/2026. Escopo final: próximas compras; não corrigir ou alterar pedidos anteriores.

No Admin, criar um tipo de entrada Grupo — vários ingressos com QR individuais, informar o preço integral e a quantidade de ingressos inclusos, e salvar o evento. Uma unidade desse cadastro equivale ao grupo inteiro. O sistema usa a modalidade camarote já existente no banco e grava wristbands nos detalhes. Após pagamento confirmado pelo backend, issue_tickets emite N ingressos, uma única vez. Ingressos individuais continuam emitindo um por unidade. O nome do ingresso não muda sua modalidade.

Cadastros que já têm pedidos preservam a modalidade e quantidade histórica. Para vender um novo grupo com outra quantidade de inclusos, adicionar outro tipo de ingresso/unidade e desativar o cadastro antigo para futuras vendas, quando apropriado. Não converter compras antigas nem gerar entradas adicionais a partir do botão de PDF.

O mapa enviado pelo organizador aparece depois das atrações e antes dos ingressos. Categorias e unidades numeradas são geradas no editor do mapa; posições sobre a foto precisam de conferência manual. A mesma imagem aparece no checkout com a unidade escolhida destacada, e há link para ver o original sem marcadores. Sem imagem, usa-se planta esquemática. Não há análise automática da foto por OCR/IA.

QR originais permanecem vinculados à numeração persistida. PDF com até quatro por página. Admin permite buscar comprador e consultar/baixar/compartilhar seus ingressos existentes. Compartilhamento não cria um QR novo.

Validação: 106 testes unitários/de banco passaram; testes de interface cobrem Grupo, 15 camarotes e 20 mesas, mapa e mesma foto no checkout, numeração, persistência, suporte Admin, e PDF de 1/4/5/10/15/30 ingressos, em desktop e celular. Build usa configuração sintética para teste; Render usa suas configurações públicas existentes. Sem cobranças reais. Nenhuma nova migração nem alteração de pedidos de produção nesta publicação. Dependências de banco: migrações 027 e 028 previamente aplicadas.

Rollback do frontend: reverter esta revisão ou publicar a revisão anterior fe6d5e6. Não restaurar banco, excluir ingressos nem modificar pagamentos para desfazer uma mudança visual.


## Ajustes de salvar e edição compacta

Ao trocar um cadastro antigo individual/mesa sem numeração, que já tenha pedidos, para Grupo, o editor prepara um novo SKU para as próximas vendas e conserva o original inativo com seu estoque e histórico intactos. Isso evita reduzir o estoque antigo para 1 e a mensagem Capacidade inferior às reservas e vendas. O organizador precisa preencher os inclusos e salvar o evento. Não se aplica automaticamente a camarotes já numerados ou a mudanças de capacidade em outras modalidades; esses casos continuam protegidos no backend para evitar revender uma unidade física.

O editor do mapa agora ajusta a imagem inteira à área disponível, com altura de referência até 440px/48vh. Há botão Ajustar à tela e zoom para posicionamento preciso. As coordenadas continuam em porcentagem da imagem original. O ajuste é restrito à edição e não altera posições ou QR.

Testes adicionais verificam a troca de cadastro antigo, estoque histórico preservado, emissão idempotente dos 15 inclusos em uma nova compra pelo fluxo do backend, e mapa compacto/zoom/ajuste. Dados e pedidos reais permaneceram sem alterações.

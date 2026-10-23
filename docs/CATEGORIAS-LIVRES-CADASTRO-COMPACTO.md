# Categorias livres e cadastro compacto

No Admin, abra Categorias e unidades numeradas > + Adicionar categoria. Informe o nome desejado (Box, Lounge, Mesa, Camarote etc.) e, opcionalmente, o nome usado em cada número. Só depois configure quantidade de unidades, número inicial, preço integral e ingressos inclusos. Os campos começam vazios. Gerar adiciona ao rascunho; salvar o evento publica.

Os cartões de ingresso/lote começam recolhidos. A faixa mostra nome, lote, preço e quantidade. Clique em Abrir edição/Recolher. O conteúdo pode ser operado por teclado. Preço 0 é gratuito e continua sendo aceito; apagar o preço deixa o campo vazio e impede salvar até preenchê-lo. O mesmo vale para estoque e ingressos por unidade. Erros de validação abrem o cartão correspondente.

Categorias existentes e pedidos não são convertidos. As novas categorias são metadados JSON compatíveis nas estruturas já existentes. Unidades numeradas continuam usando estoque exclusivo e emissão idempotente de N QR após pagamento confirmado. Nenhuma migração adicional é necessária.

Validação: build/lint; criação de categoria Boxes e 3 unidades com 10 ingressos; abrir/recolher, apagar quantidades/preço e digitar novamente, preço 0 explícito; mapa público com categoria personalizada; regressão de Camarotes/Mesas VIP existentes nas larguras 390/1280; preservação dos IDs/nomes/unidades antigas nos testes. Nenhuma compra ou mensagem real foi realizada.

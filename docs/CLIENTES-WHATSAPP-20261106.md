# Clientes legíveis e contato pelo WhatsApp — 06/11/2026

Base publicada:31b3704. Escopo isolado: melhorar a leitura das informações dos clientes e adicionar contato pelo WhatsApp nas listas por evento e na busca global do Admin principal.

- Nome20px e demais informações15px, alto contraste, espaçamento e organização responsiva. Busca aceita nome/e-mail/CPF/telefone como já suportado pelo filtro existente.
- Falar no WhatsApp abre wa.me no número brasileiro cadastrado, normalizado com55 eDDD sem duplicar o país. Saudação inclui primeiro nome e, quando a lista é de um único evento, nome desse evento. Não inclui CPF/e-mail ou ingresso no texto; não envia mensagem automaticamente. O usuário confere e envia no WhatsApp.
- Número ausente/inválido deixa o botão indisponível, sem adivinhar dígitos ou abrir um contato genérico. Novas abas usam noopener/noreferrer. Não altera cadastros, pedidos ou QR.
- Preserva filtros de eventos/organizações e acesso atual: Admin/organizador podem ver o contato; Financeiro não ganha acesso a identidade/CPF ou WhatsApp pela URL direta. A busca global continua exclusiva do Admin principal.

Validação:2testes unitários de normalização/saudação e número inválido;4testes de navegador em390/1280, busca global e restrição do Financeiro;lint e build. Somente dados fictícios. Não foram abertas conversas nem enviadas mensagens reais.

Não exige migração. Publicação autorizada expressamente pelo usuário junto das correções de abertura programada e fogos, com arquivos isolados e conferidos. Rollback: restaurar os dois componentes existentes da base31b3704; os arquivos novos podem ser retirados sem apagar dados.

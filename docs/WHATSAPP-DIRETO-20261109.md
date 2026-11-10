# Compartilhamento direto pelo WhatsApp — 09/11/2026

O botão individual de Meus Ingressos e do painel do organizador abre diretamente o WhatsApp com o link seguro original e a numeração do ingresso. O menu nativo do aparelho continua disponível para outros compartilhamentos do site, mas não é usado neste botão.

No Admin, utiliza o número válido do comprador. Sem telefone ou com telefone inválido, abre a escolha de contato no WhatsApp. Venda local mostra o botão de WhatsApp também sem telefone cadastrado. Não envia mensagens automaticamente, não emite novos ingressos e não troca QR Codes.

O link continua sendo autorizado pelas funções existentes create_ticket_share/create_admin_ticket_share, com validade indicada de 24 horas. Erro no servidor impede a abertura do WhatsApp. Sem migração ou mudanças no banco/pagamentos.

Validação: 4 testes de navegador com destinos e banco simulados, incluindo botão real do Admin, telefone normalizado, cliente com compartilhamento nativo disponível, venda sem telefone e falha na criação do link. Nenhuma mensagem real enviada. Lint e build executados. Build local com configuração pública fictícia, não destinado à publicação de dist.

Rollback: reverter este commit e reconstruir apenas o frontend. Não há rollback de banco.

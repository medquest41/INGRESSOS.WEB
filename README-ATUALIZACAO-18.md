# Correção 18.1 — A mesma conta em vários eventos

Contas existentes, inclusive organizadores e financeiro, podem receber vínculo de portaria em vários eventos sem mudança do perfil ou da organização da conta. Cada dono controla apenas o próprio evento. Desativar/remover em um evento preserva os demais vínculos.

No evento de outra organização, o convite oferece somente check-in: sem vendas, financeiro, taxas ou gestão de equipe. Os direitos de gestão anteriores nos próprios eventos são preservados. A conta precisa estar ativa e ter e-mail confirmado; convites pendentes aguardam confirmação.

Ativação: primeiro a atualização 18 (migration 025), depois a nova migration 026 OU ATIVAR-ATUALIZACAO-18.1.sql (cópias idênticas). A execução remota da 026 aguarda autorização específica. A 025 já foi aplicada em produção.

Validação: build aprovado, 85 testes locais aprovados e 2 testes de navegador aprovados (lista/ativação/desativação/remoção e organizador externo restrito à câmera, incluindo revogação). Sem testes de câmera física ou concessões a contas reais.

A tentativa anterior de cadastrar giuliadalponte@gmail.com não criou vínculo, pois a versão anterior rejeitava seu perfil de organizador externo. Após aplicar o SQL 18.1, autorize esse e-mail novamente pelo painel do dono do evento.

Pacote incremental acumulado sobre a base online 0e8e1c3: somente arquivos alterados/novos, sem segredos, .env.local, node_modules, dist ou .git. Arquivos de pagamento preservados.

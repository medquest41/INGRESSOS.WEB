# Atualização 18 — Equipe e check-in

Patch aplicado sobre o GitHub main 0e8e1c3, preservando os pagamentos e as demais alterações online.

Inclui status por evento, convites por e-mail confirmado, Ativar/Desativar, Remover acesso, escopo/RLS, auditoria e revalidação no login/link da portaria.

Aplicação: extraia na raiz do projeto. Revise e aplique UMA das cópias idênticas: ATIVAR-ATUALIZACAO-18.sql OU supabase/migrations/025_event_checkin_member_status.sql. Requer as estruturas 015/016. O SQL não é executado pelo build. Sem SQL, a nova gestão fica bloqueada com aviso de ativação pendente, evitando usar as antigas regras de remoção. Após aplicar, clique em Atualizar lista.

Validação: build completo e testes locais executados sobre a base online. Sem credenciais privadas no pacote; build local usa configuração pública fictícia. Homologação de câmera física e contas reais depende do banco ativado.

Arquivos de pagamentos preservados; sem .env.local, segredos, node_modules, dist ou .git.

# Auditoria antes da integração

Base: commit ab4f6fe, árvore Git limpa, projeto original preservado.

- AuthStore: autenticação local por hash SHA-256, promoção por e-mail no navegador e sessão local. Inadequado para produção.
- EventStore: eventos, compras, cupons, ingressos e check-in exclusivamente em localStorage. Locks apenas entre abas, não entre dispositivos.
- Supabase: adaptador não utilizado; chave publishable do .env.local não reconhecida. Não existe src/lib/supabase.js nesta base.
- .gitignore protege .env.local; somente .env.example está versionado.
- SQL 001: esquema inicial parcial, sem profile trigger, checkout, estoque, pagamentos, cancelamento ou provisionamento de equipe.
- UI: CRUD/preview/arquivo/duplicação, checkout, QR, câmera, relatórios e perfis já existem e serão reaproveitados.
- Mercado Pago: adaptador de servidor preparatório, sem endpoint implantado. Nenhuma cobrança real habilitada.
- Não encontrados CLI Supabase/psql, token CLI ou conexão administrativa no ambiente. A chave pública não autoriza migrations.
- Eventos aprovados podem estar no navegador; não podem ser importados automaticamente pelo acesso ao disco. Nenhum localStorage será apagado.

Plano: separar DEV de produção; Auth real; migrations incrementais com RLS/RPC transacionais; adaptar os providers mantendo a UI; validar testes, lint e build; documentar limites de validação remota.

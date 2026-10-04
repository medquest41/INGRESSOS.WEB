# Integrações — 04/10/2026

O adaptador Supabase está conectado aos providers e às telas. Não existe fallback local em produção. O estado de ativação remota e os passos exatos estão em [RELATORIO_FINAL.md](../RELATORIO_FINAL.md).

- Cliente: src/lib/supabase.js, com publishable/anon e sessão persistente.
- Auth: src/store/AuthStore.jsx; providers locais separados e acessíveis somente em DEV explícito.
- Dados: src/services/remoteData.js e src/store/EventStore.jsx; RLS e RPCs fazem autorização e cálculo no servidor.
- Banco: supabase/migrations/001_platform.sql até 004_preservation_reservation_limits.sql.
- Admin principal: supabase/setup/promote-primary-admin.sql, sem senha ou promoção automática por metadados.
- E-mails: supabase/templates/confirmation.html e recovery.html; configurar templates, redirects e SMTP no Dashboard.
- Pagamento: server/mercadopago.mjs e payment-handlers.mjs são módulos seguros de servidor preparados; não são endpoints publicados. Sem Mercado Pago ativo, pedidos pagos ficam pendentes e não emitem ingressos.

A sondagem pública acessou Auth, mas a tabela events retornou HTTP 404. As migrations não foram aplicadas remotamente por ausência de acesso administrativo disponível. Os testes de banco executam as migrations em PGlite; testes das telas usam respostas interceptadas. Não confundir estas verificações com homologação remota.

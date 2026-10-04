# Entrega do site de ingressos — 04/10/2026

Projeto preservado: `D:\SITE-INGRESSOS\ingressos-local`.
Repositório: https://github.com/medquest41/INGRESSOS.WEB.git.
Base recebida: `ab4f6fe`, branch `main`, sem alterações locais pendentes.

## Resultado e estado real

O aplicativo existente foi conectado ao Supabase no código, com autenticação, permissões e operações transacionais de comércio. O visual verde e dourado, os cards, as animações e os eventos de referência foram preservados. O projeto não foi recriado. Os projetos de gás e CMC Pets não foram alterados.

**Ainda é necessário aplicar as migrations no Supabase para operar o banco remoto.** A verificação pública retornou HTTP 200 em `/auth/v1/settings` e HTTP 404 em `/rest/v1/events`. Isso confirma acesso à API de Auth e indisponibilidade da tabela de eventos na API; não confirma que contas, permissões ou migrations já estejam configuradas. Não havia CLI Supabase/psql autenticada, token administrativo, conexão de banco ou sessão administrativa de navegador disponível. Não foram criados pedidos, usuários, pagamentos ou ingressos no Supabase remoto nesta execução.

O código usa Supabase quando a configuração pública é válida. Erros remotos são apresentados ao usuário; nunca são substituídos silenciosamente por dados locais. A operação não deve ser apresentada como produção ativa antes da configuração e homologação remotas descritas abaixo.

## O que foi concluído

| Área | Implementação |
| --- | --- |
| Configuração | Cliente único em `src/lib/supabase.js`; publishable ou anon; persistência e renovação de sessão; proteção de `.env.local`; bloqueio de chaves privadas em variáveis `VITE_` e no build. |
| Auth | Login, logout, cadastro, confirmação de e-mail, solicitação de recuperação, redefinição de senha, sessão após recarga, rotas protegidas, espera de sessão e redirecionamentos internos. Perfis vêm do banco; metadados de cadastro não promovem ninguém. |
| Administrador principal | Script manual de promoção de `medquest41@gmail.com`, exigindo conta existente e e-mail confirmado. Nenhuma senha padrão, senha em código ou promoção automática por comparação de e-mail no modo Supabase. |
| Banco | Quatro migrations versionadas, chaves/índices/constraints, profiles, organizations, events, event_images, event_sectors, ticket_types, orders, order_items, order_status_history, payments, tickets, checkins, checkin_assignments, coupons, coupon_uses, refunds, transfers, audit_log e settings. `ticket_types` é a entidade de lotes compatível com a base existente; `profiles.role` e `organization_id` representam permissões e vínculo da equipe. |
| Segurança de dados | RLS, grants mínimos, RPCs com checagem de identidade/perfil/escopo, funções privilegiadas com search_path restrito e execução explicitamente liberada. Escrita direta do navegador em perfis, pedidos e ingressos é bloqueada. |
| Eventos | Cadastro/edição, slug, publicar/ocultar, arquivar/restaurar, duplicar, copiar link, preview restrito e catálogo publicado. Imagens HTTPS, proteção de lotes com pedidos e preservação de descrições/metadados. |
| Organizadores | Criar, editar, ativar/desativar empresas; atribuir contas já confirmadas a perfis/organizações; ativar/desativar membros; autorizar/revogar check-in por evento. Cada membro possui um vínculo de organização nesta versão. |
| Lotes/setores | Pista, VIP, Open Bar e demais nomes configuráveis; mesas/camarotes individuais ou por grupo; capacidade, preço, disponibilidade, início/fim, ordem, ativação e avanço sequencial por setor. Estoque é calculado pelo banco. |
| Checkout | Comprador, CPF com dígitos verificadores, e-mail da conta confirmada, telefone, nascimento, quantidade, subtotal, taxa, cupom, total, origem e campanha. Cotação remota e recálculo obrigatório na transação de criação. |
| Reservas/pedidos | Idempotência, reserva de 15 minutos, limite de cinco reservas pendentes por conta, serialização do estoque por evento, status, histórico de mudanças, filtros e cancelamento controlado. Reservas expiradas deixam de consumir estoque/cupom automaticamente no cálculo, sem apagar pedidos. |
| Ingressos | QR com UUID aleatório, vínculo ao pedido, evento, lote/setor e titular; Meus Ingressos com somente dados próprios; impressão/salvar PDF, status válido/usado/cancelado. Pedidos gratuitos confirmados emitem ingressos na mesma transação. |
| Check-in | Câmera existente preservada, entrada manual, resposta válido/usado/cancelado/inválido/sem permissão, horário/operador, histórico e contadores. A função bloqueia registros antes de validar e atualizar; cancelamento e check-in usam ordem compatível de locks. |
| Cupons | Criar/editar/desativar, percentual/valor fixo, início/validade no horário de Brasília, limite total/por cliente, evento/lote opcional e cupom global exclusivo do admin. Reservas entram na contagem; lock do cupom protege limites entre eventos. |
| Financeiro/Admin | Pedidos, vendas confirmadas, faturamento calculado, clientes, cupons, equipe, relatórios CSV, eventos, origem e audit logs. Paginação com contagens filtradas por RLS evita truncar relatórios pelo limite da API. Financeiro recebe vendas sem CPF, telefone ou QR de terceiros. |
| Tracking | `ref`, `utm_source` e `campaign` são preservados do evento ao pedido, com tamanho limitado. Não foi acrescentada coleta de localização, impressão digital ou outros dados de divulgação. |
| Mercado Pago | Adaptador de servidor e handlers preparados; verificação HMAC, consulta do pagamento na API, vendedor/ambiente/moeda/referência, valor e liquidação idempotente. RPC de liquidação acessível somente ao serviço e desligada por configuração de banco. Não há endpoint implantado nem cobrança ativa. |
| E-mails | Templates de confirmação/recuperação e fluxos de Auth preparados. Aplicação dos templates, URLs permitidas e SMTP dependem do Dashboard. |
| UX | Visual e interações existentes preservados; skeletons, estados de carregamento/erro/vazio, foco visível, redução de movimento, feedback de pedidos e controles responsivos. Checkout e check-in verificados em 390px. |

## O que continua em mock ou preparado

- **Somente DEV:** `npm run dev:demo` ativa `.env.demo` e os providers locais separados. Este modo preserva os hashes/sessões legados e simula aprovação/recusa. Não cria usuários nem vendas no Supabase. O build de produção nunca ativa o fallback local, mesmo com `VITE_LOCAL_DEMO=true`.
- **Supabase sem Mercado Pago:** pedidos com total positivo ficam `pending`, sem QR válido e sem cobrança. O cliente pode cancelar a reserva. Total zero, inclusive desconto integral autorizado, é confirmado no banco e emite QR.
- **Mesas/camarotes:** uma unidade gera um ingresso do grupo. A estrutura de layout/setores existe, mas mapa visual de assentos e convites individuais não foram ativados.
- **Refunds/transfers:** estrutura protegida preparada. Fluxos completos de estorno no provedor, transferência de titularidade e respectivos formulários ainda dependem da política comercial e integração de pagamentos; não há botões que fingem concluir essas operações.
- **SMTP, câmera física, múltiplos dispositivos e deploy:** precisam de homologação no ambiente real. O SMTP remoto não foi verificado ou alterado nesta entrega.

## Como aplicar o banco

Abra o projeto `ingressos-web` no Supabase Dashboard. Confirme o identificador `oavpsfcosidlvoinbjst`. No SQL Editor, verifique primeiro:

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename;
```

Em banco novo, execute o conteúdo dos arquivos nesta ordem, aguardando sucesso a cada etapa:

1. `supabase/migrations/001_platform.sql` — base original.
2. `supabase/migrations/002_production.sql` — Auth, estrutura complementar, RLS/grants, estoque, checkout, cupons, emissão e check-in.
3. `supabase/migrations/003_order_history_global_coupons.sql` — histórico de pedidos, cupons globais e auditoria administrativa.
4. `supabase/migrations/004_preservation_reservation_limits.sql` — metadados/links legados e limite de reservas por conta.

Se a base `001` já tiver sido aplicada, execute somente as versões pendentes. Se houver tabelas diferentes das migrations, compare a estrutura antes de aplicar; não apague, reinicialize ou sobrescreva dados para resolver conflitos. As migrations `002` a `004` usam transação; não foram projetadas para repetição indiscriminada.

Alternativa com a CLI oficial, depois de autenticar em seu próprio ambiente:

```powershell
Set-Location D:\SITE-INGRESSOS\ingressos-local
npx supabase init
npx supabase login
npx supabase link --project-ref oavpsfcosidlvoinbjst
npx supabase db push --dry-run
npx supabase db push
```

Use `init` somente se `supabase/config.toml` ainda não existir. Faça a autenticação e qualquer entrada de credencial diretamente nas ferramentas oficiais. Se as migrations foram aplicadas pelo SQL Editor, registre as versões como aplicadas antes de usar `db push`: `npx supabase migration repair --status applied 001 002 003 004`, somente após confirmar que cada versão está de fato no banco.

Depois execute `npm run check:supabase`: `/rest/v1/events` deve passar a responder HTTP 200. Esta sondagem não substitui os testes de perfis e transações.

## Administrador Geral principal

1. Em **Authentication → Users**, procure `medquest41@gmail.com`. Se não existir, crie a conta manualmente no Dashboard ou faça o cadastro normal e confirme o e-mail. Defina sua senha diretamente no fluxo oficial, sem colocá-la em arquivos, mensagens ou comandos.
2. Depois das migrations, execute `supabase/setup/promote-primary-admin.sql` no SQL Editor. O script valida que a conta existe e está confirmada, atribui `admin`, ativa o perfil e registra a operação.
3. Entre no aplicativo com sua conta e abra `/admin`. A autorização real vem da linha de `profiles` e das funções/RLS, não da identidade visual do frontend.
4. Em Equipe, crie uma organização ativa e atribua os membros existentes/confirmados. Para quem ainda não possui conta, use cadastro/confirmação ou convite do Dashboard Auth. A tela remota não solicita senha inicial de terceiros.

## Variáveis e segredos

Frontend, em `.env.local` ou nas variáveis públicas do host:

```dotenv
VITE_SUPABASE_URL=https://oavpsfcosidlvoinbjst.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua chave pública publishable>
```

`VITE_SUPABASE_ANON_KEY` é aceito como alternativa legada. `VITE_LOCAL_DEMO=true` só tem efeito no servidor DEV. `.env.local` existente foi preservado e permanece ignorado no Git. `.env.demo` contém apenas o sinalizador da demonstração e é versionado por exceção explícita.

Somente no ambiente seguro de servidor, quando implantar pagamentos: URL Supabase, chave pública para validar o usuário, `SUPABASE_SERVICE_ROLE_KEY` para a RPC de liquidação, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_COLLECTOR_ID`, URLs HTTPS de retorno/webhook e configuração de ativação. O host deve injetar essas configurações nos handlers. Nenhum desses segredos deve ter prefixo `VITE_`, ser enviado ao navegador ou entrar no Git. Não foram inventadas ou mostradas credenciais.

## Preservação e importação

`src/data/defaultEvents.js` foi mantido. Nenhuma chave de dados do navegador foi apagada nesta execução. Os testes usaram contextos isolados com dados fictícios.

Após configurar banco e admin, abra o mesmo navegador/origem onde estão os eventos aprovados. Em **Equipe → Preservar eventos deste navegador**, exporte o backup, escolha explicitamente a organização de destino e importe. A importação preserva descrições, metadados e links antigos, gera UUIDs para o banco e ignora slugs já existentes. Se falhar parcialmente, repita: os links já importados são ignorados. O armazenamento original permanece intacto.

Pedidos, usuários e ingressos locais simulados continuam no navegador; não são transformados automaticamente em vendas/contas reais. Para consultar a demonstração legada, use `npm run dev:demo` na mesma origem. A pasta antiga aninhada `ingressos-local/` foi mantida e continua fora do aplicativo/repositório principal.

## Como testar no Supabase real

1. Cadastre dois clientes, confirme seus e-mails, teste login, recarga, logout e recuperação/redefinição. Cliente não deve acessar `/admin` nem pedidos/QR do outro.
2. Crie organizações A/B e membros organizador/financeiro/check-in. Organizador só administra seu escopo; financeiro não recebe CPF, telefone ou QR dos compradores; operador só valida eventos atribuídos.
3. Importe ou crie um evento; teste publicação/ocultação/arquivo/preview, duplicação, lotes, validade e links.
4. Para validar emissão sem cobrança, crie lote gratuito ou cupom integral autorizado. Compre: o pedido deve confirmar, emitir QR e aparecer na conta correta. Em lote pago, deve ficar pendente, sem QR, com reserva de 15 minutos.
5. Teste estoque pequeno, cupom total/por usuário e compras concorrentes. Ao esgotar, outra compra deve ser recusada. Cancele reserva para recuperar disponibilidade. Não reduza capacidade abaixo das reservas/vendas.
6. Autorize um operador no evento. Escaneie/cole o QR: primeiro válido, depois usado. QR cancelado deve ser recusado. Em dois dispositivos, tente o mesmo QR simultaneamente: exatamente uma entrada deve ser confirmada. Confira horário, operador e contadores.
7. Verifique financeiro/CSV, filtros, histórico, escopo das organizações e dados vazios. Os números vêm do banco; não há saldo de repasse calculado ou fictício.

## Validação automática realizada

- `npm test`: **23 testes aprovados**, incluindo execução das quatro migrations em PostgreSQL embarcado (PGlite), RLS/grants sob roles diferentes, escalada de perfil, isolamento, estoque, idempotência, CPF, cupons, histórico, reservas, emissão, check-in e paginação.
- `npm run lint`: aprovado, abrangendo frontend, servidor, scripts, testes e configurações.
- `npm run build`: aprovado com configuração pública existente; dependências separadas e scanner de variáveis privadas.
- `npm run test:e2e`: **15 testes de navegador**, nove da demonstração e seis do adaptador Supabase, cobrindo sessão, cadastro, recuperação/redefinição, compras gratuitas/pendentes, QR, reuso, erros sem fallback, equipe, eventos, preservação e mobile.

Os testes do adaptador interceptam respostas de rede; não equivalem a homologação com credenciais reais. PGlite executa SQL e RLS, mas não valida a configuração do serviço remoto nem concorrência entre conexões remotas independentes. A câmera física, o SMTP e pagamentos reais não foram exercitados.

Para repetir os testes:

```powershell
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
```

Os testes de navegador iniciam instâncias isoladas nas portas 5190/5191 e usam Chrome instalado. Não alteram o perfil normal do usuário nem os sites em outras portas.

## Mercado Pago, SMTP e deploy: passos pendentes

**Mercado Pago:** `server/mercadopago.mjs` e `server/payment-handlers.mjs` são módulos preparados, não endpoints publicados. Implante o host/Edge Function; valide Bearer token com Supabase Auth; leia o pedido autorizado do banco; configure tokens somente no servidor; publique webhook HTTPS com assinatura; consulte o pagamento e valide vendedor, ambiente, moeda, referência e valor antes de chamar `settle_payment`. Somente depois de homologar, habilite `settings.payments_enabled` e o servidor. Conecte o botão de pagamento ao endpoint. Reconcile reservas expiradas, recusas, devoluções e disputas. Faça homologação de sandbox em ambiente separado antes de qualquer cobrança real.

**SMTP/Auth:** em Authentication, mantenha confirmação de e-mail, configure Site URL e redirecionamentos exatos para `/login` e `/redefinir-senha` (localhost durante DEV e domínio HTTPS final em produção). Copie os templates de `supabase/templates/` para Email Templates. Configure e teste SMTP customizado para entregar e-mails a clientes fora da equipe do projeto; o serviço padrão tem restrições. Nenhum envio de recuperação a usuário real foi solicitado pelos testes.

**Deploy:** configure variáveis públicas, sirva `dist` em HTTPS e faça fallback das rotas SPA para `index.html`. Publique o servidor de pagamentos separadamente, com CORS limitado ao domínio do app, validação de Auth e monitoramento. Valide autorização com contas reais, concorrência, câmera, recuperação, estoque e rastreabilidade. Configure rate limits/CAPTCHA de Auth e proteção dos endpoints conforme o tráfego; o banco já limita reservas por conta. Revise backups, restauração e política de estornos/transferências antes da operação comercial.

Referências oficiais utilizadas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funções de banco](https://supabase.com/docs/guides/database/functions), [recuperação de senha](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [templates](https://supabase.com/docs/guides/auth/auth-email-templates) e [webhooks Mercado Pago](https://www.mercadopago.com.br/developers/en/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks).

## Git

Commit de implementação: `5e2778a`, enviado à branch `main` do repositório autorizado. README, auditoria, instruções de integração e este relatório são versionados em um commit de documentação da mesma entrega. A revisão de staging verificou os arquivos antes do envio. Não foram incluídos `.env.local`, service_role, access tokens, senhas ou arquivos de clientes. Os arquivos de testes contêm somente credenciais sintéticas identificadas como teste.

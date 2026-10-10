# Validação — 10/10/2026

- npm run lint: aprovado, sem avisos.
- npm run build: aprovado.
- npm test: 59 testes aprovados, incluindo regressão de pedidos, pagamentos, estoque, portaria e segurança existente.
- Teste jurídico/limpeza repetido sobre schema completo até a migração 014 + equipe/convites: 8 verificações aprovadas.
- Playwright: 7 cenários finais aprovados em serviços simulados (cadastro com aceite obrigatório, marketing opcional, documentos no celular, candidatura de promotor, limpeza só pelo titular, cadastro e isolamento da portaria).
- Senha da limpeza: verificação separada aprovou recusa de senha incorreta, identidade de outra conta e divergência entre conta original e autenticação.
- SHA-256 dos seis conteúdos canônicos conferido.
- Histórico imutável, revogação de marketing e permissões de consulta verificados em PostgreSQL local/PGlite.
- Limpeza libera estoque de testes gratuitos e preserva evento/atrações; pagamentos aprovados e cobranças ativas são recusados transacionalmente.
- Revisão visual: campo de limpeza em desktop e página jurídica em 390 px, sem rolagem horizontal.
- Nenhum pagamento, limpeza de dados, publicação ou migração executado em produção.

## Limites da validação

Interface usa mocks; não houve teste de senha real nem instalação da Edge Function no Supabase de produção. A função de servidor nova requer homologação com configuração de origem antes de publicar. O Programa de Promotores existente não foi encontrado: candidatura e termos foram preparados; links, atribuição, comissões e pagamentos não estão implementados. Identidade empresarial e revisão jurídica continuam pendentes. As versões de homologação identificadas como Empresa de teste e Endereço fictício de teste são fixtures; não são identidade empresarial publicada.

## Reprodução

npm run lint
npm run build
npm test
npx playwright test --project=supabase-adapter -g "legal signup|draft documents|promoter application|sales cleanup|other admins|portaria link|portaria has" --trace=off

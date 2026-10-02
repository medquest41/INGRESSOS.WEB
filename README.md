# Plataforma de ingressos

Aplicação React/Vite existente, preservando o visual verde e dourado e `src/data/defaultEvents.js`.

## Executar

Requer Node.js 22.12+ (validado com 24.21).

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Abra http://localhost:5173. Para testar a câmera no celular será necessário HTTPS; o armazenamento local não é compartilhado entre dispositivos. Não use esta demonstração para vendas/portaria reais.

## Funcionalidades

- Home e catálogo `/eventos`, cards inteiros clicáveis, links por slug com compatibilidade por ID, copiar link e visualização restrita de eventos ocultos.
- Login local; primeiro administrador em `/admin`; cadastro de cliente no login. Equipe: Administrador, Organizador, Financeiro, Check-in e Cliente.
- Organizador/Financeiro/Check-in vinculados à organização. Cliente acessa seus próprios pedidos; pedidos antigos são reconhecidos pelo e-mail da conta.
- Checkout com CPF verificado, nome, telefone, e-mail da conta, nascimento, quantidade, cupom, taxa e total. PIX/cartão simulados; aprovação/recusa explícitas, sem dados bancários.
- Pedido aprovado emite número único e QR por unidade. Mesas/camarotes representam uma unidade com entrada única do grupo (não há mapa de assentos ou convites individuais).
- Estoque calculado considerando pedidos aprovados. Cancelamento libera estoque e invalida QR; pedido já utilizado não pode ser cancelado.
- Check-in por câmera ou digitação: válido, usado, cancelado, inválido e sem permissão. Web Locks e gravação em snapshot único impedem dupla entrada concorrente entre abas do mesmo navegador.
- Admin: dashboard, eventos, lotes/setores, mesas/camarotes, edição, duplicação, publicação, ocultação, arquivamento/restauração, pedidos, clientes, cupons, financeiro, CSV por evento/origem, equipe e histórico operacional.
- Divulgação: acrescente `?ref=instagram` ou `?utm_source=instagram` ao link público; o checkout preserva a origem no pedido.

## Preservação dos dados

As chaves antigas `ingressos_events_v1` e `ingressos_orders_v1` são lidas na primeira operação. A nova versão grava um snapshot em `ingressos_platform_v2`; as chaves antigas não são apagadas. `ingressos_auth_users_v1` e `ingressos_auth_session_v1` continuam compatíveis. Não limpe o armazenamento do navegador.

A pasta duplicada `ingressos-local/` encontrada dentro do projeto foi mantida e não faz parte do aplicativo principal. Não foi recriado `src/data/events.js`. Botões que apagavam todos os eventos ou restauravam os exemplos sobre os dados foram removidos.

## Limites e integração externa

Tudo permanece em modo local. A proteção de interfaces e operações não substitui autorização de servidor; qualquer pessoa com acesso ao armazenamento do navegador pode alterar esses dados. Contas locais não verificam e-mail e os hashes legados de senha são mantidos por compatibilidade. Dados de demonstração devem ser fictícios.

Consulte `docs/INTEGRACOES.md` para a estrutura de Supabase/Postgres e Mercado Pago. Preencher `.env` sozinho **não ativa** vendas reais. Não há credenciais inventadas ou segredos versionados.

## Testes de navegador

```sh
npm run test:e2e
```

Os testes utilizam o Google Chrome instalado. Use uma instância do site em http://localhost:5173. Os testes criam contexto isolado e dados fictícios, sem alterar o perfil normal do usuário. Câmera física, banco remoto e pagamento real exigem validação no ambiente de implantação.

## Administrador Geral principal (modo local)

O e-mail principal é medquest41@gmail.com. Em um navegador sem essa conta, abra /admin sem sessão ativa e informe seu nome e uma senha na configuração inicial; o e-mail já vem fixo. Nenhuma senha padrão é criada. O fluxo existente armazena somente o hash da senha.

Se esse e-mail já existir no armazenamento local, seu registro é atualizado para admin ativo, preservando ID, hash de senha e demais dados. Outros usuários, eventos e pedidos são preservados. O perfil principal não pode ser desativado ou rebaixado pela gestão de equipe. Esta configuração é exclusiva da autenticação local/mock; não cria usuários no Supabase.

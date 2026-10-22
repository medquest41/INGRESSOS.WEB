# Camarotes — implementação local, sem publicação

Base consultada em 22/10/2026: `origin/main` = `e2687605b0b3b9ab6f5baa9773c41c951b2641ef`.
A pasta existente estava em HEAD `e8e6099`, com alterações não commitadas. A comparação foi feita também pelo conteúdo normalizado, pois CRLF/LF criava diferenças falsas. Os arquivos entregues partem do GitHub recente, sem regressão para a base antiga.

## Uso

No Admin, edite o evento e adicione um tipo de ingresso. Selecione **Camarote inteiro — pulseiras individuais**, nomeie `Camarote 01`, informe o preço inteiro (ex.: R$ 1.200) e a quantidade de pulseiras (ex.: 8). Cada camarote numerado tem estoque exatamente 1; cadastre cada espaço separadamente. Nomes de camarote repetidos no mesmo evento são bloqueados no banco. O controle “Disponível para venda” permite bloquear a venda.

Em “Mapa do evento e setores”, reutilize o upload/recorte existente ou deixe sem imagem para usar a planta esquemática. Selecione um camarote e toque na planta; as posições também podem ser informadas em porcentagem. A lista acessível abaixo do mapa permite escolher sem depender da posição visual.

O cliente seleciona o espaço, vê preço e pulseiras e segue ao checkout existente. Quantidade da compra permanece 1; participantes correspondem às pulseiras. Os dados do comprador preenchem o primeiro participante; a política existente de CPF e idade continua sendo aplicada. De 1 a 100 pulseiras por camarote.

Após confirmação pelo fluxo verificado do backend, cada pulseira aparece em Meus Ingressos com QR próprio, PDF via impressão/salvar e compartilhamento individual existente. Em Pedidos, o Admin vê quantidade emitida, utilizada e pendente de entrada. O vínculo ao camarote fica no tipo de ingresso do pedido e no snapshot imutável.

## Estoque e pagamento

Reutiliza `ticket_types`, `orders`, `order_items`, `tickets`, participantes, outbox de e-mail e o fluxo Mercado Pago/Supabase atual. Nenhuma cobrança real foi realizada.

`create_order` serializa por evento e relê o lote após adquirir o lock; o estoque inclui pedidos aprovados e reservas pendentes válidas. Camarotes aceitam apenas uma unidade por pedido. A contagem de pulseiras é gravada no snapshot no servidor, nunca aceita do frontend como autoridade. A modalidade e a quantidade de pulseiras ficam protegidas após qualquer histórico.

Reserva inicial de 15 minutos; o fluxo Pix/cartão existente estende para 32 minutos ao iniciar a tentativa, compatível com o Pix existente. Falhas ambíguas de rede mantêm a reserva; apenas rejeição/cancelamento definitivo libera antecipadamente. Expiração libera pelo predicado do estoque, sem depender de tarefa agendada. Cancelamento local segue o fluxo existente; uma aprovação posterior a cancelamento/expiração vai para revisão, sem emissão. Aprovações tardias exigem reconciliação/estorno operacional, não aprovação visual nem emissão automática. O webhook duplicado não regenera QR. A emissão usa lock do pedido e números individuais, preservando códigos existentes; reprocessar não reinicia e-mail já emitido.

O backend continua verificando assinatura, tentativa, titularidade, valor, moeda, ambiente e status do provedor. As rotinas de confirmação/emissão continuam inacessíveis a `anon` e `authenticated`. `camarote_availability` expõe somente id e status e respeita a visibilidade do evento. O mapa consulta a disponibilidade a cada 15 segundos; somente a reserva transacional garante a compra.

## Migração: autorização separada

**Nada foi aplicado ao Supabase ou publicado no Render.**

1. Em homologação, rode o arquivo somente leitura `PREFLIGHT-CAMAROTES.sql`. Guarde as definições atuais das funções e confira os pré-requisitos de participantes e pagamento verificado (012, 013 e 014). Compare funções customizadas antes de substituir. A ausência de `event_activity_summary` e `organizations.whatsapp` detectada anteriormente pode indicar instalação parcial; este pacote não tenta corrigir isso automaticamente.
2. Não aplique pacotes antigos de ativação. Se faltar um pré-requisito, prepare uma correção específica após auditoria. O SQL 027 interrompe a aplicação quando faltam os principais pré-requisitos. As migrations 025/026 de portaria do GitHub não são reaplicadas por este pacote.
3. Com os pré-requisitos confirmados, aplique **somente** `supabase/migrations/027_camarotes.sql` em homologação. O arquivo inteiro usa transação. Registre sua aplicação no controle de migrações usado pelo ambiente.
4. Homologue com credenciais de teste e cobrança sandbox: Admin, mapa com imagem, Pix pendente/aprovado/expirado, cartão, retomada, cancelamento, duplicação de webhook, compartilhamento, PDF e portaria com usuários reais de teste. Execute disputa com conexões PostgreSQL independentes.
5. Produção exige autorização explícita posterior. Não há mudança de Edge Function neste pacote; a migração integra as rotinas de pagamentos existentes. Frontend requer build e publicação autorizada depois da migração homologada.

## Rollback seguro

Antes de cadastrar camarotes, `ROLLBACK-CAMAROTES.sql` restaura as quatro funções originais e remove somente os objetos adicionados. Ele **recusa** downgrade se houver camarotes ou pedidos com pulseiras. Foi testado que essa recusa preserva os ingressos.

Após cadastrar/vender camarotes, o rollback operacional seguro é bloquear novas vendas e manter a migração 027 e a interface de leitura/portaria para os pedidos existentes. Não converta camarotes em ingressos de grupo, não remova tickets nem apague histórico. Uma reversão completa depois de vendas precisa de plano específico e autorização. Os originais locais sobrescritos foram preservados em backup separado; restaurá-los integralmente depois de vendas também pode ocultar os novos pedidos e não é um rollback operacional seguro.

## Verificação e limites

- Build passou com URL/chave pública sintéticas, sem conexão ao projeto Supabase real.
- 87 testes automatizados passaram; depois do último ajuste SQL, o teste específico de camarotes passou novamente.
- Três testes de navegador: compra simulada em 390 e 1366 px, oito ingressos, estoque indisponível após compra, bloqueio e edição Admin de pulseiras/posição. Chamadas externas bloqueadas.
- Na pasta existente em D:, build e oito testes de camarotes/pagamentos também passaram. Os três testes visuais foram repetidos nessa instalação. Foi necessário limitar a descoberta do Vite a `index.html` e unificar React/React DOM: cópias antigas dentro de `work` estavam provocando carregamento duplicado no servidor de desenvolvimento. Nenhuma dessas cópias foi removida.
- Testes SQL executam migração real em PGlite: reserva exclusiva, submissões concorrentes, duplicação de pedido/webhook, Pix e cartão confirmados, expiração e aprovação tardia, cancelamento/rejeição, estorno, privilégios, QR únicos, entradas independentes e regressão de ingresso comum.
- **PGlite usa uma conexão e serializa consultas**: a submissão concorrente passou, mas não comprova contenção entre sessões PostgreSQL reais. Esse teste segue pendente em homologação.
- Não verificados em serviço real: cobranças, webhooks via rede, schema/RLS atuais de produção, PDF salvo pelo sistema operacional, entrega de e-mail, WhatsApp externo e portaria com câmera física. Os botões existentes foram preservados e a exibição foi conferida.
- A migração não corrige pendências alheias de banco, documentos legais ou cadastro de organização.

## Arquivos

Alterações de camarotes: `CamaroteMap.jsx/.css`, `TicketBatchEditor.jsx`, `VenueMapEditor.jsx`, `Participants.jsx`, `EventOrderList.jsx`, `Admin.jsx`, `Checkout.jsx`, `Evento.jsx`, `MeusIngressos.jsx`, `LocalEventStore.jsx`, `commerce.js`, `experience.js`, migração 027, preflight, rollback e testes específicos.

Compatibilidade com o GitHub recente, necessária para não regredir os fluxos existentes: `eventAccess.js`, `EventCheckinTeam.jsx`, `ProtectedRoute.jsx`, `AuthStore.jsx` e `inlinePayment.js`. Esses arquivos recuperam o acesso de portaria por evento e o cancelamento de pagamento já presentes na base recente. Não há nova migração de portaria nem mudança nos templates de e-mail.

`vite.config.js` também foi ajustado para impedir descoberta de projetos antigos e duplicação de React na pasta local. A versão anterior está no backup.

O manifesto do pacote lista caminhos, hashes antes/depois e base GitHub. O ZIP contém somente arquivos incrementais; exclui `.env*`, `.git`, dependências, builds, dados e credenciais.

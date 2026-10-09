# Correção 16.1 — catálogo compatível com o banco anterior

O erro `column organizations_1.whatsapp does not exist` ocorre quando o frontend da atualização 16 consulta o contato do organizador antes de essa coluna existir no banco conectado. A consulta nova deixou a Home dependente da ativação do SQL. O patch corrige essa dependência para o catálogo.

Extraia `INGRESSOS-ATUALIZACAO-16.1.zip` sobre `D:\SITE-INGRESSOS\ingressos-local`, substituindo apenas os arquivos deste pacote. Não crie outra pasta dentro dela. Pare e reinicie o servidor local; no Render, publique novamente com o processo habitual.

O catálogo tenta carregar o WhatsApp do organizador e, somente quando o campo opcional não existe, repete a consulta com o nome do organizador. Os eventos voltam a carregar e os contatos já gravados no evento continuam disponíveis. Quando a coluna for criada, a consulta completa volta a funcionar. Erros de permissões, rede e campos essenciais não são ocultados. A correção não muda pagamentos, taxas, autenticação, pedidos ou localStorage.

Para ativar **todos os recursos da atualização 16**, ainda é necessário aplicar manualmente `ATIVAR-ATUALIZACAO-16.sql` do ZIP 16, depois de verificar os pré-requisitos até a migration 012. Não execute apenas um ALTER de WhatsApp como substituto desse SQL: participantes, VIP, compartilhamento protegido e fila de e-mail também precisam da migration 013. Nenhum SQL remoto foi executado nesta correção.

Verificação local: testes específicos de banco sem/com coluna opcional, preservação de erros reais, suíte completa, lint e build com configuração pública sintética. O ZIP não contém credenciais, `.env.local`, dependências ou build.

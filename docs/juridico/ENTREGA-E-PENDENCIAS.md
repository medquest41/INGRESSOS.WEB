# Atualização jurídica e limpeza de vendas — 10/10/2026

## Estado da entrega

Código preparado no checkout ingressos-publicacao, baseado no commit 4fd847f. Não publicado, não enviado ao GitHub e nenhuma migração aplicada em produção. Nenhum pedido foi limpo.

## Seis documentos

termos.md, privacidade.md, organizadores.md, promotores.md, cookies.md e cancelamentos.md. Total aproximado de 3.700 palavras. Fontes oficiais ao final de cada documento. Todos são minutas, com versão e hash, sem proteção jurídica absoluta e sujeitos a advogado brasileiro.

## Pendências de identidade e operação

- Identificação preenchida conforme alvará enviado: JOCIMAR DE OLIVEIRA, CNPJ 65.586.495/0001-28, Avenida Marinas, s/n, Zona Rural, Boa Vista da Aparecida. CEP 85780-000 informado pela responsável. Confirmar a identificação contratual da operação durante a revisão jurídica. Versão das minutas: 2026-10-10.2.
- Confirmar responsável pelo canal de privacidade, eventual encarregado e uso do e-mail de suporte para solicitações jurídicas.
- Confirmar entidades contratuais, regiões de hospedagem e mecanismos de transferência internacional de Supabase, Render, Resend e Mercado Pago.
- Definir tabela de retenção, expurgo, guarda de registros de acesso, backups e resposta a incidentes; o código atual não comprova essas rotinas.
- Validar fluxo operacional de reembolsos, prazos efetivos do provedor e repasses aos organizadores.
- Validar classificação etária, proteção de menores, regras locais de meia-entrada, acessibilidade e documentação tributária.
- Programa de Promotores NÃO existia no checkout: esta entrega acrescenta termos, candidatura e histórico de aceite. Não implementa atribuição de organizadores, cálculo financeiro, link de indicação ativo ou pagamento de comissão. Regras de atribuição, janela, prazo de contestação e efeitos do encerramento precisam de decisão e implementação antes de ativar o programa.

## Aceites

Checkbox obrigatório desmarcado no cadastro; marketing separado e opcional. Links completos em nova aba. Servidor registra usuário, documento, versão, hash SHA-256, origem e horário UTC. Conteúdos e registros não podem ser alterados por clientes; revisões geram novas versões. Marketing tem histórico de concessão e revogação. Usuário consulta seus aceites e o Admin Geral os consulta com controle no banco.

Migração 017 cria a estrutura incremental, com exigência de cadastro DESATIVADA até revisão. O frontend de cadastro desta atualização bloqueia adesão enquanto não houver identidade completa e documentos vigentes aprovados. Por isso NÃO publicar o frontend antes de preparar a revisão e ativação sincronizada. Login de contas existentes, recuperação de senha e compra rápida continuam com seus fluxos; o checkout e o provedor não foram alterados.

A promoção de cliente a organizador também exige aceite no servidor quando a implantação jurídica estiver ativada. A candidatura de promotor nunca ativa link nem concede acesso administrativo.

## Limpeza de vendas de teste

Botão exclusivo da conta principal ingressosaltatemporada@gmail.com com perfil admin ativo. Fica em Pedidos deste evento. Requer seleção de até 500 pedidos, senha existente do Admin Geral e frase LIMPAR VENDAS DE TESTE. A senha é conferida pelo Supabase no servidor, não fica em localStorage nem no código.

A Edge Function sales-maintenance é a única autorizada a chamar a função de limpeza. O navegador não pode executar diretamente a RPC. A operação é transacional, confere todos os IDs e bloqueia seleção duplicada ou de outro evento. Registros são arquivados, testes pendentes/gratuitos são cancelados, QR fica cancelado, estoque é liberado e os totais operacionais excluem o arquivamento. A auditoria conserva IDs, responsável e data. Não se apagam eventos, atrações, DJs, lotes, fotografias, configurações, contas ou histórico financeiro.

IMPORTANTE: o pagamento real aprovado de R$ 13,93 e outros pagamentos/cobranças ativos não são apagados. Pedidos com pagamento identificado, revisão ou repasse ficam bloqueados. Arquivar não é estornar. Se um teste foi realmente pago, deve ser conciliado com o provedor e receber tratamento específico antes de qualquer exclusão dos totais; esta entrega não faz estorno nem apaga comprovantes.

## Instalação para revisão

1. Conferir que a cópia de destino corresponde ao checkout atualizado/base 4fd847f; uma pasta antiga precisa receber primeiro as atualizações anteriores. Fazer backup do código e do banco antes da instalação.
2. Extrair os arquivos sobre a cópia de desenvolvimento D:/SITE-INGRESSOS/ingressos-local. O ZIP é incremental e não contém configurações privadas ou dependências.
3. Instalar as migrações 017 e 018 primeiro em um banco de homologação que já tenha as migrações anteriores. Esta entrega NÃO executa SQL em produção.
4. Configurar e implantar sales-maintenance em homologação. Definir SALES_MAINTENANCE_ALLOWED_ORIGINS com as origens exatas permitidas, separadas por vírgula. O serviço usa SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY disponibilizados no ambiente da Edge Function. Não inserir a service role no frontend.
5. Revisar as minutas e preencher a identidade na área Meus aceites e privacidade/Admin Geral. Salvar identidade apenas marca como pendente, não publica.
6. Para versões revisadas, preparar um JSON com company completa (reviewed:true) e documents por slug, cada conteúdo com status approved, nova versão, data, seções e referências. Executar scripts/prepare-reviewed-legal.mjs para gerar SQL de publicação revisável. O script não se conecta ao banco. Não reutilizar a versão de minuta.
7. Após revisão jurídica e autorização de produção, aplicar a transação de publicação revisada e publicar o frontend de forma coordenada. Antes disso, novos cadastros desta atualização permanecem bloqueados em revisão. Não ativar links de promotor: o módulo operacional ainda não foi implementado.

## Verificação

Testes locais usam PGlite e mocks, sem pagamentos e sem gravações em produção. A revisão SQL deve conferir também a aplicação sobre o schema real completo em homologação. As migrações não apagam ou recriam tabelas existentes. Executar npm run lint, npm run build, npm test e os cenários jurídicos de Playwright indicados no relatório de validação.

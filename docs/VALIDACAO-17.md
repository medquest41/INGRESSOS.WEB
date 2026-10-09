# Validação — atualização 17

Validação local, sem cobrança e sem acesso ao Supabase remoto.

| Verificação | Resultado |
|---|---|
| Suíte existente + novos testes (`node --test tests/*.test.js`) | 46 testes aprovados, zero falhas |
| Testes adicionais de pagamento/handler após ampliar os cenários | 4 testes aprovados, zero falhas |
| Chrome/Playwright — interface Pix/cartão, mobile e estados terminais | 6 testes aprovados, zero falhas |
| Inspeção estática com oxlint | Sem erros/avisos |
| Build de produção com configuração pública sintética | Aprovado |
| Migrations no PostgreSQL/PGlite | Sequência até 014 aprovada; reaplicação de 014 aprovada |

Os testes de PostgreSQL exercitam RLS/EXECUTE, reserva e emissão, snapshot de taxa, Pix pendente/aprovado, cartão em processamento/recusado, cancelamento, aprovação atrasada, estorno total/chargeback e parcial antes da primeira aprovação, repetição de webhook/settlement, rollback da aprovação e lease de criação concorrente. Nenhum QR pago é emitido antes de aprovação; dois ingressos produzem dois códigos diferentes pelo fluxo existente.

O teste HTTP carrega o handler real de `supabase/functions/payments/index.ts` usando o suporte de TypeScript do Node e substitui o cliente Supabase e a rede por respostas sintéticas. Exercita CORS, sessão, valores do servidor, repetição, falha de banco, recuperação de resposta perdida, cartão recusado e HMAC válida/inválida. As rotinas SQL são verificadas separadamente com PostgreSQL local. Isso não equivale a executar a função no runtime Deno hospedado; compatibilidade foi revisada e os imports de `node:crypto`/`node:buffer` são explícitos.

O teste visual intercepta todas as chamadas Supabase e o SDK do Mercado Pago. Verifica QR Pix/copia e cola, total, validade, limite da tela mobile, token/identidade do titular e bloqueio para estados expired/refunded/charged_back/review. Não tokeniza um cartão real. O formulário de teste não integra o bundle de produção.

Nesta máquina Windows, o encerramento automático do servidor de teste ficou aguardando após os testes terminarem. A confirmação final foi repetida usando `INGRESSOS_E2E_EXTERNAL=1` com o servidor local já iniciado: **6 passed (13.3s)** e processo de testes encerrado com código zero. Esse modo opcional não altera o produto.

Pendências externas: credenciais correspondentes, habilitação Pix/cartão na conta, execução manual das migrations ausentes, publicação da Edge Function, origem Render autorizada, entrega de webhook autenticado e homologação de SDK/3DS/provedor. Nada disso foi declarado ativo ou executado nesta entrega.

# Plataforma de ingressos

Projeto React/Vite existente com visual verde e dourado preservado. A integração de Auth e dados usa Supabase quando configurado; o modo local foi separado e só funciona em DEV explícito.

**Ativação necessária:** aplique as migrations 001 a 004 no Supabase, configure Auth e promova a conta principal com o script de setup. O banco remoto ainda não foi ativado nesta entrega. Veja [RELATORIO_FINAL.md](RELATORIO_FINAL.md) para o estado real, passos de configuração, permissões, preservação e testes.

## Executar

Node.js 22.12+; validado com 24.21.0.

```sh
npm ci
npm run dev
```

Configure a URL e a chave publishable em .env.local conforme .env.example. A chave anon legada também é aceita. Nunca use uma chave privada com prefixo VITE_. O build recusa configuração pública ausente ou chaves privadas.

Para consultar os dados locais antigos e demonstrar o sistema sem banco:

```sh
npm run dev:demo
```

Este modo é somente de desenvolvimento, usa dados do navegador e não faz cobrança. Use a mesma origem onde estão os dados existentes. Eles não são apagados automaticamente. Depois de configurar o admin remoto, a tela Equipe permite exportar/importar eventos locais para uma organização escolhida, preservando links e conteúdo; pedidos simulados não viram vendas reais.

## Validar

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam Chrome e iniciam instâncias isoladas em 5190/5191. A suite cobre o modo local e o adaptador Supabase com respostas de rede simuladas. As migrations/RLS são executadas em PostgreSQL embarcado nos testes. Homologue contas, concorrência entre dispositivos, câmera, e-mails e pagamentos no ambiente real antes de vender.

## Pagamentos e administração

Pedidos gratuitos emitem ingressos após validação no banco. Pedidos pagos ficam pendentes, com reserva de 15 minutos e sem QR, até a integração de pagamento. Mercado Pago tem arquitetura de servidor preparada, com liquidação exclusiva do serviço e desligada por padrão; endpoints, webhook e configuração ainda precisam ser implantados. Não há saldo ou cobrança fictícia no modo Supabase.

O administrador principal é medquest41@gmail.com. Crie/confirme a conta pelo Auth e execute supabase/setup/promote-primary-admin.sql de forma confiável. Nenhuma senha foi definida em código. A gestão remota vincula contas confirmadas a perfis/organizações e autoriza check-in por evento.

Home, catálogo, eventos, Admin, checkout, Meus Ingressos, QR, scanner, cupons, relatórios, equipe e histórico foram reaproveitados e integrados. A pasta antiga aninhada ingressos-local/ continua preservada e não faz parte do app principal.

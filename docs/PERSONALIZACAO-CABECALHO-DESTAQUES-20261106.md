# Personalização compartilhada, cabeçalho e destaques — 06/11/2026

Base:66a62e8. Publicação autorizada pelo usuário após os novos pedidos de personalização.

- Destaque “Últimos ingressos” e “Texto personalizado”, com mensagem de até48caracteres. A mensagem é renderizada como texto, sem interpretar HTML, com herança no cartão principal e unidades do mesmo combo. Editar/remover não altera outras ofertas. As indicações continuam sendo uma escolha editorial do organizador, sem inferir escassez automaticamente.
- Cabeçalho: separa marca, acesso e navegação, com duas linhas no celular. O logo fica visível. Conferência de não sobreposição em320/390/690/1280px.
- Padrão compartilhado: acabamento de profundidade e bordas luminosas em benefícios/tópicos, etapas, cartões e painéis existentes, incluindo Admin. Campos e QR Codes permanecem estáveis. A página de ingresso compartilhado e a impressão continuam fora da animação global. Não adiciona dados comerciais ou altera preços.
- Entrada: boas-vindas só com conta autenticada e ativa. Tentativa recusada não abre a animação. Cadastro pendente de confirmação mantém mensagem de conferir e-mail, sem afirmar que a conta já pode acessar. Preferência visual só usa tipo/timestamp de tentativa em sessionStorage; não armazena senha ou dados pessoais. Não muda permissões ou autenticação.
- Compra: reforça o relevo da comemoração já existente, preservando a verificação do pedido aprovado no backend, ingressos válidos e bloqueio em revisão/estorno.

Validação: lint/build,11 testes unitários pertinentes e23 testes de navegador, incluindo customização, cabeçalho, acesso correto/incorreto, superfícies do início/painel, compra aprovada/pendente/estornada, zoom,16mesas e checkout. Contas, pedidos e senhas usados nos testes são exclusivamente sintéticos locais. Nenhuma cobrança, e-mail ou cadastro real. O cadastro real com confirmação de e-mail e o acesso real de produção não foram repetidos. Não é teste de carga.

Sem migração SQL, sem mudança em funções de pagamento, sem venda local029, sem alteração de dados de produção. Rollback: reverter este commit de código e republicar. Dados de destaque e demais detalhes podem permanecer no banco, sem apagar pedidos/ingressos.

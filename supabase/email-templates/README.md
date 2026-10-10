# E-mails de autenticação

Modelos prontos para Supabase Authentication → Emails → Templates.

- Confirm sign up: assunto `Confirme seu e-mail | Ingressos Experiences`, corpo `confirm-signup.html`.
- Reset password: assunto `Redefina sua senha | Ingressos Experiences`, corpo `reset-password.html`.

Preservar `{{ .ConfirmationURL }}` no botão e no endereço alternativo. O Supabase gera o link seguro e mantém o destino de retorno da aplicação.

Aplicados no projeto de produção oavpsfcosidlvoinbjst em 09/10/2026, com prévias e confirmação de salvamento no painel. Envio configurado pela integração oficial Resend → Supabase. Remetente: Ingressos Experiences <ingressos@medquestapp.com.br>. Contato: ingressosaltatemporada@gmail.com. Não houve disparo real de teste nem alteração de senha.

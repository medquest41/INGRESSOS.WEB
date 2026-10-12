export const existingAccountMessage = 'Você já possui uma conta. Entre ou recupere sua senha para continuar seu cadastro de promotor.'
export function signupResult(data) {
  if (!data?.session && Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
    return { existingAccount: true, confirmationRequired: false }
  }
  return { existingAccount: false, confirmationRequired: !data?.session }
}
export function isExistingAccountError(message = '') {
  return /user already registered|email.*already.*(?:registered|exists)|(?:e-mail|email|cpf).*(?:já cadastrad|já.*uso)|identidade já cadastrada/i.test(message)
}
export function loginErrorMessage(message = '') {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos. Se você já tem uma conta, use sua senha anterior ou clique em Esqueci minha senha.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.'
  return message || 'Não foi possível entrar.'
}

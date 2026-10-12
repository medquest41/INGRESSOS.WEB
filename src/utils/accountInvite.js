export function accountInviteLink(invitationId,role,origin){
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(invitationId||''))throw Error('Convite inválido. Prepare um novo convite.')
 const url=new URL('/login',origin);url.search=new URLSearchParams({cadastro:'1',convite:invitationId,returnTo:role==='cliente'?'/ingressos':'/admin'}).toString();return url.href
}

export async function verifySalesOwner(client, token, password) {
 const {data,error}=await client.auth.getUser(token)
 const user=data?.user
 if(error||!user||user.email?.toLowerCase()!=='ingressosaltatemporada@gmail.com')throw Error('Acesso exclusivo do Admin Geral.')
 if(typeof password!=='string'||password.length<6||password.length>256)throw Error('Senha inválida.')
 const verified=await client.auth.signInWithPassword({email:user.email,password})
 if(verified.error||verified.data?.user?.id!==user.id)throw Error('Senha inválida. A limpeza não foi realizada.')
 return user
}

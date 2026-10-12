export const accountGroups=[['cadastrados','Cadastrados'],['organizador','Organizadores'],['checkin','Check-in'],['financeiro','Financeiro'],['cliente','Clientes'],['visitante','Visitantes'],['admin','Administradores']]
export function accountGroup(user){
 if(user.role==='cliente'&&(user.guest===true||user.is_anonymous===true||!String(user.email||'').trim()))return 'visitante'
 return ['organizador','checkin','financeiro','cliente','admin'].includes(user.role)?user.role:'outros'
}
export function matchesAccountGroup(user,group){return group==='cadastrados'?accountGroup(user)!=='visitante':accountGroup(user)===group}

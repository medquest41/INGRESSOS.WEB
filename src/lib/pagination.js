// Uses exact RLS-filtered counts so a lower API row cap cannot silently truncate reports.
export async function paged(query,pageSize=200){
 const rows=[];let offset=0
 for(;;){
  const response=await query().range(offset,offset+pageSize-1)
  if(response.error)return response
  const batch=response.data||[];rows.push(...batch);offset+=batch.length
  if(batch.length===0||(Number.isInteger(response.count)?offset>=response.count:batch.length<pageSize))return {data:rows,error:null}
 }
}

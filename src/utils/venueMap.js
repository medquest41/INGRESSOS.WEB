export function venueMapUrl(value,{local=false}={}) {
 const text=String(value||'').trim()
 if(!text)return ''
 if(local&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(text))return text
 try{const url=new URL(text);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href}catch{}
 throw Error('Use uma imagem do mapa enviada pelos arquivos ou um link HTTPS válido.')
}

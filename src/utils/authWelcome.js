const key='ingressos_auth_welcome_v1'
export function readAuthWelcome(){try{const data=JSON.parse(sessionStorage.getItem(key)||'null');return data&&['login','signup'].includes(data.kind)&&Date.now()-data.at<120000&&Date.now()>=data.at?data:null}catch{return null}}
export function setAuthWelcome(kind){try{if(kind)sessionStorage.setItem(key,JSON.stringify({kind,at:Date.now()}));else sessionStorage.removeItem(key)}catch{/* Optional visual feedback. */}window.dispatchEvent(new Event('ingressos-auth-welcome'))}
export function clearAuthWelcome(){try{sessionStorage.removeItem(key)}catch{/* Optional visual feedback. */}}

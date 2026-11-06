export function mapZoom(value){const n=Number(value);return Number.isFinite(n)&&n>=1&&n<=3?Math.round(n*100)/100:1}
export const mapZoomKey=(event,editor=false)=>JSON.stringify([event.id||'',event.venueMapImage||'',editor?'editor':'visitor',mapZoom(event.venueMapZoom)])

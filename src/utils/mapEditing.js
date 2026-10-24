const clamp=(n,min,max)=>Math.min(max,Math.max(min,n))
export const mapCoordinate=value=>Math.round(clamp(Number(value)||0,0,100)*1000)/1000
export function markerPosition(ticket,index=0){return {x:Number(ticket.mapX??(15+(index%4)*23)),y:Number(ticket.mapY??((40+Math.floor(index/4)*18)%90))}}
export function moveMarker(point,dx,dy,rect){return {x:mapCoordinate(point.x+dx/rect.width*100),y:mapCoordinate(point.y+dy/rect.height*100)}}
export function nudgeMarker(point,key,rect,{shiftKey=false,altKey=false}={}){
 const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}
 const vector=vectors[key];if(!vector)return null
 const step=altKey ? 0.25 : shiftKey ? 10 : 1
 return moveMarker(point,vector[0]*step,vector[1]*step,rect)
}
export function markerSize(value){const size=Number(value);return Number.isFinite(size)&&size>=1&&size<=14?size:5}

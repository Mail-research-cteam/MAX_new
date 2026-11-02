const assert=require('node:assert/strict');
function helpers(p){
 const matrix=()=>p.locator('#flLayer').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {z:m.a,x:m.e,y:m.f};});
 async function zoomTo(value){const z=(await matrix()).z;await p.locator('#flView').evaluate((el,delta)=>{const r=el.getBoundingClientRect();el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,deltaY:delta}));},-Math.log(value/z)/.002);}
 async function pan(dx,dy){
  let left=dx,top=dy;
  for(let i=0;i<150&&(Math.abs(left)>.5||Math.abs(top)>.5);i++){
   const r=await p.locator('#flView').boundingBox(),start=await p.locator('#flView').evaluate(el=>{const r=el.getBoundingClientRect();for(let y=r.y+100;y<r.bottom-80;y+=70)for(let x=r.x+100;x<r.right-80;x+=70){const e=document.elementFromPoint(x,y);if(el.contains(e)&&!e.closest('input,textarea,select,button,label[for]'))return {x,y};}throw Error('No pan surface');});
   const sx=Math.max(r.x+20-start.x,Math.min(r.x+r.width-20-start.x,left)),sy=Math.max(r.y+20-start.y,Math.min(r.y+r.height-20-start.y,top));
   await p.mouse.move(start.x,start.y);await p.mouse.down({button:'middle'});await p.mouse.move(start.x+sx,start.y+sy);await p.mouse.up({button:'middle'});left-=sx;top-=sy;
  }
  assert(Math.abs(left)<1&&Math.abs(top)<1,'Pan did not finish');
 }
 async function focus(locator,x=180,y=220){const a=await locator.boundingBox(),r=await p.locator('#flView').boundingBox();await pan(r.x+x-a.x-a.width/2,r.y+y-a.y-a.height/2);}
 async function connect(key,to){const port=p.locator('[data-port="'+key+'"]');await port.focus();await p.keyboard.press('Enter');await p.locator('dialog select').selectOption(to);await p.getByRole('button',{name:'Применить',exact:true}).click();}
 async function selectEdge(key){const port=p.locator('[data-port="'+key+'"]');await focus(port);await port.click();assert.equal(await p.locator('#boardEdgeList').inputValue(),key);}
 async function dragTarget(locator){for(let i=0;i<160;i++){const a=await locator.boundingBox(),r=await p.locator('#flView').boundingBox(),x=a.x+a.width/2,y=a.y+a.height/2;if(x>r.x+30&&x<r.x+r.width-30&&y>r.y+30&&y<r.y+r.height-30){await p.mouse.move(x,y);return;}await p.mouse.move(x<r.x+30?r.x+4:x>r.x+r.width-30?r.x+r.width-4:x,y<r.y+30?r.y+4:y>r.y+r.height-30?r.y+r.height-4:y);await p.waitForTimeout(100);}throw Error('Target unreachable by edge auto-pan');}
 return {matrix,zoomTo,pan,focus,connect,selectEdge,dragTarget};
}
module.exports=helpers;

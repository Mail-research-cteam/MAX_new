/* Board-only geometry and interactions. No player or scenario content changes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxBoard=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const MIN=.08,MAX=2.5,GAP=36;
  function world(p,pan,z){return {x:(p.x-pan.x)/z,y:(p.y-pan.y)/z};}
  function zoomAt(p,pan,z,next){next=Math.max(MIN,Math.min(MAX,next));const w=world(p,pan,z);return {zoom:next,pan:{x:p.x-w.x*next,y:p.y-w.y*next}};}
  function overlaps(a,b,gap=GAP){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
  function selectionRect(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};}
  function place(rect,occupied){let p={...rect};for(let attempt=0;attempt<occupied.length+2;attempt++){const hits=occupied.filter(b=>overlaps(p,b));if(!hits.length)return p;p.y=Math.max(...hits.map(b=>b.y+b.h))+GAP;}throw Error('Не удалось разместить карточку');}
  // Explicit graph layout only. Automatic placement of new cards still uses place().
  function tidy(rectangles,edges){
    if(!rectangles.length)return [];
    const byId=new Map(rectangles.map(r=>[r.id,r])),out=new Map(rectangles.map(r=>[r.id,[]])),incoming=new Map(rectangles.map(r=>[r.id,0]));
    const seenEdges=new Set();
    for(const [key,to] of edges){
      const from=key.split(':')[1],pair=JSON.stringify([from,to]);
      if(from===to||!byId.has(from)||!byId.has(to)||seenEdges.has(pair))continue;
      seenEdges.add(pair);out.get(from).push({to,auto:key.startsWith('auto:')});incoming.set(to,incoming.get(to)+1);
    }
    for(const list of out.values())list.sort((a,b)=>Number(b.auto)-Number(a.auto));
    const color=new Map(),dag=new Map(rectangles.map(r=>[r.id,[]])),children=new Map(rectangles.map(r=>[r.id,[]])),roots=[],post=[];
    function visit(id){
      color.set(id,1);
      for(const {to} of out.get(id)){
        // Loop-back links stay in scenario data, but do not force infinite ranks.
        if(color.get(to)===1)continue;
        dag.get(id).push(to);
        if(!color.has(to)){children.get(id).push(to);visit(to);}
      }
      color.set(id,2);post.push(id);
    }
    const priority=id=>id==='__meta'?-2:id==='__intro'?-1:0;
    const ordered=[...rectangles].sort((a,b)=>priority(a.id)-priority(b.id)||a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
    for(const r of ordered)if((r.id==='__intro'||!incoming.get(r.id))&&!color.has(r.id)){roots.push(r.id);visit(r.id);}
    for(const r of ordered)if(!color.has(r.id)){roots.push(r.id);visit(r.id);}
    const rank=new Map(rectangles.map(r=>[r.id,0]));
    for(const id of post.reverse())for(const to of dag.get(id))rank.set(to,Math.max(rank.get(to),rank.get(id)+1));
    const widths=[];for(const r of rectangles)widths[rank.get(r.id)]=Math.max(widths[rank.get(r.id)]||0,r.w);
    const xs=[Math.min(...rectangles.map(r=>r.x))];for(let i=0;i<widths.length-1;i++)xs[i+1]=xs[i]+(widths[i]||0)+80;
    const positions=new Map();
    function row(id,y){
      const rect=byId.get(id),branch=children.get(id);positions.set(id,{x:xs[rank.get(id)],y});
      let height=rect.h;
      if(branch.length)height=Math.max(height,row(branch[0],y));
      for(const child of branch.slice(1)){height+=48;height+=row(child,y+height);}
      return height;
    }
    let y=Math.min(...rectangles.map(r=>r.y));
    for(const id of roots)y+=row(id,y)+64;
    return rectangles.map(r=>({...r,...positions.get(r.id)}));
  }
  function target(s,key,value){const p=key.split(':'),n=p[1]==='__intro'?s.intro:s.nodes[p[1]];if(!n)throw Error('Источник связи не найден');if(p[0]==='btn'){if(!n.buttons||!n.buttons[+p[2]])throw Error('Кнопка не найдена');n.buttons[+p[2]].target=value;}else{const prop={auto:'auto',ok:'confirmTarget',no:'cancelTarget',target:'target'}[p[0]];if(!prop)throw Error('Неизвестный выход');n[prop]=value;}}
  function create(api){
    const {viewport,layer}=api;let drag=null,link=null,selected=null,raf=0,last=0,pointer={x:0,y:0},space=false,resizeFrame=0,captured=null;
    let nodesSelected=new Set(),lastHit=null;
    const marquee=document.createElement('div');marquee.className='board-selection-box';marquee.hidden=true;marquee.setAttribute('aria-hidden','true');viewport.append(marquee);
    function paintSelection(){layer.querySelectorAll('.fl-node').forEach(el=>{const on=nodesSelected.has(el.dataset.id);el.classList.toggle('is-node-selected',on);el.dataset.selected=String(on);});}
    function paintMarquee(){if(drag?.type!=='marquee')return;const v=api.view(),r=bounds(),end=world(local({x:Math.max(r.left,Math.min(r.right,pointer.x)),y:Math.max(r.top,Math.min(r.bottom,pointer.y))}),v.pan,v.zoom),box=selectionRect(drag.start,end);nodesSelected=new Set(drag.additive?drag.before:[]);for(const n of rects())if(overlaps(box,n,0))nodesSelected.add(n.id);paintSelection();marquee.hidden=false;marquee.style.left=(box.x*v.zoom+v.pan.x)+'px';marquee.style.top=(box.y*v.zoom+v.pan.y)+'px';marquee.style.width=box.w*v.zoom+'px';marquee.style.height=box.h*v.zoom+'px';}
    viewport.tabIndex=0;viewport.setAttribute('aria-label','Доска сценария');
    const tools=document.createElement('div');tools.className='board-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','Управление доской');document.querySelector('.fl-bar').after(tools);
    function button(text,fn,label){const b=document.createElement('button');b.type='button';b.textContent=text;b.className='fl-t';if(label)b.setAttribute('aria-label',label);b.onclick=fn;tools.append(b);return b;}
    const output=document.createElement('output');output.id='boardZoom';output.setAttribute('aria-label','Масштаб доски');
    button('−',()=>stepZoom(-.2),'Уменьшить доску');tools.append(output);button('+',()=>stepZoom(.2),'Увеличить доску');button('100%',()=>zoom(0,true),'Сбросить масштаб доски');button('Вся схема',fit);
    const list=document.createElement('select');list.id='boardEdgeList';list.setAttribute('aria-label','Выбрать связь');tools.append(list);list.onchange=()=>select(list.value||null);
    const remove=button('Удалить связь',deleteEdge);remove.disabled=true;
    const arrange=button('Навести порядок',arrangeGraph);arrange.id='boardArrange';
    const info=document.createElement('span');info.className='board-info';info.setAttribute('role','status');tools.append(info);
    document.querySelector('.fl-hint')?.remove();
    const editable=e=>!!e.target.closest('input,textarea,select,label[for],[contenteditable]:not([contenteditable="false"])');
    function bounds(){return viewport.getBoundingClientRect();}
    function local(client){const r=bounds();return {x:client.x-r.left,y:client.y-r.top};}
    function apply(){const s=api.view();layer.style.transform=`translate(${s.pan.x}px,${s.pan.y}px) scale(${s.zoom})`;layer.style.setProperty('--board-scale',s.zoom);output.value=Math.round(s.zoom*100)+'%';if(drag?.type==='marquee'&&drag.moved)paintMarquee();}
    function setView(pan,z){api.setView(pan,z);apply();}
    function zoom(factor,reset=false,anchor){const s=api.view(),r=bounds(),p=anchor||{x:r.width/2,y:r.height/2};const next=zoomAt(p,s.pan,s.zoom,reset?1:s.zoom*factor);setView(next.pan,next.zoom);if(link)paintLink();}
    function stepZoom(delta){const s=api.view();zoom(Math.max(MIN,Math.min(MAX,s.zoom+delta))/s.zoom);}
    function rects(){return [...layer.querySelectorAll('.fl-node')].map(el=>({id:el.dataset.id,x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}));}
    function fit(){const rs=rects(),r=bounds();if(!rs.length||!r.width||!r.height)return;const x=Math.min(...rs.map(a=>a.x)),y=Math.min(...rs.map(a=>a.y)),w=Math.max(...rs.map(a=>a.x+a.w))-x,h=Math.max(...rs.map(a=>a.y+a.h))-y;const z=Math.max(MIN,Math.min(1,(r.width-80)/w,(r.height-80)/h));setView({x:40-x*z,y:40-y*z},z);api.draw();}
    function label(key,to){const s=api.state(),p=key.split(':'),n=p[1]==='__intro'?s.intro:s.nodes[p[1]],dest=s.nodes[to];const type={auto:'авто',btn:'кнопка',ok:'подтвердить',no:'отменить',target:'выбор контакта'}[p[0]];return `${p[1]} · ${type}${p[0]==='btn'?' «'+(n.buttons[+p[2]].label||'')+'»':''} → ${to}${dest?' · '+(dest.text||dest.title||dest.type).slice(0,45):''}`;}
    function select(key){selected=key;list.value=key||'';remove.disabled=!key;api.draw();info.textContent=key?'Выбрана: '+label(key,api.edges().find(e=>e[0]===key)?.[1]):'';}
    function deleteEdge(){if(!selected)return;const key=selected;api.snapshot();target(api.state(),key,'');selected=null;api.rebuild();api.sync();api.save();viewport.focus({preventScroll:true});info.textContent='Связь удалена. Отмена: Ctrl+Z / Cmd+Z.';}
    function deleteNodes(){
      const ids=[...nodesSelected].filter(id=>api.state().nodes[id]);if(!ids.length)return;
      if(!window.confirm('Удалить выбранные узлы ('+ids.length+')? Действие можно отменить.'))return;
      cancel();api.snapshot();const s=api.state(),removed=new Set(ids);ids.forEach(id=>delete s.nodes[id]);
      if(removed.has(s.intro.auto))s.intro.auto='';
      for(const n of Object.values(s.nodes)){for(const k of ['auto','target','confirmTarget','cancelTarget'])if(removed.has(n[k]))n[k]='';for(const b of n.buttons||[])if(removed.has(b.target))b.target='';}
      nodesSelected.clear();selected=null;api.rebuild();api.sync();api.save();viewport.focus({preventScroll:true});info.textContent='Узлы удалены. Отмена: Ctrl+Z / Cmd+Z.';
    }
    function refresh(){
      const entries=api.edges();if(selected&&!entries.some(e=>e[0]===selected))selected=null;
      list.replaceChildren(new Option('Выберите связь…',''));for(const [key,to]of entries)list.add(new Option(label(key,to),key));list.value=selected||'';remove.disabled=!selected;apply();
      const rs=rects(),count=rs.reduce((sum,a,i)=>sum+rs.slice(i+1).filter(b=>overlaps(a,b,0)).length,0);arrange.textContent='Навести порядок';arrange.dataset.overlaps=String(count);
      const current=new Set(layer.querySelectorAll('.fl-node'));for(const el of observed)if(!current.has(el)){observer.unobserve(el);observed.delete(el);}for(const el of current)if(!observed.has(el)){observer.observe(el);observed.add(el);}
      const ids=new Set([...current].map(el=>el.dataset.id));nodesSelected=new Set([...nodesSelected].filter(id=>ids.has(id)));paintSelection();
    }
    function repair(all=false,ids=[],hasSnapshot=false){
      const rs=rects(),chosen=new Set(ids),occupied=[],changes=[];
      // Keep every untouched card fixed; only the requested new cards move.
      for(const r of rs)if(!chosen.has(r.id))occupied.push(r);
      if(all){occupied.length=0;const conflicts=[];for(const r of rs){if(occupied.some(b=>overlaps(r,b,0)))conflicts.push(r);else occupied.push(r);}for(const r of conflicts){const next=place(r,occupied);occupied.push(next);if(next.x!==r.x||next.y!==r.y)changes.push(next);}}
      else for(const r of rs.filter(r=>chosen.has(r.id))){const next=place(r,occupied);occupied.push(next);if(next.x!==r.x||next.y!==r.y)changes.push(next);}
      if(changes.length){if(!hasSnapshot)api.snapshot();for(const c of changes){const o=api.pos(c.id);o.x=c.x;o.y=c.y;const el=layer.querySelector(`[data-id="${c.id}"]`);el.style.left=c.x+'px';el.style.top=c.y+'px';}api.save();api.draw();}
      refresh();if(all)info.textContent=changes.length?'Раскладка исправлена. Отмена: Ctrl+Z.':'Наложений нет.';return changes.length;
    }
    function arrangeGraph(){
      cancel();
      const current=rects(),positions=tidy(current,api.edges());
      const changes=positions.filter((p,i)=>p.x!==current[i].x||p.y!==current[i].y);
      if(changes.length){
        api.snapshot();
        for(const p of changes){const state=api.pos(p.id),el=layer.querySelector(`[data-id="${p.id}"]`);state.x=p.x;state.y=p.y;el.style.left=p.x+'px';el.style.top=p.y+'px';}
        api.draw();api.save();
      }
      refresh();info.textContent=changes.length?'Порядок наведён. Отмена: Ctrl+Z / Cmd+Z.':'Схема уже упорядочена.';
    }
    function linkTarget(){
      const r=bounds();if(pointer.x<r.left||pointer.x>r.right||pointer.y<r.top||pointer.y>r.bottom)return null;
      const direct=document.elementFromPoint(pointer.x,pointer.y)?.closest('.fl-node');
      if(direct&&!['intro','meta'].includes(direct.dataset.kind))return direct;
      let near=null,distance=25;
      for(const slot of layer.querySelectorAll('.fl-input-slot')){const a=slot.getBoundingClientRect(),d=Math.hypot(pointer.x-a.x-a.width/2,pointer.y-a.y-a.height/2);if(d<distance){near=slot.closest('.fl-node');distance=d;}}
      const over=near||document.elementFromPoint(pointer.x,pointer.y)?.closest('.fl-node');return over&&!['intro','meta'].includes(over.dataset.kind)?over:null;
    }
    function handleAt(e){
      const candidates=[];for(const el of layer.querySelectorAll('.fl-port--out,.edge-end-hit')){const a=el.getBoundingClientRect(),x=a.x+a.width/2,y=a.y+a.height/2;if(Math.abs(e.clientX-x)<=18&&Math.abs(e.clientY-y)<=18)candidates.push({el,d:Math.hypot(e.clientX-x,e.clientY-y),selected:el.dataset.reconnect===selected});}
      candidates.sort((a,b)=>Number(b.selected)-Number(a.selected)||a.d-b.d);return candidates[0]?.el;
    }
    function paintLink(){if(!link)return;const source=api.port(link.key);if(!source){cancel();return;}const r=bounds(),inside=pointer.x>=r.left&&pointer.x<=r.right&&pointer.y>=r.top&&pointer.y<=r.bottom;
      layer.querySelectorAll('.is-drop,.is-link-source,.is-port-active').forEach(el=>el.classList.remove('is-drop','is-link-source','is-port-active'));source.closest('.fl-node').classList.add('is-link-source');source.classList.add('is-port-active');
      const over=link.moved?linkTarget():null;
      if(over&&!['meta','intro'].includes(over.dataset.kind))over.classList.add('is-drop');
      const v=api.view();api.draw({a:api.localPos(source),b:over?api.inputPos(over.dataset.id,world(local(pointer),v.pan,v.zoom)):world(local(pointer),v.pan,v.zoom)});
    }
    function tick(time){if(!link)return;const dt=Math.min(32,time-(last||time));last=time;const r=bounds(),inside=link.moved&&pointer.x>=r.left&&pointer.x<=r.right&&pointer.y>=r.top&&pointer.y<=r.bottom;
      if(inside){const edge=64,speed=650,axis=(p,a,b)=>p<a+edge?(a+edge-p)/edge:p>b-edge?-(p-(b-edge))/edge:0;const s=api.view();setView({x:s.pan.x+axis(pointer.x,r.left,r.right)*speed*dt/1000,y:s.pan.y+axis(pointer.y,r.top,r.bottom)*speed*dt/1000},s.zoom);paintLink();}
      raf=requestAnimationFrame(tick);
    }
    function cancel(){if(drag?.type==='node'&&drag.moved){for(const p of drag.positions){const o=api.pos(p.id),el=layer.querySelector('[data-id="'+p.id+'"]');if(o){o.x=p.x;o.y=p.y;}if(el){el.style.left=p.x+'px';el.style.top=p.y+'px';}}}cancelAnimationFrame(raf);raf=0;last=0;drag=null;link=null;marquee.hidden=true;if(captured!==null){const id=captured;captured=null;if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}viewport.classList.remove('is-panning');layer.querySelectorAll('.is-drop,.is-link-source,.is-port-active').forEach(el=>el.classList.remove('is-drop','is-link-source','is-port-active'));api.draw();}
    function capture(e){captured=e.pointerId;viewport.setPointerCapture(e.pointerId);}
    viewport.addEventListener('pointerdown',e=>{
      if(!e.isPrimary || (e.button!==0&&e.button!==1) || drag || link)return;pointer={x:e.clientX,y:e.clientY};
      const handle=handleAt(e),endpoint=handle?.matches('[data-reconnect]')?handle:null;
      const port=handle?.matches('.fl-port--out')?handle:null;
      if((endpoint||port)&&!space&&e.button===0){e.preventDefault();capture(e);link={key:endpoint?endpoint.dataset.reconnect:port.dataset.port,start:{...pointer},moved:false};selected=null;info.textContent='Перенесите конец связи на нужную карточку. Escape — отмена.';paintLink();raf=requestAnimationFrame(tick);return;}
      const hit=e.target.closest('[data-edge]');if(hit&&!space&&!e.shiftKey){e.preventDefault();viewport.focus({preventScroll:true});nodesSelected.clear();paintSelection();const keys=[...new Set(document.elementsFromPoint(e.clientX,e.clientY).filter(el=>el.matches('.edge-hit')).map(el=>el.dataset.edge))].sort();const same=lastHit&&Math.hypot(e.clientX-lastHit.x,e.clientY-lastHit.y)<5&&JSON.stringify(keys)===lastHit.keys;const key=same?keys[(keys.indexOf(selected)+1)%keys.length]:hit.dataset.edge;lastHit={x:e.clientX,y:e.clientY,keys:JSON.stringify(keys)};select(key);capture(e);link={key,start:{...pointer},moved:false};return;}
      if(editable(e)||e.target.closest('button'))return;e.preventDefault();capture(e);const v=api.view(),node=e.target.closest('.fl-node');
      if(node&&!space&&e.button!==1){const id=node.dataset.id;viewport.focus({preventScroll:true});if(e.shiftKey){nodesSelected.has(id)?nodesSelected.delete(id):nodesSelected.add(id);paintSelection();select(null);cancel();return;}if(!nodesSelected.has(id))nodesSelected=new Set([id]);paintSelection();drag={type:'node',id:id,el:node,x:e.clientX,y:e.clientY,positions:[...nodesSelected].map(id=>({id,x:api.pos(id).x,y:api.pos(id).y})),moved:false};}
      else if(space||e.button===1){drag={type:'pan',x:e.clientX,y:e.clientY,px:v.pan.x,py:v.pan.y};viewport.classList.add('is-panning');}
      else{viewport.focus({preventScroll:true});drag={type:'marquee',start:world(local(pointer),v.pan,v.zoom),screen:{...pointer},before:new Set(nodesSelected),additive:e.shiftKey,moved:false};if(!e.shiftKey)nodesSelected.clear();paintSelection();}select(null);
    });
    window.addEventListener('pointermove',e=>{if(captured!==null&&e.pointerId!==captured)return;pointer={x:e.clientX,y:e.clientY};if(link){if(Math.hypot(pointer.x-link.start.x,pointer.y-link.start.y)>4)link.moved=true;if(link.moved&&!raf)raf=requestAnimationFrame(tick);paintLink();return;}if(!drag)return;
      if(drag.type==='marquee'){if(Math.hypot(pointer.x-drag.screen.x,pointer.y-drag.screen.y)>3){drag.moved=true;paintMarquee();}return;}
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.type==='pan')setView({x:drag.px+dx,y:drag.py+dy},api.view().zoom);
      else{if(!drag.moved&&Math.hypot(dx,dy)<3)return;if(!drag.moved){drag.moved=true;}const z=api.view().zoom;for(const p of drag.positions){const o=api.pos(p.id),el=layer.querySelector(`[data-id="${p.id}"]`);el.style.left=Math.round(p.x+dx/z)+'px';el.style.top=Math.round(p.y+dy/z)+'px';}api.draw();}
    });
    window.addEventListener('pointerup',e=>{if(captured!==null&&e.pointerId!==captured)return;if(link){const r=bounds(),inside=link.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom,over=inside?linkTarget():null;const key=link.key,moved=link.moved,v=api.view(),point=over?api.inputPos(over.dataset.id,world(local(pointer),v.pan,v.zoom)):null;cancel();if(!moved){if(api.edges().some(e=>e[0]===key))select(key);return;}if(over&&!['meta','intro'].includes(over.dataset.kind)&&point){api.snapshot();target(api.state(),key,over.dataset.id);(api.state()._boardInputSides ||= {})[key]={target:over.dataset.id,side:point.side};api.rebuild();api.sync();api.save();info.textContent='Связь создана.';}else info.textContent='Соединение отменено. Прежняя связь сохранена.';return;}if(drag?.type==='node'&&drag.moved){const end=drag.positions.map(p=>({id:p.id,x:layer.querySelector('[data-id="'+p.id+'"]').offsetLeft,y:layer.querySelector('[data-id="'+p.id+'"]').offsetTop}));const changed=end.some((p,i)=>p.x!==drag.positions[i].x||p.y!==drag.positions[i].y);for(const p of drag.positions){api.pos(p.id).x=p.x;api.pos(p.id).y=p.y;}if(changed){api.snapshot();for(const p of end){api.pos(p.id).x=p.x;api.pos(p.id).y=p.y;}api.save();}drag.moved=false;}cancel();refresh();});
    window.addEventListener('pointercancel',cancel);window.addEventListener('blur',()=>{space=false;cancel();});
    viewport.addEventListener('wheel',e=>{if(drag?.type==='node')cancel();const modified=e.ctrlKey||e.altKey||e.metaKey;if(!modified&&editable(e))return;e.preventDefault();const factor=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;if(modified||(!e.shiftKey&&e.deltaY))zoom(Math.exp(-e.deltaY*factor*.002),false,local({x:e.clientX,y:e.clientY}));else{const s=api.view();setView({x:s.pan.x-(e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX)*factor,y:s.pan.y},s.zoom);if(link)paintLink();}}, {passive:false});
    // Chromium/Firefox trackpad pinch arrives as ctrl+wheel; Safari also emits GestureEvent.
    let gestureZoom=null;
    viewport.addEventListener('gesturestart',e=>{e.preventDefault();cancel();gestureZoom=api.view().zoom;},{passive:false});
    viewport.addEventListener('gesturechange',e=>{e.preventDefault();if(gestureZoom===null)gestureZoom=api.view().zoom;const r=bounds(),anchor=Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)?local({x:e.clientX,y:e.clientY}):{x:r.width/2,y:r.height/2};if(Number.isFinite(e.scale)&&e.scale>0)zoom(gestureZoom*e.scale/api.view().zoom,false,anchor);},{passive:false});
    viewport.addEventListener('gestureend',e=>{e.preventDefault();gestureZoom=null;},{passive:false});
    window.addEventListener('keydown',e=>{if(drag&&(e.ctrlKey||e.metaKey)&&(e.code==='KeyZ'||e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();cancel();return;}if(e.key==='Escape'){if(link||drag){e.preventDefault();cancel();info.textContent='Соединение отменено.';}nodesSelected.clear();paintSelection();select(null);return;}if(editable(e)||e.target.closest('dialog')||e.target.closest('.app'))return;
      if(e.code==='Space'&&!e.target.closest('button,[role="button"]')){space=true;e.preventDefault();}
      if(e.key==='Delete'||e.key==='Backspace'){if(selected){e.preventDefault();deleteEdge();}else if(nodesSelected.size){e.preventDefault();deleteNodes();}}
    });window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
    const observed=new Set();
    viewport.addEventListener('focusin',e=>{
      if(!e.target.closest('.fl-node')||drag||link)return;
      requestAnimationFrame(()=>{
        if(document.activeElement!==e.target)return;
        const r=bounds(),a=e.target.getBoundingClientRect(),palette=document.querySelector('.node-palette-inner')?.getBoundingClientRect();
        const bottom=palette?Math.min(r.bottom,palette.top-12):r.bottom-12;
        const safeTop=r.top+document.querySelector('.editor-toolbar').offsetHeight+12;
        const dx=a.left<r.left+12?r.left+12-a.left:a.right>r.right-12?r.right-12-a.right:0;
        const dy=a.top<safeTop?safeTop-a.top:a.bottom>bottom?bottom-a.bottom:0;
        if(dx||dy){const s=api.view();setView({x:s.pan.x+dx,y:s.pan.y+dy},s.zoom);}
      });
    });
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{api.draw();refresh();});});
    new ResizeObserver(()=>{cancel();api.draw();}).observe(viewport);
    new ResizeObserver(()=>{const bars=document.querySelector('.fl-bar').offsetHeight+tools.offsetHeight;document.documentElement.style.setProperty('--author-toolbar-height',bars+'px');}).observe(tools);
    const barObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--author-toolbar-height',(document.querySelector('.fl-bar').offsetHeight+tools.offsetHeight)+'px'));barObserver.observe(document.querySelector('.fl-bar'));
    function reveal(id){const n=rects().find(r=>r.id===id);if(!n)return;const r=bounds(),z=api.view().zoom,palette=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--node-palette-height'))||60;const available=Math.max(120,r.height-palette-48);setView({x:(r.width-n.w*z)/2-n.x*z,y:Math.max(24,(available-Math.min(n.h*z,available-48))/2)-n.y*z},z);}
    refresh();return {refresh,fit,apply,repair,cancel,reveal,selected:()=>selected,connecting:()=>link?.key,notice:message=>{info.textContent=message;}};
  }
  return {world,zoomAt,overlaps,place,tidy,target,create,MIN,MAX};
});


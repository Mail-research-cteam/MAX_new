/* One-file transport. Imported HTML is parsed as data, never executed. */
window.MaxHTML = (() => {
  'use strict';
  const marker='max-html-package';
  function encode(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
  function serialize(pack,runtimeSource){
    const data=JSON.stringify(pack).replace(/</g,'\\u003c');
    const boot=('('+runtimeSource+')('+serialize.toString()+');').replace(/<\/script/gi,'<\\/script');
    return '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Автономный флоу</title>'+ 
      '<style>html,body{margin:0;height:100%;overflow:hidden}#screen{height:100%;position:relative}iframe{position:absolute;inset:0;border:0;width:100%;height:100%;background:white}</style><main id="screen"></main>'+ 
      '<script type="application/json" id="max-html-package">'+data+'</script><script>'+boot+'</script></html>';
  }
  function runtime(serialize){
    'use strict';
    const pack=JSON.parse(document.getElementById('max-html-package').textContent),files=pack.files,dec=new TextDecoder(),enc=new TextEncoder();
    const mime=p=>({'svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','gif':'image/gif','webp':'image/webp','woff':'font/woff','woff2':'font/woff2','json':'application/json','html':'text/html','js':'text/javascript','css':'text/css'})[p.split('.').pop()]||'application/octet-stream';
    const bytes=p=>Uint8Array.from(atob(files[p]),c=>c.charCodeAt(0));
    const text=p=>dec.decode(bytes(p));
    const data=p=>'data:'+mime(p)+';base64,'+files[p];
    const root='https://max-offline.invalid/';
    function path(url,base='index.html'){const u=new URL(url,new URL(base,root));return u.origin===new URL(root).origin?decodeURIComponent(u.pathname.slice(1)):null;}
    function asset(url,base){const p=path(url,base);return p&&files[p]?data(p):url;}
    let dirty=false,editor=null;
    const host=document.getElementById('screen'),frames=[];
    document.title=(pack.bundle.title||pack.bundle.id)+' — автономный флоу';
    function current(){return editor?editor():structuredClone(pack.bundle);}
    function downloaded(){dirty=false;}
    function createHTML(b){pack.bundle=b;pack.createdAt=new Date().toISOString();const json=enc.encode(JSON.stringify(b));let s='';for(let i=0;i<json.length;i+=32768)s+=String.fromCharCode(...json.subarray(i,i+32768));files['scenarios/'+b.id+'.json']=btoa(s);
      return serialize(pack,runtime.toString());}
    function download(){const b=current();const url=URL.createObjectURL(new Blob([createHTML(b)],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=b.id+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);downloaded();}
    function rewrite(source,base){
      // Static references in HTML, CSS and JS; dynamically built image paths use asset().
      for(const p of Object.keys(files).filter(p=>p.startsWith('assets/')&&!/\.(?:css|json|txt)$/.test(p)).sort((a,b)=>b.length-a.length))source=source.split(p).join(data(p));
      if(base.endsWith('.css'))source=source.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(all,q,url)=>'url("'+asset(url,base)+'")');
      return source;
    }
    const prepared=new Map();
    function page(p,search){
      let source=prepared.get(p);
      if(!source){const doc=new DOMParser().parseFromString(text(p),'text/html');
        doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(el=>el.remove());
        for(const el of doc.querySelectorAll('link[rel="stylesheet"]')){const css=path(el.getAttribute('href'),p);if(!files[css])throw Error('Нет стилей: '+css);const style=doc.createElement('style');style.textContent=rewrite(text(css),css);el.replaceWith(style);}
        for(const el of doc.querySelectorAll('script[src]')){const js=path(el.getAttribute('src'),p);if(!files[js])throw Error('Нет скрипта: '+js);el.removeAttribute('src');el.textContent=rewrite(text(js),js).replace(/<\/script/gi,'<\\/script');}
        source=rewrite('<!doctype html>'+doc.documentElement.outerHTML,p);prepared.set(p,source);
      }
      return source.replace(/<head[^>]*>/i,match=>match+'<script>window.MaxStandalone=parent.MaxOffline.bridge('+JSON.stringify(search)+','+JSON.stringify(p)+');window.MaxStandalone.setup(window);<\/script>');
    }
    function navigate(url,overlay=false){
      const u=new URL(url,root),p=path(url);
      if(!p||!files[p]||!p.endsWith('.html')){if(/^https?:/.test(url))window.open(url,'_blank','noopener,noreferrer');else alert('Страница не включена в HTML: '+url);return;}
      if(p==='bot-lpr.html'||p==='bot-employee.html'){const id=p==='bot-lpr.html'?'owner':'employee';if(id!==pack.bundle.id){alert('Этот HTML содержит только флоу «'+(pack.bundle.title||pack.bundle.id)+'». Для другого флоу скачайте отдельный HTML.');return;}navigate('index.html?scenario='+id,overlay);return;}
      if(p==='index.html'){
        if(dirty&&!overlay&&!confirm('Перейти? Нескачанные изменения останутся только в текущем сеансе.'))return;
        pack.bundle=current();
        if(!overlay){frames.splice(0).forEach(f=>f.remove());editor=null;}
      }
      const frame=document.createElement('iframe');frame.title=p;frame.srcdoc=page(p,u.search);
      host.append(frame);frames.push(frame);if(overlay)history.pushState({maxOverlay:true},'');
    }
    window.MaxOffline={bridge(search,base='index.html'){return {search,asset,download,navigate,createHTML,draftScope:location.pathname,
      chooseFile:window.showSaveFilePicker?options=>window.showSaveFilePicker(options):null,
      changed(){dirty=true;},saved:downloaded,
      register(get){editor=get;},
      bundle(){return structuredClone(pack.bundle);},
      fetch:async url=>{const p=path(typeof url==='string'?url:url.url,base);if(!p||!files[p])return new Response('Not included',{status:404});return new Response(bytes(p),{headers:{'Content-Type':mime(p)}});},
      open(url){navigate(url,true);},
      setup(win){win.document.addEventListener('keydown',e=>{if(e.key==='Escape'&&frames.length>1)history.back();});win.fetch=this.fetch;win.open=url=>{navigate(new URL(url,new URL(base,root)).href,true);return null;};win.document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.hasAttribute('download'))return;const href=a.getAttribute('href');if(!href||href.startsWith('#'))return;e.preventDefault();navigate(new URL(href,new URL(base,root)).href,true);},true);}
    };}};
    addEventListener('popstate',()=>{if(frames.length>1)frames.pop().remove();});
    addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    navigate('index.html?edit=1');
  }
  async function exportHTML(bundle,scenario){
    const b=MaxAuthor.envelope(structuredClone({...bundle,scenario}));
    if(window.MaxStandalone){window.MaxStandalone.download();return;}
    const response=await fetch('release-files.json',{cache:'no-store'});if(!response.ok)throw Error('Не загружен список ресурсов');
    const manifest=await response.json();if(!Array.isArray(manifest)||manifest.some(p=>!MaxSafety.releasePath(p))||new Set(manifest).size!==manifest.length)throw Error('Некорректный список ресурсов');
    const files={};
    for(const p of manifest.filter(p=>!p.startsWith('scenarios/')&&p!=='release-files.json'&&p!=='release-helper.json')){
      const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('Не загружен ресурс '+p);files[p]=encode(new Uint8Array(await r.arrayBuffer()));
    }
    files['scenarios/'+b.id+'.json']=encode(new TextEncoder().encode(JSON.stringify(b)));
    files['scenarios/catalog.json']=encode(new TextEncoder().encode(JSON.stringify([{id:b.id,title:b.title||b.id}])));
    const pack={format:'max-standalone',version:1,createdAt:new Date().toISOString(),bundle:b,files};
    const html=serialize(pack,runtime.toString()),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=b.id+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    MaxAuthor.status('HTML скачан. Откройте его двойным щелчком; правки сохраняйте кнопкой «Скачать HTML».');
  }
  function extract(source){
    const doc=new DOMParser().parseFromString(source,'text/html'),node=doc.getElementById(marker);
    if(!node||node.tagName!=='SCRIPT'||node.type!=='application/json')throw Error('Это не автономный HTML проекта');
    const pack=JSON.parse(node.textContent);
    if(pack.format!=='max-standalone'||pack.version!==1)throw Error('Неподдерживаемая версия HTML');
    return MaxAuthor.envelope(MaxSafety.parse(JSON.stringify(pack.bundle)));
  }
  return {exportHTML,extract};
})();

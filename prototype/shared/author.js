'use strict';
window.MaxAuthor = (() => {
  const aliases={'bot-lpr.html':'owner','bot-employee.html':'employee'};
  const prefix='max-saved:1:'+(window.MaxStandalone?'standalone:':new URL('../',document.currentScript.src).pathname)+':';
  const navigate=url=>window.MaxStandalone?window.MaxStandalone.navigate(url):location.assign(url);
  let catalog=[], fileBaseline=null, sourceMessage='',exporting=false;
  function validate(s) { return MaxSafety.validate(s); }
  function envelope(b) {
    if(!MaxSafety.record(b) || b.schemaVersion!==1 || !MaxSafety.identifier(b.id) || !Number.isInteger(b.revision) || b.revision<1) throw Error('Неподдерживаемый формат, ID или версия сценария');
    if(b.title!=null&&typeof b.title!=='string')throw Error('Название версии должно быть текстом');validate(b.scenario); return b;
  }
  async function json(url) { const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw Error('Не удалось загрузить '+url); return r.json(); }
  function status(message,error=false) { const el=document.getElementById('authorStatus');if(el){el.hidden=(!!window.MaxStandalone&&!error)||message==='Черновик сохранён в браузере';el.textContent=el.hidden?'':message;el.title=el.hidden?'':message;el.classList.toggle('author-error',error);} }
  function failure(e) { document.body.replaceChildren();const p=document.createElement('p');p.textContent='Не удалось открыть сценарий: '+e.message;document.body.append(p); }
  async function load() {
    if(window.MaxStandalone){fileBaseline=envelope(window.MaxStandalone.bundle());await MaxMessageMedia.verify(fileBaseline.scenario);const recovered=await MaxAutosave.recover(fileBaseline);if(recovered!==fileBaseline)window.MaxStandalone.changed();catalog=[{id:fileBaseline.id,title:fileBaseline.title||fileBaseline.id}];sourceMessage='Источник: автономный HTML. После правок нажмите «Скачать HTML».';return recovered;}
    catalog=await json('scenarios/catalog.json');
    if(!Array.isArray(catalog)||catalog.some(x=>!MaxSafety.record(x)||!MaxSafety.identifier(x.id)||typeof x.title!=='string')||new Set(catalog.map(x=>x.id)).size!==catalog.length)throw Error('Некорректный каталог сценариев');
    const q=new URLSearchParams(location.search), file=location.pathname.split('/').pop();
    const id=q.get('scenario')||aliases[file]||document.documentElement.dataset.scenario||'purchase';
    if(!MaxSafety.identifier(id)) throw Error('Недопустимый ID сценария');
    let stored=null;
    try { stored=localStorage.getItem(prefix+id); }catch{}
    if(stored && (q.get('saved')==='1'||/[?&]edit(=1)?(&|$)/.test(location.search))) {
     try {
      const saved=envelope(MaxSafety.parse(stored));
      await MaxMessageMedia.verify(saved.scenario);
      if(catalog.some(x=>x.id===id))fileBaseline=envelope(await json('scenarios/'+id+'.json'));
      sourceMessage='Источник: сохранённая версия браузера.';
      if(fileBaseline && JSON.stringify(fileBaseline.scenario)!==JSON.stringify(saved.scenario))sourceMessage+=' Данные файла отличаются — используйте «Файловая версия» для сравнения.';
      return saved;
     }catch(e){sourceMessage='Сохранённая версия повреждена; открывается файл. Данные браузера сохранены.';}
    }
    if(!catalog.some(x=>x.id===id)) throw Error('Сценарий не найден: '+id);
    fileBaseline=envelope(await json('scenarios/'+id+'.json'));await MaxMessageMedia.verify(fileBaseline.scenario);sourceMessage=sourceMessage||'Источник: JSON-файл. Черновик редактора хранится отдельно.';return fileBaseline;
  }
  function download(name,data,type) {
    const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function store(entries){
    const before=entries.map(([key])=>[key,localStorage.getItem(key)]),written=[];
    try{for(const [key,value]of entries){localStorage.setItem(key,value);written.push(key);}}
    catch(error){for(const [key,value]of before.reverse())if(written.includes(key)){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}throw error;}
  }
  function saveBundle(b,s) {
    const next=envelope({...b,scenario:s});
    const text=JSON.stringify(next,null,2);let stored=false;
    if(!window.MaxStandalone)try{const old=localStorage.getItem(prefix+b.id),serialized=JSON.stringify(next);store([...(old&&old!==serialized?[[prefix+'backup:'+b.id,old]]:[]),[prefix+b.id,serialized]]);stored=true;}catch{}
    download(b.id+'.json',text,'application/json');
    status(stored?'Версия сохранена в этом браузере; JSON скачан. Исходный файл не перезаписан.':'JSON скачан. Не удалось сохранить версию в браузере; сохраните скачанный файл.',!stored);
  }
  function install(b,get,replace,connect) {
    const bar=document.querySelector('.fl-bar');
    MaxAutosave.install(b,()=>envelope({...b,scenario:get()}));
    window.MaxStandalone?.register(()=>envelope({...b,scenario:get()}));
    const source=document.createElement('p');source.className='author-source';source.textContent=sourceMessage;source.setAttribute('role','note');document.querySelector('.board-tools').append(source);
    // Board owns the combined height of the author toolbar and board controls.
    const ports=()=>document.querySelectorAll('.fl-port--out').forEach(p=>{p.tabIndex=0;p.setAttribute('role','button');p.setAttribute('aria-label','Выбрать следующий шаг');p.title='Перетащите связь или нажмите Enter для выбора шага';});
    const layer=document.getElementById('flLayer');new MutationObserver(ports).observe(layer,{childList:true,subtree:true});ports();
    layer.addEventListener('keydown',event=>{
      const port=event.target.closest('.fl-port--out');if(!port||!['Enter',' '].includes(event.key))return;event.preventDefault();
      const dialog=document.createElement('dialog'),form=document.createElement('form');form.method='dialog';
      const label=document.createElement('label');label.textContent='Следующий шаг ';const select=document.createElement('select');select.add(new Option('Без связи',''));
      for(const [id,n] of Object.entries(get().nodes))select.add(new Option((n.text||n.title||n.message||n.type).slice(0,65)+' ['+id+']',id));
      const parts=port.dataset.port.split(':'),s=get(),n=parts[1]==='__intro'?s.intro:s.nodes[parts[1]];
      select.value=parts[0]==='btn'?(n.buttons[+parts[2]].target||''):(n[{auto:'auto',ok:'confirmTarget',no:'cancelTarget',target:'target'}[parts[0]]]||'');
      label.append(select);form.append(label);const apply=document.createElement('button');apply.textContent='Применить';apply.type='button';apply.onclick=()=>{connect(port.dataset.port,select.value);dialog.close();};const cancel=document.createElement('button');cancel.textContent='Отмена';form.append(apply,cancel);dialog.append(form);document.body.append(dialog);const key=port.dataset.port;dialog.onclose=()=>{dialog.remove();document.querySelector('[data-port="'+key+'"]')?.focus();};dialog.showModal();select.focus();
    });
    const label=document.createElement('span');label.id='authorStatus';label.className='author-status';label.setAttribute('role','status');label.textContent='Открыт: '+(b.title||b.id);label.hidden=!!window.MaxStandalone;bar.append(label);
    function button(title,fn){const x=document.createElement('button');x.className='fl-t';x.textContent=title;x.onclick=async()=>{try{await fn();}catch(e){status(e.message,true);}};bar.append(x);return x;}
    const select=document.createElement('select');select.className='author-select';select.setAttribute('aria-label','Сценарий');
    const choices=new Map(catalog.map(x=>[x.id,x.title]));
    if(!window.MaxStandalone)try {for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix)&&!key.startsWith(prefix+'backup:')){try{const x=envelope(JSON.parse(localStorage.getItem(key)));choices.set(x.id,x.title||x.id);}catch{}}}}catch{}
    for(const [id,title] of choices){const o=new Option(title,id);o.selected=id===b.id;select.add(o);}bar.prepend(select);
    select.onchange=()=>{navigate('index.html?scenario='+encodeURIComponent(select.value)+'&edit=1');};
    button('Сохранить версию + JSON',()=>saveBundle(b,get()));
    const jsonDownload=button('Скачать JSON',()=>{const next=envelope({...b,scenario:get()});download(b.id+'.json',JSON.stringify(next,null,2),'application/json');});jsonDownload.id='flDownloadJSON';jsonDownload.classList.add('fl-t--primary');
    if(!window.MaxStandalone)button('Новый вариант',()=>{
      const id=prompt('ID нового варианта: латинские буквы, цифры, дефис',b.id+'-variant');if(!id)return;
      if(!MaxSafety.identifier(id))throw Error('Допустимы латинские буквы, цифры, дефис и подчёркивание');
      if(choices.has(id))throw Error('Этот ID уже существует');
      const next={...b,id,revision:1,title:id,scenario:get()};envelope(next);localStorage.setItem(prefix+id,JSON.stringify(next));navigate('index.html?scenario='+encodeURIComponent(id)+'&edit=1');
    });
    const input=document.createElement('input');input.type='file';input.accept='.json,.html,application/json,text/html';input.hidden=true;bar.append(input);
    let importRequest=0;
    input.onchange=async()=>{const request=++importRequest;try{
      const file=input.files[0];if(!file)return;if(file.size>(/\.html$/i.test(file.name)?100*1024*1024:MaxSafety.MAX_BYTES))throw Error('Файл слишком большой');
      const source=await file.text();
      const next=/\.html$/i.test(file.name)?MaxHTML.extract(source):envelope(MaxSafety.parse(source));
      await MaxMessageMedia.verify(next.scenario);
      if(request!==importRequest)return;
      if(choices.has(next.id)&&!confirm('Заменить версию и черновик? Предыдущие данные будут сохранены в резервных копиях.'))return;
      if(window.MaxStandalone){if(next.id!==b.id)throw Error('В автономный файл можно импортировать только текущий флоу');replace(next.scenario);status('Импортировано. Нажмите «Скачать HTML».');return;}
      const key='max-draft:1:'+location.pathname.replace(/[^/]*$/,'')+':'+next.id+':'+next.revision,old=localStorage.getItem(prefix+next.id),draft=localStorage.getItem(key);
      store([...(old?[[prefix+'backup:'+next.id,old]]:[]),...(draft?[[key+':backup',draft]]:[]),[prefix+next.id,JSON.stringify(next)],[key,JSON.stringify(next.scenario)],[key+':base',JSON.stringify(next.scenario)]]);
      navigate('index.html?scenario='+encodeURIComponent(next.id)+'&edit=1');
    }catch(e){if(request===importRequest)status(e.message,true);}finally{if(request===importRequest)input.value='';}};
    button('Импорт JSON / HTML',()=>input.click());
    if(!window.MaxStandalone)button('Открыть сохранённую версию',()=>{navigate('index.html?scenario='+encodeURIComponent(b.id)+'&saved=1');});
    if(!window.MaxStandalone)button('Предыдущая сохранённая',()=>{const raw=localStorage.getItem(prefix+'backup:'+b.id);if(!raw)throw Error('Предыдущей сохранённой версии пока нет');const previous=envelope(JSON.parse(raw));replace(previous.scenario);status('Предыдущая версия загружена в черновик. Проверьте и сохраните.');});
    button('Файловая версия',async()=>{
      const baseline=window.MaxStandalone?fileBaseline:envelope(await json('scenarios/'+b.id+'.json'));
      if(!confirm('Загрузить данные JSON с диска в редактор? Текущие изменения можно будет отменить.'))return;
      replace(baseline.scenario);status('Файловая версия загружена в черновик. Сохранённая версия пока не заменена.');
    });
  }
  // ZIP store format: UTF-8 names, CRC32; no third-party code or network service.
  function zip(entries) {
    const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
    const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
    const put=(v,o,n,size)=>size===2?v.setUint16(o,n,true):v.setUint32(o,n,true);
    for(const [name,data] of entries){const n=enc.encode(name),d=typeof data==='string'?enc.encode(data):data;let crc=0xffffffff;for(const x of d)crc=table[(crc^x)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
      const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);put(v,0,0x04034b50);put(v,4,20,2);put(v,6,0x800,2);put(v,14,crc);put(v,18,d.length);put(v,22,d.length);put(v,26,n.length,2);h.set(n,30);chunks.push(h,d);
      const c=new Uint8Array(46+n.length),w=new DataView(c.buffer);put(w,0,0x02014b50);put(w,4,20,2);put(w,6,20,2);put(w,8,0x800,2);put(w,16,crc);put(w,20,d.length);put(w,24,d.length);put(w,28,n.length,2);put(w,42,offset);c.set(n,46);central.push(c);offset+=h.length+d.length;
    }
    const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);put(v,0,0x06054b50);put(v,8,entries.length,2);put(v,10,entries.length,2);put(v,12,size);put(v,16,offset);return new Blob([...chunks,...central,end],{type:'application/zip'});
  }
  async function exportBundle(b,s) {
    if(exporting)return;exporting=true;
    const trigger=document.getElementById('flDownload'),wasDisabled=trigger?.disabled;if(trigger)trigger.disabled=true;
    try {
      s=structuredClone(s);
      envelope({...b,scenario:s});status('Собирается комплект…');
      const manifest=await json('release-files.json');const entries=[];
      if(!Array.isArray(manifest)||manifest.some(file=>!MaxSafety.releasePath(file))||new Set(manifest).size!==manifest.length)throw Error('Некорректный список файлов ZIP');
      for(const file of manifest){const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error('Не загружен ресурс '+file);entries.push([file,new Uint8Array(await r.arrayBuffer())]);}
      const enc=new TextEncoder(),dec=new TextDecoder();
      const set=(file,data)=>{const old=entries.find(x=>x[0]===file);if(old)old[1]=enc.encode(data);else entries.push([file,enc.encode(data)]);};
      const helper=await json('release-helper.json');set('tools/preview.cjs',helper.server);set('start.cmd',helper.start);
      set('scenarios/'+b.id+'.json',JSON.stringify({...b,scenario:s},null,2));
      const list=JSON.parse(dec.decode(entries.find(x=>x[0]==='scenarios/catalog.json')[1]));if(!list.some(x=>x.id===b.id))list.push({id:b.id,title:b.title||b.id});set('scenarios/catalog.json',JSON.stringify(list));
      for(const name of ['index.html','bot-lpr.html','bot-employee.html']){const shell=dec.decode(entries.find(x=>x[0]===name)[1]);set(name,shell.replace(/<html\b/,'<html data-frozen="true"'+(name==='index.html'?' data-scenario="'+b.id+'"':'')));}
      set('release.json',JSON.stringify({createdAt:new Date().toISOString(),scenario:b.id,revision:b.revision,schemaVersion:1,baseVersion:1},null,2));
      set('ПРОЧИТАЙТЕ.txt','Распакуйте всю папку. Установите Node.js, если его нет. Дважды нажмите start.cmd. Откройте http://127.0.0.1:8000/index.html . Остановка: Ctrl+C.\nКомплект содержит свою копию общей основы и не меняется при изменении рабочего проекта.\nInter и Roboto включены локально вместе с лицензиями. Произвольные внешние URL, добавленные автором, могут требовать интернет.');
      const blob=zip(entries);download(b.id+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip',blob,'application/zip');status('Комплект ZIP скачан; шрифты включены. Распакуйте целиком.');
    }catch(e){status('Экспорт не выполнен: '+e.message,true);}
    finally{exporting=false;if(trigger)trigger.disabled=wasDisabled;}
  }
  return {load,validate,envelope,parse:MaxSafety.parse,status,failure,install,exportBundle,zip};
})();

/* File writes require an explicit browser picker gesture. No credentials or network. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxAutosave=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const INTERVAL=120000;
 function controller({get,build,notify=()=>{},lock=async(_name,run)=>run()}){
  let target=null,expected='',saved='',busy=null,generation=0;
  async function attach(handle,validate){
   if(busy)await busy;
   const content=await (await handle.getFile()).text();if(content)validate(content);
   target=handle;expected=content;saved='';generation++;notify('enabled',handle.name);
  }
  function stop(){target=null;generation++;notify('disabled');}
  function save(){
   if(busy)return busy;if(!target)return Promise.resolve(false);
   const handle=target,version=generation;let snapshot,signature;
   try{snapshot=structuredClone(get());signature=JSON.stringify(snapshot);}catch(e){stop();notify('error','Не удалось сохранить: '+e.message);return Promise.resolve(false);}
   if(signature===saved)return Promise.resolve(false);
   busy=lock('max-autosave:'+handle.name,async()=>{
    if(handle.queryPermission&&await handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Нет разрешения на запись. Выберите файл заново.');
    if(await (await handle.getFile()).text()!==expected)throw Error('Файл изменён другой программой или вкладкой. Автосохранение остановлено; скачайте копию и проверьте версии.');
    const content=await build(snapshot);
    if(version!==generation||target!==handle)return false;
    const stream=await handle.createWritable({mode:'exclusive'});
    try{await stream.write(content);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}
    expected=content;saved=signature;notify('saved',handle.name);
    if(JSON.stringify(get())===signature)notify('clean');else notify('pending',handle.name);return true;
   }).catch(e=>{if(target===handle){target=null;generation++;}notify('error',e.message);return false;}).finally(()=>{busy=null;});
   return busy;
  }
  return {attach,stop,save,active:()=>!!target};
 }
 function draftKey(id){return 'max-autosave-draft:1:'+(window.MaxStandalone?.draftScope||location.pathname)+':'+id;}
 async function recover(b){
  if(!window.MaxStandalone)return b;
  try{const raw=localStorage.getItem(draftKey(b.id));if(!raw)return b;
   const draft=JSON.parse(raw),candidate=MaxAuthor.envelope(MaxSafety.parse(JSON.stringify(draft.bundle)));
   if(candidate.id!==b.id)return b;await MaxMessageMedia.verify(candidate.scenario);
   if(JSON.stringify(candidate.scenario)!==JSON.stringify(b.scenario)&&confirm('Найден черновик с несохранёнными изменениями. Восстановить его? Отмена — открыть HTML без изменений. Черновик останется в браузере.'))return candidate;
  }catch(e){setTimeout(()=>MaxAuthor.status('Не удалось восстановить черновик: '+e.message,true),0);}
  return b;
 }
 function install(b,get){
  const standalone=window.MaxStandalone,bar=document.querySelector('.fl-bar');
  const button=document.createElement('button');button.type='button';button.id='fileAutosave';button.className='autosave-toggle';button.setAttribute('role','switch');button.setAttribute('aria-checked','false');button.setAttribute('aria-describedby','fileAutosaveStatus');
  const caption=document.createElement('span');caption.textContent='Автосохранение';const track=document.createElement('span');track.className='autosave-track';track.setAttribute('aria-hidden','true');button.append(caption,track);button.title='Выбрать файл для сохранения раз в 2 минуты';
  const label=document.createElement('span');label.id='fileAutosaveStatus';label.className='autosave-status';label.setAttribute('role','status');label.hidden=true;
  const picker=standalone?standalone.chooseFile:window.showSaveFilePicker?.bind(window);
  const build=snapshot=>standalone?standalone.createHTML(snapshot):JSON.stringify(snapshot,null,2);
  const session=controller({get,build,lock:(name,run)=>navigator.locks?navigator.locks.request(name,run):run(),notify(state,detail){
   if(state==='clean'){standalone?.saved();return;}
   button.setAttribute('aria-checked',String(state==='enabled'||state==='saved'||state==='pending'));
   label.hidden=state==='disabled';label.classList.toggle('author-error',state==='error');
   label.textContent=state==='saved'?'Сохранено в '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):state==='enabled'?'Каждые 2 минуты':state==='pending'?'Ожидает сохранения':state==='error'?detail:'';
   label.title=detail||'';
  }});
  let choosing=false,timer=null,pendingDraft=false;
  button.onclick=async()=>{
   if(choosing)return;
   if(session.active()){session.stop();return;}
   if(!picker){label.hidden=false;label.textContent='Для записи в файл откройте в Chrome или Edge. Можно использовать «Скачать HTML».';return;}
   choosing=true;button.disabled=true;
   try{
    const extension=standalone?'.html':'.json';
    const handle=await picker({suggestedName:b.id+extension,types:[{description:standalone?'Автономный HTML':'Сценарий JSON',accept:{[standalone?'text/html':'application/json']:[extension]}}]});
    await session.attach(handle,source=>{const previous=standalone?MaxHTML.extract(source):MaxAuthor.envelope(MaxSafety.parse(source));if(previous.id!==b.id)throw Error('Выбран файл другого сценария. Выберите файл '+b.id+extension);if(JSON.stringify(previous.scenario)!==JSON.stringify(get().scenario)&&!confirm('В выбранном файле другая версия сценария. Заменить её текущими изменениями редактора?'))throw new DOMException('Выбор отменён','AbortError');});
    await session.save();
   }catch(e){if(e.name!=='AbortError'){label.hidden=false;label.textContent=e.message;label.classList.add('author-error');}}
   finally{choosing=false;button.disabled=false;}
  };
  const interval=setInterval(()=>session.save(),INTERVAL);
  function draft(){if(session.active()){label.hidden=false;label.textContent='Ожидает сохранения';}clearTimeout(timer);if(!standalone)return;pendingDraft=true;
   timer=setTimeout(()=>{pendingDraft=false;try{localStorage.setItem(draftKey(b.id),JSON.stringify({bundle:get(),updatedAt:Date.now()}));}catch{label.hidden=false;label.classList.add('author-error');label.textContent='Не удалось сохранить черновик в браузере. Сохраните файл.';}},300);
  }
  window.MaxAutosaveSession={changed:draft};
  addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(interval);clearTimeout(timer);if(standalone&&pendingDraft)try{localStorage.setItem(draftKey(b.id),JSON.stringify({bundle:get(),updatedAt:Date.now()}));}catch{}});
  // File handles and permissions are deliberately not persisted between openings.
  const control=document.createElement('div');control.id='fileAutosaveControl';control.className='autosave-control';control.append(button,label);bar.append(control);return session;
 }
 return {controller,recover,install,INTERVAL};
});

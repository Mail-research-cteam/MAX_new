/* Uploaded media is embedded in scenario JSON: drafts, versions and ZIP stay portable. */
window.MaxMessageMedia=(()=>{
 'use strict';
 const LIMIT=1024*1024,MAX_SIDE=1600,TYPES=['image/png','image/jpeg','image/webp','image/gif'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function valid(image){return MaxSafety.image(image);}
 async function verify(scenario){
  const seen=new Map();for(const node of Object.values(scenario.nodes))if(node.image){
   if(!valid(node.image))throw Error('Некорректное изображение');
   let dimensions=seen.get(node.image.src);
   if(!dimensions){const img=new Image();img.src=node.image.src;try{await img.decode();}catch{throw Error('Изображение повреждено или не поддерживается.');}dimensions={width:img.naturalWidth,height:img.naturalHeight};seen.set(node.image.src,dimensions);img.removeAttribute('src');}
   if(dimensions.width!==node.image.width||dimensions.height!==node.image.height)throw Error('Размеры изображения не совпадают с данными файла.');
  }
 }
 function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Не удалось прочитать файл. Попробуйте ещё раз.'));r.readAsDataURL(file);});}
 async function readFile(file){
  const inferred={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[file.name.split('.').pop().toLowerCase()];
  const type=file.type||inferred;if(!TYPES.includes(type))throw Error('Выберите изображение PNG, JPG, WebP или GIF.');
  if(file.size>20*1024*1024)throw Error('Файл больше 20 МБ. Выберите изображение поменьше.');
  let src=await fileData(new Blob([file],{type})),img=new Image();img.src=src;
  try{await img.decode();}catch{throw Error('Не удалось открыть изображение. Проверьте файл.');}
  let width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height||width*height>40000000)throw Error('Изображение слишком большое. Уменьшите его размер.');
  if(type==='image/gif'){
   if(src.length>LIMIT)throw Error('GIF слишком большой. Выберите файл меньше 750 КБ.');
  }else if(src.length>LIMIT||Math.max(width,height)>MAX_SIDE){
   const scale=Math.min(1,MAX_SIDE/Math.max(width,height)),canvas=document.createElement('canvas');
   width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));canvas.width=width;canvas.height=height;
   canvas.getContext('2d').drawImage(img,0,0,width,height);
   for(const quality of [.9,.8,.7,.6,.5]){src=canvas.toDataURL('image/webp',quality);if(src.length<=LIMIT)break;}
   if(src.length>LIMIT)throw Error('Не удалось уменьшить изображение. Выберите файл поменьше.');
  }
  return {src,name:file.name,width,height};
 }
 function field(id,image){
  const has=valid(image),key='message-image-'+id;
  return '<div class="fl-media-field" data-media-field="'+esc(id)+'"><label class="fl-media-drop" for="'+esc(key)+'" tabindex="0" role="button" aria-label="'+(has?'Заменить картинку':'Добавить картинку')+'">'+
   (has?'<img class="fl-media-thumb" src="'+esc(image.src)+'" width="'+image.width+'" height="'+image.height+'" alt="">':'<span class="editor-icon" aria-hidden="true">'+MaxIcons.plus+'</span>')+
   '<span>'+(has?'Заменить картинку':'Добавить картинку')+'</span></label><input type="file" hidden id="'+esc(key)+'" data-media-file="'+esc(id)+'" accept="image/png,image/jpeg,image/webp,image/gif">'+
   (has?'<div class="fl-media-details"><span>'+esc(image.name||'Изображение')+'</span><button class="fl-x" type="button" data-media-remove="'+esc(id)+'" aria-label="Удалить картинку" title="Удалить картинку">'+MaxIcons.trash+'</button></div>':'')+
   '<p class="fl-media-error" id="'+esc(key)+'-error" role="alert"></p></div>';
 }
 function picture(node,id){return valid(node.image)?'<button type="button" class="message-image" data-message-image="'+esc(id)+'" aria-label="Открыть изображение"><img src="'+esc(node.image.src)+'" width="'+node.image.width+'" height="'+node.image.height+'" alt="Изображение в сообщении" draggable="false"></button>':'';}
 function installEditor(api){
  const requests=new Map();
  function error(zone,message){const p=zone.querySelector('.fl-media-error');if(p)p.textContent=message;}
  async function upload(zone,files){
   if(!files.length)return;if(files.length!==1){error(zone,'Выберите одно изображение.');return;}
   const id=zone.dataset.mediaField,node=api.getNode(id),token={};requests.set(id,token);zone.setAttribute('aria-busy','true');error(zone,'');
   try{const image=await readFile(files[0]);if(requests.get(id)!==token||api.getNode(id)!==node)return;api.commit(id,image);}
   catch(e){if(requests.get(id)===token&&api.getNode(id)===node)error(zone,e.message);}
   finally{zone.removeAttribute('aria-busy');}
  }
  api.layer.addEventListener('change',e=>{const input=e.target.closest('[data-media-file]');if(input){upload(input.closest('.fl-media-field'),input.files);input.value='';}});
  for(const event of ['dragenter','dragover','dragleave','drop'])api.layer.addEventListener(event,e=>{
   const zone=e.target.closest('[data-media-field]');if(!zone)return;e.preventDefault();e.stopPropagation();
   const drop=zone.querySelector('.fl-media-drop');
   if(event==='dragenter'||event==='dragover'){drop.classList.add('is-dragover');if(e.dataTransfer)e.dataTransfer.dropEffect='copy';}
   if(event==='dragleave'&&!zone.contains(e.relatedTarget))drop.classList.remove('is-dragover');
   if(event==='drop'){drop.classList.remove('is-dragover');upload(zone,e.dataTransfer.files);}
  });
  api.layer.addEventListener('keydown',e=>{const label=e.target.closest('.fl-media-drop');if(label&&(e.key==='Enter'||e.key===' ')){e.preventDefault();document.getElementById(label.htmlFor)?.click();}});
  api.layer.addEventListener('click',e=>{const remove=e.target.closest('[data-media-remove]');if(!remove)return;const id=remove.dataset.mediaRemove;requests.delete(id);try{api.commit(id,null);}catch(err){error(remove.closest('.fl-media-field'),err.message);}});
 }
 function installViewer(api){
  const host=document.querySelector('.app'),viewer=document.createElement('section');let opener,messageId,blocked=[];
  viewer.className='message-image-viewer';viewer.hidden=true;viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','Просмотр изображения');host.append(viewer);
  const asset=(name,section)=>{const path='assets/message-media/'+section+'/'+name+'.svg';return window.MaxStandalone?window.MaxStandalone.asset(path):path;};
  const icon=(desktop,mobile)=>'<span class="message-image-viewer__icon"><img class="media-desktop-icon" src="'+asset(desktop,'desktop')+'" alt="" width="24" height="24"><img class="media-mobile-icon" src="'+asset(mobile,'mobile')+'" alt="" width="24" height="24"></span>';
  function close(){if(viewer.hidden)return;viewer.hidden=true;viewer.replaceChildren();blocked.forEach(el=>{el.inert=false;});blocked=[];if(opener?.isConnected)opener.focus({preventScroll:true});}
  function jumpToMessage(){
   // The feed may have been rebuilt while the viewer was open. Resolve the live message.
   const target=opener?.isConnected?opener:[...api.feed.querySelectorAll('[data-message-image]')].find(el=>el.dataset.messageImage===messageId);
   close();
   if(!target?.isConnected)return;
   const bounds=api.feed.getBoundingClientRect(),rect=target.getBoundingClientRect();
   // Scroll only the chat feed; scrollIntoView could also move editor/document ancestors.
   api.feed.scrollTop+=rect.top-bounds.top-(api.feed.clientHeight-rect.height)/2;
   target.focus({preventScroll:true});
  }
  api.feed.addEventListener('click',e=>{
   const target=e.target.closest('[data-message-image]');if(!target)return;const node=api.getNode(target.dataset.messageImage);if(!valid(node?.image))return;
   const images=[...api.feed.querySelectorAll('[data-message-image]')],author=api.author(node),index=images.indexOf(target)+1;
   opener=target;messageId=target.dataset.messageImage;blocked=[...host.children].filter(el=>el!==viewer&&!el.inert);blocked.forEach(el=>{el.inert=true;});
   viewer.innerHTML='<div class="message-image-viewer__top"><span class="message-image-viewer__count">'+index+' из '+images.length+'</span><button class="message-image-viewer__close" type="button" aria-label="Закрыть изображение">'+icon('1f506','d2c6d')+'</button></div><div class="message-image-viewer__stage"><img src="'+esc(node.image.src)+'" alt="Изображение из сообщения" width="'+node.image.width+'" height="'+node.image.height+'"></div><div class="message-image-viewer__bar"><div class="message-image-viewer__author">'+(author.avatar?'<img class="message-image-viewer__avatar" src="'+esc(author.avatar)+'" alt="">':'')+'<div><strong>'+esc(author.name)+'</strong><span>'+esc(author.date+(node.time?' в '+node.time:''))+'</span></div></div><div class="message-image-viewer__actions"><button type="button" data-image-message aria-label="Перейти к сообщению"><span>Перейти к сообщению</span>'+icon('61f7b','b8e47')+'</button><button type="button" data-image-boundary aria-label="Скачать изображение"><span>Скачать</span>'+icon('8f3ca','bfeb7')+'</button></div></div>';
   viewer.inert=false;viewer.hidden=false;viewer.querySelector('.message-image-viewer__close').focus({preventScroll:true});
  });
  viewer.addEventListener('click',e=>{if(e.target.closest('.message-image-viewer__close'))close();else if(e.target.closest('[data-image-message]'))jumpToMessage();else if(e.target.closest('[data-image-boundary]'))MaxBoundary.open(e.target.closest('button'));});
  document.addEventListener('keydown',e=>{
   if(viewer.hidden||document.querySelector('.prototype-boundary:not([hidden])'))return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
   if(e.key==='Tab'){const buttons=[...viewer.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  },true);
  return {close};
 }
 return {valid,verify,readFile,field,picture,installEditor,installViewer};
})();

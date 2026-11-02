/* Validation and URL policy for files, imports and browser storage. No network calls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxSafety=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_BYTES=20*1024*1024,reserved=new Set(['__proto__','prototype','constructor','__intro','__meta']);
 const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v),identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v)&&!reserved.has(v);
 function image(value){return record(value)&&typeof value.src==='string'&&value.src.length<=1024*1024&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value.src)&&Number.isFinite(value.width)&&Number.isFinite(value.height)&&value.width>0&&value.height>0&&value.width*value.height<=40000000&&(value.name==null||typeof value.name==='string');}
 function url(value,image=false){
  if(typeof value!=='string'||!value)return '';
  if(/[\x00-\x20\x7f\\]/.test(value)||value.startsWith('//'))return '';
  if(image&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value))return value;
  try{const parsed=new URL(value,'https://prototype.invalid/base/');if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)return '';return value;}catch{return '';}
 }
 function validate(s){
  if(!record(s)||!record(s.header)||!record(s.intro)||!record(s.intro.card)||!record(s.nodes))throw Error('Нужны объекты header, intro.card и nodes');
  let count=0;function inspect(v,depth=0){if(depth>24||++count>150000)throw Error('Слишком сложные данные сценария');if(v&&typeof v==='object')for(const [key,item]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Недопустимое имя поля');inspect(item,depth+1);}else if(typeof v==='string'&&v.length>2*1024*1024)throw Error('Слишком длинное значение');}
  inspect(s);
  const nodes=Object.entries(s.nodes);if(nodes.length>1000)throw Error('Сценарий должен содержать не более 1000 узлов');
  const stringFields=['name','text','message','title','sub','caption','time','auto','target','confirmLabel','cancelLabel','confirmTarget','cancelTarget','url','repeatUrl','noteTpl','doneTpl','contactSource','status','statusMobile','statusDesktop','date'];
  function strings(o){for(const key of stringFields)if(o[key]!=null&&typeof o[key]!=='string')throw Error('Поле '+key+' должно быть текстом');}
  strings(s.header);strings(s.intro);strings(s.intro.card);
  if(s.contacts!=null&&(!Array.isArray(s.contacts)||s.contacts.length>1000))throw Error('Некорректный справочник контактов');
  const contacts=new Set();for(const c of s.contacts||[]){if(!record(c)||!identifier(c.id)||contacts.has(c.id))throw Error('Некорректный или повторяющийся ID контакта');contacts.add(c.id);strings(c);if(c.avatar!=null&&(typeof c.avatar!=='string'||(c.avatar&&!url(c.avatar,true))))throw Error('Некорректный адрес аватара');}
  for(const [id,n]of nodes){
   if(!identifier(id)||!record(n)||!['bot','user','contact','person_chat','contact_modal','modal','toast','payment','external'].includes(n.type))throw Error('Некорректный ID или тип узла');strings(n);
   if(n.buttons!=null&&(!Array.isArray(n.buttons)||n.buttons.length>200||n.buttons.some(b=>!record(b)||typeof b.label!=='string'||(b.target!=null&&typeof b.target!=='string'))))throw Error('Некорректные действия узла');
   if(n.type==='external')for(const key of ['url','repeatUrl'])if(n[key]&&!url(n[key]))throw Error('Недопустимый адрес внешней страницы');
   for(const key of ['autoDelay','successDelay','duration'])if(n[key]!=null&&n[key]!==''&&(!Number.isFinite(Number(n[key]))||Number(n[key])<0||Number(n[key])>2147483647))throw Error('Некорректная задержка');
   if(n.image!=null&&!image(n.image))throw Error('Некорректное изображение');
   for(const target of [n.auto,n.target,n.confirmTarget,n.cancelTarget,...(n.buttons||[]).map(b=>b.target)])if(target&&!Object.hasOwn(s.nodes,target))throw Error('Отсутствует целевой шаг');
  }
  if(s.intro.auto&&!Object.hasOwn(s.nodes,s.intro.auto))throw Error('Отсутствует начальный шаг');
  if(s.autoDelay!=null&&(!Number.isFinite(Number(s.autoDelay))||Number(s.autoDelay)<0))throw Error('Некорректная задержка сценария');
  return s;
 }
 function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('JSON превышает 20 МБ');return JSON.parse(text);}
 function releasePath(name){return typeof name==='string'&&name.length<240&&!/[\\\x00-\x20?#:%]/.test(name)&&!name.startsWith('/')&&name.split('/').every(p=>p&&!p.startsWith('.'))&&/\.(?:html|css|js|json|png|jpe?g|webp|gif|svg|woff2?|txt)$/i.test(name);}
 return {MAX_BYTES,record,identifier,url,image,validate,parse,releasePath};
});

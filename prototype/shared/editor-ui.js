/* Author-only toolbar presentation; existing commands remain owned by app/author. */
window.MaxEditorUI={
  organizeCards(layer){
    // Presentation only: preserve inputs, ports and delegated data attributes.
    layer.querySelectorAll('.fl-node').forEach((card,cardIndex)=>{
      const body=card.querySelector('.fl-body'),items=[...body.children];
      const type=items.find(el=>el.querySelector('[data-type]'));
      const time=items.find(el=>el.querySelector('[data-path$=".time"]'));
      const section=(name,cls)=>{const el=document.createElement('div');el.className='fl-section '+(cls||'');el.setAttribute('role','group');el.setAttribute('aria-label',name);body.append(el);return el;};
      body.replaceChildren();
      if(type)body.append(type);
      let group=section('Содержимое','fl-content-group');
      items.forEach(el=>{
        if(el===type||el===time)return;
        if(el.classList.contains('fl-lab')&&['Действия','Контакты — имя, статус, аватар'].includes(el.textContent)){
          group=section(el.textContent,el.textContent==='Действия'?'fl-buttons-group':'fl-contacts-group');
          el.classList.add('fl-group-label');
        }
        group.append(el);
      });
      // Timing remains in scenario data and the player, outside the author UI.
      card.querySelector('.fl-delay')?.remove();
      if(card.dataset.kind==='payment')card.querySelectorAll('.fl-note').forEach(el=>el.remove());
      const autoPort=card.querySelector('.fl-foot [data-port^="auto:"]');
      if(autoPort&&card.dataset.kind==='intro'){
        autoPort.closest('.fl-foot').remove();card.append(autoPort);autoPort.classList.add('fl-intro-port');
      }
      if(autoPort&&card.dataset.kind!=='intro'){
        const foot=autoPort.closest('.fl-foot'),label=foot.firstElementChild;
        foot.classList.add('fl-auto-transition');label.className='fl-auto-label';
        const glyph=this.icon('path-arrow');glyph.classList.add('fl-auto-icon');
        const copy=document.createElement('span');copy.className='fl-auto-copy';
        const title=document.createElement('span');title.className='fl-auto-title';title.textContent='Автопереход';
        const sub=document.createElement('span');sub.className='fl-auto-sub';sub.textContent='Без действия пользователя';
        copy.append(title,sub);label.replaceChildren(glyph,copy);
      }
      body.querySelectorAll('.fl-section:empty').forEach(el=>el.remove());
      body.querySelectorAll('.fl-lab').forEach((lab,i)=>{
        if(lab.classList.contains('fl-group-label'))return;
        let control=lab.nextElementSibling;
        if(!control?.matches('input,textarea,select'))return;
        const id='editor-field-'+cardIndex+'-'+i;
        control.id=id;
        const label=document.createElement('label');label.className=lab.className;label.htmlFor=id;label.textContent=lab.textContent;lab.replaceWith(label);
        control.parentElement.classList.add('fl-field');
      });
      card.querySelectorAll('input,textarea,select').forEach(el=>{
        const path=el.dataset.path||'';
        const labelled=body.querySelector('label[for="'+el.id+'"]');
        if(labelled)el.removeAttribute('aria-label');
        else {
          const match=path.match(/\.buttons\.(\d+)\.label$/);
          el.setAttribute('aria-label',match?'Подпись кнопки '+(+match[1]+1):path.endsWith('.confirmLabel')?'Подпись кнопки подтверждения':path.endsWith('.cancelLabel')?'Подпись кнопки отмены':el.placeholder||'Значение');
        }
        el.name=el.dataset.path||el.dataset.delayNode||el.dataset.type||el.id;
        el.autocomplete='off';
      });
      card.querySelectorAll('select.fl-sel').forEach(select=>{select.parentElement.classList.add('fl-select-field');const icon=this.icon('nav-arrow-up');icon.classList.add('fl-select-chevron');select.after(icon);});
      card.querySelectorAll('.fl-ava img').forEach(img=>{const fallback=()=>{if(!img.isConnected)return;img.replaceWith(this.icon('user'));};img.addEventListener('error',fallback,{once:true});if(img.complete&&!img.naturalWidth)fallback();});
      card.querySelectorAll('button[title]').forEach(el=>el.setAttribute('aria-label',el.title));
      card.querySelectorAll('button svg').forEach(el=>el.setAttribute('aria-hidden','true'));
      card.querySelectorAll('.fl-contacts-group>.fl-row').forEach(el=>el.classList.add('fl-contact-fields'));
      card.querySelectorAll('.fl-note').forEach((el,i)=>{
        const control=el.previousElementSibling;
        if(control?.matches('input,textarea,select')){el.id='editor-note-'+cardIndex+'-'+i;control.setAttribute('aria-describedby',el.id);}
      });
    });
  },
  icon(name){const span=document.createElement('span');span.className='editor-icon';span.setAttribute('aria-hidden','true');span.innerHTML=window.MaxIcons[name]||'';return span;},
  iconButton(button,name,label){button.replaceChildren(this.icon(name));button.classList.add('editor-icon-button');button.setAttribute('aria-label',label);button.title=label;},
  scenarioDropdown(select,context,commands=[],source=null){
    select.classList.add('editor-sr-only');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    context.classList.add('editor-dropdown-surface');
    const trigger=document.createElement('button');trigger.type='button';trigger.className='scenario-trigger fl-t editor-dropdown-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','scenarioOptions');
    const title=document.createElement('span');title.className='scenario-title';trigger.append(title,this.icon('nav-arrow-up'));
    const list=document.createElement('div');list.id='scenarioOptions';list.className='scenario-options editor-dropdown-menu';list.setAttribute('role','dialog');list.setAttribute('aria-label','Сценарии и версии');list.hidden=true;
    const close=(focus=false)=>{list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();};
    const render=()=>{title.textContent=select.selectedOptions[0]?.textContent||'';trigger.setAttribute('aria-label','Сценарий: '+title.textContent);trigger.title=title.textContent;list.replaceChildren();const options=document.createElement('div');options.setAttribute('role','listbox');options.setAttribute('aria-label','Сценарий');for(const option of select.options){const row=document.createElement('button');row.type='button';row.className='scenario-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(option.selected));row.tabIndex=-1;row.disabled=option.disabled;const text=document.createElement('span');text.textContent=option.textContent;row.append(text);if(option.selected){const marker=document.createElement('span');marker.className='scenario-selected';marker.setAttribute('aria-hidden','true');row.append(marker);}row.onclick=()=>{close(true);select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));render();};options.append(row);}list.append(options);if(commands.length){const actions=document.createElement('div');actions.setAttribute('role','group');actions.setAttribute('aria-label','Версии и файлы');commands.forEach(b=>actions.append(b));list.append(actions);}if(source)list.append(source);};
    const open=()=>{render();list.hidden=false;trigger.setAttribute('aria-expanded','true');(list.querySelector('[aria-selected=true]')||list.firstElementChild)?.focus();};
    trigger.onclick=()=>list.hidden?open():close();
    trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}if(e.key==='Escape'){e.stopPropagation();close(true);}};
    list.onkeydown=e=>{const rows=[...list.querySelectorAll('button')].filter(el=>!el.disabled),i=rows.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();rows[e.key==='Home'?0:e.key==='End'?rows.length-1:(i+(e.key==='ArrowDown'?1:rows.length-1))%rows.length]?.focus();}else if(e.key==='Tab')close(true);};
    document.addEventListener('pointerdown',e=>{if(!context.contains(e.target))close();});document.addEventListener('focusin',e=>{if(!context.contains(e.target))close();});
    select.addEventListener('change',render);new MutationObserver(render).observe(select,{childList:true,subtree:true,characterData:true});commands.forEach(b=>{b.className='scenario-option scenario-command';b.tabIndex=-1;const handler=b.onclick;b.onclick=e=>{close(true);return handler.call(b,e);};});context.append(trigger,list);render();
  },
  install(){
    // Escape preview containment; CSS confines this layer to the bot's rectangle.
    document.body.append(document.getElementById('shareModal'));
    document.addEventListener('wheel',e=>{if(document.body.classList.contains('is-editing')&&(e.ctrlKey||e.metaKey)&&e.target.closest('.app'))e.preventDefault();},{capture:true,passive:false});
    const bar=document.querySelector('.fl-bar'),flow=document.getElementById('flow');bar.classList.add('editor-toolbar');
    bar.querySelector('b')?.remove();bar.querySelectorAll('.fl-sep,.fl-grow').forEach(el=>el.remove());
    const removed=['Сохранить версию + JSON','Импорт JSON / HTML','Комплект ZIP','Открыть сохранённую версию','Предыдущая сохранённая','Файловая версия'];
    const hiddenCommands=new Set(['Сохранить версию + JSON','Импорт JSON / HTML','Открыть сохранённую версию']);
    const commands=[...bar.querySelectorAll('button')].filter(b=>removed.includes(b.textContent.trim()));commands.forEach(b=>b.remove());const source=document.querySelector('.author-source');source?.remove();
    const context=document.createElement('div');context.className='editor-context';context.append(bar.querySelector('.author-select'));
    const modes=document.createElement('div');modes.className='editor-segments';modes.setAttribute('role','radiogroup');modes.setAttribute('aria-label','Отображение редактора');
    const options=[...bar.querySelectorAll('[data-view]')];
    function activate(button){options.forEach(b=>{const on=b===button;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});}
    options.forEach(b=>{b.setAttribute('role','radio');modes.append(b);b.addEventListener('click',()=>activate(b));});activate(options.find(b=>b.classList.contains('is-on'))||options[1]);
    modes.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;options[next].focus();options[next].click();};
    const scenario=[...bar.querySelectorAll('button')].find(b=>b.textContent.trim()==='Новый вариант');
    const scenarioSelect=context.querySelector('select'),currentScenario=scenarioSelect.value,chooseScenario=scenarioSelect.onchange;
    if(scenario){scenarioSelect.add(new Option('Новый сценарий',':new:'));
    scenarioSelect.onchange=()=>{if(scenarioSelect.value===':new:'){scenarioSelect.value=currentScenario;scenario.click();}else chooseScenario();};}
    if(!window.MaxStandalone)this.scenarioDropdown(scenarioSelect,context,commands.filter(button=>!hiddenCommands.has(button.textContent.trim())));
    scenario?.remove();
    const actions=document.createElement('div');actions.className='editor-actions';
    const undo=document.getElementById('flUndo');this.iconButton(undo,'undo','Отменить — Ctrl+Z / Cmd+Z');
    const redo=document.createElement('button');redo.id='flRedo';redo.type='button';redo.className='fl-t';redo.disabled=true;this.iconButton(redo,'redo','Повторить — Ctrl+Shift+Z / Cmd+Shift+Z');
    const history=document.createElement('div');history.className='editor-history';history.setAttribute('role','group');history.setAttribute('aria-label','История изменений');history.append(undo,redo);
    document.getElementById('flReset')?.remove();
    const restart=document.getElementById('flRestart');this.iconButton(restart,'restart','Перезапустить превью');const download=document.getElementById('flDownload');download.classList.remove('fl-t--primary');download.prepend(this.icon('download'));
    const jsonDownload=document.getElementById('flDownloadJSON');jsonDownload.prepend(this.icon('download'));
    document.getElementById('flFit')?.remove();
    actions.append(restart,history,document.getElementById('fileAutosaveControl'),download,jsonDownload);const status=document.getElementById('authorStatus');status.classList.add('editor-save-status');status.title=status.textContent;
    if(window.MaxStandalone)bar.append(modes,actions,status);else bar.append(context,modes,actions,status);
    new ResizeObserver(()=>document.documentElement.style.setProperty('--editor-navigation-height',bar.offsetHeight+'px')).observe(bar);
    document.getElementById('flDraft').hidden=true;
    const palette=document.createElement('div');palette.className='node-palette';palette.setAttribute('role','toolbar');palette.setAttribute('aria-label','Добавление узлов');const inner=document.createElement('div');inner.className='node-palette-inner';palette.append(inner);
    function nodeButton(kind){const meta=MaxStepUI[kind],b=document.createElement('button');b.type='button';b.dataset.add=kind;b.className='node-type-button';b.title=meta.description;b.setAttribute('aria-label',meta.label);const glyph=MaxEditorUI.icon(meta.icon);glyph.style.color=meta.color;b.append(glyph,document.createTextNode(meta.label));return b;}
    for(const kinds of [['bot','user','contact'],['modal','payment','toast']]){const group=document.createElement('div');group.className='node-type-group';kinds.forEach(kind=>group.append(nodeButton(kind)));inner.append(group);}
    const more=document.createElement('div');more.className='node-more editor-dropdown-surface';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='node-type-button node-more-toggle editor-dropdown-trigger';toggle.append(document.createTextNode('Ещё 3'),this.icon('nav-arrow-up'));toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','nodeMoreMenu');
    const menu=document.createElement('div');menu.id='nodeMoreMenu';menu.className='node-more-menu editor-dropdown-menu';menu.setAttribute('role','menu');menu.hidden=true;
    for(const kind of ['contact_modal','person_chat','external']){const b=nodeButton(kind);b.setAttribute('role','menuitem');b.tabIndex=-1;menu.append(b);}
    const close=(focus=false)=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();};
    const open=()=>{menu.hidden=false;toggle.setAttribute('aria-expanded','true');};
    toggle.onclick=()=>menu.hidden?open():close();
    toggle.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();open();(e.key==='ArrowUp'?menu.lastElementChild:menu.firstElementChild).focus();}if(e.key==='Escape')close(true);};
    menu.onkeydown=e=>{const items=[...menu.children],i=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:items.length-1))%items.length;items[n].focus();}else if(e.key==='Tab')close(true);};
    menu.addEventListener('click',e=>{if(e.target.closest('[data-add]'))close(true);});
    document.addEventListener('pointerdown',e=>{if(!more.contains(e.target))close();});
    document.addEventListener('focusin',e=>{if(!more.contains(e.target))close();});
    more.append(toggle,menu);inner.append(more);
    document.querySelector('.fl-fab')?.remove();flow.append(palette);
    new ResizeObserver(()=>document.documentElement.style.setProperty('--node-palette-height',inner.offsetHeight+'px')).observe(inner);
    // Keep the edge picker as an accessible alternative in its contextual dialog, not a persistent toolbar.
    const list=document.getElementById('boardEdgeList'),remove=[...document.querySelectorAll('.board-tools button')].find(b=>b.textContent==='Удалить связь');
    list.hidden=true;remove.hidden=true;
    const tools=document.querySelector('.board-tools');tools.querySelectorAll('button').forEach(b=>{if(['100%','Вся схема'].includes(b.textContent))b.remove();});
    const minus=tools.querySelector('[aria-label="Уменьшить доску"]'),plus=tools.querySelector('[aria-label="Увеличить доску"]');this.iconButton(minus,'minus','Уменьшить доску');this.iconButton(plus,'plus','Увеличить доску');
    const dock=document.createElement('div');dock.className='zoom-dock';dock.setAttribute('role','group');dock.setAttribute('aria-label','Масштаб доски');dock.append(minus,document.getElementById('boardZoom'),plus);flow.append(dock);
    const info=document.querySelector('.board-info');info.classList.add('editor-sr-only');
    const arrange=document.getElementById('boardArrange');actions.insertBefore(arrange,download);
  }
};

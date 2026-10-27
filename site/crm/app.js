const API = '/functions/v1/landing-crm';
let crmKey = sessionStorage.getItem('mm-crm-key') || '';
const stageNames = {1:'Открыл лендинг',2:'Начал собирать',3:'Сформировал рацион',4:'Нажал «Оформить»',5:'Открыл оформление',6:'Начал контакты',7:'Попытался отправить',8:'Создал заявку'};
const eventNames = {landing_view:'Открыл лендинг',builder_started:'Начал собирать заказ',order_type_selected:'Выбрал тип заказа',ration_configured:'Изменил конфигурацию рациона',checkout_clicked:'Нажал «Оформить»',checkout_viewed:'Открыл оформление',contact_started:'Начал вводить контакты',submit_attempted:'Попытался отправить заявку',submit_failed:'Ошибка отправки',lead_created:'Заявка создана'};
const deviceNames = {desktop:'Компьютер',mobile:'Телефон',tablet:'Планшет',unknown:'Не определено'};
const orderTypeNames = {all:'Все направления',ration:'Готовый рацион',custom_dishes:'Выбор блюд',unknown:'Не определено'};
let lastData = null;
let selectedStage = 'all';
let selectedOrderType = 'all';
const fmtDate = (value) => value ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function summaryCard(label,value){return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`}
function configText(config={}){
  return [config.order_type === 'custom_dishes' ? 'Отдельные блюда' : config.order_type === 'ration' ? 'Рацион' : null,config.tier,config.goal,config.days ? `${config.days} дн.` : null,config.items_count ? `${config.items_count} поз.` : null,config.total_text].filter(Boolean).map(esc).join(' · ') || 'Нет конфигурации';
}
function statusText(status){return status==='converted'?'Заявка':status==='abandoned'?'Брошена':'Активна'}
function sessionOrderType(session){return session.configuration?.order_type||'unknown'}
function scopedSessions(data){return selectedOrderType==='all'?data.sessions:data.sessions.filter(session=>sessionOrderType(session)===selectedOrderType)}
function scopedEvents(data){
  if(selectedOrderType==='all') return data.events;
  const ids=new Set(scopedSessions(data).map(session=>session.session_id));
  return data.events.filter(event=>ids.has(event.session_id));
}
function renderOrderTypeStats(data){
  const variants=['all','ration','custom_dishes','unknown'];
  document.querySelector('#order-type-filters').innerHTML=variants.map(type=>{
    const sessions=type==='all'?data.sessions:data.sessions.filter(session=>sessionOrderType(session)===type);
    const sessionIds=new Set(sessions.map(session=>session.session_id));
    const leads=data.leads.filter(lead=>type==='all'||lead.order_type===type||type==='unknown'&&!lead.order_type);
    const selections=data.events.filter(event=>event.event_name==='order_type_selected'&&(type==='all'||event.payload?.order_type===type)).length;
    const converted=sessions.filter(session=>session.display_status==='converted').length;
    const conversion=sessions.length?Math.round(converted/sessions.length*1000)/10:0;
    return `<button type="button" class="order-type-card${selectedOrderType===type?' active':''}" data-order-type="${type}"><span>${esc(orderTypeNames[type])}</span><strong>${sessions.length}</strong><small>${selections} выборов · ${leads.length} заяв. · конверсия ${conversion}%</small></button>`;
  }).join('');
}
function renderFunnel(data){
  const sessions=scopedSessions(data);
  const rows=Object.entries(stageNames).map(([stage,label])=>({stage:Number(stage),label,count:sessions.filter(session=>Number(session.max_stage)>=Number(stage)).length}));
  const max=Math.max(1,...rows.map(row=>row.count));
  document.querySelector('#funnel').innerHTML=rows.map((row,index)=>{
    const previous=index?rows[index-1].count:null;
    const dropoff=previous===null?0:Math.max(0,previous-row.count);
    const conversion=previous?Math.round(row.count/previous*1000)/10:null;
    return `<div class="funnel-row"><div>${esc(row.label)}</div><div class="funnel-track"><div class="funnel-bar" style="width:${Math.max(1,row.count/max*100)}%"></div></div><div class="funnel-count">${row.count}</div><div class="drop">${dropoff?`−${dropoff}`:conversion===null?'старт':`${conversion}%`}</div></div>`;
  }).join('');
}
function dayKey(date){
  const value=new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
function renderActivityChart(data){
  const filters=[['all','Все этапы'],...Object.entries(stageNames)];
  document.querySelector('#stage-filters').innerHTML=filters.map(([stage,label])=>`<button type="button" class="stage-filter${String(selectedStage)===String(stage)?' active':''}" data-stage-filter="${esc(stage)}">${stage==='all'?'Все':`${stage}. ${esc(label)}`}</button>`).join('');
  const today=new Date(); today.setHours(0,0,0,0);
  const oldestAllowed=new Date(today); oldestAllowed.setDate(today.getDate()-29);
  const activityEvents=scopedEvents(data);
  const eventDays=activityEvents.map(event=>{const value=new Date(event.created_at);value.setHours(0,0,0,0);return value}).filter(value=>!Number.isNaN(value.getTime()));
  const earliest=eventDays.length?new Date(Math.min(...eventDays.map(value=>value.getTime()))):new Date(today);
  let start=new Date(Math.max(oldestAllowed.getTime(),earliest.getTime()));
  const minimumStart=new Date(today); minimumStart.setDate(today.getDate()-6);
  if(start>minimumStart) start=minimumStart;
  const days=[];
  for(const cursor=new Date(start);cursor<=today;cursor.setDate(cursor.getDate()+1)) days.push(new Date(cursor));
  const matching=activityEvents.filter(event=>selectedStage==='all'||Number(event.stage)===Number(selectedStage));
  const previousStage=selectedStage==='all'||Number(selectedStage)<=1?null:Number(selectedStage)-1;
  const previousMatching=previousStage===null?[]:activityEvents.filter(event=>Number(event.stage)===previousStage);
  const sessionsByDay=new Map();
  matching.forEach(event=>{
    const key=dayKey(event.created_at);
    if(!sessionsByDay.has(key)) sessionsByDay.set(key,new Set());
    sessionsByDay.get(key).add(event.session_id);
  });
  const previousSessionsByDay=new Map();
  previousMatching.forEach(event=>{
    const key=dayKey(event.created_at);
    if(!previousSessionsByDay.has(key)) previousSessionsByDay.set(key,new Set());
    previousSessionsByDay.get(key).add(event.session_id);
  });
  const rows=days.map(day=>({day,count:sessionsByDay.get(dayKey(day))?.size||0,previousCount:previousSessionsByDay.get(dayKey(day))?.size||0}));
  const max=Math.max(1,...rows.flatMap(row=>[row.count,row.previousCount]));
  const currentTotal=new Set(matching.map(event=>event.session_id)).size;
  const previousTotal=previousStage===null?null:new Set(previousMatching.map(event=>event.session_id)).size;
  const dropoff=previousTotal===null?null:Math.max(0,previousTotal-currentTotal);
  const conversion=previousTotal?Math.round(currentTotal/previousTotal*1000)/10:null;
  const selectedLabel=selectedStage==='all'?'всем этапам':`этапу ${selectedStage} «${stageNames[selectedStage]}»`;
  document.querySelector('#activity-caption').textContent=`${orderTypeNames[selectedOrderType]} · уникальные сессии по ${selectedLabel}`;
  document.querySelector('#activity-kpis').innerHTML=selectedStage==='all'
    ? summaryCard('Активных сессий',currentTotal)+summaryCard('Событий',matching.length)
    : summaryCard(`Этап ${selectedStage}`,currentTotal)+summaryCard(`Предыдущий этап ${previousStage}`,previousTotal)+summaryCard('Потеряно',dropoff)+summaryCard('Переход',conversion===null?'—':`${conversion}%`);
  document.querySelector('#activity-insight').textContent=selectedStage==='all'
    ? 'Показаны сессии, в которых было хотя бы одно отслеживаемое действие.'
    : dropoff===0
      ? `Все ${currentTotal} сесс. с предыдущего этапа дошли до выбранного. Поэтому высота столбцов может не измениться.`
      : `Между этапами ${previousStage} и ${selectedStage} потеряно ${dropoff} сесс. (${previousTotal?Math.round(dropoff/previousTotal*100):0}%).`;
  document.querySelector('#activity-chart').innerHTML=rows.map(row=>`<div class="day-column" title="${esc(row.day.toLocaleDateString('ru-RU'))}: этап ${selectedStage} — ${row.count}${previousStage===null?'':`, предыдущий — ${row.previousCount}`}"><div class="day-value">${row.count}${previousStage===null?'':` <small>/ ${row.previousCount}</small>`}</div><div class="day-track">${previousStage===null?'':`<div class="day-bar previous" style="height:${row.previousCount?Math.max(8,row.previousCount/max*100):0}%"></div>`}<div class="day-bar current" style="height:${row.count?Math.max(8,row.count/max*100):0}%"></div></div><div class="day-label">${row.day.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</div></div>`).join('');
}
function renderDeviceDetails(visitorId){
  if(!lastData) return;
  const device=lastData.devices.find(row=>row.visitor_id===visitorId);
  if(!device) return;
  const sessions=lastData.sessions.filter(row=>row.visitor_id===visitorId);
  const sessionIds=new Set(sessions.map(row=>row.session_id));
  const events=lastData.events.filter(row=>sessionIds.has(row.session_id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const leads=lastData.leads.filter(row=>sessionIds.has(row.session_id));
  const details=document.querySelector('#device-details');
  details.hidden=false;
  details.innerHTML=`<div class="details-heading"><div><span class="eyebrow">ИСТОРИЯ УСТРОЙСТВА</span><h3>${esc(visitorId.slice(0,8))}</h3></div><button class="details-close" type="button" aria-label="Закрыть">×</button></div>
    <div class="details-grid"><div><span>Тип</span><strong>${esc(device.device_types.map(type=>deviceNames[type]||type).join(', ')||deviceNames.unknown)}</strong></div><div><span>Первый визит</span><strong>${fmtDate(device.first_seen_at)}</strong></div><div><span>Последняя активность</span><strong>${fmtDate(device.last_seen_at)}</strong></div><div><span>Сессии / заявки</span><strong>${device.sessions_count} / ${device.lead_count}</strong></div></div>
    <h4>Действия</h4><div class="timeline">${events.length?events.map(event=>`<div class="timeline-row"><span class="timeline-dot"></span><div><strong>${esc(eventNames[event.event_name]||event.event_name)}</strong><div class="small">${fmtDate(event.created_at)} · ${esc(event.path)} · сессия ${esc(event.session_id.slice(0,8))}</div>${Object.keys(event.payload||{}).length?`<div class="small config">${configText(event.payload)}</div>`:''}</div></div>`).join(''):'<div class="empty">Действий пока нет</div>'}</div>
    ${leads.length?`<h4>Связанная заявка</h4>${leads.map(lead=>`<div class="linked-lead"><strong>${esc(lead.customer_name)} · ${esc(lead.phone)}</strong><span>${esc(lead.total_text||'')} · ${fmtDate(lead.created_at)}</span></div>`).join('')}`:''}`;
  details.querySelector('.details-close').addEventListener('click',()=>{details.hidden=true});
  details.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function load(){
  const notice=document.querySelector('#notice');
  notice.hidden=false; notice.className='notice'; notice.textContent='Обновляю данные…';
  try{
    if(!crmKey){
      crmKey=prompt('Введите ключ CRM:')||'';
      if(!crmKey) throw new Error('Ключ доступа не введён');
      sessionStorage.setItem('mm-crm-key',crmKey);
    }
    const response=await fetch(API,{cache:'no-store',headers:{'x-crm-key':crmKey}});
    if(response.status===401){sessionStorage.removeItem('mm-crm-key');crmKey='';throw new Error('Неверный ключ доступа')}
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!data.ok) throw new Error(data.error||'Ошибка API');
    lastData=data;
    const s=data.summary;
    document.querySelector('#summary').innerHTML=[['Устройства',s.devices],['Сессии',s.sessions],['Активные',s.active],['Брошенные',s.abandoned],['Заявки',s.leads],['Конверсия',`${s.conversion_rate}%`]].map(([a,b])=>summaryCard(a,b)).join('');
    renderOrderTypeStats(data);
    renderFunnel(data);
    renderActivityChart(data);
    document.querySelector('#device-summary').innerHTML=data.device_summary.map(row=>`<article class="device-card"><span>${esc(deviceNames[row.type]||row.type)}</span><strong>${row.devices}</strong><small>${row.sessions} сесс. · ${row.leads} заяв.</small></article>`).join('')||'<div class="empty">Устройств пока нет</div>';
    document.querySelector('#devices').innerHTML=data.devices.length?data.devices.map(device=>`<tr><td><strong>${esc(device.visitor_id.slice(0,8))}</strong><div class="small">анонимный ID</div></td><td>${esc(device.device_types.map(type=>deviceNames[type]||type).join(', ')||deviceNames.unknown)}</td><td>${device.sessions_count}<div class="small">заявок: ${device.lead_count}</div></td><td>${fmtDate(device.last_seen_at)}<div class="small"><span class="status ${esc(device.latest_status)}">${statusText(device.latest_status)}</span></div></td><td><strong>${esc(stageNames[device.max_stage]||device.last_event)}</strong><div class="small">Этап ${device.max_stage} из 8</div></td><td>${esc(device.sources.join(', ')||'direct')}</td><td><button class="detail-button" type="button" data-device="${esc(device.visitor_id)}">Действия</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Устройств пока нет</td></tr>';
    document.querySelector('#leads').innerHTML=data.leads.length?data.leads.map(lead=>`<tr><td>${fmtDate(lead.created_at)}</td><td><strong>${esc(lead.customer_name)}</strong><div class="small">${esc(lead.phone)}</div></td><td><strong>${lead.order_type==='ration'?'Готовый рацион':'Отдельные блюда'}</strong><div class="small config">${configText({order_type:lead.order_type,tier:lead.tier,goal:lead.goal,days:lead.days,meals_per_day:lead.meals_per_day})}</div></td><td>${esc(lead.fulfillment_method)}<div class="small">${esc(lead.first_date||'')}</div></td><td><strong>${esc(lead.total_text||'—')}</strong></td><td><span class="status converted">${esc(lead.crm_status)}</span></td></tr>`).join(''):`<tr><td colspan="6" class="empty">Заявок пока нет</td></tr>`;
    const incomplete=data.sessions.filter(row=>row.display_status!=='converted');
    document.querySelector('#sessions').innerHTML=incomplete.length?incomplete.map(row=>`<tr><td>${fmtDate(row.last_seen_at)}<div class="small">сессия ${esc(row.session_id.slice(0,8))}</div></td><td><button class="device-link" type="button" data-device="${esc(row.visitor_id)}">${esc(row.visitor_id.slice(0,8))}</button><div class="small">${esc(deviceNames[row.device_type]||row.device_type||deviceNames.unknown)}</div></td><td><span class="status ${esc(row.display_status)}">${statusText(row.display_status)}</span></td><td><strong>${esc(stageNames[row.max_stage]||row.last_event)}</strong><div class="small">Этап ${row.max_stage} из 8</div></td><td class="config">${configText(row.configuration)}</td><td>${esc(row.utm_source||row.source||'direct')}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">Незавершённых сессий пока нет</td></tr>`;
    document.querySelector('#generated').textContent=`Обновлено ${fmtDate(data.generated_at)}`;
    notice.hidden=true;
  }catch(error){notice.hidden=false;notice.className='notice error';notice.textContent=`Не удалось загрузить CRM: ${error.message}`}
}

document.querySelector('#refresh').addEventListener('click',load);
document.addEventListener('click',(event)=>{
  const orderTypeButton=event.target.closest('[data-order-type]');
  if(orderTypeButton){selectedOrderType=orderTypeButton.dataset.orderType;renderOrderTypeStats(lastData);renderFunnel(lastData);renderActivityChart(lastData);return}
  const stageButton=event.target.closest('[data-stage-filter]');
  if(stageButton){selectedStage=stageButton.dataset.stageFilter;renderActivityChart(lastData);return}
  const button=event.target.closest('[data-device]');
  if(button) renderDeviceDetails(button.dataset.device);
});
document.querySelector('#tracking-stages').innerHTML=Object.entries(stageNames).map(([stage,label])=>`<span><b>${stage}</b>${esc(label)}</span>`).join('');
load();
setInterval(load,30000);

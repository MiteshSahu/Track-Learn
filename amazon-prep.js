/* Amazon loop preparation: extends the existing state, notes, editor and save(). */
window.AmazonPrep = (() => {
  'use strict';
  const D = window.AMAZON_PREP_DATA;
  const weights = {NOT_STARTED:0, ATTEMPTED:15, SOLVED_WITH_HELP:35, SOLVED_INDEPENDENTLY:60, REVISED_ONCE:80, REVISED_TWICE:95, INTERVIEW_READY:100};
  const priorities = ['MUST_DO','IMPORTANT','GOOD_TO_DO','OPTIONAL'];
  const projectStates = ['NOT_STARTED','PREPARED','PRACTICED','MOCKED','INTERVIEW_READY'];
  const foundationStates = ['NOT_STARTED','LEARNED','REVISED','CAN_EXPLAIN_IN_INTERVIEW'];
  const barStates = ['No Story','Story Drafted','Practiced','Deep-Dive Ready'];
  const tabs = ['DSA','HLD','LLD','Leadership / Bar Raiser','Projects','Mocks','Recent Experience','Final Revision'];
  const topTen = [146,200,207,297,236,239,3,560,253,295];
  const textFields = ['Approach Used','Pattern Recognition','Key Insight','Common Mistake','Edge Cases','Follow-up','Alternative Approach','Time Complexity','Space Complexity','Interview Explanation'];
  let recentSection='DSA';
  let practiceQuestion='';
  let tab = 'DSA', selected = '', filters = {}, dateSelected = '', timerHandle;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical = value => String(value || '').toLowerCase().replace(/^\d+[.\s]+/,'').replace(/[^a-z0-9]/g,'');
  const canonicalURL = value => String(value || '').replace(/[?#].*$/,'').replace(/\/$/,'').toLowerCase();
  const today = () => todayStr();
  const dayNumber = date => Date.parse(date+'T12:00:00Z') / 86400000;
  const addDays = (date,n) => new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
  const avg = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  const percent = value => Math.round(value)+'%';
  const safeURL = value => /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?$/i.test(value || '') ? value : '';
  function phase(date=today()) {
    if(date<'2026-10-01') return 'Upcoming — starts 1 October';
    if(date>'2026-10-30') return 'Preparation window completed';
    if(date<'2026-10-05') return 'Phase 0 — Setup + Vacation';
    if(date<'2026-10-15') return 'Phase 1 — DSA Intensive';
    if(date<'2026-10-21') return 'Phase 2 — LLD + DSA Maintenance';
    if(date<'2026-10-28') return 'Phase 3 — Interview Simulation';
    return 'Phase 4 — Final Revision';
  }
  function legacyItems(s) {
    const items=[];
    for(const [cat,group] of Object.entries(AMAZON_CATEGORIES)) for(const q of group.questions || []) items.push({...q,url:leetcodeLink(q),key:amazonBuiltInKey(cat,q),store:'amazon'});
    for(const [cat,group] of Object.entries(DSA_CATEGORIES)) for(const title of group.questions || []) items.push({title,key:dsaBuiltInKey(cat,title),store:'dsa'});
    for(const store of ['amazon','dsa']) for(const [cat,group] of Object.entries(s[store==='amazon'?'customAmazonQuestions':'customDsaQuestions'] || {})) for(const q of group) items.push({...q,url:q.link,key:store==='amazon'?amazonCustomKey(cat,q):dsaCustomKey(cat,q),store});
    return items;
  }
  function matches(q, items) {
    const rank = item => q.num && Number(item.num || item.leetcodeNumber)===Number(q.num) ? 1 : canonical(item.title)===canonical(q.title) ? 2 : q.url && canonicalURL(item.url)===canonicalURL(q.url) ? 3 : 0;
    return items.map(item=>({...item,rank:rank(item)})).filter(i=>i.rank).sort((a,b)=>a.rank-b.rank);
  }
  function migrate(s) {
    const p=s.amazonPrep ||= {version:1};
    for(const key of ['questions','hld','lld','stories','projects','mocks','foundations','bar','calendar','final','activity','patterns','genai','practice']) p[key] ||= {};
    p.customQuestions ||= [];
    const items=legacyItems(s);
    for(const q of [...D.questions,...p.customQuestions]) {
      if(p.questions[q.id]) continue;
      const found=matches(q,items), sources=found.map(({store,key})=>({store,key}));
      const progress=found.map(i=>({done:s[i.store+'Done']?.[i.key],revisions:s[i.store+'Revisions']?.[i.key]||0,revisit:s[i.store+'Revisit']?.[i.key]}));
      const rev=Math.max(0,...progress.map(v=>v.revisions));
      const done=progress.map(v=>v.done).filter(Boolean);
      const dates=done.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      const metadata=found.map(i=>({...s[i.store+'Notes']?.[i.key],...i}));
      const previous=key=>metadata.map(m=>m[key]).find(v=>v!==undefined&&v!==null&&v!=='');
      p.questions[q.id]={status:Object.hasOwn(weights,previous('status'))?previous('status'):rev>=2?'REVISED_TWICE':rev===1?'REVISED_ONCE':done.length?'SOLVED_WITH_HELP':'NOT_STARTED',confidence:previous('confidence')||'',firstSolved:dates[0] || '',markRevision:progress.some(v=>v.revisit),sources:sources.length?sources:[{store:'amazon',key:'amazon::loop::'+q.id}]};
      for(const field of ['firstAttempt','firstSolved','lastAttempt','revision1','revision2','nextRevision',...textFields]) if(previous(field)!==undefined) p.questions[q.id][field]=previous(field);
    }
    for(const [kind,names] of [['hld',D.hld],['lld',D.lld],['stories',D.stories],['projects',D.projects]]) names.forEach((title,i)=>{p[kind][i] ||= {title};});
    D.mocks.forEach((m,i)=>{p.mocks[i] ||= {...m};});
    for(const [kind,entries] of Object.entries(D.recentTopics)) entries.forEach((entry,i)=>{
      const names=[entry.title,...entry.aliases].map(canonical);
      const existing=Object.values(p[kind]).find(r=>names.includes(canonical(r.title)));
      const r=existing || (p[kind]['recent-'+i] ||= {title:entry.title});
      r.recentExperience=true;
    });
    for(let d=1;d<=30;d++) {
      const date='2026-10-'+String(d).padStart(2,'0');
      p.calendar[date] ||= {tasks:dailyPlan(d).map((title,i)=>({id:date+'-'+i,title,done:false})),Notes:'',carry:[]};
    }
    return s;
  }
  function dailyPlan(d) {
    if(d===1) return ['Setup tracker','2 DSA — Arrays / Hashing','Start first 2 LP stories','HLD basics — 30–60 min'];
    if(d===2) return ['3 DSA — Sliding Window / Tree','HLD framework — 30–60 min','1 LP story','Vacation starts tonight'];
    if(d===3 || d===4) return ['Vacation / Light Mode — optional 30–45 min revision only'];
    if(d<=14) return [(d===5?'Resume after vacation: ':'')+'DSA — 5–7 curated problems, adjust for difficulty','HLD — 30–60 min','LP — 20–30 min',...(d===12?['Mock 1 — DSA']:[])];
    if(d<=20) return ['DSA — 2–3 questions / revisions','LLD — 2–3 hours where practical','HLD — 30–60 min','LP — 20–30 min','Project — short explanation',...(d===18?['Mock 2 — LLD + LP']:[])];
    if(d<=27) return ['Timed DSA — 2–3 familiar problems / revisions','HLD / LLD without notes','Leadership follow-ups','Project explanation',...({22:['Mock 3 — HLD + LP'],25:['Mock 4 — DSA + LP'],27:['Mock 5 — full simulation']}[d]||[])];
    return ['DSA — 3–4 familiar problems maximum; revise templates','HLD / LLD — redo 2 designs across final days','LP — review stories and follow-ups','Both projects — 20-minute whiteboard explanation'];
  }
  const prep = () => state.amazonPrep;
  const questions = () => [...D.questions,...prep().customQuestions];
  const record = q => prep().questions[q.id];
  function noteFor(q, sourceIndex=0) {
    const source=record(q).sources[sourceIndex] || record(q).sources[0];
    const notes=state[source.store+'Notes'];
    notes[source.key]=normalizeNoteObject(notes[source.key]);
    return notes[source.key];
  }
  function persist(activity=true) {if(activity) prep().activity[today()]=true; save();}
  function changeStatus(q,next,date=today()) {
    const r=record(q),old=r.status;r.status=next;
    if(next!=='NOT_STARTED') {r.firstAttempt ||= date;r.lastAttempt=date;}
    if(weights[next]>=35) r.firstSolved ||= date;
    if(next==='SOLVED_INDEPENDENTLY' && old!==next) r.nextRevision=addDays(date,3);
    if(next==='REVISED_ONCE' && old!==next) {r.revision1 ||= date;r.nextRevision=addDays(date,7);r.markRevision=false;}
    if(next==='REVISED_TWICE' && old!==next) {r.revision2 ||= date;r.nextRevision='';r.markRevision=false;}
    if(next==='INTERVIEW_READY') {r.nextRevision='';r.markRevision=false;}
    // Only explicit changes propagate; never downgrade or erase legacy history.
    for(const src of r.sources) {
      if(weights[next]>=35 && !state[src.store+'Done'][src.key]) {
        state[src.store+'Done'][src.key]=date;
        state[src.store+'Log'][date]=(state[src.store+'Log'][date]||0)+1;
      }
      if(next==='REVISED_ONCE' || next==='REVISED_TWICE') state[src.store+'Revisions'][src.key]=Math.max(state[src.store+'Revisions'][src.key]||0,next==='REVISED_TWICE'?2:1);
    }
  }
  const revisionCount = q => Math.max(record(q).revision2?2:record(q).revision1?1:0,record(q).status==='REVISED_TWICE'?2:record(q).status==='REVISED_ONCE'?1:0,...record(q).sources.map(src=>state[src.store+'Revisions'][src.key]||0));
  const due = (q,date=today()) => !!(record(q).markRevision || (record(q).nextRevision && record(q).nextRevision<=date));
  function patternStats() {
    return [...new Set(questions().map(q=>q.pattern))].map(pattern=>{
      const qs=questions().filter(q=>q.pattern===pattern), rated=qs.map(q=>+record(q).confidence).filter(Boolean);
      const pending=qs.filter(q=>q.priority==='MUST_DO' && weights[record(q).status]<35).length;
      const helped=qs.filter(q=>record(q).status==='SOLVED_WITH_HELP').length;
      return {pattern,pct:avg(qs.map(q=>weights[record(q).status]||0)),confidence:rated.length?avg(rated):null,pending,helped,due:qs.filter(q=>due(q)).length,weak:(rated.length>0 && avg(rated)<=2.5)||pending>=3||helped>=2};
    });
  }
  function designProgress(kind,r) {
    const fields=D[kind+'Fields'];
    const written=fields.filter(f=>String(r[f]||'').trim()).length/fields.length;
    return kind==='hld'? written*15+(r['Completed Once']?25:0)+(r['Redesigned Without Notes']?35:0)+(r['Mock Completed']?25:0) : written*15+(r['Core Code Written']?20:0)+(r['Redesign Attempted']?30:0)+(r['Explanation Practiced']?10:0)+(r['Mock Completed']?25:0);
  }
  function storyProgress(r) {return r['Deep Dive Practiced']?100:r['Practiced Aloud']?65:D.storyFields.slice(1).some(f=>String(r[f]||'').trim())?30:0;}
  function progress() {
    const p=prep();
    const dsa=avg(questions().map(q=>weights[record(q).status]>=35?100:0));
    const hld=avg(Object.values(p.hld).map(r=>topicDone('hld',r)?100:0));
    const lld=avg(Object.values(p.lld).map(r=>topicDone('lld',r)?100:0));
    const lp=avg(Object.values(p.stories).map(r=>topicDone('stories',r)?100:0));
    const projects=avg(Object.values(p.projects).map(r=>topicDone('projects',r)?100:0));
    const mocks=avg(Object.values(p.mocks).map(r=>topicDone('mocks',r)?100:0));
    return {dsa,hld,lld,lp,projects,mocks,overall:dsa*.4+hld*.2+lld*.15+lp*.15+(projects+mocks)*.05};
  }
  function recommend(date=today()) {
    if(date<'2026-10-01' || date>'2026-10-30') return [];
    let qs=questions().filter(q=>record(q).status!=='INTERVIEW_READY');
    if(date==='2026-10-03'||date==='2026-10-04'||date>='2026-10-21') qs=qs.filter(q=>weights[record(q).status]>=35);
    if(date>='2026-10-24') qs=qs.filter(q=>!(q.priority==='OPTIONAL'&&q.difficulty==='Hard'&&weights[record(q).status]<35));
    const rank=q=>due(q,date)&&q.priority==='MUST_DO'?0:q.topPriority&&weights[record(q).status]<35?1:q.priority==='MUST_DO'&&record(q).status==='NOT_STARTED'?2:q.priority==='MUST_DO'&&record(q).confidence&&+record(q).confidence<=2?3:q.priority==='MUST_DO'?4:q.priority==='IMPORTANT'?5:6;
    return qs.sort((a,b)=>rank(a)-rank(b)).slice(0,date==='2026-10-03'||date==='2026-10-04'?1:date>='2026-10-15'?3:date<'2026-10-05'?date==='2026-10-01'?2:3:6);
  }
  const button=(text,action,extra='')=>`<button type="button" class="btn small secondary" data-action="${action}" ${extra}>${esc(text)}</button>`;
  const badge=text=>`<span class="ap-badge">${esc(text)}</span>`;
  const link=q=>safeURL(q.url)?`<a class="btn small secondary" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">Open in LeetCode ↗</a>`:'';
  function fold(title,body) {return `<details class="ap-card ap-fold"><summary>${esc(title)}</summary>${body}</details>`;}
  function card(title,body) {
    const secondary=['Interview Ready checklist','Existing notes & saved code','Attempt History','HLD standard framework','LLD standard framework','HLD foundation checklist','Bar Raiser readiness'];
    return secondary.includes(title)||D.projects.includes(title)?fold(title,body):`<section class="ap-card"><h3>${esc(title)}</h3>${body}</section>`;
  }
  function dsaActivityLog() {
    const log={};
    for(const q of questions()) {
      const r=record(q);if(weights[r.status]<35)continue;
      // A question shared by the old DSA/Amazon trackers contributes only once.
      const dates=r.sources.map(src=>state[src.store+'Done'][src.key]).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')).sort();
      const date=dates[0] || r.firstSolved;
      if(/^\d{4}-\d{2}-\d{2}$/.test(date||''))log[date]=(log[date]||0)+1;
    }
    return log;
  }
  function summaryHTML() {
    const qs=questions(),solved=qs.filter(q=>weights[record(q).status]>=35),pct=solved.length/qs.length*100;
    return `<div class="dsa-summary ap-summary"><div class="donut-card dsa-donut-card"><div class="donut-wrap" style="--easy:${solved.filter(q=>q.difficulty==='Easy').length/qs.length*100};--medium:${solved.filter(q=>q.difficulty==='Medium').length/qs.length*100};--hard:${solved.filter(q=>q.difficulty==='Hard').length/qs.length*100};--solved:${pct}"><div class="donut"></div><div class="donut-center"><div><b>${solved.length}<span class="denom">/${qs.length}</span></b><span>✓ Solved</span></div></div></div><div class="donut-sub">${qs.length-solved.length} Remaining</div><div class="difficulty-stack">${['Easy','Medium','Hard'].map(d=>`<div class="difficulty-tile ${d.toLowerCase()}"><b>${d}</b><span>${solved.filter(q=>q.difficulty===d).length}/${qs.filter(q=>q.difficulty===d).length}</span></div>`).join('')}</div></div><div class="heatmap-card"><h3>Daily Activity</h3><div class="heatmap-shell"><div class="heatmap-wrap"><div class="heatmap-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div><div class="heatmap" id="apHeatmap"></div></div></div><div class="legend">Less ${[0,1,2,3,4].map(i=>`<div class="cell" style="background:var(--grid${i})"></div>`).join('')} More</div></div><div class="weekly-card"><h3 id="ap-solved-today">Solved Today: ${dsaActivityLog()[today()]||0}</h3><div class="view-desc" style="margin:0">Last 30 days · drag sideways to browse</div><div class="weekly-chart" id="apWeeklyChart"></div></div><div class="topic-chart-card"><h3>Preparation progress</h3>${Object.entries(progress()).filter(([k])=>['dsa','hld','lld','lp'].includes(k)).map(([k,v])=>`<div class="topic-bar-row"><div class="tname">${k==='lp'?'Leadership':k.toUpperCase()}</div><div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div><div class="bval">${percent(v)}</div></div>`).join('')}<div class="ap-summary-footer">${qs.filter(q=>due(q)).length} revision due · ${qs.filter(q=>record(q).status==='INTERVIEW_READY').length} interview ready</div></div></div>`;
  }
  function field(label,key,value='',type='text',options=null) {
    let input;
    if(options) input=`<select data-field="${esc(key)}">${options.map(v=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(v || 'Not rated')}</option>`).join('')}</select>`;
    else if(type==='checkbox') input=`<input data-field="${esc(key)}" type="checkbox" ${value?'checked':''}>`;
    else if(type==='textarea') input=`<textarea data-field="${esc(key)}" rows="3">${esc(value)}</textarea>`;
    else input=`<input data-field="${esc(key)}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}>`;
    return `<label class="ap-field ${type==='checkbox'?'ap-check':''}"><span>${esc(label)}</span>${input}</label>`;
  }
  const confidence=(r,key='confidence')=>field('Confidence (1–5)',key,r[key]||'','select',['',1,2,3,4,5]);
  function bindFields(root,r,after) {
    root.querySelectorAll('[data-field]').forEach(el=>{el.onchange=()=>{
      if(!el.reportValidity()) return;
      const value=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?'':Number(el.value)):el.value;
      if(after && after(el.dataset.field,value)===false) return;
      r[el.dataset.field]=value;persist();showSaved();
    };});
  }
  function showSaved(message='Saved') {const el=document.getElementById('ap-save-status');if(el) el.textContent=message;}
  function remainingSummaryHTML() {
    const days=Math.max(0,Math.ceil(dayNumber('2026-10-30')-dayNumber(today())));
    const qs=questions(),left=qs.filter(q=>weights[record(q).status]<35);
    const items=[['days','Days remaining',days,'Until 30 Oct 2026'],['dsa','DSA left',left.length,left.filter(q=>q.priority==='MUST_DO').length+' MUST_DO remaining'],...['hld','lld','stories'].map(kind=>{const records=Object.values(prep()[kind]);return [kind,kind==='stories'?'Leadership left':kind.toUpperCase()+' left',records.filter(r=>!topicDone(kind,r)).length,'of '+records.length+' '+(kind==='stories'?'stories':'topics')];})];
    return items.map(([key,label,value,hint])=>`<div class="ap-remaining-item"><span>${label}</span><strong data-remaining="${key}">${value}</strong><small>${esc(hint)}</small></div>`).join('');
  }
  function updateRemainingSummary() {const el=document.getElementById('ap-remaining');if(el)el.innerHTML=remainingSummaryHTML();}
  function render() {
    migrate(state);
    clearInterval(timerHandle);
    const p=prep();
    // Seed only into the existing persistence envelope. Safe to repeat after remote loads.
    persist(false);
    const main=document.getElementById('mainArea');
    main.innerHTML=`<div class="view active ap" id="amazon-prep"><div class="view-header"><div><h2 class="view-title">Amazon SDE II Preparation</h2><div class="view-desc">30 October 2026 · ${Math.max(0,Math.ceil(dayNumber('2026-10-30')-dayNumber(today())))} days remaining</div></div>${!['Final Revision','Recent Experience'].includes(tab)?'<div class="view-header-actions"><button class="modal-trigger-btn" id="ap-create">+ Create</button></div>':''}</div><div class="ap-phase"><span id="ap-save-status" role="status" aria-live="polite"></span></div><section id="ap-remaining" class="ap-remaining" aria-label="Preparation remaining">${remainingSummaryHTML()}</section><nav class="ap-tabs dsa-cat-tabs" aria-label="Amazon preparation">${tabs.map(t=>`<button class="cat-btn ${t===tab?'active':''}" data-tab="${esc(t)}" aria-current="${t===tab?'page':'false'}">${esc(t)}</button>`).join('')}</nav><div id="ap-content"></div></div>`;
    const root=document.getElementById('ap-content');
    const create=document.getElementById('ap-create');if(create)create.onclick=()=>createDialog();
    main.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{tab=el.dataset.tab;selected='';render();});
    if(tab==='Overview') overview(root);
    if(tab==='DSA') dsa(root);
    if(tab==='HLD'||tab==='LLD') designs(root,tab.toLowerCase());
    if(tab==='Leadership / Bar Raiser') leadership(root);
    if(tab==='Projects') projects(root);
    if(tab==='Mocks') mocks(root);
    if(tab==='Calendar') calendar(root);
    if(tab==='Final Revision') finalRevision(root);
    if(tab==='Recent Experience') recentView(root);
    bindQuestionRows(root);
    const activity=dsaActivityLog();
    renderHeatmap(activity,'apHeatmap');
    renderWeeklyChart(activity,'apWeeklyChart');
    root.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{tab=el.dataset.go;selected='';render();});
    bindNoteFormatting();
    if(selected){const target=root.querySelector(`[data-open="${selected}"]`);selected='';if(target)target.click();}
  }
  function qRow(q) {
    const r=record(q);
    const hasNote=r.sources.some(src=>{const n=state[src.store+'Notes'][src.key];return n?.body || n?.solutions?.some(s=>s.code);});
    return `<div class="q-card ap-q ${weights[r.status]>=35?'done':''} ${r.markRevision?'revisit':''}"><div class="q-row"><input type="checkbox" data-q-done="${esc(q.id)}" aria-label="Mark ${esc(q.title)} complete" ${weights[r.status]>=35?'checked':''}><button class="ap-question qname" data-open="${esc(q.id)}">${q.num?esc(q.num)+'. ':''}${esc(q.title)}</button><span class="ap-priority ap-priority-${q.priority.toLowerCase()}">${esc(q.priority)}</span><span class="diff-cycle ${q.difficulty.toLowerCase()}" title="${esc(q.difficulty)}" aria-label="${esc(q.difficulty)}">${q.difficulty[0]}</span><button class="revisit-toggle ${r.markRevision?'active':''}" data-revisit="${esc(q.id)}">${r.markRevision?'Revisit':'Mark revisit'}</button>${q.recentExperience?badge('Recent Experience'):''}${hasNote?'<span class="note-dot">Notes saved</span>':''}${safeURL(q.url)?`<a class="ytlink" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">LeetCode ↗</a>`:''}</div><div class="q-note-panel ap-inline-panel"></div></div>`;
  }
  function tasksHTML(date,limit=99) {
    const day=prep().calendar[date];if(!day) return '<p class="ap-muted">The plan runs from 1–30 October. Open Calendar to prepare ahead.</p>';
    return day.tasks.slice(0,limit).map(t=>`<label class="ap-task"><input type="checkbox" data-task="${esc(t.id)}" data-date="${date}" ${t.done?'checked':''} ${t.carriedTo?'disabled':''}><span>${esc(t.title)}${t.carriedTo?` <small>Carried to ${esc(t.carriedTo)}</small>`:''}${t.from?` <small>Carried from ${esc(t.from)}</small>`:''}</span></label>`).join('');
  }
  function bindTasks(root) {root.querySelectorAll('[data-task]').forEach(el=>el.onchange=()=>{const t=prep().calendar[el.dataset.date].tasks.find(t=>t.id===el.dataset.task);t.done=el.checked;t.completedDate=el.checked?today():'';persist();render();});}
  function todayTopics() {
    if(!prep().calendar[today()] || today()==='2026-10-03'||today()==='2026-10-04') return '';
    const p=prep(),pick=(kind,predicate)=>Object.values(p[kind]).find(predicate)?.title;
    const rows=[['HLD Topic',pick('hld',r=>!r['Redesigned Without Notes'])],...(today()>='2026-10-15'?[['LLD Topic',pick('lld',r=>!r['Redesign Attempted'])]]:[]),['LP Story',pick('stories',r=>!r['Deep Dive Practiced'])],...(today()>='2026-10-15'?[['Project Task',pick('projects',r=>r.Status!=='INTERVIEW_READY')]]:[]),['Mock Task',Object.values(p.mocks).find(r=>r.Date===today()&&!r.Completed)?.title]];
    return '<div class="ap-today-topics">'+rows.filter(([,v])=>v).map(([k,v])=>'<p><b>'+esc(k)+':</b> '+esc(v)+'</p>').join('')+'</div>';
  }
  function overview(root) {
    const p=prep(),pr=progress(),qs=questions(),stats=patternStats();
    const overdue=Object.entries(p.calendar).filter(([d])=>d<today()).flatMap(([d,r])=>r.tasks.filter(t=>!t.done&&!t.carriedTo&&!t.title.startsWith('Vacation')).map(t=>({...t,date:d})));
    const revised=qs.filter(q=>revisionCount(q)>=1).length,solved=qs.filter(q=>weights[record(q).status]>=35).length,ready=qs.filter(q=>record(q).status==='INTERVIEW_READY').length;
    root.innerHTML=summaryHTML()+`<div class="ap-grid">${card('Today',tasksHTML(today())+button('Open Calendar','calendar','data-go="Calendar"'))}${card('Revision due',qs.filter(q=>due(q)).slice(0,3).map(qRow).join('')||'<p class="ap-muted">No revisions due.</p>')}</div>${fold('More progress & insights',`<p>${esc(phase())} · Overall ${percent(pr.overall)} · ${Object.values(p.mocks).filter(r=>r.Completed).length}/5 mocks</p><p>${solved} solved · ${revised} revised · ${ready} interview ready · ${overdue.length} overdue tasks</p>${stats.filter(s=>s.weak).map(s=>`<p>${esc(s.pattern)}: ${s.pending} core questions pending${s.confidence===null?'':' · confidence '+s.confidence.toFixed(1)+'/5'}</p>`).join('')}`)}`;
    bindTasks(root);
  }
  function filteredQuestions() {
    return questions().filter(q=>{
      const r=record(q);
      return (!filters.recent||q.recentExperience)&&(!filters.search||`${q.title} ${q.num}`.toLowerCase().includes(filters.search.toLowerCase()))&&(!filters.pattern||q.pattern===filters.pattern)&&(!filters.difficulty||q.difficulty===filters.difficulty)&&(!filters.priority||q.priority===filters.priority)&&(!filters.status||r.status===filters.status)&&(!filters.confidence||String(r.confidence)===filters.confidence)&&(!filters.amazon||q.amazonTagged)&&(!filters.top||q.topPriority)&&(!filters.due||due(q));
    }).sort((a,b)=>priorities.indexOf(a.priority)-priorities.indexOf(b.priority)||a.pattern.localeCompare(b.pattern)||a.num-b.num);
  }
  function dsa(root) {
    root.innerHTML=summaryHTML()+`<div class="ap-list-toolbar" id="ap-filters">${field('Search problems','search',filters.search)}${field('Priority','priority',filters.priority,'select',['',...priorities])}<details class="ap-filter-menu"><summary>Filters</summary><div class="ap-form">${[['pattern',[...new Set(questions().map(q=>q.pattern))]],['difficulty',['Easy','Medium','Hard']],['status',Object.keys(weights)],['confidence',[1,2,3,4,5]]].map(([key,values])=>field(key,key,filters[key],'select',['',...values])).join('')}${field('Recent Experience only','recent',filters.recent,'checkbox')}${field('Amazon Tagged only','amazon',filters.amazon,'checkbox')}${field('Top Priority only','top',filters.top,'checkbox')}${field('Revision Due only','due',filters.due,'checkbox')}</div></details>${button('Reset filters','reset')}</div><div class="dsa-cat-tabs" id="ap-pattern-tabs">${['',...new Set(questions().map(q=>q.pattern))].map(pattern=>`<button class="cat-btn ${(!filters.pattern&&!pattern)||filters.pattern===pattern?'active':''}" data-pattern="${esc(pattern)}">${esc(pattern||'All')}</button>`).join('')}</div><div class="q-list" id="ap-results"></div>`;
    root.querySelectorAll('#ap-filters select').forEach(el=>{if(el.options[0].value==='')el.options[0].textContent='All '+el.dataset.field;});
    root.querySelectorAll('[data-pattern]').forEach(el=>el.onclick=()=>{filters.pattern=el.dataset.pattern;render();});
    const results=()=>{const qs=filteredQuestions();document.getElementById('ap-results').innerHTML=`<p class="ap-muted">${qs.length} of ${questions().length} questions</p>${qs.map((q,i)=>`${i===0||qs[i-1].pattern!==q.pattern||qs[i-1].priority!==q.priority?`<h3 class="dsa-section-title ap-pattern-title">${esc(q.pattern)}</h3>`:''}${qRow(q)}`).join('')||'<p>No matching questions.</p>'}`;bindQuestionRows(root);};results();
    root.querySelectorAll('#ap-filters [data-field]').forEach(el=>{el.oninput=()=>{filters[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;results();};});
    root.querySelector('[data-action="reset"]').onclick=()=>{filters={};render();};

  }

  function createDialog() {
    const kinds={HLD:'hld',LLD:'lld','Leadership / Bar Raiser':'stories',Projects:'projects',Mocks:'mocks'};
    const kind=kinds[tab],isDSA=tab==='DSA',overlay=document.createElement('div');
    const patterns=[...new Set(questions().map(q=>q.pattern))];
    overlay.className='modal-overlay open';
    overlay.innerHTML=`<form class="modal-box" role="dialog" aria-modal="true" aria-labelledby="ap-create-title"><button type="button" class="modal-close" aria-label="Close">×</button><h3 id="ap-create-title">${isDSA?'Create DSA Question':'Create '+esc(tab==='Leadership / Bar Raiser'?'Story':tab==='Mocks'?'Mock':tab==='Projects'?'Project':tab+' Topic')}</h3><div class="modal-fields"><input class="wide" name="title" aria-label="${isDSA?'Question name':'Topic name'}" placeholder="${isDSA?'Question name':'Topic name'}" required>${isDSA?`<select name="category" aria-label="Topic">${patterns.map(p=>`<option ${filters.pattern===p?'selected':''}>${esc(p)}</option>`).join('')}</select><input class="wide" name="newCategory" aria-label="New topic" placeholder="Or create new category, e.g. Tree"><input name="num" type="number" min="1" step="1" aria-label="LeetCode number" placeholder="LeetCode number (optional)"><select name="difficulty" aria-label="Difficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select><select name="priority" aria-label="Priority">${priorities.map(p=>`<option ${p==='IMPORTANT'?'selected':''}>${p}</option>`).join('')}</select>`:''}<input class="wide" name="url" type="url" aria-label="Link" placeholder="Link (optional)"></div><p id="ap-create-error" role="status"></p><div class="modal-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button class="btn" type="submit">${isDSA?'Add Question':'Add '+(tab==='Leadership / Bar Raiser'?'Story':tab==='Projects'?'Project':tab==='Mocks'?'Mock':'Topic')}</button></div></form>`;
    document.body.appendChild(overlay);const form=overlay.querySelector('form'),previous=document.activeElement;
    const close=()=>{overlay.remove();previous?.focus();};
    overlay.querySelector('.modal-close').onclick=close;overlay.querySelector('[data-cancel]').onclick=close;
    overlay.onclick=e=>{if(e.target===overlay)close();};
    overlay.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...form.querySelectorAll('button,input,select')],first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    form.elements.title.focus();
    form.onsubmit=e=>{
      e.preventDefault();const title=form.elements.title.value.trim(),url=form.elements.url.value.trim();
      if(!title||url&&!/^https?:\/\//i.test(url)){overlay.querySelector('#ap-create-error').textContent='Enter a name and an http or https link.';return;}
      if(isDSA){
        const category=form.elements.newCategory.value.trim()||form.elements.category.value;
        const q={id:'custom-'+Date.now(),title,num:form.elements.num.value?+form.elements.num.value:'',url:safeURL(url),category,pattern:category,difficulty:form.elements.difficulty.value,priority:form.elements.priority.value,amazonTagged:false,topPriority:false};
        const existing=matches(q,questions())[0];
        if(existing){close();filters={};selected=existing.id;render();showSaved('Existing question opened.');return;}
        prep().customQuestions.push(q);migrate(state);if(url&&!q.url)noteFor(q).links.push({tag:'resource',url});selected=q.id;filters={};
      }else{
        if(Object.values(prep()[kind]).some(r=>canonical(r.title)===canonical(title))){overlay.querySelector('#ap-create-error').textContent='This topic already exists.';return;}
        prep()[kind]['custom-'+Date.now()]={title,complete:false,body:'',links:url?[{tag:'resource',url}]:[]};
      }
      persist();close();render();
    };
  }
  function bindQuestionRows(root) {
    root.querySelectorAll('.ap-q .q-row').forEach(row=>row.onclick=e=>{if(!e.target.closest('input,button,a,select'))row.querySelector('[data-open]').click();});
    root.querySelectorAll('[data-q-done]').forEach(el=>el.onchange=()=>{
      const q=questions().find(q=>q.id===el.dataset.qDone),r=record(q);
      if(el.checked) changeStatus(q,r.previousStatus&&weights[r.previousStatus]>=35?r.previousStatus:'SOLVED_WITH_HELP');
      else {r.previousStatus=r.status;r.status='NOT_STARTED';for(const src of r.sources){const date=state[src.store+'Done'][src.key];if(date&&state[src.store+'Log'][date])state[src.store+'Log'][date]=Math.max(0,state[src.store+'Log'][date]-1);delete state[src.store+'Done'][src.key];}}
      persist();render();
    });
    root.querySelectorAll('[data-revisit]').forEach(el=>el.onclick=()=>{const r=prep().questions[el.dataset.revisit];r.markRevision=!r.markRevision;for(const src of r.sources)state[src.store+'Revisit'][src.key]=r.markRevision;persist();render();});
    root.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>{
      const panel=el.closest('.q-card').querySelector('.ap-inline-panel'),wasOpen=panel.classList.contains('open');
      root.querySelectorAll('.ap-inline-panel').forEach(p=>{p.classList.remove('open');p.innerHTML='';});
      if(wasOpen)return;
      const q=questions().find(q=>q.id===el.dataset.open),n=noteFor(q);n.solutions ||= [];
      panel.classList.add('open');
      notesPanel(panel,n,'ap-question-note');
    });
  }
  function notesPanel(panel,n,id,onSave) {
    n.links ||= [];
    // Display previously saved code in the same notes editor without deleting its source.
    let body=n.body || '';
    if(!n.codeInNotes && n.solutions?.some(s=>s.code)) body=NOTE_RICH_PREFIX+noteBodyToHTML(body)+n.solutions.filter(s=>s.code).map(s=>'<div><b>'+esc(s.title||'Solution')+'</b></div><div>'+esc(s.code).replace(/\n/g,'<br>')+'</div>').join('');
    panel.innerHTML=noteEditorHTML(id,body,'Write notes, approach, or paste code...')+`<div class="link-chips"></div><div class="link-form"><input aria-label="Link tag" placeholder="Tag e.g. video" data-link-tag><input aria-label="Link URL" type="url" placeholder="Paste link" data-link-url>${button('Save Link','save-link')}</div><div class="row-actions">${button('Save Note','save-note')}${button('Add link','add-link')}${button('Expand','expand-note')}${button('Close','close-note')}</div>`;
    const saveNote=()=>{n.body=getNoteEditorBody(id);if(n.solutions?.length)n.codeInNotes=true;if(onSave)onSave(n);persist();showSaved('Note saved.');};
    const links=()=>{
      panel.querySelector('.link-chips').innerHTML=n.links.map((l,i)=>`<span class="link-chip"><span>${esc(l.tag||'link')}</span><a href="${esc(/^https?:\/\//i.test(l.url)?l.url:'#')}" target="_blank" rel="noopener noreferrer">${esc(l.url)}</a><button data-remove-link="${i}" aria-label="Remove link">x</button></span>`).join('');
      panel.querySelectorAll('[data-remove-link]').forEach(el=>el.onclick=()=>{n.links.splice(+el.dataset.removeLink,1);saveNote();links();});
    };
    links();
    panel.querySelector('[data-action="save-note"]').onclick=saveNote;
    panel.querySelector('[data-action="add-link"]').onclick=e=>{const form=panel.querySelector('.link-form');form.classList.toggle('open');e.target.textContent=form.classList.contains('open')?'Hide link':'Add link';};
    panel.querySelector('[data-action="save-link"]').onclick=()=>{const input=panel.querySelector('[data-link-url]'),url=input.value.trim();if(!/^https?:\/\//i.test(url)||!input.reportValidity()){showSaved('Enter an http or https URL.');return;}const tag=panel.querySelector('[data-link-tag]').value.trim()||'resource';if(!n.links.some(l=>l.url===url&&l.tag===tag))n.links.push({tag,url});saveNote();links();input.value='';};
    panel.querySelector('[data-action="expand-note"]').onclick=e=>{panel.classList.toggle('note-expanded');e.target.textContent=panel.classList.contains('note-expanded')?'Collapse':'Expand';};
    panel.querySelector('[data-action="close-note"]').onclick=()=>{panel.classList.remove('open');panel.innerHTML='';};
    bindNoteFormatting();
  }
  function topicDone(kind,r) {
    if(typeof r.complete==='boolean')return r.complete;
    return kind==='hld'?!!r['Completed Once']:kind==='lld'?!!r['Core Code Written']:kind==='stories'?!!r['Practiced Aloud']:kind==='projects'?['PREPARED','PRACTICED','MOCKED','INTERVIEW_READY'].includes(r.Status):!!r.Completed;
  }
  function topicNote(r) {
    if(r.body!==undefined)return r.body;
    // Keep earlier detailed answers available in the single notes editor.
    return Object.entries(r).filter(([key,value])=>typeof value==='string'&&value.trim()&&!['title','Story Title','Status','Date','Round Type'].includes(key)).map(([key,value])=>key==='Notes'?value:key+': '+value).join('\n\n');
  }
  function topicRows(root,kind,recentOnly=false) {
    const records=Object.fromEntries(Object.entries(prep()[kind]).filter(([,r])=>!recentOnly||r.recentExperience)),done=Object.values(records).filter(r=>topicDone(kind,r)).length;
    root.innerHTML=`<div class="cat-progress">${done}/${Object.keys(records).length} completed</div><div class="q-list">${Object.entries(records).map(([id,r])=>`<div class="q-card ${topicDone(kind,r)?'done':''}" data-record="${esc(id)}"><div class="q-row"><input type="checkbox" data-topic-done="${esc(id)}" aria-label="Mark ${esc(r.title)} complete" ${topicDone(kind,r)?'checked':''}><button class="ap-question qname" data-topic-open="${esc(id)}">${esc(r['Story Title']||r.title)}</button>${r.recentExperience?badge('Recent Experience'):''}${r.Date?`<span class="date-done">${esc(r.Date)}</span>`:''}${topicNote(r)?'<span class="note-dot">Notes saved</span>':''}</div><div class="q-note-panel"></div></div>`).join('')}</div>`;
    root.querySelectorAll('.q-row').forEach(row=>row.onclick=e=>{if(!e.target.closest('input,button,a,select'))row.querySelector('[data-topic-open]').click();});
    root.querySelectorAll('[data-topic-done]').forEach(el=>el.onchange=()=>{const r=records[el.dataset.topicDone];r.complete=el.checked;if(kind==='mocks')r.Completed=el.checked;persist();topicRows(root,kind,recentOnly);updateRemainingSummary();});
    root.querySelectorAll('[data-topic-open]').forEach(el=>el.onclick=()=>{
      const panel=el.closest('.q-card').querySelector('.q-note-panel'),open=panel.classList.contains('open');
      root.querySelectorAll('.q-note-panel').forEach(p=>{p.classList.remove('open');p.innerHTML='';});
      if(open)return;
      const r=records[el.dataset.topicOpen];panel.classList.add('open');
      notesPanel(panel,{body:topicNote(r),links:r.links||[]},'ap-topic-note',n=>{r.body=n.body;r.links=n.links;});
    });
  }
  function designs(root,kind) {topicRows(root,kind);}
  function leadership(root) {topicRows(root,'stories');}
  function projects(root) {topicRows(root,'projects');}
  function mocks(root) {topicRows(root,'mocks');}
  function recentView(root) {
    const sections=['DSA','Patterns','HLD','LLD','Leadership','GenAI','Practice'];
    root.innerHTML=`<p class="ap-muted">Recent Experience · your supplied preparation topics</p><div class="dsa-cat-tabs">${sections.map(t=>`<button class="cat-btn ${recentSection===t?'active':''}" data-recent-section="${t}">${t}</button>`).join('')}</div><div id="ap-recent-content"></div>`;
    root.querySelectorAll('[data-recent-section]').forEach(el=>el.onclick=()=>{recentSection=el.dataset.recentSection;render();});
    const content=root.querySelector('#ap-recent-content');
    if(recentSection==='DSA')content.innerHTML=`<div class="cat-progress">12 questions · click a row for notes</div><div class="q-list">${questions().filter(q=>q.recentExperience).sort((a,b)=>a.pattern.localeCompare(b.pattern)).map(qRow).join('')}</div>`;
    else if(recentSection==='Practice')practiceView(content);
    else topicRows(content,{Patterns:'patterns',HLD:'hld',LLD:'lld',Leadership:'stories',GenAI:'genai'}[recentSection],true);
  }
  function practiceView(root) {
    const qs=questions().filter(q=>q.recentExperience);
    practiceQuestion ||= qs[0].id;
    const q=qs.find(q=>q.id===practiceQuestion)||qs[0];
    const r=prep().practice[q.id] ||= {minutes:q.difficulty==='Hard'?40:30,seconds:0,start:null,body:'',dryRun:false,followUp:false,finished:false};
    root.innerHTML=`<section class="ap-card"><h3>Timed solve · no IDE</h3><p class="ap-muted">Plain text only. No autocomplete or execution. Pattern and previous notes stay hidden.</p><label class="ap-field">Question<select id="ap-practice-question">${qs.map(item=>`<option value="${item.id}" ${q.id===item.id?'selected':''}>${esc(item.title)}</option>`).join('')}</select></label><div class="ap-actions"><label>Minutes <input type="number" min="1" max="180" id="ap-practice-minutes" value="${r.minutes}"></label><output id="ap-practice-clock"></output>${button('Start','practice-start')}${button('Pause','practice-pause')}${button('Finish solve','practice-finish')}</div><label class="ap-field">Solution<textarea class="ap-code" id="ap-practice-body" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${esc(r.body)}</textarea></label>${field('Dry run completed','dryRun',r.dryRun,'checkbox')}${field('Follow-up handled','followUp',r.followUp,'checkbox')}${field('Dry run / edge cases','dryNotes',r.dryNotes,'textarea')}${field('Follow-up / changed constraints','followNotes',r.followNotes,'textarea')}<div class="row-actions">${button('Save practice','practice-save')}</div><p id="ap-practice-status" role="status">${r.finished?'Solve finished.':''}</p></section>`;
    const elapsed=()=>r.seconds+(r.start?(Date.now()-r.start)/1000:0);
    const tick=()=>{const output=document.getElementById('ap-practice-clock');if(!output){clearInterval(timerHandle);return;}const seconds=Math.ceil(r.minutes*60-elapsed());output.textContent=(seconds<0?'Overtime +':'')+Math.floor(Math.abs(seconds)/60)+':'+String(Math.abs(seconds)%60).padStart(2,'0');};
    const saveDraft=()=>{r.body=root.querySelector('#ap-practice-body').value;root.querySelectorAll('[data-field]').forEach(el=>r[el.dataset.field]=el.type==='checkbox'?el.checked:el.value);persist();};
    root.querySelector('#ap-practice-question').onchange=e=>{saveDraft();r.seconds=elapsed();r.start=null;persist(false);practiceQuestion=e.target.value;render();};
    root.querySelector('#ap-practice-body').oninput=saveDraft;
    root.querySelectorAll('[data-field]').forEach(el=>el.onchange=saveDraft);
    root.querySelector('#ap-practice-minutes').onchange=e=>{if(e.target.reportValidity()){r.minutes=+e.target.value;persist(false);tick();}};
    root.querySelector('[data-action="practice-start"]').onclick=()=>{r.start ||= Date.now();r.finished=false;persist(false);tick();};
    root.querySelector('[data-action="practice-pause"]').onclick=()=>{r.seconds=elapsed();r.start=null;saveDraft();tick();};
    root.querySelector('[data-action="practice-finish"]').onclick=()=>{r.seconds=elapsed();r.start=null;r.finished=true;saveDraft();tick();root.querySelector('#ap-practice-status').textContent='Solve finished. Complete your dry run and follow-up notes.';};
    root.querySelector('[data-action="practice-save"]').onclick=()=>{saveDraft();root.querySelector('#ap-practice-status').textContent='Practice saved.';};
    tick();timerHandle=setInterval(tick,500);
  }
  function calendar(root) {
    const p=prep();dateSelected ||= today()>='2026-10-01'&&today()<='2026-10-30'?today():'2026-10-01';
    const day=p.calendar[dateSelected],active=day.tasks.filter(t=>!t.carriedTo),done=active.filter(t=>t.done).length;
    root.innerHTML=card('October 2026 preparation calendar',`<p>Vacation: 2 October night → 5 October morning. 3–4 October stay intentionally light. 5 October starts DSA Intensive.</p><div class="ap-calendar">${Object.entries(p.calendar).map(([date,r])=>`<button class="ap-day ${date===dateSelected?'selected':''}" data-day="${date}"><b>${Number(date.slice(-2))}</b><small>${r.tasks.filter(t=>t.done).length}/${r.tasks.filter(t=>!t.carriedTo).length}</small></button>`).join('')}</div>`)+card(dateSelected+' · '+phase(dateSelected),`<p>${percent(active.length?done/active.length*100:0)} daily completion</p>${tasksHTML(dateSelected)}<div class="ap-actions"><input id="ap-new-task" aria-label="New planned task" placeholder="Add a planned task">${button('Add task','add-task')}</div><div class="ap-actions"><label>Carry unfinished to <input id="ap-carry-date" type="date" min="2026-10-01" max="2026-10-30" value="${dateSelected<'2026-10-30'?addDays(dateSelected,1):dateSelected}"></label>${button('Carry forward','carry')}</div><p class="ap-muted">${day.carry.map(c=>esc(c)).join(' · ')}</p><div class="ap-form" id="ap-day-fields">${field('Notes','Notes',day.Notes,'textarea')}${['Hours Studied','DSA Count','HLD Minutes','LLD Minutes','LP Minutes'].map(f=>field(f,f,day[f],'number')).join('')}${field('Mock Done','Mock Done',day['Mock Done'],'checkbox')}${field('Energy / Focus Score','Energy / Focus Score',day['Energy / Focus Score']||'','select',['',1,2,3,4,5])}</div>`);
    root.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{dateSelected=el.dataset.day;render();});bindTasks(root);bindFields(document.getElementById('ap-day-fields'),day);
    root.querySelector('[data-action="add-task"]').onclick=()=>{const input=document.getElementById('ap-new-task');if(!input.value.trim())return;day.tasks.push({id:'task-'+Date.now(),title:input.value.trim(),done:false});persist();render();};
    root.querySelector('[data-action="carry"]').onclick=()=>{
      const target=document.getElementById('ap-carry-date').value;if(!p.calendar[target]||target<=dateSelected){showSaved('Choose a later date in the preparation window.');return;}
      for(const t of day.tasks.filter(t=>!t.done&&!t.carriedTo)) {p.calendar[target].tasks.push({...t,id:t.id+'-'+target,from:dateSelected});t.carriedTo=target;day.carry.push(t.title+' → '+target);}
      persist();render();
    };
  }
  function finalRevision(root) {
    root.innerHTML=card('Final revision — 28–30 October','<p>Keep the workload light: 3–4 familiar DSA problems/day maximum. Focus on recall, explanation, and follow-ups.</p>')+Object.entries(D.final).map(([group,items])=>card(group,items.map(f=>field(f,group+': '+f,prep().final[group+': '+f],'checkbox')).join(''))).join('');bindFields(root,prep().final);
  }
  return {render,migrate,weights,phase,addDays,matches,progress,changeStatus,patternStats,recommend,filteredQuestions,due};
})();

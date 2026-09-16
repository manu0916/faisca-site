/* Faísca: local lessons with optional native account and cloud progress. */
(function () {
  'use strict';
  const C=window.FaiscaCore, curriculum=window.FAISCA_CURRICULUM, catalog=C.index(curriculum);
  const lessonTotal=Object.keys(catalog.lessons).length, questionTotal=Object.keys(catalog.questions).length;
  const app=document.getElementById('app'), modalRoot=document.getElementById('modal-root');
  const native=window.FaiscaNative, web=window.FaiscaWeb, STORAGE='faisca-progress-v1';
  const A=window.FaiscaAccount,S=window.FaiscaSync;
  let accountUI=null, classroomsManager=null, classroomsUI=null;
  const icons={
    home:'M3 10 12 3 21 10M5 9v11h5v-6h4v6h5V9',
    path:'M6 4h9a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h9M6 4h.01M18 20h.01',
    review:'M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2',
    user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    fire:'M13 2c-1 5 3 6 4 9 1-1 2-3 2-4 5 9 0 15-7 15C5 22 1 15 6 8c0 4 4 3 4 0 0-2 1-4 3-6ZM12 13c-4 4-3 7 0 7s4-3 0-7Z',
    bolt:'m13 2-9 12h7l-1 8 10-13h-7l1-7Z',
    arrow:'M4 12h15m-6-6 6 6-6 6',
    chevron:'m9 5 7 7-7 7',
    back:'M20 12H5m6-6-6 6 6 6',
    close:'m6 6 12 12M6 18 18 6',
    check:'m5 12 4 4L19 6',
    book:'M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3V4Zm9 2v15',
    lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
    bookmark:'M6 3h12v19l-6-4-6 4V3Z',
    search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
    trophy:'M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5m-4 1v5m-5 2h10',
    star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',
    target:'M21 12a9 9 0 1 1-9-9m0 5a4 4 0 1 0 4 4m-4 0 9-9m-5 0h5v5',
    cloud:'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 0 5 5 0 0 1 0 10M8 14l4 4 4-4m-4-4v11',
    upload:'M5 15v6h14v-6M12 17V3m-5 5 5-5 5 5',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7-3 2-2 3 2h4l3-2 2 2-1 3 2 3v2l-2 3 1 3-2 2-3-2h-4l-3 2-2-2 1-3-2-3v-2l2-3-1-3Z',
    info:'M12 16v-5m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    pen:'m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4',
    code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16',
    leaf:'M4 20C1 3 15 5 21 2c1 11-3 19-14 16m-3 2 11-10',
    flag:'M5 22V3m0 0c5-4 8 4 14 0v10c-6 4-9-4-14 0',
    spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
    devices:'M4 5h12v10H4V5Zm4 14h4m-2-4v4m8-9h2v9h-6v-2',
    download:'M12 3v12m-5-5 5 5 5-5M5 20h14'
  };
  function icon(name, cls='') { return '<svg class="icon '+cls+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(icons[name]||icons.code)+'"/></svg>'; }
  function esc(value) { return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  const clean=s=>s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let state=C.fresh(), storageFailed=false, recovery=false, route='home', viewCourse='python', readId='', category='Todas', search='', noteSearch='', notebookFilter='Salvos', onboardStep=0;
  let classroomTracks=null; // null = livre; array de IDs = restrito pela sala
  let draft={name:'',goal:30,course:'python'}, modalAction=null, modalPreviousFocus=null, toastTimer=null, installPrompt=null;
  let installed=!!(web&&web.platform==='desktop');
  try{installed=installed||!!(web&&window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);}catch(ignored){}
  try {
    const raw=native?native.load():localStorage.getItem(STORAGE);
    if(raw)state=C.sanitize(JSON.parse(raw),catalog);
  } catch(e) { recovery=true; }
  viewCourse=state.activeCourse;

  function save(schedule=true) {
    if(recovery)return false;
    try {
      const serialized=S?S.stringify(state):JSON.stringify(state);
      if(native) { if(!native.save(serialized,A?A.owner():'guest'))throw Error('save'); }
      else localStorage.setItem(STORAGE,serialized);
      if(schedule&&A)A.changed();
      storageFailed=false;return true;
    } catch(e) { storageFailed=true;toast('Não foi possível salvar. Exporte uma cópia do progresso em Você.');return false; }
  }
  function toast(message) {
    const box=document.getElementById('toast');box.textContent=message;box.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),4200);
  }
  const count=c=>c.lessons.filter(l=>state.completed[l.id]).length;
  const totalDone=()=>Object.keys(state.completed).length;
  const level=()=>Math.floor(state.totalXp/250)+1;
  const plural=(n,one,many)=>n+' '+(n===1?one:many);
  function language(c,size='') { return '<span class="language '+size+'" style="--tone:'+c.color+'">'+esc(c.symbol)+'</span>'; }
  function brand() { return '<button class="brand" data-action="home" aria-label="Faísca, início"><img src="art/marca.svg" alt=""><span>faísca</span><span class="brand-star">✳</span></button>'; }
  function button(label, action, extra='', classes='') { return '<button class="btn '+classes+'" data-action="'+action+'" '+extra+'>'+label+'</button>'; }
  function progress(percent) { return '<div class="meter" aria-label="'+Math.round(percent)+'% concluído"><span style="width:'+Math.max(0,Math.min(100,percent))+'%"></span></div>'; }
  function routeTitle(){return {home:'Hoje',courses:'Trilhas',course:'Trilha',review:'Revisar',profile:'Você',notebook:'Caderno',reading:'Caderno',account:'Conta e sincronização',classrooms:'Salas de aula',lesson:'Lição'}[route]||'Hoje';}
  function syncBadge(){
    const s=A&&A.status?A.status():null;
    let glyph='devices',label='Somente neste dispositivo',tone='local';
    if(s&&s.user){
      if(s.needsLogin){glyph='info';label='Entrar novamente';tone='warning';}
      else if(s.phase==='syncing'){glyph='cloud';label='Sincronizando…';tone='working';}
      else if(s.error||s.dirty||!s.lastSync){glyph='cloud';label='Alterações pendentes';tone='pending';}
      else{glyph='check';label='Sincronizado agora';tone='synced';}
    }
    return '<button class="desktop-sync sync-'+tone+'" data-action="nav" data-route="account" title="'+esc(accountUI?accountUI.syncText():label)+'">'+icon(glyph)+'<span>'+label+'</span>'+icon('chevron')+'</button>';
  }
  function refreshSyncBadge(){
    const current=document.querySelector('.desktop-sync');
    if(!current||!document.createElement)return;
    const holder=document.createElement('div');holder.innerHTML=syncBadge();current.replaceWith(holder.firstElementChild);
  }
  function header() {
    const today=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    return '<header class="header">'+brand()+'<div class="desktop-page-context"><span>'+esc(today)+'</span><strong>'+routeTitle()+'</strong></div><div class="header-status"><span class="pill orange" aria-label="'+C.streak(state)+' dias de sequência">'+icon('fire')+C.streak(state)+'</span><span class="pill" aria-label="'+state.totalXp+' XP">'+icon('bolt')+state.totalXp+' XP</span>'+syncBadge()+'</div></header>';
  }
  function nav() {
    const mobileActive=['course'].includes(route)?'courses':['notebook','reading','account','classrooms'].includes(route)?'profile':route;
    const desktopActive=route==='course'?'courses':route==='reading'?'notebook':route;
    const due=C.due(state).length;
    const items=[['home','home','Hoje'],['courses','path','Trilhas'],['review','review','Revisar'],['notebook','bookmark','Caderno'],['classrooms','book','Salas de aula']];
    const desktop='<aside class="desktop-sidebar" aria-label="Navegação principal"><div class="desktop-brand">'+brand()+'</div><div class="desktop-nav-label">Aprender</div><nav class="desktop-nav">'+items.slice(0,4).map(([name,i,label])=>'<button class="desktop-nav-item '+(desktopActive===name?'active':'')+'" data-action="nav" data-route="'+name+'" '+(desktopActive===name?'aria-current="page"':'')+'>'+icon(i)+'<span>'+label+'</span>'+(name==='review'&&due?'<b>'+due+'</b>':'')+'</button>').join('')+'</nav><div class="desktop-nav-label sharing">Compartilhar</div><nav class="desktop-nav">'+items.slice(4).map(([name,i,label])=>'<button class="desktop-nav-item '+(desktopActive===name?'active':'')+'" data-action="nav" data-route="'+name+'" '+(desktopActive===name?'aria-current="page"':'')+'>'+icon(i)+'<span>'+label+'</span></button>').join('')+'</nav><button class="desktop-profile '+(['profile','account'].includes(desktopActive)?'active':'')+'" data-action="nav" data-route="profile"><span class="desktop-avatar">'+esc((state.name||'F').slice(0,1).toUpperCase())+'</span><span><strong>'+esc(state.name||'Explorador')+'</strong><small>Nível '+level()+' · '+state.totalXp+' XP</small></span>'+icon('chevron')+'</button></aside>';
    const mobile='<nav class="bottom-nav" aria-label="Navegação principal">'+[['home','home','Hoje'],['courses','path','Trilhas'],['review','review','Revisar'],['profile','user','Você']].map(([name,i,label])=>'<button class="nav-item '+(mobileActive===name?'active':'')+'" data-action="nav" data-route="'+name+'" '+(mobileActive===name?'aria-current="page"':'')+'><span class="nav-icon">'+icon(i)+'</span>'+label+(name==='review'&&due?'<span class="dot"></span>':'')+'</button>').join('')+'</nav>';
    return desktop+mobile;
  }
  function courseCard(c) {
    const completed=count(c);
    return '<button class="card course-card" data-action="course" data-id="'+c.id+'">'+language(c)+icon('arrow','corner-arrow')+'<h3>'+c.name+'</h3><p>'+esc(c.description)+'</p><div class="course-meta"><span>'+c.lessons.length+' lições</span><span>'+completed+'/'+c.lessons.length+'</span></div>'+progress(completed/c.lessons.length*100)+'</button>';
  }
  function ring(value,max) {
    const p=Math.min(1,value/max),d=226.2;
    return '<div class="ring"><svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="36" fill="none" stroke="#e5e7d7" stroke-width="7"/><circle cx="42" cy="42" r="36" fill="none" stroke="#c45126" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+d+'" stroke-dashoffset="'+(d*(1-p))+'"/></svg><span class="ring-label">'+Math.min(value,max)+'<small>/ '+max+' XP</small></span></div>';
  }
  function home() {
    const c=catalog.courses[state.activeCourse], next=c.lessons.find(l=>!state.completed[l.id]);
    const today=state.days[C.dayKey()]||0, reviewCount=C.due(state).length;
    const session=state.session&&!state.session.finished;
    const title=session?'Sua descoberta continua.':next?next.title:'Uma trilha. Muitas conquistas.';
    return '<section class="welcome"><div class="eyebrow">UM POUQUINHO, TODO DIA.</div><h1>Olá, '+esc(state.name||'explorador')+'. '+icon('spark','mini-flame')+'</h1><p class="muted small">Vamos transformar curiosidade em código?</p></section>'+
      '<div class="home-grid"><section class="hero"><span class="pill tag">'+language(c,'small')+c.name+'<span> • '+(next?'lição '+next.number+' de '+c.lessons.length:'trilha completa')+'</span></span><img class="art" src="art/capa.png" alt="Mascote Faísca aprendendo com um notebook"><div class="hero-copy"><div class="eyebrow orange">'+(session?'CONTINUE DE ONDE PAROU':'SUA PRÓXIMA DESCOBERTA')+'</div><h2>'+title+'</h2><p>'+(session?'Sua aula está salva. Retome no seu ritmo.':next?esc(next.objective):'Você concluiu os fundamentos. Explore outra linguagem ou pratique novamente.')+'</p>'+button((session?'Retomar aula':next?'Começar lição':'Ver minha trilha')+' '+icon('arrow'),'continue','','primary')+'</div></section>'+
      '<div class="sidecards"><section class="card goal-card"><div class="eyebrow">SEU RITMO, SUA META</div><div class="row spread"><div><h3>'+ (today>=state.goal?'Meta do dia atingida!':'Uma faísca por dia')+'</h3><p class="small muted" style="margin-top:8px">'+(today>=state.goal?'Você reservou um tempo para aprender.':Math.max(0,state.goal-today)+' XP para completar sua meta.')+'</p></div>'+ring(today,state.goal)+'</div>'+progress(today/state.goal*100)+'<button class="text-btn" data-action="goal">Ajustar meta '+icon('chevron')+'</button></section>'+
      '<section class="card review-card"><div><span class="review-symbol">'+icon('review')+'</span><h3>'+(reviewCount?'Hora de reforçar.':'Aprender. Relembrar.')+'</h3><p class="muted small">'+(reviewCount?plural(reviewCount,'exercício pronto','exercícios prontos')+' para revisão.':'Suas revisões aparecem depois das lições.')+'</p></div><button class="text-btn" data-action="nav" data-route="review">Revisar '+icon('arrow')+'</button></section></div></div>'+
      '<div class="stat-grid"><div class="stat"><b>'+totalDone()+'</b><span>lições concluídas</span></div><div class="stat"><b>'+C.streak(state)+'</b><span>dias de sequência</span></div><div class="stat"><b>'+level()+'</b><span>seu nível</span></div></div>'+
      '<div class="section-title"><h2>Novas possibilidades</h2><button class="text-btn" data-action="nav" data-route="courses">Ver todas '+icon('arrow')+'</button></div><div class="course-grid">'+curriculum.courses.filter(x=>x.id!==c.id).slice(0,2).map(courseCard).join('')+'</div><p class="footer-note">Sem pressa. Sem vidas para perder. Só você e sua próxima ideia.</p>';
  }
  function courses() {
    const filtered=curriculum.courses.filter(c=>(classroomTracks?classroomTracks.includes(c.id):(category==='Todas'||c.category===category))&&clean(c.name+' '+c.description).includes(clean(search)));
    const intro=classroomTracks
      ? '<div class="page-intro"><div class="eyebrow orange">TRILHAS DA SUA SALA</div><h1>Sua sala de aula.</h1><p class="muted">O professor liberou '+filtered.length+' '+(filtered.length===1?'trilha':'trilhas')+' para esta turma.</p></div>'
      : '<div class="page-intro"><div class="eyebrow orange">12 CAMINHOS PARA COMEÇAR</div><h1>Qual ideia te move?</h1><p class="muted">'+lessonTotal+' lições, dos fundamentos aos projetos, uma descoberta de cada vez.</p></div>';
    const searchAndChips=classroomTracks?'':('<label class="sr-only" for="course-search">Buscar linguagem</label><div class="search-wrap">'+icon('search')+'<input class="search" id="course-search" type="search" autocomplete="off" placeholder="Encontre sua linguagem" value="'+esc(search)+'"></div><div class="chips" aria-label="Categorias">'+['Todas','Web','Apps','Dados','Sistemas'].map(x=>'<button class="chip '+(x===category?'selected':'')+'" data-action="category" data-id="'+x+'" aria-pressed="'+(x===category)+'">'+x+'</button>').join('')+'</div>');
    return intro+searchAndChips+'<div class="course-grid" id="course-results">'+(filtered.length?filtered.map(courseCard).join(''):'<div class="empty full-span">'+icon('search')+'<h2>Nenhuma trilha por aqui.</h2><p>'+(classroomTracks?'O professor ainda não liberou nenhuma trilha.':'Tente outro nome ou escolha a categoria Todas.')+'</p></div>')+'</div>';
  }
  function coursePage() {
    const c=catalog.courses[viewCourse], completed=count(c), next=c.lessons.find(l=>!state.completed[l.id]);
    if(classroomTracks&&!classroomTracks.includes(viewCourse)){
      return '<div class="back-row"><button class="text-btn" data-action="nav" data-route="courses">'+icon('back')+' Trilhas da sala</button></div><div class="card empty">'+icon('lock')+'<h2>Trilha não disponível.</h2><p>Esta trilha não foi liberada pelo seu professor. Acesse as trilhas da sua sala.</p>'+button('Ver trilhas da sala '+icon('arrow'),'nav','data-route="courses"','primary')+'</div>';
    }
    let lastUnit='', unitNumber=0;
    return '<div class="back-row"><button class="text-btn" data-action="nav" data-route="courses">'+icon('back')+' Todas as trilhas</button><span class="pill">'+c.category+'</span></div>'+
      '<div class="course-heading">'+language(c,'large')+'<div><div class="eyebrow orange">'+c.level+'</div><h1>'+c.name+'</h1></div></div><p class="course-desc">'+esc(c.description)+' Leia a ideia, acompanhe o exemplo e pratique. As próximas lições são liberadas conforme você avança.</p>'+
      '<div class="course-banner"><div><h3>'+(completed===c.lessons.length?'Trilha concluída!':'Seu caminho está começando a brilhar.')+'</h3><p>'+completed+' de '+c.lessons.length+' lições • '+c.lessons.reduce((n,l)=>n+l.questions.length,0)+' exercícios • projetos guiados</p></div><div><b>'+Math.round(completed/c.lessons.length*100)+'%</b>'+progress(completed/c.lessons.length*100)+'</div></div><div class="path-wrap">'+c.lessons.map(l=>{
        let unit='';if(lastUnit!==l.unit){lastUnit=l.unit;unit='<div class="unit-heading"><span class="unit-count">'+String(++unitNumber).padStart(2,'0')+'</span>'+l.unit+'</div>';}
        const done=state.completed[l.id],unlocked=C.unlocked(state,c,l.id),current=next&&next.id===l.id;
        return unit+'<div class="lesson-row '+(done?'done':current?'current':'locked')+'"><span class="node">'+(done?icon('check'):unlocked?icon(l.project?'flag':'code'):icon('lock'))+'</span><button class="lesson-link" data-action="start-lesson" data-id="'+l.id+'" '+(!unlocked?'disabled':'')+'><span><small>LIÇÃO '+String(l.number).padStart(2,'0')+' • '+l.minutes+' MIN</small><h3>'+esc(l.title)+'</h3>'+(done?'<span class="stars" aria-label="'+done.score+' acertos de primeira em três">'+('★'.repeat(done.score)+'☆'.repeat(3-done.score))+'</span>':'<small>'+(current?'Pronta para começar':'Conclua a lição anterior')+'</small>')+'</span>'+icon(done?'review':unlocked?'chevron':'lock')+'</button></div>';
      }).join('')+'</div><div class="card"><div class="row">'+icon('leaf')+'<h3>Uma base para construir</h3></div><p class="small muted" style="margin-top:12px">Esta trilha apresenta os fundamentos. Os projetos guiados ajudam a aplicar as ideias; depois, continue praticando em um ambiente da linguagem.</p></div>';
  }
  function codeBlock(code,output,label) {
    return '<div class="code-block"><div class="code-bar"><span>'+esc(label||'EXEMPLO COMENTADO')+'</span><span class="code-dots"><i></i><i></i><i></i></span></div><pre><code>'+esc(code)+'</code></pre>'+(output!=null?'<div class="output"><small>RESULTADO DO EXEMPLO</small>'+esc(output)+'</div>':'')+'</div>';
  }
  function theory(l) {
    return '<div class="theory">'+l.paragraphs.slice(0,-1).map(p=>'<p>'+esc(p)+'</p>').join('')+'</div><div class="concept-note"><h3>'+icon('spark')+' '+(catalog.courses[l.courseId].id==='web'?'Na prática':'Nesta linguagem')+'</h3><p>'+esc(l.paragraphs[l.paragraphs.length-1])+'</p></div>';
  }
  function example(l) {
    return codeBlock(l.code,l.output,catalog.courses[l.courseId].name+' • EXEMPLO')+'<h3>Vamos por partes</h3><ol class="walkthrough">'+l.walkthrough.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ol><div class="concept-note"><h3>'+icon('info')+' Guarde esta ideia</h3><p>'+esc(l.tip)+'</p></div>'+(l.project?'<div class="card"><h3>'+icon('flag')+' Leve para o seu projeto</h3><p class="small muted" style="margin-top:12px">'+esc(l.project)+'</p></div>':'');
  }
  function order(q) {
    const offset=[...q.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%q.options.length;
    return q.options.map((_,i)=>(i+offset)%q.options.length);
  }
  function getAnalyzer() {
    return (typeof window !== 'undefined' && window.CodeAnalyzer) || (typeof CodeAnalyzer !== 'undefined' ? CodeAnalyzer : null);
  }

  function editorView(q, s, diagnostics = []) {
    const analyzer = getAnalyzer();
    const lang = q.language || 'python';
    const val = String(s.value || '');
    const lines = Math.max(1, val.split('\n').length);
    const gutterHtml = Array.from({length: lines}, (_, i) => '<div>' + (i + 1) + '</div>').join('');
    const highlighted = analyzer
      ? analyzer.renderHighlightedHtml(val, lang, diagnostics)
      : esc(val);

    const langLabels = {
      python: 'Python', java: 'Java', sql: 'SQL', javascript: 'JavaScript', typescript: 'TypeScript',
      kotlin: 'Kotlin', c: 'C', cpp: 'C++', csharp: 'C#', php: 'PHP', swift: 'Swift', web: 'HTML & CSS'
    };

    const probCount = diagnostics.length;
    const categoryLabels = {
      syntax: 'Erro de sintaxe',
      divergence: 'Divergência do exercício',
      limitation: 'Limitação da análise',
      warning: 'Aviso'
    };

    let problemsHtml = '';
    if (s.checked && !s.correct && probCount > 0) {
      problemsHtml = '<div class="editor-problems-panel" role="region" aria-label="Painel de problemas">' +
        '<div class="problems-header"><span class="problems-title">' + icon('info') + ' Problemas (' + probCount + ')</span><span class="muted small">Identificado pelo Faísca</span></div>' +
        '<div class="problems-list" role="list">' +
        diagnostics.map(d => (
          '<div class="problem-card" role="listitem">' +
            '<div class="problem-top">' +
              '<span class="problem-badge ' + esc(d.category) + '">' + esc(categoryLabels[d.category] || d.category) + '</span>' +
              '<span class="problem-location">Linha ' + d.line + ', Coluna ' + d.column + '</span>' +
            '</div>' +
            '<div class="problem-msg">' + esc(d.message) + '</div>' +
            (d.hint ? '<div class="problem-hint">' + esc(d.hint) + '</div>' : '') +
            '<button class="locate-btn" type="button" data-action="locate-problem" data-start="' + d.range.start + '" data-end="' + d.range.end + '">' +
              icon('search') + ' Localizar no código' +
            '</button>' +
          '</div>'
        )).join('') +
        '</div></div>';
    }

    return '<div class="code-editor-container" role="region" aria-label="Editor educacional de código">' +
      '<div class="editor-header">' +
        '<div class="editor-title-group">' +
          '<span class="editor-lang-badge">' + esc(langLabels[lang] || lang) + '</span>' +
          '<span class="editor-mode-tag">Escreva a linha inteira</span>' +
        '</div>' +
        '<div class="editor-meta">' +
          '<span class="editor-cursor-pos" id="editor-cursor">Ln 1, Col 1</span>' +
          '<span class="editor-problem-count">' + probCount + (probCount === 1 ? ' problema' : ' problemas') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="code-editor-wrap">' +
        '<div class="editor-gutter" id="editor-gutter" aria-hidden="true">' + gutterHtml + '</div>' +
        '<div class="editor-canvas">' +
          '<div class="editor-backdrop" id="editor-backdrop" aria-hidden="true">' + highlighted + '</div>' +
          '<textarea class="editor-input answer-input code-answer" id="answer" rows="4" maxlength="500" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-describedby="answer-help" ' + (s.checked ? 'disabled' : '') + ' placeholder="Escreva sua linha de código aqui">' + esc(val) + '</textarea>' +
        '</div>' +
      '</div>' +
      problemsHtml +
    '</div>';
  }

  function updateEditorMeta(field) {
    const cursorEl = document.getElementById('editor-cursor');
    if (!cursorEl || !field) return;
    const pos = field.selectionStart || 0;
    const text = field.value || '';
    let line = 1, col = 1;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === '\n') { line++; col = 1; } else { col++; }
    }
    cursorEl.textContent = 'Ln ' + line + ', Col ' + col;
  }

  function syncEditorBackdrop(field) {
    const s = state.session; if (!s) return;
    const q = catalog.questions[s.qids[s.index]]; if (!q || q.answerMode !== 'code') return;
    const val = field.value;
    const gutter = document.getElementById('editor-gutter');
    if (gutter) {
      const lines = Math.max(1, val.split('\n').length);
      gutter.innerHTML = Array.from({length: lines}, (_, i) => '<div>' + (i + 1) + '</div>').join('');
    }
    const backdrop = document.getElementById('editor-backdrop');
    const analyzer = getAnalyzer();
    if (backdrop && analyzer) {
      backdrop.innerHTML = analyzer.renderHighlightedHtml(val, q.language, []);
    }
    updateEditorMeta(field);
  }

  let liveTimer = null;
  function scheduleLiveAnalysis(field) {
    clearTimeout(liveTimer);
    const s = state.session; if (!s || s.checked) return;
    const q = catalog.questions[s.qids[s.index]]; if (!q || q.answerMode !== 'code') return;
    const analyzer = getAnalyzer();
    if (!analyzer) return;
    liveTimer = setTimeout(() => {
      if (!state.session || state.session.checked) return;
      const res = analyzer.analyzeCode(q, field.value, { phase: 'live' });
      const backdrop = document.getElementById('editor-backdrop');
      if (backdrop) {
        backdrop.innerHTML = analyzer.renderHighlightedHtml(field.value, q.language, res.diagnostics);
      }
      const countEl = document.querySelector('.editor-problem-count');
      if (countEl) {
        const c = res.diagnostics.length;
        countEl.textContent = c + ' ' + (c === 1 ? 'problema' : 'problemas');
      }
    }, 400);
  }

  function lessonView() {
    const s=state.session;
    if(!s){route='home';return '';}
    if(s.phase===3)return resultView();
    const q=catalog.questions[s.qids[s.index]],l=catalog.lessons[s.kind==='lesson'?s.lessonId:q.lessonId],c=catalog.courses[l.courseId];
    const step=s.kind==='lesson'?s.phase<2?s.phase+1:s.index+3:s.index+1, steps=s.qids.length+(s.kind==='lesson'?2:0);
    let content='<div class="session-top"><button class="icon-btn" data-action="leave-lesson" aria-label="Pausar e sair da aula">'+icon('close')+'</button>'+progress((step-1)/steps*100)+'<span class="step-count">'+step+' / '+steps+'</span></div>'+
      '<div class="session-label">'+language(c,'small')+'<span>'+c.name+' • '+(s.kind==='review'?'REVISÃO':('LIÇÃO '+l.number))+'</span><button class="icon-btn '+(state.bookmarks.includes(l.id)?'active':'')+'" style="margin-left:auto" data-action="bookmark" data-id="'+l.id+'" aria-label="'+(state.bookmarks.includes(l.id)?'Remover dos salvos':'Salvar lição no caderno')+'" aria-pressed="'+state.bookmarks.includes(l.id)+'">'+icon('bookmark')+'</button></div>';
    if(s.phase<2) {
      content+='<div class="lesson-head"><div class="eyebrow orange">'+(s.phase===0?'01 • ENTENDA A IDEIA':'02 • VEJA ACONTECER')+'</div><h1 tabindex="-1">'+esc(l.title)+'</h1><p class="objective">'+esc(l.objective)+'</p></div>'+(s.phase===0?theory(l):example(l));
      return content+'<div class="lesson-action">'+(s.phase===1?button(icon('back'),'theory-back','aria-label="Voltar à explicação"','secondary'):'')+'<span class="action-note">Leia com calma. Aprender não é uma corrida.</span>'+button((s.phase===0?'Ver exemplo':'Vamos praticar')+' '+icon('arrow'),'theory-next','','primary')+'</div>';
    }
    content+='<div class="lesson-head"><div class="eyebrow orange">'+(q.type==='choice'?'ESCOLHA A RESPOSTA':q.answerMode==='code'?'ESCREVA A LINHA INTEIRA':q.id.endsWith('-c')?'COMPLETE O CÓDIGO':'LEIA E DESCUBRA')+'</div><h1 tabindex="-1">'+(q.answerMode==='code'?'Agora é com você.':esc(q.prompt))+'</h1>'+(q.answerMode==='code'?'<p class="objective">'+esc(q.prompt)+'</p>':'')+'</div>'+(q.code?codeBlock(q.code,null,c.name+(q.answerMode==='code'?' • CÓDIGO DE APOIO':' • EXERCÍCIO')):'');
    if(q.type==='choice') {
      content+='<div class="choices" role="radiogroup" aria-label="Alternativas">'+order(q).map((i,n)=>'<button class="choice '+(s.selected===i?'selected ':'')+(s.checked&&s.selected===i?(s.correct?'good':'bad'):'')+'" role="radio" aria-checked="'+(s.selected===i)+'" data-action="choose" data-index="'+i+'" '+(s.checked?'disabled':'')+'><span class="letter">'+String.fromCharCode(65+n)+'</span><span>'+esc(q.options[i].text)+'</span></button>').join('')+'</div>';
    } else {
      const writing=q.answerMode==='code';
      const help=writing
        ? (q.language==='sql'?'Palavras-chave e nomes sem aspas aceitam maiúsculas ou minúsculas. Preserve o texto entre aspas.':'Respeite maiúsculas, minúsculas e o conteúdo dos textos.')
          +' Espaços entre símbolos são aceitos. Escreva uma única linha seguindo o enunciado.'
        : (q.caseInsensitive?'Palavras-chave SQL podem usar maiúsculas ou minúsculas.':'Respeite maiúsculas, minúsculas e os símbolos do código.');
      if(writing){
        const analyzer=getAnalyzer();
        const diagnostics=(s.checked&&!s.correct&&analyzer)
          ? analyzer.analyzeCode(q,s.value,{phase:'submit'}).diagnostics
          : [];
        content+='<label class="answer-label" for="answer">Seu código completo</label>'+editorView(q,s,diagnostics)+'<p id="answer-help" class="small muted" style="margin-top:10px">'+esc(help)+(q.placement?' '+esc(q.placement):'')+'</p>';
      } else {
        content+='<label class="answer-label" for="answer">'+(q.id.endsWith('-c')?'Escreva somente o que falta na lacuna':'Sua resposta')+'</label><textarea class="answer-input" id="answer" rows="2" maxlength="500" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-describedby="answer-help" '+(s.checked?'disabled':'')+' placeholder="Toque para responder">'+esc(s.value)+'</textarea><p id="answer-help" class="small muted" style="margin-top:10px">'+esc(help)+'</p>';
      }
    }
    if(s.checked) {
      content+='<section class="feedback '+(s.correct?'':'wrong')+'" role="status" aria-live="polite" tabindex="-1"><h3>'+icon(s.correct?'check':'leaf')+' '+(s.correct?'Isso mesmo!':'Quase. Vamos entender?')+'</h3><p>'+esc(q.explanation)+'</p>'+(!s.correct?'<p class="solution"><b>Resposta esperada:</b> <code>'+esc(q.type==='choice'?q.options.find(o=>o.correct).text:q.answers[0])+'</code></p>':'')+'</section>';
    } else content+='<button class="text-btn" data-action="hint">'+icon('book')+' Consultar a explicação</button>';
    const disabled=!s.checked&&(q.type==='choice'?s.selected<0:!s.value.trim());
    return content+'<div class="lesson-action"><span class="action-note">'+(s.checked?(s.correct?'Mais uma ideia que agora é sua.':'Errar também faz parte de aprender.'):'Você pode tentar quantas vezes precisar.')+'</span>'+button((s.checked?(s.correct?(s.index===s.qids.length-1?'Concluir':'Continuar'):q.answerMode==='code'?'Corrigir código':'Tentar novamente'):'Verificar resposta')+' '+icon(s.checked&&s.correct?'arrow':'check'),'answer',disabled?'disabled':'','primary')+'</div>';
  }
  function resultView() {
    const s=state.session, l=catalog.lessons[s.lessonId], c=l?catalog.courses[l.courseId]:null;
    const done=c&&count(c)===8;
    return '<div class="session-top"><button class="icon-btn" data-action="result-close" aria-label="Voltar ao início">'+icon('close')+'</button><span class="eyebrow">UMA IDEIA A MAIS NO SEU MUNDO</span></div><section class="result"><img class="result-art" src="art/capa.png" alt="Faísca celebrando uma descoberta"><div class="eyebrow orange">'+(s.kind==='review'?'REVISÃO CONCLUÍDA':'LIÇÃO CONCLUÍDA')+'</div><h1>'+ (s.first===s.qids.length?'Você fez brilhar!':'Sua faísca cresceu.')+'</h1><p>'+(s.kind==='review'?'Relembrar fortalece o que você já aprendeu.':'Agora você sabe um pouco mais. Volte quando quiser para praticar.')+'</p><div class="stat-grid"><div class="stat"><b>+'+s.award+'</b><span>XP conquistados</span></div><div class="stat"><b>'+s.first+'/'+s.qids.length+'</b><span>acertos de primeira</span></div><div class="stat"><b>'+C.streak(state)+'</b><span>dias de sequência</span></div></div>'+(done?'<div class="badge-earned">'+icon('trophy')+'<div><h3>Fundamentos de '+c.name+'</h3><p>Você completou as 8 lições desta trilha.</p></div></div>':'')+'<p class="small muted">'+(s.award===0?'Os pontos desta atividade já foram registrados hoje. Você pode continuar praticando livremente.':s.first<s.qids.length?'As ideias que precisaram de outra tentativa vão para a sua revisão.':'As próximas revisões serão liberadas para ajudar você a lembrar.')+'</p></section><div class="lesson-action"><span class="action-note">'+(s.kind==='lesson'?'O próximo passo está ao seu alcance.':'Seu conhecimento merece uma segunda visita.')+'</span>'+button((s.kind==='lesson'&&c&&!done?'Próxima lição':'Voltar ao início')+' '+icon('arrow'),'result-next','','primary')+'</div>';
  }
  function reviewPage() {
    const ids=C.due(state), learned=Object.keys(state.reviews), errors=learned.filter(id=>state.reviews[id].error);
    if(!learned.length)return '<div class="page-intro"><div class="eyebrow orange">CONHECIMENTO QUE FICA</div><h1>Revisar é fazer crescer.</h1></div><div class="card empty">'+icon('leaf')+'<h2>Uma ideia precisa nascer primeiro.</h2><p>Conclua sua primeira lição. Depois, traremos exercícios de volta na hora de reforçar o que você aprendeu.</p>'+button('Escolher uma trilha '+icon('arrow'),'nav','data-route="courses"','primary')+'</div>';
    const upcoming=Object.values(state.reviews).map(r=>r.due).sort((a,b)=>a-b)[0];
    return '<div class="page-intro"><div class="eyebrow orange">CONHECIMENTO QUE FICA</div><h1>Uma segunda faísca.</h1><p class="muted">Pequenas revisões para suas ideias criarem raízes.</p></div><section class="review-summary"><div><div class="eyebrow">'+(ids.length?'SEU TREINO ESTÁ PRONTO':'TUDO EM DIA')+'</div><h2>'+ (ids.length?plural(ids.length,'exercício para hoje','exercícios para hoje'):'Dê tempo para aprender.')+'</h2><p>'+(ids.length?'Começamos pelos erros. Cada rodada tem até 5 exercícios.':'Próxima revisão prevista: '+new Date(upcoming*86400000).toLocaleDateString('pt-BR',{timeZone:'UTC'})+'.')+'</p></div>'+button((ids.length?'Começar revisão':'Praticar mesmo assim')+' '+icon('arrow'),'start-review','data-mode="'+(ids.length?'due':'all')+'"','light')+'</section><div class="stat-grid"><div class="stat"><b>'+ids.length+'</b><span>para revisar</span></div><div class="stat"><b>'+errors.length+'</b><span>para reforçar</span></div><div class="stat"><b>'+learned.length+'</b><span>ideias estudadas</span></div></div><div class="section-title"><h2>'+(ids.length?'Na sua próxima rodada':'Seu calendário de revisão')+'</h2></div><div class="review-list">'+(ids.length?ids.slice(0,5):learned.sort((a,b)=>state.reviews[a].due-state.reviews[b].due).slice(0,5)).map(id=>{
      const q=catalog.questions[id],l=catalog.lessons[q.lessonId],c=catalog.courses[q.courseId];
      return '<div class="card review-item">'+language(c,'small')+'<div class="details"><div class="eyebrow" style="font-size:9px">'+c.name+'</div><h3>'+l.title+'</h3><p>'+(q.type==='choice'?'Conceito':q.answerMode==='code'?'Escrever a linha inteira':id.endsWith('-c')?'Complete o código':'Leitura de código')+'</p></div><span class="pill '+(state.reviews[id].error?'orange':'')+'">'+(state.reviews[id].error?'Reforçar':'Relembrar')+'</span></div>';
    }).join('')+'</div><div class="concept-note"><h3>Como funciona?</h3><p>Após a primeira lição, a revisão aparece no dia seguinte. Ao acertar de primeira, o intervalo cresce para 3, 7, 14, 30 e 60 dias. Se errar, retomamos um intervalo curto. A prática antecipada também atualiza o calendário.</p></div>';
  }
  function badges() {
    const done=totalDone(), tracks=curriculum.courses.filter(c=>count(c)>=8).length;
    const fullTracks=curriculum.courses.filter(c=>count(c)===c.lessons.length).length;
    return [
      ['spark','Primeira faísca','Concluir 1 lição',done>=1],['fire','Pegou o ritmo','Estudar 3 dias seguidos',C.longestStreak(state)>=3],
      ['book','Mente curiosa','Concluir 10 lições',done>=10],['flag','Primeira trilha','Concluir 8 lições de uma trilha',tracks>=1],
      ['trophy','Trilha completa','Concluir todas as 40 lições de uma trilha',fullTracks>=1],
      ['code','Novos caminhos','Concluir lições em 3 trilhas',curriculum.courses.filter(c=>count(c)>0).length>=3],['trophy','Mil ideias','Acumular 1.000 XP',state.totalXp>=1000]
    ];
  }
  function settingsRow(action,i,title,desc,extra='') {
    return '<button class="settings-row" data-action="'+action+'" '+extra+'>'+icon(i)+'<span class="details"><h3>'+title+'</h3><p>'+desc+'</p></span>'+icon('chevron')+'</button>';
  }
  function profilePage() {
    const day=C.dayNumber();
    return '<div class="profile-head"><div class="avatar">'+esc((state.name||'F').slice(0,1).toUpperCase())+'</div><div><div class="eyebrow orange">SEU CADERNO DE CONQUISTAS</div><h1>'+esc(state.name||'Explorador')+'</h1><p class="small muted" style="margin-top:7px">Nível '+level()+' • '+state.totalXp+' XP</p></div></div><section class="card"><div class="row spread"><h3>Seu ritmo de estudo</h3><span class="pill orange">'+icon('fire')+C.streak(state)+' dias</span></div><div class="week">'+Array.from({length:7},(_,i)=>{
      const d=day-6+i,key=C.keyFromDay(d),xp=state.days[key]||0,studied=state.studyDays[key]||xp>0;
      return '<div class="day" aria-label="'+key+', '+xp+' XP"><div class="day-box '+(studied?'done ':'')+(d===day?'today':'')+'">'+(studied?icon('check'):new Date(d*86400000).getUTCDate())+'</div>'+['D','S','T','Q','Q','S','S'][new Date(d*86400000).getUTCDay()]+'</div>';
    }).join('')+'</div><p class="small muted" style="margin-top:18px">'+(state.days[C.dayKey()]>=state.goal?'Sua meta de hoje já está completa.':'Meta de hoje: '+state.goal+' XP. Concluir atividades mantém sua sequência.')+'</p></section><div class="section-title"><h2>Pequenas grandes conquistas</h2></div><div class="badge-grid">'+badges().map(([i,t,d,earned])=>'<div class="badge '+(earned?'earned':'locked')+'">'+icon(i)+'<h3>'+t+'</h3><p>'+d+'</p><span class="sr-only">'+(earned?'Conquistada':'Ainda não conquistada')+'</span></div>').join('')+'</div><div class="section-title"><h2>Do seu jeito</h2></div><div class="card settings-list">'+
      settingsRow('notebook','bookmark','Meu caderno',state.bookmarks.length+' lições salvas e suas anotações')+
      settingsRow('nav','book','Salas de aula','Acompanhe turmas ou participe com código de entrada','data-route="classrooms"')+
      settingsRow('nav','lock','Conta e sincronização',A&&!A.status().user?'Criar conta com Google ou e-mail e senha':accountUI?accountUI.syncText():'Conecte sua conta para guardar o progresso','data-route="account"')+
      (web&&!installed&&installPrompt?settingsRow('install-app','download','Instalar no computador','Abra o Faísca como aplicativo no Windows, macOS ou Linux'):'')+
      settingsRow('edit-profile','user','Nome e meta','Personalize sua rotina de aprendizagem')+
      settingsRow('motion','leaf','Movimento da interface',state.reducedMotion?'Animações reduzidas':'Animações suaves ativadas')+
      settingsRow('export','cloud','Salvar cópia do progresso','Exporte um arquivo para guardar ou trocar de aparelho')+
      settingsRow('import','upload','Restaurar uma cópia','Importe seu arquivo de progresso do Faísca')+
      settingsRow('about','info','Sobre o Faísca','Versão 1.5.0 • celular e computador')+
      settingsRow('reset','trash','<span class="danger-text">Recomeçar do zero</span>','Disponível no modo sem conta')+'</div><p class="footer-note">Lições offline. Conta opcional para guardar suas descobertas online.</p>';
  }
  function notebookPage() {
    const all=Object.values(catalog.lessons).filter(l=>(notebookFilter==='Salvos'?state.bookmarks.includes(l.id):notebookFilter==='Anotações'?(!!state.notes[l.id]||!!(state.noteVersions[l.id]||[]).length):!!state.completed[l.id])&&clean(l.title+' '+catalog.courses[l.courseId].name+' '+(state.notes[l.id]||'')).includes(clean(noteSearch)));
    return '<button class="text-btn" data-action="nav" data-route="profile">'+icon('back')+' Você</button><div class="page-intro"><div class="eyebrow orange">PARA CONSULTAR, SEMPRE</div><h1>Seu caderno.</h1><p class="muted">Guarde as ideias que você quer levar adiante.</p></div><label class="sr-only" for="note-search">Buscar no caderno</label><div class="search-wrap">'+icon('search')+'<input class="search" id="note-search" type="search" placeholder="Linguagem, lição ou anotação" value="'+esc(noteSearch)+'"></div><div class="chips">'+['Salvos','Anotações','Estudados'].map(t=>'<button class="chip '+(notebookFilter===t?'selected':'')+'" data-action="notebook-filter" data-id="'+t+'">'+t+'</button>').join('')+'</div><div class="reading-list">'+(all.length?all.map(l=>'<button class="card search-result" data-action="read" data-id="'+l.id+'"><div class="row">'+language(catalog.courses[l.courseId],'small')+'<span class="eyebrow">'+catalog.courses[l.courseId].name+'</span></div><h3>'+l.title+'</h3><p>'+l.objective+'</p>'+(state.notes[l.id]?'<p class="note-preview">'+esc(state.notes[l.id].slice(0,150))+'</p>':'')+'</button>').join(''):'<div class="card empty full-span">'+icon('bookmark')+'<h2>Espaço para suas ideias.</h2><p>Toque no marcador durante uma aula para guardá-la aqui. As lições concluídas também aparecem na aba Estudados.</p></div>')+'</div>';
  }
  function noteHistory(id){
    const versions=state.noteVersions[id]||[];
    return versions.length?'<details class="note-history"><summary>Outras versões da anotação ('+versions.length+')</summary><p class="small muted">Textos preservados ao combinar alterações feitas em aparelhos diferentes.</p>'+versions.map(text=>'<pre>'+esc(text)+'</pre>').join('')+'</details>':'';
  }
  function readingPage() {
    const l=catalog.lessons[readId],c=catalog.courses[l.courseId];
    return '<div class="back-row"><button class="text-btn" data-action="notebook">'+icon('back')+' Caderno</button><button class="icon-btn '+(state.bookmarks.includes(l.id)?'active':'')+'" data-action="bookmark" data-id="'+l.id+'" aria-label="Salvar ou remover lição">'+icon('bookmark')+'</button></div><div class="session-label">'+language(c,'small')+c.name+' • LIÇÃO '+l.number+'</div><div class="lesson-head"><h1>'+l.title+'</h1><p class="objective">'+l.objective+'</p></div>'+theory(l)+example(l)+'<section class="note-card"><div class="section-title"><h2>Com suas palavras</h2>'+icon('pen')+'</div><label class="sr-only" for="lesson-note">Sua anotação sobre a lição</label><textarea class="note" id="lesson-note" data-id="'+l.id+'" maxlength="2000" placeholder="O que você entendeu? Qual ideia quer lembrar?">'+esc(state.notes[l.id]||'')+'</textarea><div class="note-footer"><span id="note-save-status">Anotações salvas automaticamente</span><span id="note-count">'+(state.notes[l.id]||'').length+'/2000</span></div>'+noteHistory(l.id)+'</section>'+button('Praticar esta lição '+icon('arrow'),'start-lesson','data-id="'+l.id+'"','full primary');
  }
  function onboarding() {
    let content='';
    const accountOptions=A&&A.status().user?button('Minha conta','nav','data-route="account"','text-btn full'):button('Criar conta','account-open','data-mode="signup"','secondary full onboard-signup')+button('Já tenho uma conta. Entrar','account-open','data-mode="login"','text-btn full');
    if(onboardStep===0)content='<div class="onboard-content"><img class="onboard-art" src="art/capa.png" alt="Faísca, uma pequena chama com um notebook e ideias ao redor"><div class="onboard-copy"><div class="eyebrow orange">ACENDA SUA CURIOSIDADE</div><h1>Grandes ideias<br>começam com<br>uma <em>faísca.</em></h1><p>Aprenda a programar do zero, com explicações de verdade e pequenas descobertas todos os dias.</p>'+button('Quero começar '+icon('arrow'),'onboard-next','','primary full')+accountOptions+'<div class="onboard-features"><span>'+icon('path')+' 12 trilhas</span><span>'+icon('book')+' '+lessonTotal+' lições</span><span>'+icon('check')+' Lições offline</span></div></div></div><div class="onboard-bottom">No seu tempo. No seu ritmo. O próximo código pode ser seu.</div>';
    else if(onboardStep===1)content='<section class="setup"><button class="text-btn" data-action="onboard-back">'+icon('back')+' Voltar</button><div class="eyebrow orange">01 / 02 • SEU JEITO DE APRENDER</div><h1>Vamos no seu ritmo.</h1><p>Como podemos chamar você? Escolha também uma meta diária de XP. Você pode ajustar tudo depois.</p><div class="field"><label for="learner-name">Seu nome ou apelido</label><input id="learner-name" maxlength="30" autocomplete="given-name" placeholder="Como quer ser chamado?" value="'+esc(draft.name)+'"></div><span class="answer-label">Seu objetivo diário</span><div class="goal-options">'+goals(draft.goal,'onboard-goal')+'</div><p class="small muted" style="margin-bottom:24px">Uma lição nova vale entre 30 e 45 XP. Sem bloquear seu aprendizado quando você erra.</p>'+button('Escolher minha trilha '+icon('arrow'),'onboard-next','','primary full')+'</section>';
    else content='<section class="setup"><button class="text-btn" data-action="onboard-back">'+icon('back')+' Voltar</button><div class="eyebrow orange">02 / 02 • SUA PRIMEIRA DESCOBERTA</div><h1>Por onde vamos?</h1><p>Se estiver começando do zero, Python é um caminho acessível. Todas as trilhas ficam disponíveis para você trocar quando quiser.</p><div class="course-select">'+curriculum.courses.map(c=>'<button class="course-pick '+(draft.course===c.id?'selected':'')+'" data-action="onboard-course" data-id="'+c.id+'" aria-pressed="'+(draft.course===c.id)+'">'+language(c,'small')+c.name+'</button>').join('')+'</div>'+button('Acender minha faísca '+icon('spark'),'onboard-finish','','primary full')+'</section>';
    return '<main class="onboard screen-enter"><div class="onboard-header">'+brand()+'<span class="pill green">APRENDER É CRIAR</span></div>'+content+'</main>';
  }
  function goals(selected,action) {
    return [[15,'Leve'],[30,'Constante'],[60,'Intenso']].map(([xp,label])=>'<button class="goal-option '+(selected===xp?'selected':'')+'" data-action="'+action+'" data-goal="'+xp+'" aria-pressed="'+(selected===xp)+'"><b>'+xp+' XP</b><span>'+label+'</span></button>').join('');
  }
  function render(scroll=true) {
    if(recovery) {
      app.innerHTML='<main class="onboard"><div class="setup"><img src="art/marca.svg" width="65" alt=""><h1>Vamos cuidar do seu progresso.</h1><p>Não foi possível ler os dados salvos. Você pode exportar o arquivo original antes de recomeçar, ou restaurar uma cópia válida.</p><div class="stack">'+button('Exportar dados originais','export','','primary')+button('Restaurar uma cópia','import','','secondary')+button('Começar de novo','reset','','secondary')+(A&&A.status().user?button('Sair e usar sem conta','account-signout','','secondary'):'')+'</div></div></main>';return;
    }
    document.body.classList.toggle('reduce-motion',state.reducedMotion);
    if(!state.onboarded&&route!=='account')app.innerHTML=onboarding();
    else if(route==='lesson')app.innerHTML='<main class="session-shell screen-enter">'+lessonView()+'</main>';
    else {
      const pages={home,courses,course:coursePage,review:reviewPage,profile:profilePage,notebook:notebookPage,reading:readingPage,account:()=>accountUI?accountUI.page():profilePage(),classrooms:()=>classroomsUI?classroomsUI.page():profilePage()};
      app.innerHTML='<div class="shell">'+header()+'<main class="screen-enter">'+(pages[route]||home)()+'</main></div>'+nav();
    }
    if(storageFailed)app.insertAdjacentHTML('afterbegin','<div class="storage-warning" role="alert">O progresso não está sendo salvo. Exporte uma cópia em Você.</div>');
    if(scroll)window.scrollTo(0,0);
  }
  function navigate(name) {
    route=name;
    if(name==='classrooms'&&classroomsUI)classroomsUI.loadMyClassrooms();
    render();
  }
  function modal(title,content,actions) {
    modalPreviousFocus=document.activeElement;
    modalRoot.innerHTML='<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">'+esc(title)+'</h2>'+content+'<div class="actions">'+actions+'</div></section></div>';
    document.body.style.overflow='hidden';
    const f=modalRoot.querySelector('input,button,textarea,select');if(f)f.focus();
  }
  function closeModal() { modalRoot.innerHTML='';document.body.style.overflow='';if(modalPreviousFocus&&modalPreviousFocus.isConnected)modalPreviousFocus.focus();modalAction=null; }
  function confirmAction(title,content,label,fn,danger=false) {
    modalAction=fn;
    modal(title,'<p>'+esc(content)+'</p>',button(label,'confirm-modal','',danger?'danger':'primary')+button('Cancelar','close-modal','','secondary'));
  }
  function startLesson(id,force=false) {
    const l=catalog.lessons[id];if(!l)return;
    const c=catalog.courses[l.courseId];
    if(!C.unlocked(state,c,id)){toast('Conclua a lição anterior para continuar.');return;}
    if(state.session&&!state.session.finished&&!force) {
      if(state.session.kind==='lesson'&&state.session.lessonId===id){navigate('lesson');return;}
      confirmAction('Começar outra atividade?','A atividade em andamento será reiniciada. As lições já concluídas continuam salvas.','Começar esta lição',()=>startLesson(id,true));return;
    }
    state.activeCourse=c.id;viewCourse=c.id;
    state.session=C.newSession('lesson',id,l.questions.map(q=>q.id));save();navigate('lesson');
  }
  function startReview(mode,force=false) {
    if(state.session&&!state.session.finished&&!force){
      if(state.session.kind==='review'){navigate('lesson');return;}
      confirmAction('Começar a revisão?','A aula em andamento será reiniciada. As lições já concluídas continuam salvas.','Começar revisão',()=>startReview(mode,true));return;
    }
    const ids=(mode==='all'?Object.keys(state.reviews).sort((a,b)=>state.reviews[a].due-state.reviews[b].due):C.due(state)).slice(0,5);
    if(!ids.length){toast('Conclua uma lição para liberar revisões.');return;}
    state.session=C.newSession('review','',ids);save();navigate('lesson');
  }
  function chooseGoal() {
    modal('Um ritmo que cabe no seu dia.','<p>Escolha sua meta diária de pontos. Você pode estudar quanto quiser.</p><div class="goal-options">'+goals(state.goal,'set-goal')+'</div>',button('Pronto','close-modal','','primary'));
  }
  function exportProgress() {
    if(native){native.exportProgress();return;}
    const text=recovery?(localStorage.getItem(STORAGE)||''):JSON.stringify(state,null,2);
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='faisca-progresso.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Arquivo de progresso preparado.');
  }
  function importProgress(raw,expectedOwner=null) {
    try {
      if(expectedOwner!==null&&A&&expectedOwner!==A.owner())throw Error('account changed');
      if(typeof raw!=='string'||raw.length>8*1024*1024)throw Error('size');
      const imported=C.sanitize(JSON.parse(raw),catalog);
      if(!imported.onboarded)throw Error('empty');
      const previous=state,wasRecovery=recovery;
      state=A&&A.status().user&&!recovery?S.merge(state,imported,null,catalog):imported;recovery=false;
      if(!save()){state=previous;recovery=wasRecovery;throw Error('save');}
      viewCourse=state.activeCourse;route='profile';closeModal();render();toast('Seu progresso foi restaurado.');
    } catch(e) { toast('Arquivo inválido ou não foi possível salvar. O progresso anterior foi mantido.'); }
  }
  function beginImport() {
    if(native){native.importProgress();return;}
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{
      const f=input.files[0];if(!f)return;
      if(f.size>8*1024*1024){toast('Esse arquivo é maior que o limite de 8 MB.');return;}
      const raw=await f.text();
      confirmAction('Restaurar progresso?','Um arquivo válido substituirá o progresso atual deste navegador.','Restaurar',()=>importProgress(raw));
    };input.click();
  }
  document.addEventListener('click',function(event){
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    const a=b.dataset.action,id=b.dataset.id;
    if(a==='close-modal'){closeModal();return;}
    if(a==='confirm-modal'){const fn=modalAction;closeModal();if(fn)fn();return;}
    if(a==='nav'){navigate(b.dataset.route);return;}
    if(a==='home'){if(!state.onboarded){onboardStep=0;route='home';render();}else navigate('home');return;}
    if(accountUI&&accountUI.action(a,b))return;
    if(classroomsUI&&classroomsUI.action(a,b))return;
    if(a==='course'){viewCourse=id;navigate('course');return;}
    if(a==='category'){category=id;render(false);return;}
    if(a==='onboard-next'){
      if(onboardStep===1){const field=document.getElementById('learner-name');draft.name=field.value.trim();if(!draft.name){toast('Como podemos chamar você?');field.focus();return;}}
      onboardStep=Math.min(2,onboardStep+1);render();return;
    }
    if(a==='onboard-back'){onboardStep=Math.max(0,onboardStep-1);render();return;}
    if(a==='onboard-goal'){draft.name=document.getElementById('learner-name').value;draft.goal=Number(b.dataset.goal);render(false);return;}
    if(a==='onboard-course'){draft.course=id;render(false);return;}
    if(a==='onboard-finish'){state.name=draft.name.trim();state.goal=draft.goal;state.activeCourse=draft.course;state.onboarded=true;save();navigate('home');return;}
    if(a==='continue'){
      if(state.session&&!state.session.finished){navigate('lesson');return;}
      const c=catalog.courses[state.activeCourse],l=c.lessons.find(l=>!state.completed[l.id]);
      if(l)startLesson(l.id);else{viewCourse=c.id;navigate('course');}return;
    }
    if(a==='start-lesson'){startLesson(id);return;}
    if(a==='leave-lesson'){save();navigate('home');toast('Aula pausada. Você pode retomar quando quiser.');return;}
    if(a==='theory-next'){state.session.phase++;save();render();return;}
    if(a==='theory-back'){state.session.phase=0;save();render();return;}
    if(a==='bookmark'){
      const i=state.bookmarks.indexOf(id);if(i>=0)state.bookmarks.splice(i,1);else state.bookmarks.push(id);
      save();render(false);toast(i>=0?'Lição removida dos salvos.':'Lição salva no seu caderno.');return;
    }
    if(a==='choose'){
      const s=state.session;if(!s||s.checked)return;s.selected=Number(b.dataset.index);save();
      document.querySelectorAll('.choice').forEach(x=>{const picked=Number(x.dataset.index)===s.selected;x.classList.toggle('selected',picked);x.setAttribute('aria-checked',String(picked));});
      document.querySelector('[data-action="answer"]').disabled=false;return;
    }
    if(a==='locate-problem'){
      const start=Number(b.dataset.start)||0, end=Number(b.dataset.end)||0;
      const s=state.session;
      if(s&&s.checked&&!s.correct){
        C.retry(state,catalog);
        save();
        render(false);
      }
      const field=document.getElementById('answer');
      if(field){
        field.disabled=false;
        field.focus();
        try{field.setSelectionRange(start,end);}catch(e){}
        if(field.scrollIntoView)field.scrollIntoView({behavior:state.reducedMotion?'auto':'smooth',block:'nearest'});
        updateEditorMeta(field);
      }
      return;
    }
    if(a==='answer'){
      const s=state.session;if(!s||s.phase!==2)return;
      if(s.checked){
        if(s.correct)C.nextQuestion(state);
        else C.retry(state,catalog);
        save();render();
        const q=catalog.questions[s.qids[s.index]];
        if(q&&q.answerMode==='code'){
          const field=document.getElementById('answer');
          if(field)field.focus();
        }
        return;
      }
      const q=catalog.questions[s.qids[s.index]],answer=q.type==='choice'?s.selected:s.value;
      if(q.type==='choice'?answer<0:!String(answer).trim())return;
      C.check(state,catalog,answer);save();render(false);
      const feedback=document.querySelector('.feedback');if(feedback){feedback.scrollIntoView({behavior:state.reducedMotion?'auto':'smooth',block:'nearest'});feedback.focus({preventScroll:true});}return;
    }
    if(a==='hint'){
      const s=state.session,q=catalog.questions[s.qids[s.index]],l=catalog.lessons[q.lessonId];
      modal('Volte à ideia.', '<p>'+esc(l.paragraphs[l.paragraphs.length-1])+'</p><p>'+esc(l.tip)+'</p>',button('Voltar ao exercício','close-modal','','primary'));return;
    }
    if(a==='result-close'||a==='result-next'){
      const s=state.session,l=s&&catalog.lessons[s.lessonId],c=l&&catalog.courses[l.courseId];
      const next=c&&c.lessons.find(l=>!state.completed[l.id]);state.session=null;save();
      if(a==='result-next'&&next)startLesson(next.id);else navigate('home');return;
    }
    if(a==='start-review'){startReview(b.dataset.mode);return;}
    if(a==='goal'){chooseGoal();return;}
    if(a==='set-goal'){state.goal=Number(b.dataset.goal);save();render(false);chooseGoal();return;}
    if(a==='notebook'){navigate('notebook');return;}
    if(a==='notebook-filter'){notebookFilter=id;render(false);return;}
    if(a==='read'){readId=id;navigate('reading');return;}
    if(a==='motion'){state.reducedMotion=!state.reducedMotion;save();render(false);toast(state.reducedMotion?'Movimentos reduzidos.':'Animações suaves ativadas.');return;}
    if(a==='install-app'){
      if(!installPrompt){toast('Use a opção de instalar aplicativo do seu navegador.');return;}
      const prompt=installPrompt;installPrompt=null;prompt.prompt();
      prompt.userChoice.then(choice=>{if(choice&&choice.outcome==='accepted'){installed=true;toast('Faísca instalado neste computador.');}render(false);});return;
    }
    if(a==='edit-profile'){
      modal('Do seu jeito.','<div class="field"><label for="edit-name">Seu nome</label><input id="edit-name" maxlength="30" value="'+esc(state.name)+'"></div><div class="field"><label for="edit-goal">Meta diária</label><select id="edit-goal">'+[15,30,60].map(x=>'<option value="'+x+'" '+(x===state.goal?'selected':'')+'>'+x+' XP</option>').join('')+'</select></div>',button('Salvar alterações','save-profile','','primary')+button('Cancelar','close-modal','','secondary'));return;
    }
    if(a==='save-profile'){
      const name=document.getElementById('edit-name').value.trim();if(!name){toast('Digite seu nome ou apelido.');return;}
      state.name=name;state.goal=Number(document.getElementById('edit-goal').value);save();closeModal();render();toast('Seu perfil foi atualizado.');return;
    }
    if(a==='export'){exportProgress();return;}
    if(a==='import'){beginImport();return;}
    if(a==='about'){
      modal('Aprender é criar.','<p><b>Faísca 1.5.0</b> é um curso de programação com 12 trilhas, '+lessonTotal+' lições e '+questionTotal+' exercícios. Todas as 12 trilhas contam com 480 desafios de escrever a linha inteira ao final de cada lição. HTML e CSS são ensinados como tecnologias de estrutura e estilo.</p><p>Você lê exemplos comentados e responde a exercícios corrigidos. O app não é um compilador de código livre. Os projetos podem ser continuados em um ambiente da linguagem.</p><p>As lições funcionam offline. Sem conta, o progresso fica neste dispositivo. Ao entrar em uma conta, e-mail e progresso são enviados ao serviço do Faísca. A sincronização precisa de internet e do app aberto. Antes de trocar de celular ou computador, confira a última sincronização ou exporte uma cópia.</p><p>Professores podem publicar trabalhos, projetos e lições de casa com prazo nas salas. O aluno acompanha as atividades e o avanço até a lição indicada.</p><p>30 XP por lição nova, mais 5 por acerto de primeira. Repetir uma lição em outro dia rende 5 XP; revisões rendem 2 XP por acerto de primeira, uma vez por exercício a cada dia. O nível sobe a cada 250 XP.</p><p>Conteúdo de autoria própria. A pasta docs do projeto contém o programa do curso e referências oficiais para continuar estudando.</p>',button('Continuar aprendendo','close-modal','','primary'));return;
    }
    if(a==='reset'){
      if(A&&A.status().user){toast('Para começar um perfil local do zero, saia da conta em Conta e sincronização.');return;}
      modal('Recomeçar do zero?','<p>Isso apagará seu nome, XP, lições, revisões e anotações deste aparelho. Exporte uma cópia antes, se quiser guardar.</p><div class="field"><label for="reset-confirm">Digite APAGAR para confirmar</label><input id="reset-confirm" autocomplete="off" placeholder="APAGAR"></div>',button('Apagar progresso','reset-confirm','','danger')+button('Cancelar','close-modal','','secondary'));return;
    }
    if(a==='reset-confirm'){
      if(A&&A.status().user){closeModal();toast('A conta mudou. O progresso foi preservado.');return;}
      if(document.getElementById('reset-confirm').value!=='APAGAR'){toast('Digite APAGAR para confirmar.');return;}
      const previous=state,wasRecovery=recovery;state=C.fresh();recovery=false;
      if(!save()){state=previous;recovery=wasRecovery;toast('Não foi possível apagar. Tente novamente.');return;}
      draft={name:'',goal:30,course:'python'};onboardStep=0;route='home';closeModal();render();return;
    }
  });
  document.addEventListener('submit',function(e){
    if(e.target.id==='account-form'){e.preventDefault();if(accountUI)accountUI.submit();}
  });
  document.addEventListener('input',function(e){
    if(e.target.id==='course-search'||e.target.id==='note-search'){
      const id=e.target.id,caret=e.target.selectionStart,value=e.target.value;
      if(id==='course-search')search=value;else noteSearch=value;
      render(false);const input=document.getElementById(id);input.focus();try{input.setSelectionRange(caret,caret);}catch(ignored){}return;
    }
    if(e.target.id==='learner-name'){draft.name=e.target.value;return;}
    if(e.target.id==='answer'){
      const field=e.target;
      if(state.session&&!state.session.checked){
        state.session.value=field.value;save();
        const check=document.querySelector('[data-action="answer"]');if(check)check.disabled=!field.value.trim();
      }
      syncEditorBackdrop(field);
      scheduleLiveAnalysis(field);
      return;
    }
    if(e.target.id==='lesson-note'){
      state.notes[e.target.dataset.id]=e.target.value;const success=save();
      document.getElementById('note-save-status').textContent=success?'Anotação salva neste aparelho':'Não foi possível salvar';
      document.getElementById('note-count').textContent=e.target.value.length+'/2000';
    }
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!modalRoot.firstChild){
      const s=state.session;
      if(s&&s.phase<2&&e.target.id!=='answer'){
        const btn=document.querySelector('[data-action="theory-next"]');
        if(btn&&!btn.disabled){e.preventDefault();btn.click();return;}
      }
    }
    if(e.target.id==='answer'&&e.key==='Tab'){
      e.preventDefault();
      const field=e.target,start=field.selectionStart,end=field.selectionEnd;
      field.value=field.value.substring(0,start)+'  '+field.value.substring(end);
      field.selectionStart=field.selectionEnd=start+2;
      if(state.session&&!state.session.checked){state.session.value=field.value;save();}
      syncEditorBackdrop(field);
      return;
    }
    if(modalRoot.firstChild){
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key==='Tab'){
        const controls=[...modalRoot.querySelectorAll('button,input,textarea,select,a[href]')].filter(x=>!x.disabled);
        const first=controls[0],last=controls[controls.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }
    if(e.target.matches('[role="radio"]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const choices=[...document.querySelectorAll('.choice:not(:disabled)')],i=choices.indexOf(e.target);
      const move=e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1,next=choices[(i+move+choices.length)%choices.length];if(next){next.focus();next.click();}
    }
  });
  document.addEventListener('scroll',function(e){
    if(e.target&&e.target.id==='answer'){
      const b=document.getElementById('editor-backdrop');if(b){b.scrollTop=e.target.scrollTop;b.scrollLeft=e.target.scrollLeft;}
      const g=document.getElementById('editor-gutter');if(g){g.scrollTop=e.target.scrollTop;}
    }
  },true);
  document.addEventListener('keyup',function(e){
    if(e.target&&e.target.id==='answer')updateEditorMeta(e.target);
  });
  window.FaiscaApp={
    importProgress,
    back(){
      if(modalRoot.firstChild){closeModal();return true;}
      if(route==='account'){navigate(state.onboarded?'profile':'home');return true;}
      if(route==='classrooms'){if(classroomsUI)classroomsUI.setSubView('list');navigate('profile');return true;}
      if(!state.onboarded){if(onboardStep>0){onboardStep--;render();return true;}return false;}
      if(route==='lesson'){save();navigate('home');return true;}
      if(route==='reading'){navigate('notebook');return true;}
      if(route==='course'){navigate('courses');return true;}
      if(route!=='home'){navigate('home');return true;}return false;
    }
  };
  window.addEventListener('pagehide',()=>save());
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){save();if(A)A.pause();}
    else{if(A)A.resume();if(!['lesson','reading','account','classrooms'].includes(route)&&state.onboarded&&!modalRoot.firstChild)render(false);}
  });
  window.addEventListener('online',()=>{if(A)A.resume();});
  if(web&&web.platform!=='desktop'){
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(state.onboarded)render(false);});
    window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;if(state.onboarded)render(false);toast('Faísca instalado neste computador.');});
    if(typeof navigator!=='undefined'&&'serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
  if(A&&window.FaiscaClassrooms&&window.FaiscaClassroomsUI){
    classroomsManager=window.FaiscaClassrooms.createManager({account:A,core:C,catalog});
    classroomsUI=window.FaiscaClassroomsUI.createUI(classroomsManager,{
      esc,icon,button,toast,render,navigate,confirm:confirmAction,
      catalog,curriculum,state:()=>state,account:A,route:()=>route,
      openCourse(courseId){if(catalog.courses[courseId]){viewCourse=courseId;navigate('course');}},
      setSala(tracks){classroomTracks=Array.isArray(tracks)&&tracks.length?tracks:null;render(false);}
    });
  }
  if(A&&window.FaiscaAccountUI){
    accountUI=window.FaiscaAccountUI(A,{esc,icon,button,toast,render,navigate,confirm:confirmAction,state:()=>state,route:()=>route,startStudy(){if(!state.onboarded)onboardStep=1;navigate('home');}});
    A.init({
      state:()=>{if(recovery)throw Error('Restaure uma cópia válida antes de sincronizar.');return state;},
      apply(value,owner){
        if(owner!==A.owner())return false;
        const previous=state;state=value;
        if(!save(false)){state=previous;return false;}
        viewCourse=state.activeCourse;
        if(!['lesson','reading','account','classrooms'].includes(route)&&!modalRoot.firstChild)render(false);
        return true;
      },
      load(value,owner,invalid=false){state=value;viewCourse=state.activeCourse;recovery=invalid;closeModal();},
      account:(s,previous)=>{
        accountUI.changed(s,previous);
        if(classroomsUI)classroomsUI.onAuthChanged();
      },
      status:()=>{accountUI.statusChanged();refreshSyncBadge();}
    });
  }
  render();
})();

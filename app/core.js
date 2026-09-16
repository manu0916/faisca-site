(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FaiscaCore = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';
  const DAY = 86400000;
  const integer = (n, max = 10000000) => Number.isInteger(n) && n >= 0 && n <= max;
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function dayKey(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  }
  function dayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
  }
  function keyFromDay(day) { return new Date(day * DAY).toISOString().slice(0,10); }
  function validDay(key) {
    return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(Date.parse(key)) && new Date(key).toISOString().slice(0,10) === key;
  }
  function randomId(prefix='id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }
  function fresh() {
    return { version:1, exerciseVersion:3, onboarded:false, name:'', goal:30, activeCourse:'python', totalXp:0,
      completed:{}, reviews:{}, days:{}, studyDays:{}, rewards:{}, awardLog:{}, bookmarks:[], notes:{}, noteVersions:{}, session:null, reducedMotion:false };
  }
  function index(curriculum) {
    const courses=Object.create(null), lessons=Object.create(null), questions=Object.create(null);
    curriculum.courses.forEach(c => {
      courses[c.id]=c;
      c.lessons.forEach(l => {
        lessons[l.id]={...l, courseId:c.id};
        l.questions.forEach(q => { questions[q.id]={...q,lessonId:l.id,courseId:c.id}; });
      });
    });
    return {courses,lessons,questions};
  }
  function sanitize(value, catalog) {
    if (!object(value) || value.version!==1 || !object(value.completed) || !object(value.days)) throw Error('Formato de progresso inválido.');
    const s=fresh(), {courses,lessons,questions}=catalog;
    s.onboarded=value.onboarded===true;
    s.name=typeof value.name==='string' ? value.name.trim().slice(0,30) : '';
    s.goal=[15,30,60].includes(value.goal) ? value.goal : 30;
    s.activeCourse=courses[value.activeCourse] ? value.activeCourse : 'python';
    if (!integer(value.totalXp)) throw Error('XP inválido.');
    s.totalXp=value.totalXp;
    s.reducedMotion=value.reducedMotion===true;
    Object.entries(value.completed).forEach(([id,v])=>{
      if (!lessons[id]) return;
      if (!object(v)||!integer(v.score,3)||!integer(v.times,100000)||!integer(v.day,100000)) throw Error('Lição inválida.');
      s.completed[id]={score:v.score,times:v.times,day:v.day};
    });
    Object.entries(value.days).slice(-4000).forEach(([key,v])=>{
      if (!validDay(key)||!integer(v)) throw Error('Histórico inválido.');
      s.days[key]=v;
      if(v>0)s.studyDays[key]=true;
    });
    if(object(value.studyDays))Object.entries(value.studyDays).slice(-4000).forEach(([key,v])=>{
      if(validDay(key)&&v===true)s.studyDays[key]=true;
    });
    if (object(value.reviews)) Object.entries(value.reviews).forEach(([id,v])=>{
      if (questions[id]&&object(v)&&integer(v.due,100000)&&integer(v.box,5))
        s.reviews[id]={due:v.due,box:v.box,error:v.error===true};
    });
    if (object(value.rewards)) Object.entries(value.rewards).slice(-10000).forEach(([key,v])=>{
      if (/^\d{4}-\d{2}-\d{2}:[a-z0-9-]+$/.test(key)&&v===true) s.rewards[key]=true;
    });
    if(object(value.awardLog))Object.entries(value.awardLog).forEach(([key,n])=>{
      if(/^\d{4}-\d{2}-\d{2}:[a-z0-9-]+$/.test(key)&&validDay(key.slice(0,10))&&integer(n,45)&&n>0){
        s.awardLog[key]=n;s.rewards[key]=true;
      }
    });
    s.bookmarks=Array.isArray(value.bookmarks) ? [...new Set(value.bookmarks.filter(id=>lessons[id]))] : [];
    if (object(value.notes)) Object.entries(value.notes).forEach(([id,v])=>{
      if(lessons[id]&&typeof v==='string') s.notes[id]=v.slice(0,2000);
    });
    if(object(value.noteVersions))Object.entries(value.noteVersions).forEach(([id,versions])=>{
      if(lessons[id]&&Array.isArray(versions))s.noteVersions[id]=[...new Set(versions.filter(x=>typeof x==='string').map(x=>x.slice(0,2000)))].slice(-8);
    });
    const x=value.session;
    if (object(x)&&['lesson','review'].includes(x.kind)&&Array.isArray(x.qids)&&x.qids.length>0&&x.qids.length<=10&&
        x.qids.every(id=>questions[id])&&new Set(x.qids).size===x.qids.length&&integer(x.phase,3)&&
        integer(x.index,x.qids.length-1)&&integer(x.first,x.qids.length)&&object(x.tries)&&
        (x.kind==='review'||lessons[x.lessonId])) {
      const tries={};
      x.qids.forEach(id=>{tries[id]=integer(x.tries[id],10000)?x.tries[id]:0;});
      // A lesson session can contain only that lesson's exercises.
      if(x.kind==='review'||x.qids.every(id=>questions[id].lessonId===x.lessonId)) {
        const sessionId = typeof x.sessionId === 'string' && x.sessionId.length > 3 ? x.sessionId.slice(0, 80) : randomId('sess');
        s.session={sessionId,kind:x.kind,lessonId:x.lessonId||'',qids:x.qids,phase:x.phase,index:x.index,first:x.first,tries,
          checked:x.checked===true,correct:x.correct===true,value:typeof x.value==='string'?x.value.slice(0,500):'',
          selected:integer(x.selected,10)?x.selected:-1,finished:x.finished===true&&x.phase===3,
          award:integer(x.award,1000)?x.award:0};
      }
    }
    // Old full progress remains valid. Only an unfinished, changed question
    // needs a new answer; an old accepted gap cannot complete the new challenge.
    if ((value.exerciseVersion || 1) < 3 && s.session && !s.session.finished) {
      const session=s.session;
      const isConvertedTrack = (id) => {
        if (!questions[id] || questions[id].answerMode !== 'code') return false;
        if (!value.exerciseVersion || value.exerciseVersion < 2) return true;
        return !['python', 'java', 'sql'].includes(questions[id].language);
      };
      if(session.kind==='review' && session.qids.some(isConvertedTrack)) {
        s.session=newSession('review','',session.qids);
      } else if(session.phase===2 && isConvertedTrack(session.qids[session.index])) {
        const id=session.qids[session.index];
        if(session.checked&&session.correct&&session.tries[id]===1)session.first=Math.max(0,session.first-1);
        session.tries[id]=0;
        Object.assign(session,{checked:false,correct:false,value:'',selected:-1});
      }
    }
    return s;
  }
  function codeTokens(text, language) {
    // A conservative lexer for the single-line constructs in our authored
    // answers. It never runs student code or equates arbitrary programs.
    const source=String(text).replace(/\r\n?/g,'\n').trim(), tokens=[];
    if(!source || source.length>500 || source.includes('\n'))return null;
    let i=0;
    const operators=language==='python'
      ? ['**=','//=','<<=','>>=',':=','==','!=','<=','>=','+=','-=','*=','/=','%=','&=','|=','^=','**','//','<<','>>','->']
      : language==='java'
      ? ['>>>=','>>>','>>=','<<=','>>','<<','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','&=','|=','^=','->','::','...']
      : language==='sql'
      ? ['->>','->','==','!=','<>','<=','>=','||','<<','>>']
      : (language==='javascript'||language==='typescript')
      ? ['===','!==','??=','&&=','||=','**=','<<=','>>>=','>>=','=>','?.','??','**','++','--','+=','-=','*=','/=','%=','&=','|=','^=','==','!=','<=','>=','&&','||','<<','>>','>>>','...']
      : language==='kotlin'
      ? ['===','!==','?:','?.','!!','->','::','..','+=','-=','*=','/=','%=','==','!=','<=','>=','&&','||','++','--']
      : language==='c'
      ? ['->','++','--','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','==','!=','<=','>=','&&','||','<<','>>']
      : language==='cpp'
      ? ['::','<<=','>>=','<=>','<<','>>','->*','->','++','--','+=','-=','*=','/=','%=','&=','|=','^=','==','!=','<=','>=','&&','||']
      : language==='csharp'
      ? ['=>','??=','?.','??','++','--','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','==','!=','<=','>=','&&','||','<<','>>']
      : language==='php'
      ? ['===','!==','<=>','??=','??','?->','->','=>','::','++','--','+=','-=','*=','/=','%=','&=','|=','^=','==','!=','<=','>=','&&','||','**=','**']
      : language==='swift'
      ? ['...','..<','->','??','+=','-=','*=','/=','%=','&=','|=','^=','==','!=','<=','>=','&&','||','++','--']
      : language==='web'
      ? ['<!--','-->','</','/>','~=','|=','^=','$=','*=','::','>=','<=','==','!=']
      : ['==','!=','<=','>=','+=','-=','*=','/='];
    let inCssSelector=language==='web'&&!source.trim().startsWith('<');
    let parenDepth=0, bracketDepth=0, sawWhitespace=false;
    while(i<source.length) {
      const rest=source.slice(i), ch=source[i];
      if((language==='python'&&ch==='#') ||
         (language==='php'&&(rest.startsWith('//')||rest.startsWith('/*')||ch==='#')) ||
         (language==='sql'&&(rest.startsWith('--')||rest.startsWith('/*'))) ||
         (language==='web'&&(rest.startsWith('<!--')||rest.startsWith('/*'))) ||
         (!['python','sql','web','php'].includes(language)&&(rest.startsWith('//')||rest.startsWith('/*'))))return null;
      if(/[ \t\f]/.test(ch)){sawWhitespace=true;i++;continue;}
      if(sawWhitespace&&inCssSelector&&parenDepth===0&&bracketDepth===0&&tokens.length>0){
        const last=tokens[tokens.length-1], lastType=last[0], lastVal=last[1];
        const canPrecede=['name','number','string','literal'].includes(lastType)||(lastType==='symbol'&&[']',')','*','%'].includes(lastVal));
        const canFollow=/[A-Za-z0-9_.*#:[A-Za-z]/.test(ch)&&!['>','+','~',',','{','}',';'].includes(ch);
        if(canPrecede&&canFollow)tokens.push(['combinator',' ']);
      }
      sawWhitespace=false;
      if(language==='web'){
        if(ch==='{')inCssSelector=false;
        else if(ch==='}')inCssSelector=true;
      }
      if(ch==='"'||ch==="'") {
        const start=i, quote=ch; let value='', closed=false, escaped=false;
        i++;
        while(i<source.length) {
          const c=source[i++];
          if(c===quote) {
            if(language==='sql'&&source[i]===quote){value+=quote;i++;continue;}
            closed=true;break;
          }
          if(c==='\\'&&language!=='sql') {
            escaped=true;if(i>=source.length)return null;
            value+=c+source[i++];
          } else value+=c;
        }
        if(!closed)return null;
        const normQuote=['python','javascript','typescript','web'].includes(language)&&!escaped;
        tokens.push(normQuote ? ['string',value] : ['literal',source.slice(start,i)]);
        continue;
      }
      if(language==='web'){
        if(rest.startsWith('</')){tokens.push(['symbol','</']);i+=2;continue;}
        if(rest.startsWith('/>')){tokens.push(['symbol','/>']);i+=2;continue;}
      }
      const op=operators.find(x=>rest.startsWith(x));
      if(op){tokens.push(['symbol',op]);i+=op.length;continue;}
      const namePattern=language==='web' ? /^(?:--[a-zA-Z0-9_-]+|[A-Za-z_$][A-Za-z0-9_$-]*)/ : /^[A-Za-z_$][A-Za-z0-9_$]*/;
      const name=namePattern.exec(rest);
      if(name) {
        tokens.push(['name',language==='sql'?name[0].toLowerCase():name[0]]);
        i+=name[0].length;continue;
      }
      if(language==='web'&&ch==='#'){
        const hex=/^#[0-9a-fA-F]{3,8}\b/.exec(rest);
        if(hex){tokens.push(['color',hex[0].toLowerCase()]);i+=hex[0].length;continue;}
      }
      const numPattern=language==='web' ? /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ms|s|fr|%|deg|vh|vw)?/i : /^(?:0[xX][0-9a-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[lLfFdD]?/;
      const number=numPattern.exec(rest);
      if(number){tokens.push(['number',number[0]]);i+=number[0].length;continue;}
      if(ch==='(')parenDepth++;
      else if(ch===')')parenDepth=Math.max(0,parenDepth-1);
      else if(ch==='[')bracketDepth++;
      else if(ch===']')bracketDepth=Math.max(0,bracketDepth-1);
      if(/[()[\]{},.;:+\-*/%<>=!&|^~?@#]/.test(ch)){tokens.push(['symbol',ch]);i++;continue;}
      if(language==='web'){
        const textMatch=/^[^<>{}\n]+/.exec(rest);
        if(textMatch){
          const t=textMatch[0].trim();
          if(t)tokens.push(['text',t]);
          i+=textMatch[0].length;continue;
        }
      }
      return null;
    }
    return JSON.stringify(tokens);
  }
  function normalize(text, q) {
    let value=String(text).normalize('NFC').replace(/\r\n?/g,'\n').trim();
    if(q.caseInsensitive) value=value.toLocaleLowerCase('pt-BR');
    return value;
  }
  function isCorrect(question, value) {
    if(question.type==='choice') return integer(value,question.options.length-1)&&question.options[value].correct===true;
    if(question.answerMode==='code') {
      const typed=codeTokens(value,question.language);
      return typed!==null&&question.answers.some(a=>codeTokens(a,question.language)===typed);
    }
    return question.answers.some(a=>normalize(a,question)===normalize(value,question));
  }
  function unlocked(state, course, id) {
    const i=course.lessons.findIndex(l=>l.id===id);
    return i>=0 && (i===0 || !!state.completed[course.lessons[i-1].id]);
  }
  function due(state, today=dayNumber()) {
    return Object.entries(state.reviews).filter(([,r])=>r.due<=today)
      .sort((a,b)=>(Number(b[1].error)-Number(a[1].error))||(a[1].due-b[1].due)||a[0].localeCompare(b[0])).map(([id])=>id);
  }
  function streak(state,today=dayNumber()) {
    let end=today, count=0;
    const studied=d=>(state.studyDays&&state.studyDays[keyFromDay(d)])||state.days[keyFromDay(d)]>0;
    if(!studied(end)) end--;
    while(studied(end)){count++;end--;}
    return count;
  }
  function longestStreak(state) {
    let best=0,run=0,previous=-2;
    [...new Set([...Object.keys(state.studyDays||{}),...Object.keys(state.days).filter(k=>state.days[k]>0)])].sort().forEach(k=>{
      const d=Math.floor(Date.parse(k)/DAY);run=d===previous+1?run+1:1;
      best=Math.max(best,run);previous=d;
    });
    return best;
  }
  let eventListeners = [];
  function addEventListener(fn) { if(typeof fn==='function'&&!eventListeners.includes(fn))eventListeners.push(fn); }
  function removeEventListener(fn) { eventListeners=eventListeners.filter(f=>f!==fn); }
  function dispatchEvent(event) {
    for(const fn of eventListeners) { try{ fn(event); }catch(ignored){} }
  }
  function createLearningEvent(session, question, eventType, extra={}) {
    const sId = session ? (session.sessionId || 'sess_default') : 'sess_default';
    const qId = question ? question.id : (extra.questionId || null);
    const attempt = extra.attempt || 1;
    let id = extra.id;
    if(!id) {
      if(eventType === 'answer_submitted') id = 'evt_' + sId + '_' + qId + '_' + attempt;
      else if(eventType === 'exercise_completed') id = 'evt_' + sId + '_' + qId + '_done';
      else if(eventType === 'lesson_completed') id = 'evt_' + sId + '_lesson_' + (session.lessonId || 'done');
      else if(eventType === 'review_completed') id = 'evt_' + sId + '_review_done';
      else id = 'evt_' + sId + '_' + Date.now().toString(36);
    }
    return {
      id,
      sessionId: sId,
      courseId: question ? question.courseId : (extra.courseId || (session && session.lessonId ? session.lessonId.split('-')[0] : 'general')),
      lessonId: question ? question.lessonId : (extra.lessonId || (session ? session.lessonId : null)),
      questionId: qId,
      exerciseVersion: 3,
      eventType,
      isCorrect: extra.isCorrect !== undefined ? extra.isCorrect : null,
      attempt,
      payload: extra.payload || {},
      clientTime: new Date().toISOString()
    };
  }
  function newSession(kind,lessonId,qids) {
    return {sessionId:randomId('sess'),kind,lessonId,qids,phase:kind==='lesson'?0:2,index:0,first:0,tries:{},checked:false,correct:false,value:'',selected:-1,finished:false,award:0};
  }
  function check(state,catalog,answer,today=dayNumber()) {
    const s=state.session;
    if(!s||s.phase!==2||s.checked||s.finished) return false;
    const id=s.qids[s.index], q=catalog.questions[id];
    const correct=isCorrect(q,answer);
    s.tries[id]=(s.tries[id]||0)+1;
    s.checked=true;s.correct=correct;
    if(q.type==='choice')s.selected=answer;else s.value=String(answer);
    if(correct&&s.tries[id]===1)s.first++;
    if(!correct)state.reviews[id]={due:today,box:0,error:true};
    if(correct&&s.kind==='review') {
      const previous=state.reviews[id]||{box:0};
      const box=s.tries[id]===1?Math.min(previous.box+1,5):0;
      state.reviews[id]={due:today+([1,3,7,14,30,60][box]),box,error:s.tries[id]!==1};
    }
    const attemptEvt = createLearningEvent(s, q, 'answer_submitted', { isCorrect: correct, attempt: s.tries[id] });
    dispatchEvent(attemptEvt);
    if(correct) {
      const compEvt = createLearningEvent(s, q, 'exercise_completed', { isCorrect: true, attempt: s.tries[id] });
      dispatchEvent(compEvt);
    }
    return correct;
  }
  function retry(state, catalog) {
    if(!state.session||state.session.correct) return;
    const s=state.session;
    let keepValue=false;
    if(catalog&&catalog.questions&&s.qids&&s.qids[s.index]){
      const q=catalog.questions[s.qids[s.index]];
      if(q&&q.answerMode==='code') keepValue=true;
    }
    Object.assign(s,{checked:false,correct:false,value:keepValue?s.value:'',selected:-1});
  }
  function reward(state,key,amount,day) {
    const full=keyFromDay(day)+':'+key;
    if(state.rewards[full])return 0;
    state.rewards[full]=true;
    state.awardLog[full]=amount;
    state.totalXp+=amount;
    const date=keyFromDay(day);state.days[date]=(state.days[date]||0)+amount;
    return amount;
  }
  function finish(state,today=dayNumber()) {
    const s=state.session;
    if(!s||s.finished||!s.correct||s.index!==s.qids.length-1||s.qids.some(id=>!s.tries[id]))return 0;
    let award=0;
    if(s.kind==='lesson') {
      const previous=state.completed[s.lessonId];
      award=reward(state,s.lessonId,previous?5:30+s.first*5,today);
      state.completed[s.lessonId]={score:Math.max(previous?previous.score:0,s.first),times:(previous?previous.times:0)+1,day:today};
      s.qids.forEach(id=>{if(!state.reviews[id])state.reviews[id]={due:today+1,box:0,error:false};});
    } else {
      s.qids.forEach(id=>{if(s.tries[id]===1)award+=reward(state,id,2,today);});
    }
    Object.assign(s,{phase:3,finished:true,award});
    state.studyDays[keyFromDay(today)]=true;
    const finEvt = createLearningEvent(s, null, s.kind==='lesson'?'lesson_completed':'review_completed', {
      courseId: (s.lessonId ? s.lessonId.split('-')[0] : (s.qids[0] ? s.qids[0].split('-')[0] : 'general')),
      lessonId: s.lessonId || null,
      isCorrect: true,
      attempt: 1,
      payload: { score: s.first, award }
    });
    dispatchEvent(finEvt);
    return award;
  }
  function nextQuestion(state,today=dayNumber()) {
    const s=state.session;
    if(!s||!s.checked||!s.correct||s.finished)return;
    if(s.index===s.qids.length-1){finish(state,today);return;}
    s.index++;s.checked=false;s.correct=false;s.selected=-1;s.value='';
  }
  return {fresh,index,sanitize,normalize,codeTokens,isCorrect,unlocked,due,streak,longestStreak,dayKey,dayNumber,keyFromDay,newSession,check,retry,finish,nextQuestion,createLearningEvent,addEventListener,removeEventListener,randomId};
});

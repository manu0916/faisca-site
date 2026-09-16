(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.FaiscaCore);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FaiscaSync=api;
})(typeof window==='undefined'?this:window,function(C){
  'use strict';
  const canonical=value=>value&&typeof value==='object'
    ? Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
    : value;
  const stringify=value=>JSON.stringify(canonical(value));
  const same=(a,b)=>stringify(a)===stringify(b);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function merge(local,remote,baseline,catalog){
    const l=C.sanitize(local,catalog);
    if(!remote)return l;
    const r=C.sanitize(remote,catalog),b=baseline?C.sanitize(baseline,catalog):C.fresh(),out=clone(l);
    for(const field of ['name','goal','activeCourse','reducedMotion'])
      out[field]=same(l[field],b[field])?r[field]:l[field];
    out.onboarded=l.onboarded||r.onboarded;
    out.completed={...r.completed};
    for(const [id,v] of Object.entries(l.completed)){
      const prev=out.completed[id];
      out.completed[id]=prev?{score:Math.max(prev.score,v.score),times:Math.max(prev.times,v.times),day:Math.max(prev.day,v.day)}:v;
    }
    out.rewards={...r.rewards,...l.rewards};
    out.awardLog={...r.awardLog};
    for(const [id,n] of Object.entries(l.awardLog))out.awardLog[id]=Math.max(n,out.awardLog[id]||0);
    // Two offline devices may each consider the same lesson new on different days.
    // Keep its first completion bonus once; the later completion earns the normal 5 XP.
    const firstDay={};
    for(const key of Object.keys(out.awardLog).sort()){
      const id=key.slice(11);
      if(catalog.lessons[id]&&out.awardLog[key]>5){
        if(firstDay[id])out.awardLog[key]=5;else firstDay[id]=key;
      }
    }
    const sum=log=>Object.values(log).reduce((n,x)=>n+x,0);
    const oldXp=Math.max(0,l.totalXp-sum(l.awardLog),r.totalXp-sum(r.awardLog));
    out.totalXp=oldXp+sum(out.awardLog);
    out.days={};
    function totals(log){const values={};for(const [id,n] of Object.entries(log)){const day=id.slice(0,10);values[day]=(values[day]||0)+n;}return values;}
    const ld=totals(l.awardLog),rd=totals(r.awardLog),md=totals(out.awardLog);
    for(const day of new Set([...Object.keys(l.days),...Object.keys(r.days)]))
      out.days[day]=Math.max(0,(l.days[day]||0)-(ld[day]||0),(r.days[day]||0)-(rd[day]||0))+(md[day]||0);
    out.studyDays={...r.studyDays,...l.studyDays};
    out.reviews={};
    for(const id of new Set([...Object.keys(l.reviews),...Object.keys(r.reviews)])){
      const a=l.reviews[id],z=r.reviews[id],old=b.reviews[id];
      if(!a)out.reviews[id]=z;
      else if(!z||same(z,old))out.reviews[id]=a;
      else if(same(a,old))out.reviews[id]=z;
      else out.reviews[id]={due:Math.min(a.due,z.due),box:Math.min(a.box,z.box),error:a.error||z.error};
    }
    out.bookmarks=[...new Set([...l.bookmarks,...r.bookmarks,...b.bookmarks])]
      .filter(id=>l.bookmarks.includes(id)===b.bookmarks.includes(id)?r.bookmarks.includes(id):l.bookmarks.includes(id));
    out.notes={};out.noteVersions={...r.noteVersions};
    for(const id of new Set([...Object.keys(l.notes),...Object.keys(r.notes)])){
      const a=l.notes[id]||'',z=r.notes[id]||'',old=b.notes[id]||'';
      out.notes[id]=a===old?z:a;
      const history=[...(r.noteVersions[id]||[]),...(l.noteVersions[id]||[])];
      if(a!==z&&a!==old&&z!==old&&z)history.push(z);
      out.noteVersions[id]=[...new Set(history)].filter(x=>x&&x!==out.notes[id]).slice(-8);
    }
    // Keep a draft typed on this device; a new device can resume the cloud draft.
    out.session=same(l.session,b.session)?r.session:l.session;
    return C.sanitize(out,catalog);
  }
  return {merge,same,stringify};
});

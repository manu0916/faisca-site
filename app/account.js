(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FaiscaAccount=factory().create({core:root.FaiscaCore,sync:root.FaiscaSync,
    catalog:root.FaiscaCore.index(root.FAISCA_CURRICULUM),bridge:root.FaiscaNative});
})(typeof window==='undefined'?this:window,function(){
  'use strict';
  function create(options){
    const C=options.core,S=options.sync,catalog=options.catalog,bridge=options.bridge;
    const later=options.setTimeout||setTimeout,cancel=options.clearTimeout||clearTimeout;
    const clone=x=>JSON.parse(JSON.stringify(x));
    const pending=new Map();let serial=0,timer=null,running=null,hooks={},generation=0,authBusy=false;
    let info={ready:false,googleEnabled:false,owner:'guest',user:null,dirty:false,lastSync:'',needsLogin:false};
    try{if(bridge&&bridge.accountStatus)info=JSON.parse(bridge.accountStatus());}catch(ignored){}
    let phase=info.owner==='guest'?'local':info.dirty?'pending':'idle',error='';
    function status(){return {...info,phase,error,authBusy};}
    function notify(){if(hooks.status)hooks.status(status());}
    function clearTimer(){if(timer!==null)cancel(timer);timer=null;}
    function request(action,payload={}){
      if(!bridge||!bridge.cloudRequest)return Promise.reject(Error('As contas ainda não estão disponíveis nesta versão.'));
      const id='req-'+(++serial);
      return new Promise((resolve,reject)=>{
        const timeout=later(()=>{pending.delete(id);reject(Error('A conexão demorou. Tente novamente; seu progresso local foi mantido.'));},90000);
        pending.set(id,{resolve,reject,timeout});
        try{bridge.cloudRequest(id,action,JSON.stringify({...payload,owner:info.owner}));}
        catch(e){pending.delete(id);cancel(timeout);reject(Error('Não foi possível iniciar a conexão.'));}
      });
    }
    function receive(id,result){
      if(id==='oauth'){
        authBusy=false;
        if(result.ok){try{switchAccount(result);}catch(e){error=e.message;notify();}}
        else{error=result.error||'Não foi possível entrar pelo Google.';notify();}
        return;
      }
      const waiter=pending.get(id);if(!waiter)return;
      pending.delete(id);cancel(waiter.timeout);
      if(!result.ok){
        if(result.status&&result.status.owner===info.owner)info={...info,...result.status};
        const failure=Error(result.error||'Não foi possível conectar.');failure.code=result.code;waiter.reject(failure);
      }else waiter.resolve(result);
    }
    function schedule(){
      clearTimer();
      if(info.ready&&info.user&&!info.needsLogin&&!authBusy)
        timer=later(()=>{timer=null;synchronize().catch(()=>{});},2500);
    }
    function changed(){info.dirty=true;error='';if(!running)phase=info.user?'pending':'local';notify();schedule();}
    function current(g,owner){return generation===g&&info.owner===owner;}
    function apply(value,owner){
      if(owner!==info.owner)throw Error('A conta mudou. O progresso anterior foi preservado.');
      const clean=C.sanitize(value,catalog);
      if(!hooks.apply||hooks.apply(clean,owner)===false)throw Error('Não foi possível salvar neste aparelho. Exporte uma cópia do progresso.');
      return clean;
    }
    function switchAccount(result){
      if(!result.status)throw Error('Não foi possível confirmar a conta.');
      const previous=info.owner;
      let raw=result.progress;
      if(bridge&&bridge.accountStatus&&bridge.load){
        const live=JSON.parse(bridge.accountStatus());
        if(live.owner!==result.status.owner)return;
        result.status=live;raw=bridge.load();
      }
      // Reject stale saves from the previous owner in the native bridge as well.
      clearTimer();generation++;info={...result.status};phase=info.user?'pending':'local';error='';
      let value;
      try{value=raw?C.sanitize(JSON.parse(raw),catalog):C.fresh();}
      catch(e){
        if(hooks.load)hooks.load(C.fresh(),info.owner,true);
        throw Error('Não foi possível ler o progresso desta conta. Exporte a cópia original antes de restaurar.');
      }
      if(hooks.load)hooks.load(value,info.owner);
      if(hooks.account)hooks.account(status(),previous);
      notify();schedule();
    }
    async function auth(action,payload={}){
      if(authBusy)throw Error('Aguarde a tentativa em andamento.');
      authBusy=true;clearTimer();error='';notify();
      try{
        // Finish an in-flight merge before changing identity; all other changes remain local meanwhile.
        if(running)await running.catch(()=>{});
        const result=await request(action,payload);
        if(['signin','signup','verify','signout'].includes(action)&&typeof result.progress==='string')switchAccount(result);
        else if(result.status&&result.status.owner===info.owner)info={...info,...result.status};
        return result;
      }catch(e){error=e.message;throw e;}
      finally{authBusy=false;notify();schedule();}
    }
    function synchronize(){
      if(running)return running;
      if(!info.ready||!info.user||authBusy||info.needsLogin||!hooks.state)return Promise.resolve(false);
      clearTimer();const owner=info.owner,g=generation;
      phase='syncing';error='';notify();
      const task=(async()=>{
        let reply=await request('read');if(!current(g,owner))return false;
        let remote=reply.remote,baseline=reply.baseline&&reply.baseline.version===1?reply.baseline:null;
        for(let attempt=0;attempt<4;attempt++){
          if(!remote||!Number.isSafeInteger(remote.revision)||remote.revision<0)throw Error('O serviço enviou um progresso inválido. A cópia local foi mantida.');
          const localAtSubmit=C.sanitize(clone(hooks.state()),catalog);
          const submitted=S.merge(localAtSubmit,remote.progress,baseline,catalog);
          let savedAt=remote.savedAt;
          if(!remote.progress||!S.same(submitted,C.sanitize(remote.progress,catalog))){
            reply=await request('write',{revision:remote.revision,progress:submitted});
            if(!current(g,owner))return false;
            if(reply.remote&&reply.remote.conflict){remote=reply.remote;continue;}
            if(!reply.remote||reply.remote.conflict!==false||!reply.remote.savedAt)throw Error('O serviço não confirmou o salvamento. Tente sincronizar novamente.');
            savedAt=reply.remote.savedAt;
          }
          // A keystroke or completed exercise during the request must not be replaced by its older snapshot.
          const latest=clone(hooks.state());
          const merged=S.merge(latest,submitted,localAtSubmit,catalog);
          apply(merged,owner);
          reply=await request('checkpoint',{progressText:S.stringify(submitted),savedAt});
          if(!current(g,owner))return false;
          info={...info,...reply.status};
          // Read the synchronous native status: it includes edits made after the checkpoint's response.
          if(bridge.accountStatus){const live=JSON.parse(bridge.accountStatus());if(live.owner===owner)info={...info,...live};}
          phase=info.dirty?'pending':'synced';error='';notify();return true;
        }
        throw Error('Outro aparelho também está salvando. Aguarde um pouco e toque em Sincronizar.');
      })().catch(e=>{
        if(!current(g,owner))return false;
        phase='pending';error=e.message;notify();
        throw e;
      }).finally(()=>{if(running===task)running=null;if(current(g,owner)&&info.dirty&&!error)schedule();});
      running=task;return task;
    }
    function guest(){
      try{const raw=bridge&&bridge.guestProgress?bridge.guestProgress():'';return raw?C.sanitize(JSON.parse(raw),catalog):null;}
      catch(ignored){return null;}
    }
    function importGuest(){
      const value=guest();if(!info.user||!value)throw Error('Não há progresso local para trazer.');
      apply(S.merge(hooks.state(),value,null,catalog),info.owner);changed();
    }
    function resume(){
      try{
        if(bridge&&bridge.accountStatus&&bridge.load){
          const live=JSON.parse(bridge.accountStatus());
          if(live.owner!==info.owner)switchAccount({status:live,progress:bridge.load()});
        }
      }catch(e){error=e.message;notify();return;}
      if(!authBusy)synchronize().catch(()=>{});
    }
    function rpc(name, params={}){
      if(!info.user||info.owner==='guest')return Promise.reject(Error('Entre em sua conta para continuar.'));
      return request('rpc',{name,params}).then(reply=>{
        if(reply.remote&&reply.remote.ok===false){
          const failure=Error(reply.remote.error||'Não foi possível concluir a operação.');
          failure.code=reply.remote.code;
          throw failure;
        }
        return reply.remote||{};
      });
    }
    function queueLoad(){
      if(!info.user||info.owner==='guest'||!bridge||!bridge.cloudRequest)return Promise.resolve(null);
      return request('queue_load').then(reply=>{
        try{return JSON.parse(reply.queue||'[]');}catch(e){return [];}
      }).catch(()=>null);
    }
    function queueSave(queue){
      if(!info.user||info.owner==='guest'||!bridge||!bridge.cloudRequest)return Promise.resolve(false);
      return request('queue_save',{queue:JSON.stringify(queue)}).then(()=>true).catch(()=>false);
    }
    function init(value){hooks=value||{};notify();schedule();}
    return {init,status,owner:()=>info.owner,changed,auth,receive,synchronize,guest,importGuest,
      resume,pause:clearTimer,rpc,queueLoad,queueSave};
  }
  return {create};
});

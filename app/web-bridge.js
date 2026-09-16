/* Browser host for the same account and progress contract used by Android. */
(function(root){
  'use strict';
  if(root.FaiscaNative)return;

  const BASE_URL='https://euxbudxbmfqnlupakrpt.supabase.co';
  const PUBLIC_KEY='sb_publishable_unGbPdabKVJyHeJ2WihFDw_tMUtavAY';
  const MAX_BYTES=8*1024*1024;
  const PROGRESS='faisca-progress-v1';
  const PREFIX='faisca-web-v1.';
  let session=readJson(PREFIX+'session')||{};

  function read(key){try{return localStorage.getItem(key)||'';}catch(e){return '';}}
  function write(key,value){
    try{if(value==null)localStorage.removeItem(key);else localStorage.setItem(key,value);return true;}
    catch(e){return false;}
  }
  function readJson(key){try{return JSON.parse(read(key)||'{}');}catch(e){return {};}}
  function bytes(value){return new TextEncoder().encode(value).length;}
  function owner(){return read(PREFIX+'owner')||'guest';}
  function progressKey(id){return id==='guest'?PROGRESS:PREFIX+'progress.'+id;}
  function progress(){return read(progressKey(owner()));}
  function status(){
    const id=owner(),user=session&&session.user;
    const validUser=id!=='guest'&&user&&user.id===id;
    return {
      ready:true,
      googleEnabled:true,
      owner:id,
      user:validUser?{id:user.id,email:user.email||''}:null,
      dirty:id!=='guest'&&read(PREFIX+'dirty.'+id)==='1',
      lastSync:id!=='guest'?read(PREFIX+'sync-time.'+id):'',
      needsLogin:id!=='guest'&&!validUser,
      recovery:!!(session&&session.recovery)
    };
  }
  function save(raw,expectedOwner){
    if(owner()!==expectedOwner||typeof raw!=='string'||bytes(raw)>MAX_BYTES)return false;
    try{if(JSON.parse(raw).version!==1)return false;}catch(e){return false;}
    if(raw===progress())return true;
    if(!write(progressKey(expectedOwner),raw))return false;
    if(expectedOwner!=='guest'&&!write(PREFIX+'dirty.'+expectedOwner,'1'))return false;
    return true;
  }
  function apiError(httpStatus,code,message){
    const error=new Error(message||code||'request_failed');
    error.httpStatus=httpStatus;error.code=code||'request_failed';error.serverMessage=message||'';
    return error;
  }
  async function request(method,path,body,access){
    const headers={apikey:PUBLIC_KEY,Accept:'application/json'};
    if(access)headers.Authorization='Bearer '+access;
    const options={method,headers};
    if(body!==undefined&&body!==null){
      const raw=JSON.stringify(body);
      if(bytes(raw)>MAX_BYTES+65536)throw apiError(413,'too_large');
      headers['Content-Type']='application/json';options.body=raw;
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    options.signal=controller.signal;
    try{
      const response=await fetch(BASE_URL+path,options);
      const raw=await response.text();
      if(bytes(raw)>MAX_BYTES+65536)throw apiError(413,'too_large');
      let result={};
      if(raw){try{result=JSON.parse(raw);}catch(e){throw apiError(response.status,'invalid_response');}}
      if(!response.ok){
        const code=result.error_code||result.code||'request_failed';
        throw apiError(response.status,code,result.message||result.msg||'');
      }
      return result;
    }catch(error){
      if(error.name==='AbortError')throw apiError(0,'network','A conexão demorou.');
      if(error.httpStatus!==undefined)throw error;
      throw apiError(0,'network',error.message);
    }finally{clearTimeout(timer);}
  }
  async function acceptSession(tokens,recovery){
    const access=tokens&&tokens.access_token,refresh=tokens&&tokens.refresh_token;
    if(!access||!refresh)throw apiError(401,'invalid_session');
    const user=await request('GET','/auth/v1/user',null,access);
    if(!/^[a-fA-F0-9-]{36}$/.test(user.id||''))throw apiError(401,'invalid_session');
    session={...tokens,user,recovery:!!recovery,expires_at:Math.floor(Date.now()/1000)+(Number(tokens.expires_in)||3600)};
    if(!write(PREFIX+'session',JSON.stringify(session))||!write(PREFIX+'owner',user.id))throw Error('storage');
  }
  async function token(expectedOwner){
    if(owner()!==expectedOwner||expectedOwner==='guest')throw apiError(409,'account_changed');
    if(!session.user||session.user.id!==expectedOwner)throw apiError(401,'session_expired');
    if(Number(session.expires_at)<Math.floor(Date.now()/1000)+90){
      try{
        const recovery=!!session.recovery;
        const refreshed=await request('POST','/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},null);
        if(!refreshed.user||refreshed.user.id!==expectedOwner)throw apiError(401,'invalid_session');
        await acceptSession(refreshed,recovery);
      }catch(error){
        if([400,401,403].includes(error.httpStatus)){session={};write(PREFIX+'session',null);throw apiError(401,'session_expired');}
        throw error;
      }
    }
    return session.access_token;
  }
  function base64url(bytesValue){
    let binary='';bytesValue.forEach(value=>{binary+=String.fromCharCode(value);});
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomToken(){const data=new Uint8Array(32);crypto.getRandomValues(data);return base64url(data);}
  async function googleSignIn(){
    const settings=await request('GET','/auth/v1/settings',null,null);
    if(!settings.external||!settings.external.google)throw apiError(503,'google_provider_disabled');
    const verifier=randomToken(),state=randomToken();
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const redirect=root.FaiscaDesktop?new URL('http://localhost:3000/'):new URL(root.location.href);
    redirect.search='';redirect.hash='';
    if(!root.FaiscaDesktop)redirect.searchParams.set('faisca_oauth',state);
    const pending={verifier,state,redirect:redirect.toString(),returnTo:root.location.pathname,deadline:Date.now()+10*60*1000};
    if(!write(PREFIX+'pkce',JSON.stringify(pending)))throw Error('storage');
    const authorize=new URL(BASE_URL+'/auth/v1/authorize');
    authorize.searchParams.set('provider','google');authorize.searchParams.set('redirect_to',pending.redirect);
    authorize.searchParams.set('code_challenge',base64url(new Uint8Array(digest)));authorize.searchParams.set('code_challenge_method','s256');
    if(root.FaiscaDesktop&&typeof root.FaiscaDesktop.openOAuth==='function'){
      const opened=await root.FaiscaDesktop.openOAuth(authorize.toString(),state);
      if(!opened){write(PREFIX+'pkce',null);throw apiError(503,'oauth_unavailable');}
    }else setTimeout(()=>root.location.assign(authorize.toString()),80);
  }
  function resultMessage(error){
    const code=error.code||'network',http=error.httpStatus||0;
    if(http===429)return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
    if(code==='invalid_credentials')return 'Confira seu e-mail e sua senha.';
    if(code==='email_not_confirmed')return 'Confirme seu e-mail com o código recebido antes de entrar.';
    if(code==='invalid_email')return 'Digite um endereço de e-mail válido.';
    if(code==='weak_password')return 'Use uma senha de 8 a 256 caracteres.';
    if(code==='otp_expired')return 'O código está incorreto ou expirou. Solicite outro.';
    if(code==='session_expired'||http===401)return 'Entre novamente para continuar a sincronização.';
    if(code==='account_changed')return 'A conta mudou. Abra novamente esta tela.';
    if(code==='oauth_cancelled')return 'Entrada pelo Google cancelada.';
    if(code==='oauth_expired'||code==='invalid_callback')return 'Essa entrada expirou. Toque em Continuar com Google novamente.';
    if(code==='google_provider_disabled')return 'A entrada pelo Google ainda está indisponível. Use e-mail e senha ou tente novamente mais tarde.';
    if(code==='PGRST202'||/Could not find the function/.test(error.serverMessage||''))return 'Módulo de salas não instalado no banco. Execute o script backend/setup_classrooms.sql no Supabase.';
    if(http>=500||String(code).startsWith('PGRST'))return 'A sincronização está indisponível. Seu progresso permanece neste dispositivo.';
    if(error.serverMessage&&http<500)return error.serverMessage;
    return 'Não foi possível conectar. Seu progresso continua salvo neste dispositivo.';
  }
  function emit(id,result,attempt){
    if(root.FaiscaAccount&&root.FaiscaAccount.receive){root.FaiscaAccount.receive(id,result);return;}
    if((attempt||0)<100)setTimeout(()=>emit(id,result,(attempt||0)+1),25);
  }
  async function run(id,action,input){
    const expectedOwner=input.owner||owner(),result={};
    if(action==='status')result.status=status();
    else if(action==='signin'||action==='signup'){
      const email=String(input.email||'').trim(),password=String(input.password||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw apiError(400,'invalid_email');
      if(password.length<8||password.length>256)throw apiError(400,'weak_password');
      const reply=await request('POST',action==='signin'?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{email,password},null);
      if(reply.access_token){await acceptSession(reply,false);result.progress=progress();}
      else result.verifyEmail=true;
    }else if(action==='recover'){
      const email=String(input.email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw apiError(400,'invalid_email');
      await request('POST','/auth/v1/recover',{email},null);result.sent=true;
    }else if(action==='resend'){
      await request('POST','/auth/v1/resend',{email:String(input.email||'').trim(),type:'signup'},null);result.sent=true;
    }else if(action==='verify'){
      const type=String(input.type||''),code=String(input.code||'').trim();
      if(!['signup','recovery'].includes(type))throw apiError(400,'invalid_request');
      if(!/^[0-9]{6,10}$/.test(code))throw apiError(400,'otp_expired');
      const reply=await request('POST','/auth/v1/verify',{email:String(input.email||'').trim(),token:code,type},null);
      await acceptSession(reply,type==='recovery');result.progress=progress();
    }else if(action==='password'){
      const password=String(input.password||'');if(password.length<8||password.length>256)throw apiError(400,'weak_password');
      await request('PUT','/auth/v1/user',{password},await token(expectedOwner));session.recovery=false;write(PREFIX+'session',JSON.stringify(session));
    }else if(action==='google'){
      await googleSignIn();result.browser=true;
    }else if(action==='read'){
      result.remote=await request('POST','/rest/v1/rpc/faisca_read_progress',{},await token(expectedOwner));
      const baseline=readJson(PREFIX+'baseline.'+expectedOwner);result.baseline=baseline&&baseline.version===1?baseline:null;
    }else if(action==='write'){
      result.remote=await request('POST','/rest/v1/rpc/faisca_write_progress',{expected_revision:input.revision,new_progress:input.progress},await token(expectedOwner));
    }else if(action==='checkpoint'){
      const snapshot=String(input.progressText||'');
      if(bytes(snapshot)>MAX_BYTES)throw apiError(413,'too_large');
      try{if(JSON.parse(snapshot).version!==1)throw Error('version');}catch(e){throw apiError(400,'invalid_request');}
      if(owner()!==expectedOwner)throw apiError(409,'account_changed');
      if(!write(PREFIX+'baseline.'+expectedOwner,snapshot)||!write(PREFIX+'sync-time.'+expectedOwner,String(input.savedAt||''))||!write(PREFIX+'dirty.'+expectedOwner,snapshot===progress()?'0':'1'))throw Error('storage');
    }else if(action==='signout'){
      if(owner()!==expectedOwner)throw apiError(409,'account_changed');
      try{await request('POST','/auth/v1/logout?scope=local',{},await token(expectedOwner));}catch(e){}
      session={};write(PREFIX+'session',null);write(PREFIX+'pkce',null);if(!write(PREFIX+'owner','guest'))throw Error('storage');result.progress=progress();
    }else if(action==='rpc'){
      const name=String(input.name||'');if(!/^faisca_[a-z0-9_]{1,64}$/.test(name))throw apiError(400,'invalid_rpc');
      result.remote=await request('POST','/rest/v1/rpc/'+name,input.params||{},await token(expectedOwner));
    }else if(action==='queue_load')result.queue=read(PREFIX+'event-queue.'+expectedOwner)||'[]';
    else if(action==='queue_save'){
      const queue=String(input.queue||'[]');if(bytes(queue)>MAX_BYTES)throw apiError(413,'too_large');
      if(!write(PREFIX+'event-queue.'+expectedOwner,queue))throw Error('storage');result.saved=true;
    }else throw apiError(400,'invalid_request');
    result.ok=true;result.status=status();emit(id,result);
  }
  function cloudRequest(id,action,raw){
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||'')||typeof raw!=='string'||raw.length>2*MAX_BYTES+65536)return;
    let input;try{input=JSON.parse(raw||'{}');}catch(e){emit(id,{ok:false,error:'Solicitação inválida.',code:'invalid_request',status:status()});return;}
    run(id,action,input).catch(error=>emit(id,{ok:false,error:resultMessage(error),code:error.code||'network',status:status()}));
  }
  function exportProgress(){
    const value=progress();if(!value)return;
    let output=value;
    try{output=JSON.stringify(JSON.parse(value),null,2);}catch(e){}
    const url=URL.createObjectURL(new Blob([output],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='faisca-progresso.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function importProgress(){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{
      const file=input.files&&input.files[0];if(!file||file.size>MAX_BYTES)return;
      const message=owner()==='guest'?'Esta cópia substituirá o progresso local deste dispositivo.':'Esta cópia será combinada com o progresso da conta.';
      if(root.confirm(message)&&root.FaiscaApp)root.FaiscaApp.importProgress(await file.text(),owner());
    };
    input.click();
  }
  async function finishOAuth(){
    const url=new URL(root.location.href),code=url.searchParams.get('code'),state=url.searchParams.get('faisca_oauth');
    if(!state||(!code&&!url.searchParams.get('error')))return;
    let pending={};try{pending=JSON.parse(read(PREFIX+'pkce')||'{}');}catch(e){}
    try{
      const expected=new URL(pending.redirect||root.location.href);
      const targetOk=root.FaiscaDesktop?
        expected.origin==='http://localhost:3000'&&expected.pathname==='/':
        url.origin===expected.origin&&url.pathname===expected.pathname;
      if(state!==pending.state||Date.now()>pending.deadline||!targetOk||(!root.FaiscaDesktop&&state!==expected.searchParams.get('faisca_oauth')))throw apiError(400,'oauth_expired');
      if(url.searchParams.get('error'))throw apiError(400,'oauth_cancelled');
      if(code.length>4096)throw apiError(400,'invalid_callback');
      const reply=await request('POST','/auth/v1/token?grant_type=pkce',{auth_code:code,code_verifier:pending.verifier},null);
      await acceptSession(reply,false);write(PREFIX+'pkce',null);
      root.history.replaceState({},'',pending.returnTo||root.location.pathname);
      emit('oauth',{ok:true,status:status(),progress:progress()});
    }catch(error){
      root.history.replaceState({},'',pending.returnTo||root.location.pathname);
      emit('oauth',{ok:false,error:resultMessage(error),code:error.code||'network',status:status()});
    }
  }

  root.FaiscaWeb={platform:root.FaiscaDesktop?'desktop':'web',installable:!root.FaiscaDesktop};
  root.FaiscaNative={load:progress,save,accountStatus:()=>JSON.stringify(status()),guestProgress:()=>read(PROGRESS),cloudRequest,exportProgress,importProgress};
  finishOAuth();
})(window);

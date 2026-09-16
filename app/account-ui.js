/* Account screens contain no credentials in the progress model or exports. */
(function(root){
  'use strict';
  root.FaiscaAccountUI=function(A,host){
    const {esc,icon,button,toast,render,navigate,confirm}=host;
    let mode='login',email='',busy=false,message='',failure='',offerGuest=false;
    const value=id=>{const field=document.getElementById(id);return field?field.value:'';};
    const refresh=()=>{if(host.route()==='account')render(false);};
    function syncText(){
      const s=A.status();
      if(!s.user)return 'Progresso salvo neste aparelho';
      if(s.needsLogin)return 'Entre novamente para sincronizar';
      if(s.phase==='syncing')return 'Sincronizando seu progresso…';
      if(s.error||s.dirty||!s.lastSync)return 'Salvo neste aparelho • sincronização pendente';
      const date=new Date(s.lastSync);
      return 'Sincronizado '+(Number.isFinite(date.getTime())?date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'com sua conta');
    }
    function feedback(){return '<p id="account-error" class="account-error" role="alert">'+esc(failure||A.status().error)+'</p><p id="account-message" class="small muted" role="status">'+esc(message)+'</p>';}
    function page(){
      const s=A.status(),blocked=busy||s.authBusy,disabled=blocked?'disabled':'';
      const back='<button class="text-btn" data-action="nav" data-route="'+(host.state().onboarded?'profile':'home')+'">'+icon('back')+' '+(host.state().onboarded?'Você':'Voltar')+'</button>';
      const intro='<div class="account-intro"><span class="account-symbol">'+icon('cloud')+'</span><div class="eyebrow orange">CADA DESCOBERTA CONTA</div><h1>Seu progresso,<br>com você.</h1><p>Continue suas lições, XP e anotações no celular, tablet ou computador entrando na mesma conta.</p></div>';
      if(!s.ready)return '<div class="account-shell">'+back+intro+'<section class="card account-card"><h2>Contas ainda não ativadas</h2><p>A conexão online desta versão ainda precisa ser configurada. Você pode continuar estudando e exportando uma cópia em Você.</p>'+button('Continuar estudando','nav','data-route="home"','primary full')+'</section></div>';
      if(s.recovery)mode='password';

      // ── Conta conectada ───────────────────────────────────────────────────
      if(s.user&&!s.needsLogin&&mode!=='password'){
        const old=A.guest(),hasGuest=old&&(old.onboarded||old.totalXp||Object.keys(old.notes).length);
        const migrate=hasGuest?'<section class="card account-migrate"><h3>'+(offerGuest?'Trazer suas descobertas?':'Progresso salvo neste aparelho')+'</h3><p>Há '+Object.keys(old.completed).length+' lições concluídas e '+old.totalXp+' XP salvos localmente. Traga esse progresso somente se ele for seu.</p>'+button('Trazer para minha conta','account-import',disabled,'secondary full')+'</section>':'';
        return '<div class="account-shell">'+back+intro+
          '<section class="card account-card">'+
            '<span class="pill green">'+icon('check')+' CONTA CONECTADA</span>'+
            '<h2 class="account-email">'+esc(s.user.email||'Sua conta')+'</h2>'+
            '<p id="account-sync-text" class="sync-status" aria-live="polite">'+esc(syncText())+'</p>'+
            feedback()+
            '<div class="stack">'+
              button((host.state().onboarded?'Continuar aprendendo':'Começar meu curso')+' '+icon('arrow'),'account-study',disabled,'primary full')+
              button('Sair desta conta','account-signout',disabled,'secondary full')+
            '</div>'+
            '<p class="small muted" style="margin-top:16px">Seu progresso sincroniza automaticamente ao abrir o app e após cada atividade, enquanto houver conexão.</p>'+
          '</section>'+migrate+
          '<p class="footer-note">Antes de trocar de dispositivo, confirme a mensagem "Sincronizado".</p>'+
        '</div>';
      }

      // ── Login / criação de conta ──────────────────────────────────────────
      const isRecoveryFlow=['recover','verify','recoveryverify','password'].includes(mode);
      const titles={login:'Bem-vindo de volta',signup:'Criar conta',recover:'Recuperar acesso',verify:'Confirme seu e-mail',recoveryverify:'Digite o código recebido',password:'Escolha uma nova senha'};
      const submitLabels={login:'Entrar com e-mail',signup:'Criar com e-mail',recover:'Enviar código',verify:'Confirmar e-mail',recoveryverify:'Verificar código',password:'Salvar nova senha'};

      // Google em destaque como opção principal
      const googleSection=!isRecoveryFlow&&s.googleEnabled
        ? button(icon('spark')+' Continuar com Google','account-google',disabled,'primary full')+
          '<p class="account-divider">ou use e-mail e senha</p>'
        : '';

      // Toggle login/signup apenas fora do fluxo de recuperação
      const accountSwitch=!isRecoveryFlow
        ? '<div class="account-switch" role="group" aria-label="Criar uma conta ou entrar">'+
            button('Criar conta','account-mode','data-mode="signup" aria-pressed="'+(mode==='signup')+'" '+disabled,'account-option')+
            button('Entrar','account-mode','data-mode="login" aria-pressed="'+(mode==='login')+'" '+disabled,'account-option')+
          '</div>'
        : '';

      const emailField=['login','signup','recover'].includes(mode);
      const passwordField=['login','signup','password'].includes(mode);
      let fields=emailField?'<div class="field"><label for="account-email">E-mail</label><input id="account-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" required value="'+esc(email||s.user&&s.user.email||'')+'" placeholder="seu@email.com"></div>':'';
      if(passwordField)fields+='<div class="field"><label for="account-password">'+(mode==='password'?'Nova senha':'Senha')+'</label><input id="account-password" name="password" type="password" autocomplete="'+(mode==='login'?'current-password':'new-password')+'" minlength="8" maxlength="256" required aria-describedby="password-help"><p id="password-help" class="small muted">Use pelo menos 8 caracteres.</p></div>';
      if(mode==='signup'||mode==='password')fields+='<div class="field"><label for="account-confirm">Repita a senha</label><input id="account-confirm" name="password-confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="256" required></div>';
      if(mode==='verify'||mode==='recoveryverify')fields+='<p>Enviamos um código para <b>'+esc(email)+'</b>. Verifique também a pasta de spam.</p><div class="field"><label for="account-code">Código do e-mail</label><input id="account-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required></div>';

      const loginLinks=mode==='login'
        ? button('Esqueci minha senha','account-mode','data-mode="recover" '+disabled,'text-btn')+button('Criar uma conta','account-mode','data-mode="signup" '+disabled,'text-btn')
        : mode==='signup'
        ? button('Já tenho conta. Entrar','account-mode','data-mode="login" '+disabled,'text-btn')
        : button('Voltar para entrar','account-mode','data-mode="login" '+disabled,'text-btn');
      const resend=mode==='verify'||mode==='recoveryverify'?button('Reenviar código','account-resend',disabled,'text-btn'):'';

      return '<div class="account-shell">'+back+intro+
        '<section class="card account-card">'+
          accountSwitch+
          '<h2>'+titles[mode]+'</h2>'+
          (s.needsLogin?'<p>Seu progresso continua salvo neste aparelho. Confirme seu acesso para enviá-lo à sua conta.</p>':'')+
          googleSection+
          '<form id="account-form"><fieldset '+disabled+'><legend class="sr-only">'+titles[mode]+'</legend>'+
            fields+feedback()+
            '<button type="submit" class="btn secondary full">'+(blocked?'Aguarde…':submitLabels[mode])+'</button>'+
          '</fieldset></form>'+
          '<div class="account-links">'+resend+loginLinks+'</div>'+
          (s.user?button('Sair e usar sem conta','account-signout',disabled,'text-btn'):'')+
          '<p class="small muted">Ao conectar sua conta, o progresso sincroniza automaticamente. A opção Google abre o navegador.</p>'+
        '</section>'+
      '</div>';
    }
    async function submit(){
      if(busy)return;
      const actionMode=mode;
      email=(value('account-email')||email||A.status().user&&A.status().user.email||'').trim();
      const password=value('account-password'),confirmPassword=value('account-confirm'),code=value('account-code').trim();
      if(['login','signup','recover'].includes(mode)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){failure='Digite um e-mail válido.';refresh();return;}
      if(['login','signup','password'].includes(mode)&&password.length<8){failure='A senha deve ter pelo menos 8 caracteres.';refresh();return;}
      if(['signup','password'].includes(mode)&&password!==confirmPassword){failure='As senhas precisam ser iguais.';refresh();return;}
      const actions={login:'signin',signup:'signup',recover:'recover',verify:'verify',recoveryverify:'verify',password:'password'};
      busy=true;failure='';message='';refresh();
      try{
        const reply=await A.auth(actions[actionMode],{email,password,code,type:actionMode==='recoveryverify'?'recovery':'signup'});
        if(reply.verifyEmail){mode='verify';message='Abra o e-mail e digite o código de confirmação.';}
        else if(actionMode==='recover'){mode='recoveryverify';message='Se houver uma conta com esse e-mail, você receberá o código.';}
        else if(actionMode==='recoveryverify')mode='password';
        else if(actionMode==='password'){mode='login';toast('Senha atualizada.');}
        else mode='login';
      }catch(e){failure=e.message;if(e.code==='email_not_confirmed')mode='verify';}
      finally{busy=false;refresh();}
    }
    async function run(action,fn){
      if(busy)return;busy=true;failure='';message='';refresh();
      try{await fn();}
      catch(e){failure=e.message;toast(e.message);}
      finally{busy=false;refresh();}
    }
    function action(a,element){
      if(!a.startsWith('account-'))return false;
      if(a==='account-open'){
        if(busy||A.status().authBusy)return true;
        email=value('account-email')||email;mode=element.dataset.mode==='signup'?'signup':'login';failure='';message='';navigate('account');
      }
      if(a==='account-mode'){
        if(busy||A.status().authBusy)return true;
        email=value('account-email')||email;mode=element.dataset.mode;failure='';message='';refresh();
      }
      if(a==='account-google'){
        run('google',async()=>{
          await A.auth('google');
          message='Conclua a entrada no Google e volte ao Faísca.';
          // Sincroniza automaticamente após retorno do Google
          try{await A.synchronize();}catch(_){}
        });
      }
      if(a==='account-study'&&!busy)host.startStudy();
      if(a==='account-resend')run('resend',async()=>{await A.auth(mode==='recoveryverify'?'recover':'resend',{email});message='Solicitação enviada. Confira seu e-mail.';});
      if(a==='account-import')confirm('Trazer o progresso local?','Confirme que as lições e anotações do modo sem conta são suas. Elas serão combinadas com o progresso desta conta.','Trazer progresso',()=>{try{A.importGuest();offerGuest=false;refresh();toast('Progresso combinado e salvo neste aparelho.');}catch(e){toast(e.message);}});
      if(a==='account-signout')confirm('Sair desta conta?',A.status().dirty||!A.status().lastSync?'Há progresso que pode não estar salvo online. Sincronize antes de trocar de aparelho.':'Você voltará ao modo sem conta. O progresso desta conta continuará salvo.','Sair da conta',()=>run('signout',()=>A.auth('signout')));
      return true;
    }
    function changed(s,previous){
      failure='';message='';mode=s.recovery?'password':'login';offerGuest=previous==='guest'&&!!s.user;
      // Sincroniza automaticamente ao conectar a conta
      if(s.user)setTimeout(()=>{try{A.synchronize();}catch(_){}},300);
      // Se acabou de criar conta e ainda não passou pelo onboarding, vai direto para nome/XP
      if(s.user&&!host.state().onboarded){host.startStudy();return;}
      navigate(s.user?'account':host.state().onboarded?'profile':'home');
    }
    function statusChanged(){
      if(host.route()!=='account')return;
      const sync=document.getElementById('account-sync-text');if(sync)sync.textContent=syncText();
      const err=document.getElementById('account-error');if(err)err.textContent=failure||A.status().error;
    }
    return {page,action,submit,changed,statusChanged,syncText};
  };
})(window);

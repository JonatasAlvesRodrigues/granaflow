
const KEYS={theme:"granaflow_theme",lastView:"granaflow_last_view",authSession:"granaflow_auth_session",lastGoodData:"granaflow_last_good_data"};
const SUPABASE_URL="https://gvsrrztkxccytmmcmubp.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_HziadP-SowUvup8nDGt4-A_YAAfPHWq";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    storageKey:"granaflow_auth"
  }
});
const state={user:null,data:null,charts:{category:null,trend:null,overall:null,reportMini:null},reportMonth:"",syncTimer:null,onboardingIndex:0};
const $=(id)=>document.getElementById(id); const $$=(s)=>[...document.querySelectorAll(s)];
const CATS=[
{id:"cat_food",name:"Alimentação",color:"#22c55e",icon:"utensils"},
{id:"cat_home",name:"Moradia",color:"#3b82f6",icon:"house"},
{id:"cat_trans",name:"Transporte",color:"#f59e0b",icon:"car"},
{id:"cat_salary",name:"Salário",color:"#6366f1",icon:"wallet"},
{id:"cat_fun",name:"Lazer",color:"#ec4899",icon:"party-popper"}
];
const PAYMENT_OPTIONS={
  income:[
    {value:"cashpix",label:"Dinheiro/PIX",icon:"qr-code"},
    {value:"freelance",label:"Freela",icon:"briefcase-business"}
  ],
  expense:[
    {value:"cash",label:"Dinheiro",icon:"wallet"},
    {value:"pix",label:"PIX",icon:"qr-code"},
    {value:"debit",label:"Debito",icon:"credit-card"},
    {value:"credit",label:"Credito",icon:"badge-dollar-sign"}
  ]
};
const uid=(p="id")=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const today=()=>new Date().toISOString().slice(0,10);
const month=()=>new Date().toISOString().slice(0,7);
const VALID_VIEWS=["dashboard","transactions","categories","cards","recurring","goals","reports","insights","settings"];
const num=(v)=>{const n=Number(v); return Number.isFinite(n)?n:0};
const money=(v)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(num(v));
function toast(msg,err=false){const t=$("toast");t.classList.remove("hidden");t.textContent=msg;t.style.background=err?"#b91c1c":"#0f172a";setTimeout(()=>t.classList.add("hidden"),2500)}
function on(id,event,handler){
  const el=$(id);
  if(!el) return;
  el.addEventListener(event,handler);
}
function saveAuthSession(session){
  if(!session) return;
  try{
    localStorage.setItem(KEYS.authSession,JSON.stringify({
      access_token:session.access_token,
      refresh_token:session.refresh_token
    }));
  }catch{}
}
function clearAuthSession(){
  try{localStorage.removeItem(KEYS.authSession)}catch{}
}
async function restoreAuthSession(){
  try{
    const raw=localStorage.getItem(KEYS.authSession);
    if(!raw) return false;
    const parsed=JSON.parse(raw||"{}");
    if(!parsed?.access_token||!parsed?.refresh_token){
      clearAuthSession();
      return false;
    }
    const {data,error}=await sb.auth.setSession({
      access_token:parsed.access_token,
      refresh_token:parsed.refresh_token
    });
    if(error||!data?.session?.user){
      clearAuthSession();
      return false;
    }
    if(!state.user) await login(mapAuthUser(data.session.user));
    return true;
  }catch{
    clearAuthSession();
    return false;
  }
}
function saveLastView(view){
  if(!VALID_VIEWS.includes(view)) return;
  localStorage.setItem(KEYS.lastView,view);
}
function readLastView(){
  const saved=localStorage.getItem(KEYS.lastView)||"dashboard";
  return VALID_VIEWS.includes(saved)?saved:"dashboard";
}
const dataKey=(u)=>`granaflow_data_${u}`;
const legacyDataKey=(u)=>`finanzen_data_${u}`;
const emptyData=()=>({categories:[...CATS],accounts:[],transactions:[],transfers:[],cards:[],installments:[],recurring:[],goals:[],settings:{onboardingDone:false,salary:{enabled:false,amount:0,day:5,accountId:"",recurringId:""}}});
function dataScore(d){
  if(!d) return 0;
  return ["transactions","categories","accounts","cards","installments","recurring","goals"].reduce((s,k)=>s+((Array.isArray(d[k])?d[k].length:0)),0);
}
function safeParseData(raw){
  try{
    const parsed=JSON.parse(raw||"null");
    if(!parsed||typeof parsed!=="object") return null;
    return {...emptyData(),...parsed};
  }catch{return null}
}
function findBestLocalBackup(preferredUserId=""){
  const candidates=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key) continue;
      if(!key.startsWith("granaflow_data_")&&!key.startsWith("finanzen_data_")&&key!==KEYS.lastGoodData) continue;
      const parsed=safeParseData(localStorage.getItem(key));
      if(!parsed) continue;
      const score=dataScore(parsed);
      const preferred=preferredUserId && (key===dataKey(preferredUserId)||key===legacyDataKey(preferredUserId)) ? 100000 : 0;
      candidates.push({key,data:parsed,score:score+preferred});
    }
  }catch{}
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]||null;
}
function ensureSettings(){
  if(!state.data) return;
  if(!state.data.settings) state.data.settings={};
  if(typeof state.data.settings.onboardingDone!=="boolean") state.data.settings.onboardingDone=false;
  if(!state.data.settings.salary) state.data.settings.salary={enabled:false,amount:0,day:5,accountId:"",recurringId:""};
}
const ONBOARDING_STEPS=[
  {
    view:"dashboard",
    title:"Ative seu salário automático",
    text:"Defina o valor e o dia do mês para o sistema lançar sua renda sem você repetir todo mês.",
    focus:()=>{if($("salaryAmount")) $("salaryAmount").focus();}
  },
  {
    view:"goals",
    title:"Crie sua meta financeira",
    text:"Informe valor alvo, valor atual e prazo. O GranaFlow calcula quanto guardar por mês.",
    focus:()=>{const form=$("goalForm"); if(form?.targetAmount) form.targetAmount.focus();}
  },
  {
    view:"transactions",
    title:"Registre sua primeira transação",
    text:"Lance um gasto ou entrada e escolha a forma de pagamento para começar seus relatórios.",
    focus:()=>{const form=$("transactionForm"); if(form?.amount) form.amount.focus();}
  }
];
function loadData(userId){
  const local=safeParseData(localStorage.getItem(dataKey(userId))||localStorage.getItem(legacyDataKey(userId))||"null");
  if(local) return local;
  const best=findBestLocalBackup(userId);
  return best?.data||emptyData();
}
function saveData(){
  if(!state.user) return;
  localStorage.setItem(dataKey(state.user.id),JSON.stringify(state.data));
  if(dataScore(state.data)>0) localStorage.setItem(KEYS.lastGoodData,JSON.stringify(state.data));
  if(state.syncTimer) clearTimeout(state.syncTimer);
  state.syncTimer=setTimeout(()=>pushCloudData(),450);
}
function setAuthTab(tab){$$(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));$("loginForm").classList.toggle("hidden",tab!=="login");$("registerForm").classList.toggle("hidden",tab!=="register");$("recoverForm").classList.toggle("hidden",tab!=="recover");$("resetForm").classList.add("hidden");$("authMessage").textContent=""}
function renderAuth(){const on=!!state.user;$("authScreen").classList.toggle("hidden",on);$("appScreen").classList.toggle("hidden",!on);if(on)$("userLabel").textContent=state.user.name}
function mapAuthUser(user){return {id:user.id,email:user.email,name:user.user_metadata?.name||user.email?.split("@")[0]||"Usuário"}}
async function fetchCloudData(userId){
  const {data,error}=await sb.from("user_finance_data").select("data").eq("user_id",userId).maybeSingle();
  if(error) throw error;
  return data?.data||null;
}
async function pushCloudData(){
  if(!state.user||!state.data) return;
  const payload={user_id:state.user.id,data:state.data,updated_at:new Date().toISOString()};
  const {error}=await sb.from("user_finance_data").upsert(payload,{onConflict:"user_id"});
  if(error) console.error("Erro sync Supabase:",error.message);
}
async function hydrateFromCloud(userId){
  try{
    const cloud=await fetchCloudData(userId);
    if(cloud){
      state.data={...emptyData(),...cloud};
      localStorage.setItem(dataKey(userId),JSON.stringify(state.data));
    }else{
      if(dataScore(state.data)>0) await pushCloudData();
    }
  }catch(err){
    console.error(err);
    toast("Sem conexão com Supabase. Usando backup local.",true);
  }
}
async function login(user){
  state.user=user;
  state.data=loadData(user.id);
  if(dataScore(state.data)===0){
    const best=findBestLocalBackup(user.id);
    if(best?.data&&dataScore(best.data)>0){
      state.data=best.data;
      localStorage.setItem(dataKey(user.id),JSON.stringify(state.data));
      toast("Backup local restaurado automaticamente.");
    }
  }
  renderAuth();
  setLoadingUI(true);
  await hydrateFromCloud(user.id);
  await boot();
  setLoadingUI(false);
}
async function logout(){
  await sb.auth.signOut();
  clearAuthSession();
  state.user=null;
  state.data=null;
  renderAuth();
}
function bindAuth(){
$$(".tab-btn").forEach(b=>b.addEventListener("click",()=>setAuthTab(b.dataset.authTab)));
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const email=String(f.email||"").trim().toLowerCase();const password=String(f.password||"");const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)return $("authMessage").textContent=error.message;if(data?.session)saveAuthSession(data.session);await login(mapAuthUser(data.user));});
$("registerForm").addEventListener("submit",async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const name=String(f.name||"").trim(),email=String(f.email||"").trim().toLowerCase(),password=String(f.password||"");if(!name||!email||password.length<6)return $("authMessage").textContent="Nome, email e senha (mín. 6).";const {data,error}=await sb.auth.signUp({email,password,options:{data:{name}}});if(error)return $("authMessage").textContent=error.message;if(data.user&&data.session){saveAuthSession(data.session);await login(mapAuthUser(data.user));}else{$("authMessage").textContent="Conta criada. Verifique seu email para confirmar.";setAuthTab("login");}});
$("recoverForm").addEventListener("submit",async e=>{e.preventDefault();const email=String(new FormData(e.target).get("email")||"").trim().toLowerCase();const {error}=await sb.auth.resetPasswordForEmail(email);$("authMessage").textContent=error?error.message:"Enviamos um link de recuperação para seu email.";});
$("resetForm").addEventListener("submit",e=>{e.preventDefault();$("authMessage").textContent="Use o link de recuperação enviado por email para definir nova senha.";});
}
function subtitle(view){return({dashboard:"Visão geral",transactions:"Lançamentos",categories:"Categorias",cards:"Cartões",recurring:"Recorrentes",goals:"Metas",reports:"Relatórios",insights:"Insights",settings:"Preferências e dados"})[view]||""}
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const prefersReducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function setLoadingUI(on){document.body.classList.toggle("loading-ui",!!on)}
function animateValue(el,to,{currency=false,duration=620}={}){
  if(!el) return;
  const target=num(to);
  if(prefersReducedMotion){
    el.textContent=currency?money(target):String(Math.round(target));
    el.dataset.value=String(target);
    return;
  }
  const from=num(el.dataset.value ?? 0);
  const diff=target-from;
  if(Math.abs(diff)<0.01){
    el.textContent=currency?money(target):String(Math.round(target));
    el.dataset.value=String(target);
    return;
  }
  const started=performance.now();
  el.classList.add("value-pop");
  const tick=(now)=>{
    const p=Math.min((now-started)/duration,1);
    const eased=1-Math.pow(1-p,3);
    const value=from+(diff*eased);
    el.textContent=currency?money(value):String(Math.round(value));
    if(p<1) requestAnimationFrame(tick);
    else{
      el.dataset.value=String(target);
      setTimeout(()=>el.classList.remove("value-pop"),120);
    }
  };
  requestAnimationFrame(tick);
}
function animateView(el){
  if(!el)return;
  el.classList.remove("view-enter");
  void el.offsetWidth;
  el.classList.add("view-enter");
  const cards=[...el.querySelectorAll(".card")];
  cards.forEach((card,index)=>{
    card.classList.remove("stagger-in");
    card.style.setProperty("--stagger-index",String(index));
  });
  if(prefersReducedMotion) return;
  requestAnimationFrame(()=>cards.forEach(card=>card.classList.add("stagger-in")));
}
function updateMobileFabVisibility(view){
  const fab=$("mobileQuickAdd");
  if(!fab) return;
  const hide=view==="dashboard"||view==="transactions"||view==="settings"||view==="reports"||view==="insights"||view==="categories";
  fab.classList.toggle("is-hidden",hide);
}
function toggleTheme(){
  document.body.classList.toggle("dark");
  localStorage.setItem(KEYS.theme,document.body.classList.contains("dark")?"dark":"light");
  renderDashboard();
  renderSettings();
}
function renderSettings(){
  if(!$("settingsThemeInfo")) return;
  const isDark=document.body.classList.contains("dark");
  $("settingsThemeInfo").textContent=isDark?"Tema atual: escuro.":"Tema atual: claro.";
  renderSalaryForm();
}
function refreshMainViews(){
  refreshSelects();
  renderCategories();
  renderTransactions(state.data.transactions);
  renderCards();
  renderInvoices();
  renderRecurring();
  renderGoals();
  renderDashboard();
  renderInsights();
  renderSettings();
  lucide.createIcons();
}
async function syncNow(){
  try{
    await pushCloudData();
    toast("Sincronização concluída.");
  }catch(err){
    console.error(err);
    toast("Falha na sincronização.",true);
  }
}
function exportBackupJson(){
  if(!state.data) return;
  const payload={exportedAt:new Date().toISOString(),app:"GranaFlow",data:state.data};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`granaflow-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importBackupFromFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||"{}"));
      const incoming=parsed?.data ?? parsed;
      state.data={...emptyData(),...incoming};
      ensureSettings();
      saveData();
      refreshMainViews();
      toast("Backup importado com sucesso.");
    }catch(err){
      console.error(err);
      toast("Arquivo de backup inválido.",true);
    }
  };
  reader.readAsText(file);
}
function clearAllData(){
  if(!confirm("Limpar todos os dados financeiros desta conta?")) return;
  state.data=emptyData();
  ensureSettings();
  saveData();
  refreshMainViews();
  openView("dashboard");
  toast("Dados limpos.");
}
function openView(view){
  const navBtn = document.querySelector(`.nav-link[data-view="${view}"], .mobile-tab[data-view="${view}"]`);
  if(!navBtn) return;
  $$(".nav-link").forEach(n=>n.classList.remove("active"));
  $$(".mobile-tab").forEach(n=>n.classList.remove("active"));
  navBtn.classList.add("active");
  const desktopBtn=document.querySelector(`.nav-link[data-view="${view}"]`); if(desktopBtn) desktopBtn.classList.add("active");
  const mobileBtn=document.querySelector(`.mobile-tab[data-view="${view}"]`); if(mobileBtn) mobileBtn.classList.add("active");
  $$(".view").forEach(x=>x.classList.add("hidden"));
  const targetView=$(`${view}View`);
  targetView.classList.remove("hidden");
  animateView(targetView);
  $("viewTitle").textContent = navBtn.textContent.trim();
  $("viewSubtitle").textContent = subtitle(view);
  $("sidebar").classList.remove("open");
  updateMobileFabVisibility(view);
  saveLastView(view);
  if(view==="insights") renderInsights();
  if(view==="settings") renderSettings();
}
function renderOnboarding(){
  const step=ONBOARDING_STEPS[state.onboardingIndex];
  if(!step) return;
  $("onboardingStep").textContent=`Passo ${state.onboardingIndex+1} de ${ONBOARDING_STEPS.length}`;
  $("onboardingTitle").textContent=step.title;
  $("onboardingText").textContent=step.text;
  $("onboardingNext").textContent=state.onboardingIndex===ONBOARDING_STEPS.length-1?"Concluir":"Próximo";
  openView(step.view);
  setTimeout(()=>step.focus?.(),80);
}
function startOnboarding(force=false){
  ensureSettings();
  if(!force && state.data.settings.onboardingDone) return;
  state.onboardingIndex=0;
  $("onboardingModal").classList.remove("hidden");
  renderOnboarding();
}
function finishOnboarding(showToast=true){
  ensureSettings();
  state.data.settings.onboardingDone=true;
  $("onboardingModal").classList.add("hidden");
  saveData();
  if(showToast) toast("Onboarding concluído. Bora crescer sua grana.");
}
function nextOnboardingStep(){
  if(state.onboardingIndex>=ONBOARDING_STEPS.length-1){
    finishOnboarding(true);
    return;
  }
  state.onboardingIndex+=1;
  renderOnboarding();
}
function maybeStartOnboarding(){
  startOnboarding(false);
}
function quickAddExpense(){
  openView("transactions");
  const form = $("transactionForm");
  setTransactionType("expense");
  setTransactionPaymentMethod("cash");
  form.date.value = today();
  toggleTransactionPaymentFields();
  form.amount.focus();
}
function setTransactionType(type){
  const form=$("transactionForm");
  if(!form) return;
  const value=type==="expense"?"expense":"income";
  form.type.value=value;
  const buttons=[...document.querySelectorAll(".type-toggle-btn")];
  buttons.forEach(btn=>{
    const active=btn.dataset.txType===value;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
  });
  const categoryField=$("transactionCategoryField");
  if(categoryField) categoryField.classList.toggle("hidden",value==="income");
  renderPaymentOptionsByType(value,{preferredMethod:form.paymentMethod.value});
  if(value==="income") applyIncomeCategoryByMethod();
}
function getOrCreateCategoryByName(name,{color="#3b82f6",icon="circle"}={}){
  if(!state.data) return "";
  const normalized=String(name||"").trim().toLowerCase();
  if(!normalized) return "";
  let c=state.data.categories.find(x=>String(x.name||"").trim().toLowerCase()===normalized);
  if(c) return c.id;
  c={id:uid("cat"),name,color,icon};
  state.data.categories.push(c);
  refreshSelects();
  renderCategories();
  return c.id;
}
function applyIncomeCategoryByMethod(){
  const form=$("transactionForm");
  if(!form||!state.data||form.type.value!=="income") return;
  const method=form.paymentMethod.value;
  if(method==="freelance"){
    form.categoryId.value=getOrCreateCategoryByName("Freela",{color:"#f97316",icon:"briefcase-business"});
    return;
  }
  form.categoryId.value=getOrCreateCategoryByName("Outras entradas",{color:"#0ea5e9",icon:"banknote"});
}
function renderPaymentOptionsByType(type,{preferredMethod}={}){
  const form=$("transactionForm");
  const wrap=document.querySelector(".payment-toggle");
  if(!form||!wrap) return;
  const options=PAYMENT_OPTIONS[type==="expense"?"expense":"income"];
  const buttons=[...document.querySelectorAll(".payment-toggle-btn")];
  buttons.forEach((btn,index)=>{
    const option=options[index];
    if(!option){
      btn.classList.add("is-hidden-option");
      btn.setAttribute("aria-hidden","true");
      btn.tabIndex=-1;
      return;
    }
    btn.classList.remove("is-hidden-option");
    btn.removeAttribute("aria-hidden");
    btn.tabIndex=0;
    btn.dataset.paymentMethod=option.value;
    btn.innerHTML=`<i data-lucide="${option.icon}"></i><span>${option.label}</span>`;
  });
  wrap.dataset.count=String(options.length);
  const normalized=type==="income" && (preferredMethod==="cash"||preferredMethod==="pix") ? "cashpix" : preferredMethod;
  const nextMethod=options.some(o=>o.value===normalized)?normalized:options[0].value;
  setTransactionPaymentMethod(nextMethod);
  lucide.createIcons();
}
function setTransactionPaymentMethod(method){
  const form=$("transactionForm");
  if(!form) return;
  const buttons=[...document.querySelectorAll(".payment-toggle-btn:not(.is-hidden-option)")];
  const allowed=buttons.map(btn=>btn.dataset.paymentMethod).filter(Boolean);
  let value=allowed.includes(method)?method:"";
  if(!value&&allowed.includes("cashpix")&&(method==="cash"||method==="pix")) value="cashpix";
  if(!value&&allowed.includes("cash")) value="cash";
  if(!value&&allowed.length) value=allowed[0];
  if(!value) return;
  form.paymentMethod.value=value;
  buttons.forEach(btn=>{
    const active=btn.dataset.paymentMethod===value;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
  });
  if(form.type.value==="income") applyIncomeCategoryByMethod();
}
function toggleTransactionPaymentFields(){
  const form = $("transactionForm");
  if(!form) return;
  const showCredit = form.type.value==="expense" && form.paymentMethod.value==="credit";
  $("transactionCreditFields").classList.toggle("hidden", !showCredit);
  if(showCredit && !form.installmentCount.value) form.installmentCount.value = "1";
}
function bindUi(){
  $$(".nav-link").forEach(btn=>btn.addEventListener("click",()=>openView(btn.dataset.view)));
  $$(".mobile-tab").forEach(btn=>btn.addEventListener("click",()=>openView(btn.dataset.view)));
  on("openMenu","click",()=>$("sidebar").classList.add("open"));
  on("closeMenu","click",()=>$("sidebar").classList.remove("open"));
  on("logoutBtn","click",logout);
  on("topbarSettingsBtn","click",()=>openView("settings"));
  on("darkToggle","click",toggleTheme);
  on("settingsThemeBtn","click",toggleTheme);
  on("reopenTutorialBtn","click",()=>startOnboarding(true));
  on("settingsTutorialBtn","click",()=>startOnboarding(true));
  on("settingsLogoutBtn","click",logout);
  on("syncNowBtn","click",syncNow);
  on("exportBackupBtn","click",exportBackupJson);
  on("importBackupBtn","click",()=>$("importBackupFile")?.click());
  on("importBackupFile","change",e=>{const f=e.target.files?.[0];importBackupFromFile(f);e.target.value=""});
  on("clearDataBtn","click",clearAllData);
  on("quickAddExpense","click",quickAddExpense);
  on("mobileQuickAdd","click",quickAddExpense);
  on("onboardingNext","click",nextOnboardingStep);
  on("onboardingSkip","click",()=>finishOnboarding(false));
  $$(".type-toggle-btn").forEach(btn=>btn.addEventListener("click",()=>{
    setTransactionType(btn.dataset.txType||"income");
    toggleTransactionPaymentFields();
  }));
  $$(".payment-toggle-btn").forEach(btn=>btn.addEventListener("click",()=>{
    setTransactionPaymentMethod(btn.dataset.paymentMethod||"cash");
    toggleTransactionPaymentFields();
  }));
  bindTapFeedback();
  bindForms();
}
function bindTapFeedback(){
  const els=[...document.querySelectorAll(".mobile-tab, .btn, .icon-btn")];
  const on=(el)=>el.classList.add("tap-press");
  const off=(el)=>el.classList.remove("tap-press");
  els.forEach(el=>{
    el.addEventListener("pointerdown",()=>on(el));
    el.addEventListener("pointerup",()=>off(el));
    el.addEventListener("pointerleave",()=>off(el));
    el.addEventListener("pointercancel",()=>off(el));
  });
}
function fill(sel,items,ph){const s=$(sel);if(!s)return;const old=s.value;s.innerHTML=`<option value="">${ph}</option>`;items.forEach(i=>{const o=document.createElement("option");o.value=i.id;o.textContent=i.name;s.appendChild(o)});if([...s.options].some(o=>o.value===old))s.value=old}
function refreshSelects(){fill("transactionCategory",state.data.categories,"Categoria");fill("filterCategory",state.data.categories,"Todas");fill("recurringCategory",state.data.categories,"Categoria")}
const cat=(id)=>state.data.categories.find(x=>x.id===id);
function txVM(t){return {...t,categoryName:cat(t.categoryId)?.name||"Sem categoria"}}
function txEffect(t,rev=false){
  if(!t.accountId)return;
  if(t.type==="expense" && t.paymentMethod==="credit") return;
  const a=state.data.accounts.find(x=>x.id===t.accountId);if(!a)return;
  const n=num(t.amount),s=rev?-1:1;
  if(t.type==="income")a.balance=num(a.balance)+n*s;
  if(t.type==="expense")a.balance=num(a.balance)-n*s
}
function splitAmount(total,count){
  const cents=Math.round(num(total)*100), base=Math.floor(cents/count), rem=cents-(base*count), arr=[];
  for(let i=0;i<count;i++) arr.push((base+(i<rem?1:0))/100);
  return arr;
}
function rebuildInstallmentsForTransaction(tx){
  state.data.installments = state.data.installments.filter(i=>i.sourceTransactionId!==tx.id);
  if(!(tx.type==="expense" && tx.paymentMethod==="credit")) return;
  const count=Math.max(1,parseInt(tx.installmentCount||"1",10));
  const parts=splitAmount(tx.amount,count);
  for(let i=0;i<count;i++){
    state.data.installments.push({
      id:uid("inst"),
      cardId:tx.creditCardId||"",
      installmentNumber:i+1,
      amount:parts[i],
      invoiceMonth:addMonths(tx.date||today(),i).slice(0,7),
      paid:false,
      description:tx.description||"Compra na transação",
      sourceTransactionId:tx.id
    });
  }
}
function formatDateBR(iso){
  if(!iso) return "-";
  const d=new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR");
}
function renderDebtPanel(){
  if(!$("debtInstallmentsCount")) return;
  const openInst=state.data.installments.filter(i=>!i.paid);
  const instAmount=openInst.reduce((s,i)=>s+num(i.amount),0);
  const limitDate=addMonths(today(),1);
  const recurringDue=state.data.recurring.filter(r=>r.isActive&&r.type==="expense"&&r.nextRunDate<=limitDate);
  const recurringAmount=recurringDue.reduce((s,r)=>s+num(r.amount),0);
  $("debtInstallmentsCount").textContent=String(openInst.length);
  $("debtInstallmentsAmount").textContent=money(instAmount);
  $("debtRecurringCount").textContent=String(recurringDue.length);
  $("debtRecurringAmount").textContent=money(recurringAmount);
  const cardById=(id)=>state.data.cards.find(c=>c.id===id);
  const nextInst=openInst.slice().sort((a,b)=>a.invoiceMonth<b.invoiceMonth?-1:1).slice(0,5).map(i=>`<div class="list-item"><div><strong>Parcela ${i.installmentNumber} • ${cardById(i.cardId)?.name||"Cartão"}</strong><br><small>Fatura ${i.invoiceMonth} • ${money(i.amount)}</small></div></div>`);
  const nextRec=recurringDue.slice().sort((a,b)=>a.nextRunDate<b.nextRunDate?-1:1).slice(0,5).map(r=>`<div class="list-item"><div><strong>${r.description||"Conta recorrente"}</strong><br><small>Vence em ${formatDateBR(r.nextRunDate)} • ${money(r.amount)}</small></div></div>`);
  $("debtSummaryList").innerHTML=(nextInst.concat(nextRec)).join("")||"<small>Sem pendências no momento.</small>";
}
function renderCategories(){ $("categoryList").innerHTML=state.data.categories.map(c=>`<div class="list-item"><div><strong>${c.name}</strong><br><small><span style="display:inline-block;width:12px;height:12px;border-radius:999px;background:${c.color}"></span> ${c.icon||"icone"}</small></div><div class="actions"><button class="btn btn-ghost" onclick="editCategory('${c.id}')">Editar</button><button class="btn btn-danger" onclick="removeCategory('${c.id}')">Excluir</button></div></div>`).join("") }
window.editCategory=(id)=>{const c=cat(id);if(!c)return;const f=$("categoryForm");f.id.value=c.id;f.name.value=c.name;f.color.value=c.color;f.icon.value=c.icon||""}
window.removeCategory=(id)=>{if(!confirm("Excluir categoria?"))return;state.data.categories=state.data.categories.filter(c=>c.id!==id);state.data.transactions.forEach(t=>{if(t.categoryId===id)t.categoryId=""});saveData();refreshSelects();renderCategories();renderTransactions(state.data.transactions);renderDashboard();toast("Categoria removida")}
function saveCategory(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));if(!f.name)return toast("Nome obrigatório",true);if(f.id){const c=cat(f.id);if(c){c.name=f.name;c.color=f.color||"#3b82f6";c.icon=f.icon||"circle"}}else state.data.categories.push({id:uid("cat"),name:f.name,color:f.color||"#3b82f6",icon:f.icon||"circle"});e.target.reset();saveData();refreshSelects();renderCategories();renderDashboard();toast("Categoria salva")}

function renderAccounts(){}

function paymentLabel(t){
  if(t.type==="income"){
    if(t.paymentMethod==="cashpix"||t.paymentMethod==="cash"||t.paymentMethod==="pix") return "Dinheiro/PIX";
    if(t.paymentMethod==="freelance") return "Freela";
    return "Entrada";
  }
  if(t.paymentMethod==="pix") return "PIX";
  if(t.paymentMethod==="debit") return "Cartao de Debito";
  if(t.paymentMethod==="credit"){
    return `Cartao de Credito${num(t.installmentCount)>1?` ${t.installmentCount}x`:""}`;
  }
  return "Dinheiro"
}
function updateTransactionFiltersVisibility(){
  const card=$("transactionFilterCard");
  if(!card||!state.data) return;
  card.classList.toggle("hidden",state.data.transactions.length===0);
}
function renderTransactions(items){
  updateTransactionFiltersVisibility();
  const list=items.slice().sort((a,b)=>a.date<b.date?1:-1).map(txVM);
  $("transactionList").innerHTML=list.map(t=>`<div class="list-item"><div><strong>${t.type==="income"?"Entrada":"Saída"} ${money(t.amount)}</strong><br><small>${t.date} • ${t.categoryName}</small><br><small>${paymentLabel(t)}${t.description?` • ${t.description}`:""}</small></div><div class="actions"><button class="btn btn-ghost" onclick="editTransaction('${t.id}')">Editar</button><button class="btn btn-danger" onclick="removeTransaction('${t.id}')">Excluir</button></div></div>`).join("")||"<small>Nenhuma transação ainda.</small>";
}
window.editTransaction=(id)=>{const t=state.data.transactions.find(x=>x.id===id);if(!t)return;const f=$("transactionForm");f.id.value=t.id;setTransactionType(t.type);f.amount.value=t.amount;setTransactionPaymentMethod(t.paymentMethod||"cash");f.categoryId.value=t.categoryId||"";f.installmentCount.value=t.installmentCount||1;f.date.value=t.date;f.description.value=t.description||"";toggleTransactionPaymentFields()}
window.removeTransaction=(id)=>{if(!confirm("Excluir transação?"))return;const t=state.data.transactions.find(x=>x.id===id);if(t){txEffect(t,true);state.data.installments=state.data.installments.filter(i=>i.sourceTransactionId!==t.id)}state.data.transactions=state.data.transactions.filter(x=>x.id!==id);saveData();renderAccounts();renderTransactions(state.data.transactions);renderDashboard();renderCards();toast("Transação removida")}
function saveTransaction(e){
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target));
  const amount=num(f.amount);
  const paymentMethod=f.paymentMethod||"cash";
  const installmentCount=paymentMethod==="credit"?Math.max(1,parseInt(f.installmentCount||"1",10)):1;
  if(!["income","expense"].includes(f.type)||amount<=0)return toast("Dados inválidos",true);
  let categoryId=f.categoryId||"";
  if(f.type==="income"){
    if(paymentMethod==="freelance"){
      categoryId=getOrCreateCategoryByName("Freela",{color:"#f97316",icon:"briefcase-business"});
    }else{
      categoryId=getOrCreateCategoryByName("Outras entradas",{color:"#0ea5e9",icon:"banknote"});
    }
  }
  if(f.id){
    const t=state.data.transactions.find(x=>x.id===f.id);if(!t)return;
    txEffect(t,true);
    Object.assign(t,{type:f.type,amount,paymentMethod,installmentCount,creditCardId:"",categoryId,accountId:"",description:f.description||"",date:f.date||today()});
    txEffect(t,false);
    rebuildInstallmentsForTransaction(t);
  }else{
    const t={id:uid("tx"),type:f.type,amount,paymentMethod,installmentCount,creditCardId:"",categoryId,accountId:"",description:f.description||"",date:f.date||today()};
    txEffect(t,false);
    rebuildInstallmentsForTransaction(t);
    state.data.transactions.push(t);
  }
  saveData();e.target.reset();
  if($("transactionForm").date)$("transactionForm").date.value=today();
  setTransactionType("income");
  setTransactionPaymentMethod("cash");
  $("transactionForm").installmentCount.value="1";
  toggleTransactionPaymentFields();
  renderAccounts();renderTransactions(state.data.transactions);renderDashboard();renderCards();toast("Transação salva")
}
function filterTransactions(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));let items=[...state.data.transactions];if(f.type)items=items.filter(t=>t.type===f.type);if(f.categoryId)items=items.filter(t=>t.categoryId===f.categoryId);if(f.startDate)items=items.filter(t=>t.date>=f.startDate);if(f.endDate)items=items.filter(t=>t.date<=f.endDate);renderTransactions(items)}

function usedLimit(cardId){return state.data.installments.filter(i=>i.cardId===cardId&&!i.paid).reduce((s,i)=>s+num(i.amount),0)}
function renderCards(){renderDebtPanel()}
function addMonths(dateStr,n){const d=new Date(`${dateStr}T00:00:00`);const f=new Date(d.getFullYear(),d.getMonth()+n,Math.min(d.getDate(),28));return f.toISOString().slice(0,10)}
function nextSalaryDate(day){
  const now=new Date(`${today()}T00:00:00`);
  let y=now.getFullYear(), m=now.getMonth(), d=Math.min(28,Math.max(1,parseInt(day||"5",10)));
  const candidate=new Date(y,m,d);
  if(now>candidate) return new Date(y,m+1,d).toISOString().slice(0,10);
  return candidate.toISOString().slice(0,10);
}
function renderSalaryForm(){
  ensureSettings();
  const s=state.data.settings.salary;
  if($("salaryAmount")) $("salaryAmount").value = s.amount>0 ? s.amount : "";
  if($("salaryDay")) $("salaryDay").value = s.day||5;
  if($("salaryInfo")) $("salaryInfo").textContent = s.enabled ? `Ativo: ${money(s.amount)} todo dia ${s.day}.` : "Configure para lançar automaticamente todos os meses.";
}
function saveSalaryAuto(e){
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target));
  const amount=num(f.amount), day=Math.min(28,Math.max(1,parseInt(f.day||"5",10)));
  if(amount<=0) return toast("Informe um salário válido.",true);
  ensureSettings();
  const salaryCategory=state.data.categories.find(c=>c.id==="cat_salary"||String(c.name).toLowerCase().includes("sal"));
  let rec=state.data.recurring.find(r=>r.id===state.data.settings.salary?.recurringId);
  if(!rec){
    rec={id:uid("rec"),type:"income",amount,frequency:"monthly",nextRunDate:nextSalaryDate(day),categoryId:salaryCategory?.id||"",accountId:"",description:"Salário mensal",isActive:true,systemTag:"salary_auto"};
    state.data.recurring.push(rec);
  }else{
    Object.assign(rec,{type:"income",amount,frequency:"monthly",nextRunDate:nextSalaryDate(day),categoryId:salaryCategory?.id||rec.categoryId||"",accountId:"",description:"Salário mensal",isActive:true,systemTag:"salary_auto"});
  }
  state.data.settings.salary={enabled:true,amount,day,accountId:"",recurringId:rec.id};
  saveData();
  renderSalaryForm();
  renderRecurring();
  toast("Salário automático salvo.");
}
window.markInstallmentPaid=(id)=>{const i=state.data.installments.find(x=>x.id===id);if(!i)return;i.paid=true;saveData();renderCards();renderInvoices();renderDashboard();renderDebtPanel();toast("Parcela paga")}
function renderInvoices(e){if(e)e.preventDefault();const f=new FormData($("invoiceFilter"));const m=f.get("month");const list=state.data.installments.filter(i=>(!m||i.invoiceMonth===m));const g={};list.forEach(i=>{g[i.invoiceMonth]??={month:i.invoiceMonth,total:0,items:[]};g[i.invoiceMonth].total+=num(i.amount);g[i.invoiceMonth].items.push(i)});const rows=Object.values(g).sort((a,b)=>a.month<b.month?1:-1);$("invoiceList").innerHTML=rows.map(r=>`<div class="list-item"><div><strong>${r.month}</strong><br><small>Total: ${money(r.total)}</small>${r.items.map(i=>`<div><small>${i.installmentNumber}a parcela - ${money(i.amount)} ${i.paid?"(paga)":`<button class='btn btn-ghost' onclick="markInstallmentPaid('${i.id}')">Marcar paga</button>`}</small></div>`).join("")}</div></div>`).join("")||"<small>Sem parcelas para o período.</small>"}
function nextDate(dateStr,f){const d=new Date(`${dateStr}T00:00:00`);if(f==="daily")d.setDate(d.getDate()+1);if(f==="weekly")d.setDate(d.getDate()+7);if(f==="monthly")d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)}
function saveRecurring(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const amount=num(f.amount);if(!["income","expense"].includes(f.type)||amount<=0)return toast("Recorrência inválida",true);if(f.id){const r=state.data.recurring.find(x=>x.id===f.id);if(r)Object.assign(r,{...f,amount})}else state.data.recurring.push({id:uid("rec"),type:f.type,amount,frequency:f.frequency||"monthly",nextRunDate:f.nextRunDate||today(),categoryId:f.categoryId||"",accountId:f.accountId||"",description:f.description||"",isActive:true});saveData();e.target.reset();if($("recurringForm").nextRunDate)$("recurringForm").nextRunDate.value=today();renderRecurring();toast("Recorrência salva")}
window.removeRecurring=(id)=>{if(!confirm("Excluir recorrente?"))return;state.data.recurring=state.data.recurring.filter(r=>r.id!==id);saveData();renderRecurring();renderDashboard();toast("Recorrente removido")}
function runRecurringDue(silent=false){const t=today();let p=0;state.data.recurring.forEach(r=>{if(!r.isActive)return;while(r.nextRunDate<=t){const tx={id:uid("tx"),type:r.type,amount:num(r.amount),categoryId:r.categoryId||"",accountId:r.accountId||"",description:`[Recorrente] ${r.description||""}`.trim(),date:r.nextRunDate};txEffect(tx,false);state.data.transactions.push(tx);r.nextRunDate=nextDate(r.nextRunDate,r.frequency);p++}});if(p){saveData();renderRecurring();renderTransactions(state.data.transactions);renderAccounts();renderDashboard();if(!silent)toast(`Processados ${p} lançamentos`)}}
function renderRecurring(){ $("recurringList").innerHTML=state.data.recurring.map(r=>`<div class="list-item"><div><strong>${r.type==="income"?"Entrada":"Saída"} ${money(r.amount)}</strong><br><small>${r.frequency} • próxima: ${r.nextRunDate}</small><br><small>${r.description||"-"}</small></div><div class="actions"><button class="btn btn-danger" onclick="removeRecurring('${r.id}')">Excluir</button></div></div>`).join("");renderDebtPanel() }

function saveGoal(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const target=num(f.targetAmount),current=num(f.currentAmount),durationValue=Math.max(1,parseInt(f.durationValue||"1",10)),durationUnit=f.durationUnit||"months";if(target<=0||current<0)return toast("Meta inválida",true);if(f.id){const g=state.data.goals.find(x=>x.id===f.id);if(g){g.targetAmount=target;g.currentAmount=current;g.durationValue=durationValue;g.durationUnit=durationUnit;g.name="Meta financeira"}}else state.data.goals.push({id:uid("goal"),name:"Meta financeira",targetAmount:target,currentAmount:current,durationValue,durationUnit});saveData();e.target.reset();renderGoals();renderDashboard();toast("Meta salva")}
window.contributeGoal=(id)=>{const g=state.data.goals.find(x=>x.id===id);if(!g)return;const v=num(prompt("Valor do aporte:"));if(v<=0)return;g.currentAmount=num(g.currentAmount)+v;saveData();renderGoals();renderDashboard();toast("Aporte registrado")}
window.removeGoal=(id)=>{if(!confirm("Excluir meta?"))return;state.data.goals=state.data.goals.filter(g=>g.id!==id);saveData();renderGoals();renderDashboard();toast("Meta removida")}
function renderGoals(){
  if(!state.data.goals.length){
    $("goalList").innerHTML="<small>Nenhuma meta criada ainda.</small>";
    return;
  }
  $("goalList").innerHTML=state.data.goals.map(g=>{
    const p=g.targetAmount>0?Math.min(100,(num(g.currentAmount)/num(g.targetAmount))*100):0;
    const remaining=Math.max(0,num(g.targetAmount)-num(g.currentAmount));
    const durationUnit=(g.durationUnit==="years"?"years":"months");
    const durationValue=Math.max(1,parseInt(g.durationValue||"12",10));
    const months=(durationUnit==="years"?durationValue*12:durationValue)||1;
    const monthlyNeed=remaining/months;
    const eta=addMonths(today(),months);
    const done=p>=100;
    const risky=!done&&monthlyNeed>(num(g.targetAmount)*0.2);
    const badge=done?"Concluida":(risky?"Ajustar ritmo":"No caminho");
    const badgeClass=done?"goal-badge done":(risky?"goal-badge warn":"goal-badge ok");
    const badgeIcon=done?"badge-check":(risky?"triangle-alert":"rocket");
    return `<div class="goal-item">
      <div class="goal-top">
        <div>
          <strong>${g.name||"Meta financeira"}</strong>
          <small>Previsao: ${formatDateBR(eta)} • Prazo: ${durationValue} ${durationUnit==="years"?"anos":"meses"}</small>
        </div>
        <span class="${badgeClass}"><i data-lucide="${badgeIcon}"></i>${badge}</span>
      </div>
      <div class="goal-metrics">
        <div><small>Objetivo</small><strong>${money(g.targetAmount)}</strong></div>
        <div><small>Atual</small><strong>${money(g.currentAmount)}</strong></div>
        <div><small>Falta</small><strong>${money(remaining)}</strong></div>
        <div><small>Aporte sugerido</small><strong>${money(monthlyNeed)}/mês</strong></div>
      </div>
      <div class="progress goal-progress"><div style="width:${p}%"></div></div>
      <small class="goal-progress-label">${p.toFixed(0)}% concluido</small>
      <div class="actions">
        <button class="btn btn-secondary" onclick="contributeGoal('${g.id}')">Aportar</button>
        <button class="btn btn-danger" onclick="removeGoal('${g.id}')">Excluir</button>
      </div>
    </div>`;
  }).join("");
  lucide.createIcons();
}

function draw(k,id,type,data){
  if(state.charts[k]) state.charts[k].destroy();
  const text = getComputedStyle(document.body).getPropertyValue("--text").trim();
  const border = getComputedStyle(document.body).getPropertyValue("--border").trim();
  state.charts[k]=new Chart($(id),{
    type,
    data,
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:{
        duration: prefersReducedMotion ? 0 : 720,
        easing: "easeOutCubic"
      },
      plugins:{legend:{labels:{color:text}}},
      scales:type==="line"?{
        x:{ticks:{color:text},grid:{color:border}},
        y:{ticks:{color:text},grid:{color:border}}
      }:undefined
    }
  });
}
function renderDashboard(){
  const tx = state.data.transactions;
  const inc = tx.filter(t=>t.type==="income").reduce((s,t)=>s+num(t.amount),0);
  const exp = tx.filter(t=>t.type==="expense").reduce((s,t)=>s+num(t.amount),0);
  const balance = inc-exp;
  const alerts = state.data.recurring.filter(r=>r.nextRunDate<=today()).length+state.data.installments.filter(i=>!i.paid).length;
  animateValue($("metricBalance"),balance,{currency:true});
  animateValue($("metricIncome"),inc,{currency:true});
  animateValue($("metricExpense"),exp,{currency:true});
  animateValue($("metricAlerts"),alerts,{currency:false,duration:420});
  if($("heroBalance")) animateValue($("heroBalance"),balance,{currency:true});
  if($("heroIncome")) animateValue($("heroIncome"),inc,{currency:true});
  if($("heroExpense")) animateValue($("heroExpense"),exp,{currency:true});
  if($("heroHealth")) $("heroHealth").textContent = balance>=0 ? "Saudável" : "Atenção";
  $("latestTransactions").innerHTML=tx.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8).map(t=>`<div class="list-item"><div><strong>${money(t.amount)}</strong><br><small>${t.date} • ${t.description||"-"}</small></div></div>`).join("")||"<small>Nenhuma transação.</small>";
  const byCat={};tx.filter(t=>t.type==="expense").forEach(t=>{const k=t.categoryId||"none";byCat[k]=(byCat[k]||0)+num(t.amount)});
  draw("category","categoryChart","doughnut",{labels:Object.keys(byCat).map(k=>cat(k)?.name||"Sem categoria"),datasets:[{data:Object.values(byCat),backgroundColor:Object.keys(byCat).map(k=>cat(k)?.color||"#94a3b8")}]});
  const byMonth={};tx.forEach(t=>{const m=t.date.slice(0,7);byMonth[m]??={income:0,expense:0};byMonth[m][t.type]+=num(t.amount)});
  const ms=Object.keys(byMonth).sort();
  draw("trend","trendChart","line",{labels:ms,datasets:[{label:"Receitas",data:ms.map(m=>byMonth[m].income),borderColor:"#16a34a",tension:.3},{label:"Despesas",data:ms.map(m=>byMonth[m].expense),borderColor:"#dc2626",tension:.3}]});
  const cardOpen = state.data.installments.filter(i=>!i.paid).reduce((s,i)=>s+num(i.amount),0);
  const pieValues = [inc, exp, cardOpen];
  const pieTotal = pieValues.reduce((s,v)=>s+v,0);
  if(pieTotal<=0){
    draw("overall","overallPieChart","pie",{labels:["Sem dados"],datasets:[{data:[1],backgroundColor:["#94a3b8"]}]});
  }else{
    draw("overall","overallPieChart","pie",{
      labels:["Receitas","Despesas","Cartão em aberto"],
      datasets:[{data:pieValues,backgroundColor:["#16a34a","#dc2626","#2563eb"]}]
    });
  }
}

function monthly(m){const tx=state.data.transactions.filter(t=>t.date.slice(0,7)===m).map(txVM);const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+num(t.amount),0);const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+num(t.amount),0);return{month:m,income,expense,balance:income-expense,transactions:tx}}
function reportMonthLabel(m){
  const [y,mo]=String(m||"").split("-").map(Number);
  if(!y||!mo) return m;
  return new Date(y,mo-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
}
function renderMonthlyReportOutput(data){
  const txRows=data.transactions.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,14).map(t=>`<div class="report-row"><small>${formatDateBR(t.date)}</small><span class="report-pill ${t.type}">${t.type==="income"?"Entrada":"Saída"}</span><small>${t.categoryName}${t.description?` • ${t.description}`:""}</small><strong>${money(t.amount)}</strong></div>`).join("");
  $("reportOutput").innerHTML=`<div class="report-kpis">
    <div class="report-kpi income"><small>Receitas (${reportMonthLabel(data.month)})</small><strong>${money(data.income)}</strong></div>
    <div class="report-kpi expense"><small>Despesas (${reportMonthLabel(data.month)})</small><strong>${money(data.expense)}</strong></div>
    <div class="report-kpi"><small>Saldo</small><strong>${money(data.balance)}</strong></div>
  </div>
  <div class="report-chart-box"><canvas id="reportMiniChart"></canvas></div>
  <div class="report-list">${txRows||"<div class='report-row'><small class='report-empty'>Sem transações para este mês.</small></div>"}</div>`;
  draw("reportMini","reportMiniChart","bar",{
    labels:["Receitas","Despesas","Saldo"],
    datasets:[{
      label:"Resumo mensal",
      data:[data.income,data.expense,data.balance],
      backgroundColor:["#16a34a","#dc2626","#2563eb"],
      borderRadius:10,
      maxBarThickness:42
    }]
  });
}
function renderCompareReportOutput(current,previous){
  const deltaIncome=current.income-previous.income;
  const deltaExpense=current.expense-previous.expense;
  const deltaBalance=current.balance-previous.balance;
  $("reportOutput").innerHTML=`<div class="report-kpis">
    <div class="report-kpi income"><small>Receitas (${reportMonthLabel(current.month)})</small><strong>${money(current.income)}</strong><small>Diferença: ${deltaIncome>=0?"+":""}${money(deltaIncome)}</small></div>
    <div class="report-kpi expense"><small>Despesas (${reportMonthLabel(current.month)})</small><strong>${money(current.expense)}</strong><small>Diferença: ${deltaExpense>=0?"+":""}${money(deltaExpense)}</small></div>
    <div class="report-kpi"><small>Saldo (${reportMonthLabel(current.month)})</small><strong>${money(current.balance)}</strong><small>Diferença: ${deltaBalance>=0?"+":""}${money(deltaBalance)}</small></div>
  </div>
  <div class="report-chart-box"><canvas id="reportMiniChart"></canvas></div>
  <div class="report-list">
    <div class="report-row"><small>Período atual</small><small>${reportMonthLabel(current.month)}</small><small>Transações: ${current.transactions.length}</small><strong>${money(current.balance)}</strong></div>
    <div class="report-row"><small>Período anterior</small><small>${reportMonthLabel(previous.month)}</small><small>Transações: ${previous.transactions.length}</small><strong>${money(previous.balance)}</strong></div>
  </div>`;
  draw("reportMini","reportMiniChart","bar",{
    labels:["Receitas","Despesas","Saldo"],
    datasets:[
      {
        label:reportMonthLabel(previous.month),
        data:[previous.income,previous.expense,previous.balance],
        backgroundColor:"rgba(148,163,184,0.7)",
        borderRadius:8,
        maxBarThickness:34
      },
      {
        label:reportMonthLabel(current.month),
        data:[current.income,current.expense,current.balance],
        backgroundColor:["#16a34a","#dc2626","#2563eb"],
        borderRadius:8,
        maxBarThickness:34
      }
    ]
  });
}
function generateMonthlyReport(e){
  e.preventDefault();
  const m=new FormData(e.target).get("month");
  state.reportMonth=m;
  renderMonthlyReportOutput(monthly(m));
}
function compareMonths(e){
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target));
  const current=monthly(f.current);
  const previous=monthly(f.previous);
  state.reportMonth=f.current;
  renderCompareReportOutput(current,previous);
}
function exportCsv(){const m=state.reportMonth||month();const r=monthly(m).transactions;const csv=[["id","data","tipo","valor","categoria","descricao"],...r.map(t=>[t.id,t.date,t.type,t.amount,t.categoryName,t.description||""])].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`relatorio-${m}.csv`;a.click();URL.revokeObjectURL(url)}
function exportPdf(){
  const m=state.reportMonth||month();
  const r=monthly(m);
  const byCat={};
  r.transactions.filter(t=>t.type==="expense").forEach(t=>{const k=t.categoryName||"Sem categoria";byCat[k]=(byCat[k]||0)+num(t.amount)});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const w=window.open("","_blank");
  if(!w)return toast("Permita pop-up",true);
  const rows=r.transactions.slice().sort((a,b)=>a.date<b.date?1:-1).map(t=>`<tr><td>${formatDateBR(t.date)}</td><td>${t.type==="income"?"Entrada":"Saída"}</td><td>${t.categoryName}</td><td>${t.description||"-"}</td><td>${money(t.amount)}</td></tr>`).join("");
  const catRows=topCats.map(([name,value])=>`<div class="cat-row"><span>${name}</span><strong>${money(value)}</strong></div>`).join("");
  w.document.write(`<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório ${m}</title>
      <style>
        :root{--primary:#0f766e;--accent:#2563eb;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--bg:#f8fafc}
        *{box-sizing:border-box}
        body{font-family:Inter,Segoe UI,Arial,sans-serif;color:var(--text);margin:0;background:#fff}
        .wrap{padding:28px}
        .hero{border:1px solid var(--border);border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,rgba(15,118,110,.11),rgba(37,99,235,.12))}
        .kicker{margin:0;color:var(--muted);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
        h1{margin:6px 0 4px;font-size:25px}
        .periodo{margin:0;color:var(--muted);font-size:14px}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
        .kpi{background:#fff;border:1px solid var(--border);border-radius:12px;padding:11px 12px}
        .kpi small{display:block;color:var(--muted);font-size:12px}
        .kpi strong{font-size:18px}
        .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:12px;margin-top:14px}
        .card{border:1px solid var(--border);border-radius:14px;padding:14px;background:#fff}
        .card h3{margin:0 0 10px;font-size:16px}
        .cat-row{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)}
        .cat-row:last-child{border-bottom:0}
        table{width:100%;border-collapse:collapse;margin-top:14px;border:1px solid var(--border);border-radius:12px;overflow:hidden}
        th,td{font-size:12.5px;text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}
        thead th{background:var(--bg);font-weight:700}
        tbody tr:nth-child(even){background:#fcfdff}
        .footer{margin-top:12px;color:var(--muted);font-size:12px}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{padding:14px}.hero{break-inside:avoid}.grid{break-inside:avoid}table{break-inside:auto}tr{break-inside:avoid}}
      </style>
    </head>
    <body>
      <div class="wrap">
        <section class="hero">
          <p class="kicker">GranaFlow</p>
          <h1>Relatório Financeiro</h1>
          <p class="periodo">Período: ${reportMonthLabel(m)}</p>
          <div class="kpis">
            <div class="kpi"><small>Receitas</small><strong>${money(r.income)}</strong></div>
            <div class="kpi"><small>Despesas</small><strong>${money(r.expense)}</strong></div>
            <div class="kpi"><small>Saldo</small><strong>${money(r.balance)}</strong></div>
          </div>
        </section>
        <section class="grid">
          <article class="card">
            <h3>Resumo do período</h3>
            <p style="margin:0;color:var(--muted);font-size:13px">Transações registradas: <strong style="color:var(--text)">${r.transactions.length}</strong></p>
            <p style="margin:8px 0 0;color:var(--muted);font-size:13px">Média por transação: <strong style="color:var(--text)">${money(r.transactions.length?((r.income+r.expense)/r.transactions.length):0)}</strong></p>
          </article>
          <article class="card">
            <h3>Top categorias de despesas</h3>
            ${catRows||"<p style='margin:0;color:var(--muted)'>Sem despesas no período.</p>"}
          </article>
        </section>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
          <tbody>${rows||"<tr><td colspan='5'>Sem transações no período.</td></tr>"}</tbody>
        </table>
        <p class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} • GranaFlow</p>
      </div>
    </body>
  </html>`);
  w.document.close();
  w.focus();
  w.print();
}
function shiftMonth(monthStr,delta){
  const [year,mon]=String(monthStr||"").split("-").map(Number);
  if(!year||!mon) return month();
  const d=new Date(year,mon-1+delta,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(monthStr){
  const [year,mon]=String(monthStr||"").split("-").map(Number);
  if(!year||!mon) return monthStr;
  return new Date(year,mon-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
}
function expenseByCategory(monthStr){
  const out={};
  state.data.transactions.forEach(t=>{
    if(t.type!=="expense"||String(t.date||"").slice(0,7)!==monthStr) return;
    const k=t.categoryId||"none";
    out[k]=(out[k]||0)+num(t.amount);
  });
  return out;
}
function renderInsights(){
  const tx=state.data.transactions;
  const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+num(t.amount),0);
  const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+num(t.amount),0);
  const currentMonth=month();
  const previousMonth=shiftMonth(currentMonth,-1);
  const byCurrent=expenseByCategory(currentMonth);
  const byPrevious=expenseByCategory(previousMonth);
  const keys=[...new Set([...Object.keys(byCurrent),...Object.keys(byPrevious)])];
  const growth=keys.map(k=>{
    const current=num(byCurrent[k]);
    const previous=num(byPrevious[k]);
    return {
      key:k,
      name:cat(k)?.name||"Sem categoria",
      current,
      previous,
      delta:current-previous,
      pct:previous>0?((current-previous)/previous)*100:null
    };
  }).filter(g=>g.delta>0).sort((a,b)=>b.delta-a.delta);
  const topGrowth=growth.slice(0,3);
  const transportCatIds=state.data.categories.filter(c=>String(c.name||"").toLowerCase().includes("transp")).map(c=>c.id);
  if(state.data.categories.some(c=>c.id==="cat_trans")) transportCatIds.push("cat_trans");
  const uniqueTransport=[...new Set(transportCatIds)];
  const transportCurrent=uniqueTransport.reduce((sum,id)=>sum+num(byCurrent[id]),0);
  const transportPrevious=uniqueTransport.reduce((sum,id)=>sum+num(byPrevious[id]),0);
  const trendInsights=[];
  const topGrowthInsights=[];
  const suggestionInsights=[];
  if(transportPrevious>0&&transportCurrent>transportPrevious){
    const transportPct=((transportCurrent-transportPrevious)/transportPrevious)*100;
    trendInsights.push(`Voce gastou +${transportPct.toFixed(0)}% em transporte em ${monthLabel(currentMonth)} vs ${monthLabel(previousMonth)}.`);
  }else if(transportCurrent>0&&transportPrevious===0){
    trendInsights.push(`Transporte apareceu com ${money(transportCurrent)} em ${monthLabel(currentMonth)}. Vale conferir se houve corrida/combustivel acima do normal.`);
  }
  const currentExpenseTotal=monthly(currentMonth).expense;
  const previousExpenseTotal=monthly(previousMonth).expense;
  if(previousExpenseTotal>0&&currentExpenseTotal>0){
    const expensePct=((currentExpenseTotal-previousExpenseTotal)/previousExpenseTotal)*100;
    const direction=expensePct>=0?"+":"";
    trendInsights.push(`Despesas totais em ${monthLabel(currentMonth)}: ${direction}${expensePct.toFixed(0)}% contra ${monthLabel(previousMonth)}.`);
  }
  topGrowth.forEach((g,idx)=>{
    topGrowthInsights.push(`${idx+1}) ${g.name}: +${money(g.delta)}${g.pct===null?" (novo gasto no mes)":` (${g.pct.toFixed(0)}%)`}`);
  });
  if(!topGrowthInsights.length){
    topGrowthInsights.push("Nenhuma categoria teve aumento relevante no comparativo mensal.");
  }
  const monthsWithData=[...new Set(tx.filter(t=>t.type==="expense").map(t=>String(t.date||"").slice(0,7)))].sort();
  const previous3=monthsWithData.filter(m=>m<currentMonth).slice(-3).map(m=>monthly(m).expense);
  const avgPrevious3=previous3.length?previous3.reduce((s,v)=>s+v,0)/previous3.length:0;
  if(avgPrevious3>0&&currentExpenseTotal>avgPrevious3*1.15){
    suggestionInsights.push(`Suas despesas de ${monthLabel(currentMonth)} estao ${(((currentExpenseTotal-avgPrevious3)/avgPrevious3)*100).toFixed(0)}% acima da media recente. Defina teto para a categoria que mais subiu.`);
  }
  if(income>0&&expense>income*.85){
    suggestionInsights.push("Gastos acima de 85% da renda. Priorize cortar custos variaveis antes de comprometer novas parcelas.");
  }else if(income>0&&expense<income*.6){
    suggestionInsights.push("Voce manteve despesas abaixo de 60% da renda. Direcione parte da folga para metas ou reserva.");
  }
  if(!trendInsights.length) trendInsights.push("Registre despesas em meses consecutivos para gerar comparativos automaticamente.");
  if(!suggestionInsights.length) suggestionInsights.push("Mantenha o registro semanal em dia para receber recomendacoes mais precisas.");
  const renderInsightGroup=(id,items,emptyText)=>{
    const el=$(id);
    if(!el) return;
    el.innerHTML=items.length?items.map(t=>`<div class='list-item'><small>${t}</small></div>`).join(""):`<small>${emptyText}</small>`;
  };
  renderInsightGroup("insightTrendList",trendInsights,"Sem comparativos disponiveis.");
  renderInsightGroup("insightTopGrowthList",topGrowthInsights,"Sem alta de categorias no periodo.");
  renderInsightGroup("insightSuggestionList",suggestionInsights,"Sem sugestoes no momento.");
  if($("insightsList")){
    const fallback=[...trendInsights,...topGrowthInsights,...suggestionInsights];
    $("insightsList").innerHTML=fallback.map(t=>`<div class='list-item'><small>${t}</small></div>`).join("");
  }
  const alerts=[...state.data.recurring.filter(r=>r.nextRunDate<=today()).map(r=>`Recorrencia '${r.description||r.type}' prevista para ${r.nextRunDate}.`),...state.data.installments.filter(i=>!i.paid&&num(i.amount)>=500).map(i=>`Parcela alta em ${i.invoiceMonth}: ${money(i.amount)}.`)];
  $("notificationList").innerHTML=alerts.map(a=>`<div class='list-item'><small>${a}</small></div>`).join("")||"<small>Sem notificacoes.</small>"
}

function bindForms(){
  on("transactionForm","submit",saveTransaction);
  if($("transactionForm")?.type) $("transactionForm").type.addEventListener("change",toggleTransactionPaymentFields);
  on("transactionFilter","submit",filterTransactions);
  on("clearTxFilter","click",()=>{$("transactionFilter")?.reset();if(state.data)renderTransactions(state.data.transactions)});
  on("categoryForm","submit",saveCategory);
  on("invoiceFilter","submit",renderInvoices);
  on("recurringForm","submit",saveRecurring);
  on("runRecurring","click",()=>runRecurringDue(false));
  on("salaryForm","submit",saveSalaryAuto);
  on("goalForm","submit",saveGoal);
  on("reportForm","submit",generateMonthlyReport);
  on("compareForm","submit",compareMonths);
  on("exportCsv","click",exportCsv);
  on("exportPdf","click",exportPdf);
}
async function boot(){
  setLoadingUI(true);
  try{
    await wait(180);
    ensureSettings();
    refreshSelects();
    runRecurringDue(true);
    renderCategories();
    renderAccounts();
    renderTransactions(state.data.transactions);
    renderCards();
    renderInvoices();
    renderRecurring();
    renderGoals();
    renderSalaryForm();
    renderDashboard();
    renderInsights();
    state.reportMonth=state.reportMonth||month();
    renderMonthlyReportOutput(monthly(state.reportMonth));
    renderSettings();
    const initialView=readLastView();
    openView(initialView);
    lucide.createIcons();
    maybeStartOnboarding();
    await wait(120);
  }catch(err){
    console.error("Erro no boot:",err);
    toast("Houve um erro ao iniciar a interface.",true);
  }finally{
    setLoadingUI(false);
  }
}
function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./service-worker.js").catch(err=>console.error("SW register erro:",err));
  });
}

if(localStorage.getItem(KEYS.theme)==="dark")document.body.classList.add("dark");
bindAuth();bindUi();
if($("transactionForm").date)$("transactionForm").date.value=today(); if($("recurringForm").nextRunDate)$("recurringForm").nextRunDate.value=today(); if($("reportForm").month)$("reportForm").month.value=month(); if($("transactionForm").installmentCount)$("transactionForm").installmentCount.value="1"; setTransactionType($("transactionForm")?.type?.value||"income"); setTransactionPaymentMethod($("transactionForm")?.paymentMethod?.value||"cash"); toggleTransactionPaymentFields();
renderAuth();
(async()=>{
  const restored=await restoreAuthSession();
  if(restored) return;
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) await login(mapAuthUser(session.user));
})();
sb.auth.onAuthStateChange(async(event,session)=>{
  if(session) saveAuthSession(session);
  else clearAuthSession();
  if(session?.user && !state.user){
    await login(mapAuthUser(session.user));
    return;
  }
  if(!session?.user && state.user){
    state.user=null;
    state.data=null;
    renderAuth();
  }
});
lucide.createIcons();
registerServiceWorker();

window.addEventListener("error", (e) => {
  console.error("Erro Global:", e.message);
  if (typeof toast === "function") toast("Erro no aplicativo: " + e.message, true);
});

const KEYS={theme:"granaflow_theme",lastView:"granaflow_last_view",lastGoodData:"granaflow_last_good_data"};
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
const state={user:null,data:null,charts:{category:null,trend:null,overall:null,reportMini:null},reportMonth:"",syncTimer:null,onboardingIndex:0,aiLearning:{}};
const $=(id)=>document.getElementById(id); const $$=(s)=>[...document.querySelectorAll(s)];
const CATS=[
{id:"cat_food",name:"Alimentação",color:"#10b981",icon:"utensils"},
{id:"cat_home",name:"Moradia",color:"#3b82f6",icon:"home"},
{id:"cat_trans",name:"Transporte",color:"#f59e0b",icon:"car"},
{id:"cat_salary",name:"Salário",color:"#6366f1",icon:"banknote"},
{id:"cat_fun",name:"Lazer",color:"#fb7185",icon:"sparkles"},
{id:"cat_health",name:"Saúde",color:"#ef4444",icon:"pill"},
{id:"cat_invest",name:"Investimentos",color:"#8b5cf6",icon:"trending-up"},
{id:"cat_work",name:"Trabalho",color:"#0ea5e9",icon:"briefcase"},
{id:"cat_edu",name:"Educação",color:"#f97316",icon:"graduation-cap"},
{id:"cat_tip",name:"Gorjetas/Extras",color:"#facc15",icon:"coins"},
{id:"cat_others",name:"Outros/Geral",color:"#94a3b8",icon:"layers"}
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
const VALID_VIEWS=["dashboard","transactions","statement","categories","cards","recurring","goals","reports","insights","settings"];
const num=(v)=>{const n=Number(v); return Number.isFinite(n)?n:0};
const money=(v)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(num(v));
function toast(msg,err=false){const t=$("toast"); if(!t)return; t.classList.remove("hidden");t.textContent=msg;t.style.background=err?"#b91c1c":"#0f172a";setTimeout(()=>t.classList.add("hidden"),2500)}
function on(id, event, handler) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.addEventListener(event, handler);
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
const emptyData=()=>({categories:[...CATS],accounts:[],transactions:[],transfers:[],cards:[],installments:[],recurring:[],goals:[],budgets:[],settings:{onboardingDone:false,salary:{enabled:false,amount:0,day:5,accountId:"",recurringId:""}}});
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
  if(!state.data.budgets) state.data.budgets=[];
  if(typeof state.data.settings.onboardingDone!=="boolean") state.data.settings.onboardingDone=false;
  if(!state.data.settings.salary) state.data.settings.salary={enabled:false,amount:0,day:5,accountId:"",recurringId:""};
  if(!state.data.settings.aiLearning) state.data.settings.aiLearning={};
  state.aiLearning = state.data.settings.aiLearning;

  // Garantir que as categorias padrão existam nos dados do usuário
  if (state.data.categories) {
    CATS.forEach(defaultCat => {
      if (!state.data.categories.find(c => c.id === defaultCat.id)) {
        state.data.categories.push({...defaultCat});
      }
    });
  }
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
function setAuthTab(tab){
  $$(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));
  const l=$("loginForm"), r=$("registerForm"), v=$("recoverForm"), s=$("resetForm");
  if(l) l.classList.toggle("hidden",tab!=="login");
  if(r) r.classList.toggle("hidden",tab!=="register");
  if(v) v.classList.toggle("hidden",tab!=="recover");
  if(s) s.classList.add("hidden");
  if($("authMessage")) $("authMessage").textContent="";
}
window.setAuthTab = setAuthTab;
function renderAuth(){
  const on=!!state.user;
  const a=$("authScreen"), p=$("appScreen");
  if(a) a.classList.toggle("hidden",on);
  if(p) p.classList.toggle("hidden",!on);
  if(on && $("userLabel")) $("userLabel").textContent=state.user.name;
}
function mapAuthUser(user){return {id:user.id,email:user.email,name:user.user_metadata?.name||user.email?.split("@")[0]||"Usuário"}}
async function fetchCloudData(userId){
  console.log("Supabase: Tentando buscar dados para", userId);
  try {
    // Busca simplificada apenas da coluna data
    const {data, error, status, statusText} = await sb
      .from("user_finance_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if(error) {
      console.error("Supabase Error (Fetch):", error.code, error.message);
      toast(`Erro no Banco (${error.code}): ${error.message}`, true);
      return null;
    }
    
    console.log(`Supabase: Status ${status} (${statusText}). Dados encontrados:`, !!data);
    return data?.data || null;
  } catch (e) {
    console.error("Supabase: Erro inesperado", e);
    return null;
  }
}

async function pushCloudData(){
  if(!state.user || !state.data) return;
  
  const payload = {
    user_id: state.user.id,
    data: state.data,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await sb.from("user_finance_data").upsert(payload, { onConflict: "user_id" });
    if(error) {
      console.error("Supabase Error (Push):", error.message);
      toast("Erro ao sincronizar com a nuvem", true);
    }
  } catch (e) {
    console.error("Supabase: Erro ao enviar", e);
  }
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
async function login(user) {
  console.log("Login: Iniciando para", user.email);
  state.user = user;
  
  // 1. Carregar local
  state.data = loadData(user.id);
  console.log("Login: Local carregado (Score:", dataScore(state.data), ")");

  renderAuth();
  setLoadingUI(true);

  try {
    // 2. Tentar Nuvem
    const cloud = await fetchCloudData(user.id);
    
    if (cloud) {
      const cloudScore = dataScore(cloud);
      console.log("Login: Dados da nuvem recebidos (Score:", cloudScore, ")");
      
      // Se a nuvem tem QUALQUER dado, ela manda (para recuperar o que sumiu)
      if (cloudScore > 0) {
        console.log("Login: Restaurando dados da nuvem.");
        state.data = { ...emptyData(), ...cloud };
        localStorage.setItem(dataKey(user.id), JSON.stringify(state.data));
      }
    } else {
      console.log("Login: Nuvem retornou vazio.");
    }
  } catch (err) {
    console.error("Login: Erro sincronia", err);
  }

  await boot();
  setLoadingUI(false);
}
async function logout() {
  console.log("Forçando logout...");
  try {
    await sb.auth.signOut().catch(e => console.warn("Erro signOut:", e));
  } catch (err) {}
  state.user = null;
  state.data = null;
  renderAuth();
}
window.logout = logout;

function bindAuth() {
  console.log("Vinculando formulários de Auth...");
  
  window.handleLogin = async (e) => {
    e.preventDefault();
    console.log("Tentando login...");
    const f = Object.fromEntries(new FormData(e.target));
    const email = String(f.email || "").trim().toLowerCase();
    const password = String(f.password || "");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return $("authMessage").textContent = error.message;
    await login(mapAuthUser(data.user));
  };

  window.handleRegister = async (e) => {
    e.preventDefault();
    console.log("Tentando cadastro...");
    const f = Object.fromEntries(new FormData(e.target));
    const name = String(f.name || "").trim(),
      email = String(f.email || "").trim().toLowerCase(),
      password = String(f.password || "");
    if (!name || !email || password.length < 6) return $("authMessage").textContent = "Nome, email e senha (mín. 6).";
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return $("authMessage").textContent = error.message;
    if (data.user && data.session) {
      await login(mapAuthUser(data.user));
    } else {
      $("authMessage").textContent = "Conta criada. Verifique seu email para confirmar.";
      setAuthTab("login");
    }
  };

  window.handleRecover = async (e) => {
    e.preventDefault();
    const email = String(new FormData(e.target).get("email") || "").trim().toLowerCase();
    const { error } = await sb.auth.resetPasswordForEmail(email);
    $("authMessage").textContent = error ? error.message : "Enviamos um link de recuperação para seu email.";
  };
}

function subtitle(view){return({dashboard:"Visão geral",transactions:"Nova transação",statement:"Extrato de movimentações",categories:"Categorias",cards:"Cartões",recurring:"Recorrentes",goals:"Metas",reports:"Relatórios",insights:"Insights",settings:"Preferências e dados"})[view]||""}
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

function toggleTheme(){
  document.body.classList.toggle("dark");
  localStorage.setItem(KEYS.theme,document.body.classList.contains("dark")?"dark":"light");
  renderDashboard();
  renderSettings();
}
window.toggleTheme = toggleTheme;

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
  if(window.lucide) lucide.createIcons();
}

async function syncNow(){
  if(!state.user) return toast("Faça login para sincronizar", true);
  setLoadingUI(true);
  try{
    console.log("Sincronização manual iniciada...");
    const cloud = await fetchCloudData(state.user.id);
    if(cloud) {
      state.data = { ...emptyData(), ...cloud };
      localStorage.setItem(dataKey(state.user.id), JSON.stringify(state.data));
      refreshMainViews();
      toast("Dados restaurados da nuvem.");
    } else {
      await pushCloudData();
      toast("Dados locais enviados para a nuvem.");
    }
  }catch(err){
    console.error("Erro na sincronização manual:", err);
    toast("Falha na sincronização: " + err.message, true);
  }
  setLoadingUI(false);
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

async function clearAllData(){
  if(!confirm("⚠️ ATENÇÃO CRÍTICA: Isso apagará TODOS os seus dados financeiros de forma PERMANENTE em todos os seus dispositivos e na nuvem. Esta ação não pode ser desfeita.\n\nDeseja realmente apagar tudo?")) return;
  
  setLoadingUI(true);
  try {
    const empty = emptyData();
    
    // 1. Limpar na Nuvem (Supabase) - Forçando sobrescrita com dados vazios
    if (state.user) {
      console.log("Limpando dados na nuvem...");
      const { error } = await sb.from("user_finance_data").upsert({
        user_id: state.user.id,
        data: empty,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      
      if (error) {
        console.error("Erro Supabase:", error);
        throw new Error("Não foi possível limpar os dados na nuvem. Verifique sua conexão.");
      }
    }

    // 2. Limpeza "Nuclear" do LocalStorage
    console.log("Limpando todo o armazenamento local...");
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith("granaflow_") || 
        key.startsWith("finanzen_") || 
        key === KEYS.lastGoodData ||
        key === KEYS.lastView
      )) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));

    // 3. Resetar estado em memória
    state.data = empty;
    
    // 4. Feedback e Recarregamento Forçado
    // O recarregamento é a única forma de garantir que nenhum resíduo de memória restaure os dados
    alert("✅ Sucesso! Todos os dados foram apagados permanentemente.\nO aplicativo será reiniciado agora.");
    window.location.reload();

  } catch (e) {
    console.error("Erro na exclusão:", e);
    alert("❌ Erro ao excluir dados: " + e.message);
  } finally {
    setLoadingUI(false);
  }
}
window.clearAllData = clearAllData;

function openView(view){
  console.log("Abrindo view:", view);
  const navBtn = document.querySelector(`.nav-link[data-view="${view}"], .mobile-tab[data-view="${view}"]`);
  const targetView = $(`${view}View`);
  if (!targetView) return;

  $$(".nav-link").forEach(n=>n.classList.remove("active"));
  $$(".mobile-tab").forEach(n=>n.classList.remove("active"));
  
  if (navBtn) {
    navBtn.classList.add("active");
    const desktopBtn=document.querySelector(`.nav-link[data-view="${view}"]`); if(desktopBtn) desktopBtn.classList.add("active");
    const mobileBtn=document.querySelector(`.mobile-tab[data-view="${view}"]`); if(mobileBtn) mobileBtn.classList.add("active");
    $("viewTitle").textContent = navBtn.textContent.trim();
  } else {
    $("viewTitle").textContent = subtitle(view);
  }

  $$(".view").forEach(x=>x.classList.add("hidden"));
  targetView.classList.remove("hidden");
  animateView(targetView);
  
  $("viewSubtitle").textContent = subtitle(view);
  const s=$("sidebar"); if(s) s.classList.remove("open");
  saveLastView(view);
  if(view==="insights") renderInsights();
  if(view==="settings") renderSettings();
}
window.openView = openView;

function renderOnboarding(){
  const step=ONBOARDING_STEPS[state.onboardingIndex];
  if(!step) return;
  const s=$("onboardingStep"), t=$("onboardingTitle"), tx=$("onboardingText"), n=$("onboardingNext");
  if(s) s.textContent=`Passo ${state.onboardingIndex+1} de ${ONBOARDING_STEPS.length}`;
  if(t) t.textContent=step.title;
  if(tx) tx.textContent=step.text;
  if(n) n.textContent=state.onboardingIndex===ONBOARDING_STEPS.length-1?"Concluir":"Próximo";
  openView(step.view);
  setTimeout(()=>step.focus?.(),80);
}

function startOnboarding(force=false){
  ensureSettings();
  if(!force && state.data.settings.onboardingDone) return;
  state.onboardingIndex=0;
  const modal = $("onboardingModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.pointerEvents = "auto";
  }
  renderOnboarding();
}
window.startOnboarding = startOnboarding;

function finishOnboarding(showToast=true){
  ensureSettings();
  state.data.settings.onboardingDone=true;
  const m=$("onboardingModal"); if(m) m.classList.add("hidden");
  saveData();
  if(showToast) toast("Onboarding concluído.");
}

function nextOnboardingStep(){
  if(state.onboardingIndex>=ONBOARDING_STEPS.length-1){
    finishOnboarding(true);
    return;
  }
  state.onboardingIndex+=1;
  renderOnboarding();
}

function quickAddExpense(){
  openView("transactions");
  const form = $("transactionForm");
  if(!form) return;
  setTransactionType("expense");
  setTransactionPaymentMethod("cash");
  if(form.date) form.date.value = today();
  toggleTransactionPaymentFields();
  if(form.amount) form.amount.focus();
}
window.quickAddExpense = quickAddExpense;

function setTransactionType(type){
  const form=$("transactionForm");
  if(!form || !form.type) return;
  const value=type==="expense"?"expense":"income";
  form.type.value=value;
  $$(".type-toggle-btn").forEach(btn=>{
    const active=btn.dataset.txType===value;
    btn.classList.toggle("active",active);
  });
  const categoryField=$("transactionCategoryField");
  if(categoryField) categoryField.classList.toggle("hidden",value==="income");
  renderPaymentOptionsByType(value,{preferredMethod:form.paymentMethod?.value});
  if(value==="income") applyIncomeCategoryByMethod();
}

function setTransactionPaymentMethod(method){
  const form=$("transactionForm");
  if(!form || !form.paymentMethod) return;
  const buttons=$$(".payment-toggle-btn:not(.is-hidden-option)");
  const allowed=buttons.map(btn=>btn.dataset.paymentMethod).filter(Boolean);
  let value=allowed.includes(method)?method:"";
  if(!value&&allowed.includes("cashpix")&&(method==="cash"||method==="pix")) value="cashpix";
  if(!value&&allowed.includes("cash")) value="cash";
  if(!value&&allowed.length) value=allowed[0];
  if(!value) return;
  form.paymentMethod.value=value;
  buttons.forEach(btn=>btn.classList.toggle("active",btn.dataset.paymentMethod===value));
  if(form.type && form.type.value==="income") applyIncomeCategoryByMethod();
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
  if(!form||!state.data||form.type?.value!=="income") return;
  const method=form.paymentMethod?.value;
  if(method==="freelance"){
    form.categoryId.value=getOrCreateCategoryByName("Freela",{color:"#f97316",icon:"briefcase-business"});
  }else{
    form.categoryId.value=getOrCreateCategoryByName("Outras entradas",{color:"#0ea5e9",icon:"banknote"});
  }
}

function renderPaymentOptionsByType(type,{preferredMethod}={}){
  const form=$("transactionForm");
  const wrap=document.querySelector(".payment-toggle");
  if(!form||!wrap) return;
  const options=PAYMENT_OPTIONS[type==="expense"?"expense":"income"];
  const buttons=$$(".payment-toggle-btn");
  buttons.forEach((btn,index)=>{
    const option=options[index];
    if(!option){
      btn.classList.add("is-hidden-option");
      return;
    }
    btn.classList.remove("is-hidden-option");
    btn.dataset.paymentMethod=option.value;
    btn.innerHTML=`<i data-lucide="${option.icon}"></i><span>${option.label}</span>`;
    btn.setAttribute("onclick", `setTransactionPaymentMethod('${option.value}')`);
  });
  const normalized=type==="income" && (preferredMethod==="cash"||preferredMethod==="pix") ? "cashpix" : preferredMethod;
  const nextMethod=options.some(o=>o.value===normalized)?normalized:options[0].value;
  setTransactionPaymentMethod(nextMethod);
  if(window.lucide) lucide.createIcons();
}

function toggleTransactionPaymentFields(){
  const form = $("transactionForm");
  if(!form) return;
  const showCredit = form.type?.value==="expense" && form.paymentMethod?.value==="credit";
  const fields=$("transactionCreditFields");
  if(fields) fields.classList.toggle("hidden", !showCredit);
  if(showCredit && form.installmentCount && !form.installmentCount.value) form.installmentCount.value = "1";
}

function clearTransactionFilters() {
  const form = $("transactionFilter");
  if (form) {
    form.reset();
    if (state.data) renderTransactions(state.data.transactions);
  }
}
window.clearTransactionFilters = clearTransactionFilters;

function bindUi() {
  console.log("Vinculando UI (Formulários)...");
  // O sistema de cliques agora é 100% via onclick no HTML para máxima confiabilidade
  
  const imp=$("importBackupFile"); if(imp) imp.addEventListener("change", e => {
    const f = e.target.files?.[0]; if (f) importBackupFromFile(f); e.target.value = "";
  });

  bindForms();
}

function bindForms(){
  on("transactionForm","submit",saveTransaction);
  const tType=$("transactionForm")?.type; if(tType) tType.addEventListener("change",toggleTransactionPaymentFields);
  on("transactionFilter","submit",filterTransactions);
  on("categoryForm","submit",saveCategory);
  on("invoiceFilter","submit",renderInvoices);
  on("recurringForm","submit",saveRecurring);
  on("salaryForm","submit",saveSalaryAuto);
  on("goalForm","submit",saveGoal);
  on("reportForm","submit",generateMonthlyReport);
  on("compareForm","submit",compareMonths);
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
      id:uid("inst"), cardId:tx.creditCardId||"", installmentNumber:i+1, amount:parts[i],
      invoiceMonth:addMonths(tx.date||today(),i).slice(0,7), paid:false,
      description:tx.description||"Compra na transação", sourceTransactionId:tx.id
    });
  }
}

function formatDateBR(iso){ if(!iso) return "-"; const d=new Date(`${iso}T00:00:00`); return d.toLocaleDateString("pt-BR"); }

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
  $("debtSummaryList").innerHTML=(nextInst.concat(nextRec)).join("")||"<small>Sem pendências.</small>";
}

function renderCategories(){ $("categoryList").innerHTML=state.data.categories.map(c=>`<div class="list-item"><div><strong>${c.name}</strong><br><small><span style="display:inline-block;width:12px;height:12px;border-radius:999px;background:${c.color}"></span> ${c.icon||"icone"}${c.budget ? ` • Teto: ${money(c.budget)}` : ""}</small></div><div class="actions"><button class="btn btn-ghost" onclick="editCategory('${c.id}')">Editar</button><button class="btn btn-danger" onclick="removeCategory('${c.id}')">Excluir</button></div></div>`).join("") }
window.editCategory=(id)=>{const c=cat(id);if(!c)return;const f=$("categoryForm");f.id.value=c.id;f.name.value=c.name;f.color.value=c.color;f.icon.value=c.icon||"";if(f.budget)f.budget.value=c.budget||""}
window.removeCategory=(id)=>{if(!confirm("Excluir categoria?"))return;state.data.categories=state.data.categories.filter(c=>c.id!==id);state.data.transactions.forEach(t=>{if(t.categoryId===id)t.categoryId=""});saveData();refreshSelects();renderCategories();renderTransactions(state.data.transactions);renderDashboard();toast("Categoria removida")}
function saveCategory(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));if(!f.name)return toast("Nome obrigatório",true);const budget=num(f.budget);if(f.id){const c=cat(f.id);if(c){c.name=f.name;c.color=f.color||"#3b82f6";c.icon=f.icon||"circle";c.budget=budget>0?budget:0}}else state.data.categories.push({id:uid("cat"),name:f.name,color:f.color||"#3b82f6",icon:f.icon||"circle",budget:budget>0?budget:0});e.target.reset();saveData();refreshSelects();renderCategories();renderDashboard();toast("Categoria salva")}

function renderTransactions(items){
  const list=items.slice().sort((a,b)=>a.date<b.date?1:-1).map(txVM);
  const l=$("transactionList"); 
  if(l) {
    l.innerHTML=list.map(t=>{
      const c = cat(t.categoryId);
      return `<div class="list-item">
        <div class="list-item-icon" style="background: ${c?.color || '#94a3b8'}20; color: ${c?.color || '#94a3b8'}">
          <i data-lucide="${c?.icon || 'circle'}"></i>
        </div>
        <div style="flex: 1">
          <strong>${t.description || (t.type === 'income' ? 'Entrada' : 'Saída')}</strong><br>
          <small>${t.date} • ${t.categoryName}</small><br>
          <small>${paymentLabel(t)}</small>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
          <strong style="color: ${t.type === 'income' ? 'var(--primary)' : 'var(--danger)'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</strong>
          <div class="actions">
            <button class="btn btn-ghost" style="padding: 4px 8px; font-size: 0.7rem;" onclick="editTransaction('${t.id}')"><i data-lucide="edit-2" style="width: 12px;"></i></button>
            <button class="btn btn-ghost" style="padding: 4px 8px; font-size: 0.7rem; color: var(--danger);" onclick="removeTransaction('${t.id}')"><i data-lucide="trash-2" style="width: 12px;"></i></button>
          </div>
        </div>
      </div>`;
    }).join("")||"<small>Nenhuma transação.</small>";
    if(window.lucide) lucide.createIcons();
  }
}
function paymentLabel(t){
  if(t.type==="income") return t.paymentMethod==="freelance" ? "Freela" : "Entrada";
  if(t.paymentMethod==="credit") return `Crédito${num(t.installmentCount)>1?` ${t.installmentCount}x`:""}`;
  return t.paymentMethod==="pix" ? "PIX" : (t.paymentMethod==="debit" ? "Débito" : "Dinheiro");
}
window.editTransaction=(id)=>{
  const t=state.data.transactions.find(x=>x.id===id);
  if(!t)return;
  openView("transactions");
  const f=$("transactionForm");
  f.id.value=t.id;
  setTransactionType(t.type);
  f.amount.value=t.amount;
  setTransactionPaymentMethod(t.paymentMethod||"cash");
  f.categoryId.value=t.categoryId||"";
  f.installmentCount.value=t.installmentCount||1;
  f.date.value=t.date;
  f.description.value=t.description||"";
  toggleTransactionPaymentFields();
}
window.removeTransaction=(id)=>{if(!confirm("Excluir transação?"))return;const t=state.data.transactions.find(x=>x.id===id);if(t){txEffect(t,true);state.data.installments=state.data.installments.filter(i=>i.sourceTransactionId!==t.id)}state.data.transactions=state.data.transactions.filter(x=>x.id!==id);saveData();renderTransactions(state.data.transactions);renderDashboard();toast("Transação removida")}
function saveTransaction(e){
  e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); const amount=num(f.amount);
  if(!["income","expense"].includes(f.type)||amount<=0)return toast("Dados inválidos",true);
  const pm=f.paymentMethod||"cash"; const ic=pm==="credit"?Math.max(1,parseInt(f.installmentCount||"1",10)):1;
  let catId=f.categoryId||"";
  if(f.type==="income") catId=getOrCreateCategoryByName(pm==="freelance"?"Freela":"Outras entradas");
  if(f.id){
    const t=state.data.transactions.find(x=>x.id===f.id); if(!t)return;
    txEffect(t,true); Object.assign(t,{type:f.type,amount,paymentMethod:pm,installmentCount:ic,categoryId:catId,description:f.description||"",date:f.date||today()});
    txEffect(t,false); rebuildInstallmentsForTransaction(t);
  }else{
    const t={id:uid("tx"),type:f.type,amount,paymentMethod:pm,installmentCount:ic,categoryId:catId,description:f.description||"",date:f.date||today()};
    txEffect(t,false); rebuildInstallmentsForTransaction(t); state.data.transactions.push(t);
  }
  saveData(); e.target.reset(); if($("transactionForm")?.date) $("transactionForm").date.value=today();
  setTransactionType("income"); setTransactionPaymentMethod("cash"); toggleTransactionPaymentFields();
  renderTransactions(state.data.transactions); renderDashboard(); toast("Transação salva");
}
function filterTransactions(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));let items=[...state.data.transactions];if(f.type)items=items.filter(t=>t.type===f.type);if(f.categoryId)items=items.filter(t=>t.categoryId===f.categoryId);if(f.startDate)items=items.filter(t=>t.date>=f.startDate);if(f.endDate)items=items.filter(t=>t.date<=f.endDate);renderTransactions(items)}

function renderCards(){renderDebtPanel()}
function addMonths(dateStr,n){const d=new Date(`${dateStr}T00:00:00`);const f=new Date(d.getFullYear(),d.getMonth()+n,Math.min(d.getDate(),28));return f.toISOString().slice(0,10)}
function nextSalaryDate(day){const now=new Date(`${today()}T00:00:00`);let y=now.getFullYear(), m=now.getMonth(), d=Math.min(28,Math.max(1,parseInt(day||"5",10)));const c=new Date(y,m,d);return (now>c?new Date(y,m+1,d):c).toISOString().slice(0,10)}
function renderSalaryForm(){
  ensureSettings(); const s=state.data.settings.salary;
  if($("salaryAmount")) $("salaryAmount").value = s.amount>0 ? s.amount : "";
  if($("salaryDay")) $("salaryDay").value = s.day||5;
  if($("salaryInfo")) $("salaryInfo").textContent = s.enabled ? `Ativo: ${money(s.amount)} todo dia ${s.day}.` : "Configure salário automático.";
}
function saveSalaryAuto(e){
  e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); const amount=num(f.amount), day=Math.min(28,Math.max(1,parseInt(f.day||"5",10)));
  if(amount<=0) return toast("Informe um salário válido.",true);
  ensureSettings(); const salaryCategory=state.data.categories.find(c=>c.id==="cat_salary"||String(c.name).toLowerCase().includes("sal"));
  let rec=state.data.recurring.find(r=>r.id===state.data.settings.salary?.recurringId);
  if(!rec){
    rec={id:uid("rec"),type:"income",amount,frequency:"monthly",nextRunDate:nextSalaryDate(day),categoryId:salaryCategory?.id||"",description:"Salário mensal",isActive:true,systemTag:"salary_auto"};
    state.data.recurring.push(rec);
  }else{
    Object.assign(rec,{amount,nextRunDate:nextSalaryDate(day),categoryId:salaryCategory?.id||rec.categoryId||""});
  }
  state.data.settings.salary={enabled:true,amount,day,recurringId:rec.id};
  saveData(); renderSalaryForm(); renderRecurring(); toast("Salário automático salvo.");
}
window.markInstallmentPaid=(id)=>{const i=state.data.installments.find(x=>x.id===id);if(!i)return;i.paid=true;saveData();renderCards();renderInvoices();renderDashboard();toast("Parcela paga")}
function renderInvoices(e){if(e)e.preventDefault();const f=new FormData($("invoiceFilter"));const m=f.get("month");const list=state.data.installments.filter(i=>(!m||i.invoiceMonth===m));const g={};list.forEach(i=>{g[i.invoiceMonth]??={month:i.invoiceMonth,total:0,items:[]};g[i.invoiceMonth].total+=num(i.amount);g[i.invoiceMonth].items.push(i)});const rows=Object.values(g).sort((a,b)=>a.month<b.month?1:-1);$("invoiceList").innerHTML=rows.map(r=>`<div class="list-item"><div><strong>${r.month}</strong><br><small>Total: ${money(r.total)}</small>${r.items.map(i=>`<div><small>${i.installmentNumber}a parcela - ${money(i.amount)} ${i.paid?"(paga)":`<button class='btn btn-ghost' onclick="markInstallmentPaid('${i.id}')">Pagar</button>`}</small></div>`).join("")}</div></div>`).join("")||"<small>Sem parcelas.</small>"}
function nextDate(dateStr,f){const d=new Date(`${dateStr}T00:00:00`);if(f==="daily")d.setDate(d.getDate()+1);if(f==="weekly")d.setDate(d.getDate()+7);if(f==="monthly")d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)}
function saveRecurring(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const amount=num(f.amount);if(!["income","expense"].includes(f.type)||amount<=0)return toast("Recorrência inválida",true);if(f.id){const r=state.data.recurring.find(x=>x.id===f.id);if(r)Object.assign(r,{...f,amount})}else state.data.recurring.push({id:uid("rec"),type:f.type,amount,frequency:f.frequency||"monthly",nextRunDate:f.nextRunDate||today(),categoryId:f.categoryId||"",description:f.description||"",isActive:true});saveData();e.target.reset();renderRecurring();toast("Recorrência salva")}
window.removeRecurring=(id)=>{if(!confirm("Excluir recorrente?"))return;state.data.recurring=state.data.recurring.filter(r=>r.id!==id);saveData();renderRecurring();renderDashboard();toast("Recorrente removido")}
function runRecurringDue(silent=false){const t=today();let p=0;state.data.recurring.forEach(r=>{if(!r.isActive)return;while(r.nextRunDate<=t){const tx={id:uid("tx"),type:r.type,amount:num(r.amount),categoryId:r.categoryId||"",description:`[Recorrente] ${r.description||""}`.trim(),date:r.nextRunDate};txEffect(tx,false);state.data.transactions.push(tx);r.nextRunDate=nextDate(r.nextRunDate,r.frequency);p++}});if(p){saveData();renderRecurring();renderTransactions(state.data.transactions);renderDashboard();if(!silent)toast(`Processados ${p} lançamentos`)}}
function renderRecurring(){ $("recurringList").innerHTML=state.data.recurring.map(r=>`<div class="list-item"><div><strong>${r.type==="income"?"Entrada":"Saída"} ${money(r.amount)}</strong><br><small>${r.frequency} • próxima: ${r.nextRunDate}</small><br><small>${r.description||"-"}</small></div><div class="actions"><button class="btn btn-danger" onclick="removeRecurring('${r.id}')">Excluir</button></div></div>`).join("");renderDebtPanel() }

function saveGoal(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const target=num(f.targetAmount),current=num(f.currentAmount),dv=Math.max(1,parseInt(f.durationValue||"1",10)),du=f.durationUnit||"months";if(target<=0||current<0)return toast("Meta inválida",true);if(f.id){const g=state.data.goals.find(x=>x.id===f.id);if(g)Object.assign(g,{targetAmount:target,currentAmount:current,durationValue:dv,durationUnit:du})}else state.data.goals.push({id:uid("goal"),name:"Meta financeira",targetAmount:target,currentAmount:current,durationValue:dv,durationUnit:du});saveData();e.target.reset();renderGoals();renderDashboard();toast("Meta salva")}
window.contributeGoal=(id)=>{const g=state.data.goals.find(x=>x.id===id);if(!g)return;const v=num(prompt("Valor do aporte:"));if(v<=0)return;g.currentAmount=num(g.currentAmount)+v;saveData();renderGoals();renderDashboard();toast("Aporte registrado")}
window.removeGoal=(id)=>{if(!confirm("Excluir meta?"))return;state.data.goals=state.data.goals.filter(g=>g.id!==id);saveData();renderGoals();renderDashboard();toast("Meta removida")}
function renderGoals(){
  if(!state.data.goals.length){ $("goalList").innerHTML="<small>Nenhuma meta.</small>"; return; }
  $("goalList").innerHTML=state.data.goals.map(g=>{
    const p=g.targetAmount>0?Math.min(100,(num(g.currentAmount)/num(g.targetAmount))*100):0;
    const rem=Math.max(0,num(g.targetAmount)-num(g.currentAmount));
    const months=(g.durationUnit==="years"?num(g.durationValue)*12:num(g.durationValue))||1;
    return `<div class="goal-item">
      <strong>${g.name||"Meta"}</strong><br><small>Alvo: ${money(g.targetAmount)} • Atual: ${money(g.currentAmount)}</small>
      <div class="progress goal-progress"><div style="width:${p}%"></div></div>
      <div class="actions"><button class="btn btn-secondary" onclick="contributeGoal('${g.id}')">Aportar</button><button class="btn btn-danger" onclick="removeGoal('${g.id}')">Excluir</button></div>
    </div>`;
  }).join("");
}

function draw(k,id,type,data){
  if(state.charts[k]) state.charts[k].destroy();
  const text=getComputedStyle(document.body).getPropertyValue("--text").trim();
  const border=getComputedStyle(document.body).getPropertyValue("--border").trim();
  state.charts[k]=new Chart($(id),{
    type, data, options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:text}}},
      scales:type==="line"?{x:{ticks:{color:text},grid:{color:border}},y:{ticks:{color:text},grid:{color:border}}}:undefined
    }
  });
}

async function handleAiInput(text) {
  if (!text || !text.trim()) return;
  const input = text.trim().toLowerCase();
  
  const amountMatch = input.match(/(\d+[.,]\d+|\d+)/);
  if (!amountMatch) {
    toast("Não encontrei um valor. Ex: '20 gasolina'", true);
    return;
  }

  const amount = parseFloat(amountMatch[0].replace(",", "."));
  let description = input.replace(amountMatch[0], "").replace("r$", "").trim();
  
  if (amount > 0) {
    const keywords = {
      cat_food: ["comida", "almoço", "janta", "ifood", "mercado", "lanche", "restaurante", "pizza", "burger", "café", "padaria", "supermercado", "açougue", "feira"],
      cat_trans: ["gasolina", "uber", "onibus", "combustivel", "gasosa", "estacionamento", "pedagio", "99pop", "metro", "trem", "passagem", "oficina", "pneu", "mecanico"],
      cat_home: ["aluguel", "luz", "agua", "internet", "condominio", "reforma", "moveis", "limpeza", "iptu", "energia", "telefone", "gas"],
      cat_fun: ["cinema", "show", "bar", "cerveja", "festa", "viagem", "streaming", "netflix", "spotify", "jogos", "ps5", "xbox", "balada", "teatro", "clube"],
      cat_salary: ["salario", "recebi", "pagamento", "bonus", "pix recebido", "pro labore", "renda", "freela", "freelance", "venda"],
      cat_health: ["farmacia", "drogaria", "remedio", "hospital", "medico", "consulta", "exame", "dentista", "saude", "convenio", "plano de saude", "psicologo"],
      cat_invest: ["investimento", "bolsa", "acoes", "tesouro", "cripto", "bitcoin", "poupanca", "fii", "cdb", "aplicacao"],
      cat_work: ["trabalho", "ferramenta", "software", "assinatura", "mei", "imposto", "escritorio", "papelaria"],
      cat_edu: ["escola", "faculdade", "curso", "livro", "mensalidade", "estudo", "pos", "treinamento", "udemy", "alura"],
      cat_tip: ["gorjeta", "caixinha", "extra", "doacao", "presente", "mimo"]
    };

    let categoryId = "";
    let type = "expense";

    // 1. Verificar aprendizado dinâmico (prioridade)
     if (state.aiLearning && state.aiLearning[description]) {
       categoryId = state.aiLearning[description];
       const c = cat(categoryId);
       if (categoryId === "cat_salary" || (c && c.name.toLowerCase().includes("freela"))) type = "income";
     }
 
     // 2. Verificar palavras-chave no dicionário
     if (!categoryId) {
       for (const [catId, words] of Object.entries(keywords)) {
         if (words.some(word => description.includes(word))) {
           categoryId = state.data.categories.find(c => c.id === catId)?.id || "";
           if (catId === "cat_salary" || description.includes("freela") || description.includes("freelance")) type = "income";
           break;
         }
       }
     }

    // 3. Verificar metas (Ex: "100 meta")
    if (!categoryId && (description.includes("meta") || description.includes("objetivo"))) {
      if (state.data.goals.length > 0) {
        const goal = state.data.goals[0];
        goal.currentAmount = num(goal.currentAmount) + amount;
        saveData();
        renderGoals();
        renderDashboard();
        toast(`IA: Aporte de ${money(amount)} na meta "${goal.name}"`);
        if ($("aiQuickInput")) $("aiQuickInput").value = "";
        return;
      }
    }

    // 4. Se não reconheceu nada, tentar buscar por nome de categoria customizada
    if (!categoryId && description) {
      const customCat = state.data.categories.find(c => 
        description.includes(c.name.toLowerCase()) || 
        c.name.toLowerCase().includes(description)
      );
      if (customCat) categoryId = customCat.id;
    }

    // 5. Se ainda não reconheceu nada, perguntar ao usuário ou usar fallback
    if (!categoryId) {
      // Se não houver descrição útil (apenas caracteres aleatórios ou vazio), perguntar
      if (!description || description.length < 2) {
        const descInput = prompt("IA: Detectei o valor, mas o que você comprou?");
        if (!descInput) {
          toast("Operação cancelada.", true);
          return; 
        }
        description = descInput.toLowerCase().trim();
      }

      // Tentar re-mapear com a descrição (seja a original ou a nova do prompt)
      for (const [catId, words] of Object.entries(keywords)) {
        if (words.some(word => description.includes(word))) {
          categoryId = state.data.categories.find(c => c.id === catId)?.id || "";
          if (catId === "cat_salary") type = "income";
          break;
        }
      }

      // Se após tudo isso ainda não tem categoria, perguntar explicitamente
      if (!categoryId) {
        const categories = state.data.categories;
        const optionsText = categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
        const userChoice = prompt(`IA: Não reconheci "${description}".\nEm qual categoria isso se encaixa?\nDigite o número:\n\n${optionsText}`);
        
        const idx = parseInt(userChoice) - 1;
        if (categories[idx]) {
          categoryId = categories[idx].id;
          if (description && description.length >= 2) {
            state.aiLearning[description] = categoryId;
            saveData();
          }
        } else {
          const useOthers = confirm(`IA: Categoria não selecionada. Deseja salvar em "Outros/Geral"?`);
          if (useOthers) {
            categoryId = state.data.categories.find(c => c.id === "cat_others")?.id || state.data.categories[0].id;
          } else {
            toast("Operação cancelada.", true);
            return;
          }
        }
      }
    }

    const tx = {
      id: uid("tx"),
      type: type,
      amount: amount,
      paymentMethod: "cash",
      installmentCount: 1,
      categoryId: categoryId,
      description: description || (type === "income" ? "Entrada rápida" : "Gasto rápido"),
      date: today()
    };

    state.data.transactions.push(tx);
    saveData();
    renderTransactions(state.data.transactions);
    renderDashboard();
    
    const catName = cat(categoryId)?.name || "Sem categoria";
    toast(`IA: Registrado ${money(amount)} em ${catName}`);
    
    const aiInput = $("aiQuickInput");
    if (aiInput) aiInput.value = "";
  }
}
window.handleAiInput = handleAiInput;

function renderDashboard(){
  const tx=state.data.transactions;
  const inc=tx.filter(t=>t.type==="income").reduce((s,t)=>s+num(t.amount),0);
  const exp=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+num(t.amount),0);
  const balance=inc-exp;
  
  // Métricas principais
  animateValue($("metricBalance"),balance,{currency:true});
  animateValue($("metricIncome"),inc,{currency:true});
  animateValue($("metricExpense"),exp,{currency:true});

  // Métricas do Hero (Tela Inicial)
  animateValue($("heroBalance"),balance,{currency:true});
  animateValue($("heroIncome"),inc,{currency:true});
  animateValue($("heroExpense"),exp,{currency:true});

  const healthEl = $("heroHealth");
  if (healthEl) {
    if (balance > 0) {
      healthEl.textContent = "Saudável";
      healthEl.style.color = "#10b981";
    } else if (balance < 0) {
      healthEl.textContent = "Crítico";
      healthEl.style.color = "#fb7185";
    } else {
      healthEl.textContent = "Neutro";
      healthEl.style.color = "inherit";
    }
  }

  // Alertas
  const alertsCount = state.data.recurring.filter(r => r.isActive && r.nextRunDate <= today()).length;
  if ($("metricAlerts")) $("metricAlerts").textContent = String(alertsCount);

  // Metas count
  if ($("metricGoalsCount")) $("metricGoalsCount").textContent = String(state.data.goals.length);

  $("latestTransactions").innerHTML=tx.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8).map(t=>{
    const c = cat(t.categoryId);
    return `<div class="list-item">
      <div class="list-item-icon" style="background: ${c?.color}20; color: ${c?.color}">
        <i data-lucide="${c?.icon || 'circle'}"></i>
      </div>
      <div style="flex: 1">
        <strong>${t.description || (t.type === 'income' ? 'Entrada' : 'Saída')}</strong><br>
        <small>${t.date} • ${c?.name || 'Sem categoria'}</small>
      </div>
      <div style="text-align: right">
        <strong style="color: ${t.type === 'income' ? 'var(--primary)' : 'var(--danger)'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</strong>
      </div>
    </div>`;
  }).join("")||"<small>Sem transações.</small>";
  
  if(window.lucide) lucide.createIcons();
  
  const byCat={}; tx.filter(t=>t.type==="expense").forEach(t=>{const k=t.categoryId||"none"; byCat[k]=(byCat[k]||0)+num(t.amount)});
  draw("category","categoryChart","doughnut",{labels:Object.keys(byCat).map(k=>cat(k)?.name||"Sem categoria"),datasets:[{data:Object.values(byCat),backgroundColor:Object.keys(byCat).map(k=>cat(k)?.color||"#94a3b8")}]});
  
  // Renderizar gráfico de tendência (Evolução Mensal)
  renderTrendChart(tx);
  // Renderizar gráfico de panorama geral (Pizza)
  renderOverallChart(tx);

  renderBudgetDashboard(tx);
}

function renderTrendChart(tx) {
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6Months.push(d.toISOString().slice(0, 7));
  }

  const data = last6Months.map(m => {
    const monthTx = tx.filter(t => t.date.slice(0, 7) === m);
    const inc = monthTx.filter(t => t.type === "income").reduce((s, t) => s + num(t.amount), 0);
    const exp = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + num(t.amount), 0);
    return { month: m, income: inc, expense: exp };
  });

  draw("trend", "trendChart", "line", {
    labels: data.map(d => monthLabel(d.month)),
    datasets: [
      { label: "Receitas", data: data.map(d => d.income), borderColor: "#10b981", tension: 0.3 },
      { label: "Despesas", data: data.map(d => d.expense), borderColor: "#fb7185", tension: 0.3 }
    ]
  });
}

function renderOverallChart(tx) {
  const inc = tx.filter(t => t.type === "income").reduce((s, t) => s + num(t.amount), 0);
  const exp = tx.filter(t => t.type === "expense").reduce((s, t) => s + num(t.amount), 0);
  
  draw("overall", "overallPieChart", "pie", {
    labels: ["Receitas", "Despesas"],
    datasets: [{
      data: [inc, exp],
      backgroundColor: ["#10b981", "#fb7185"]
    }]
  });
}

function renderBudgetDashboard(tx){
  const list=$("budgetProgressList"); if(!list) return;
  const currM=month(); const catsWB=state.data.categories.filter(c=>num(c.budget)>0);
  if(!catsWB.length){ list.innerHTML="<p>Defina metas nas categorias.</p>"; return; }
  const spentByCat={}; tx.filter(t=>t.type==="expense"&&t.date.slice(0,7)===currM).forEach(t=>{const k=t.categoryId||"none"; spentByCat[k]=(spentByCat[k]||0)+num(t.amount)});
  list.innerHTML=catsWB.map(c=>{
    const spent=spentByCat[c.id]||0, budget=num(c.budget), pct=Math.min(100,(spent/budget)*100), isOver=spent>budget;
    return `<div class="budget-item"><strong>${c.name}</strong><br><small>${money(spent)} / ${money(budget)}</small><div class="progress budget-progress"><div class="progress-bar ${isOver?"bg-danger":""}" style="width:${pct}%;background-color:${isOver?"":c.color}"></div></div></div>`;
  }).join("");
}

function monthly(m){const tx=state.data.transactions.filter(t=>t.date.slice(0,7)===m).map(txVM);const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+num(t.amount),0);const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+num(t.amount),0);return{month:m,income,expense,balance:income-expense,transactions:tx}}
function renderMonthlyReportOutput(data){
  $("reportOutput").innerHTML=`<div class="report-kpis"><strong>Rec: ${money(data.income)}</strong> | <strong>Des: ${money(data.expense)}</strong> | <strong>Saldo: ${money(data.balance)}</strong></div><div class="report-chart-box"><canvas id="reportMiniChart"></canvas></div>`;
  draw("reportMini","reportMiniChart","bar",{labels:["Receitas","Despesas","Saldo"],datasets:[{data:[data.income,data.expense,data.balance],backgroundColor:["#16a34a","#dc2626","#2563eb"]}]});
}
function generateMonthlyReport(e){e.preventDefault();const m=new FormData(e.target).get("month");state.reportMonth=m;renderMonthlyReportOutput(monthly(m))}
function compareMonths(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const c=monthly(f.current), p=monthly(f.previous);$("reportOutput").innerHTML=`<div class="report-kpis"><strong>Atual: ${money(c.balance)}</strong> | <strong>Anterior: ${money(p.balance)}</strong></div><div class="report-chart-box"><canvas id="reportMiniChart"></canvas></div>`;draw("reportMini","reportMiniChart","bar",{labels:[monthLabel(p.month),monthLabel(c.month)],datasets:[{label:"Saldo",data:[p.balance,c.balance],backgroundColor:"#2563eb"}]})}
function monthLabel(m){const [y,mo]=String(m||"").split("-").map(Number); return !y||!mo?m:new Date(y,mo-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
function exportCsv(){const m=state.reportMonth||month();const r=monthly(m).transactions;const csv=[["id","data","tipo","valor","categoria"],...r.map(t=>[t.id,t.date,t.type,t.amount,t.categoryName])].map(row=>row.join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`relatorio-${m}.csv`;a.click()}
function exportPdf(){window.print()}

function renderInsights(){
  const tx=state.data.transactions; const currM=month(); const r=monthly(currM);
  const insightText=r.expense>r.income*0.85 ? "Gastos altos! Cuidado." : "Finanças saudáveis.";
  const l=$("insightsList"); if(l) l.innerHTML=`<div class="list-item">${insightText}</div>`;
}

function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load",()=>navigator.serviceWorker.register("./frontend/service-worker.js").catch(e=>console.error("SW erro:",e)));
}

async function boot(){
  setLoadingUI(true);
  try{
    await wait(100); ensureSettings(); refreshSelects(); runRecurringDue(true);
    renderCategories(); renderTransactions(state.data.transactions); renderCards();
    renderInvoices(); renderRecurring(); renderGoals(); renderSalaryForm();
    renderDashboard(); renderInsights(); renderSettings();
    const last=readLastView(); openView(last);
    if(window.lucide) lucide.createIcons();
  }catch(err){console.error("Boot erro:",err)}
  setLoadingUI(false);
}

// --- Inicialização Centralizada ---
async function initApp(){
  console.log("Iniciando App...");
  try{
    // Verificar se o Supabase está acessível
    console.log("Supabase: Verificando conexão...");
    const { error: connectionError } = await sb.from("user_finance_data").select("count").limit(0);
    if (connectionError && connectionError.code !== "PGRST116") { // PGRST116 é esperado se a tabela estiver vazia mas acessível
       console.warn("Supabase: Problema de conexão ou permissão detectado:", connectionError.message);
    } else {
       console.log("Supabase: Conexão OK.");
    }

    // EXPOSIÇÃO GLOBAL IMEDIATA
    window.logout = logout;
    window.openView = openView;
    window.toggleTheme = toggleTheme;
    window.startOnboarding = startOnboarding;
    window.setAuthTab = setAuthTab;
    window.quickAddExpense = quickAddExpense;
    window.editCategory = editCategory;
    window.removeCategory = removeCategory;
    window.editTransaction = editTransaction;
    window.removeTransaction = removeTransaction;
    window.markInstallmentPaid = markInstallmentPaid;
    window.contributeGoal = contributeGoal;
    window.removeGoal = removeGoal;
    window.removeRecurring = removeRecurring;
    window.clearTransactionFilters = clearTransactionFilters;
    window.syncNow = syncNow;
    window.exportBackupJson = exportBackupJson;
    window.clearAllData = clearAllData;
    window.saveSalaryAuto = saveSalaryAuto;
    window.saveGoal = saveGoal;
    window.generateMonthlyReport = generateMonthlyReport;
    window.compareMonths = compareMonths;
    window.exportCsv = exportCsv;
    window.exportPdf = exportPdf;
    window.runRecurringDue = runRecurringDue;
    window.setTransactionType = setTransactionType;
    window.setTransactionPaymentMethod = setTransactionPaymentMethod;
    window.finishOnboarding = finishOnboarding;
    window.nextOnboardingStep = nextOnboardingStep;

    if(localStorage.getItem(KEYS.theme)==="dark")document.body.classList.add("dark");
    
    bindAuth();
    bindUi();
    renderAuth();

    if($("transactionForm")?.date)$("transactionForm").date.value=today();
    if($("recurringForm")?.nextRunDate)$("recurringForm").nextRunDate.value=today();
    if($("reportForm")?.month)$("reportForm").month.value=month();

    // Escutar mudanças de autenticação (Fonte Única da Verdade)
    sb.auth.onAuthStateChange(async(ev,sess)=>{
      console.log("Auth Event:", ev);
      if(sess?.user){
        if(!state.user || state.user.id !== sess.user.id) {
          await login(mapAuthUser(sess.user));
        }
      } else {
        state.user = null;
        state.data = null;
        renderAuth();
      }
    });

    if(window.lucide) lucide.createIcons();
    registerServiceWorker();
  }catch(e){console.error("Init erro:",e)}
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", initApp); else initApp();

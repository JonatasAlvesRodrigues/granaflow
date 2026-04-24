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
  $$(".auth-tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));
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
      toast("Erro ao salvar na nuvem: " + error.message, true);
    }
  } catch (e) {
    console.error("Supabase: Erro inesperado no push", e);
  }
}

async function syncNow(){
  if(!state.user) return;
  toast("Sincronizando...");
  await pushCloudData();
  toast("Sincronizado com sucesso!");
}

async function login(user){
  state.user=user;
  const cloud=await fetchCloudData(user.id);
  state.data=cloud||loadData(user.id);
  ensureSettings();
  renderAuth();
  boot();
}

async function logout(){
  if(state.syncTimer) {
    clearTimeout(state.syncTimer);
    await pushCloudData();
  }
  await sb.auth.signOut();
  state.user=null;
  state.data=null;
  localStorage.removeItem(KEYS.lastView);
  renderAuth();
}

async function handleLogin(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const email=f.get("email"), pass=f.get("password");
  const msg=$("authMessage"); if(msg) msg.textContent="Entrando...";
  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){ if(msg) msg.textContent=error.message; return; }
}

async function handleRegister(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const name=f.get("name"), email=f.get("email"), pass=f.get("password");
  const msg=$("authMessage"); if(msg) msg.textContent="Criando conta...";
  const {data,error}=await sb.auth.signUp({email,password:pass,options:{data:{name}}});
  if(error){ if(msg) msg.textContent=error.message; return; }
  if(data.user && data.session){
    await login(mapAuthUser(data.user));
  } else {
    if(msg) msg.textContent="Verifique seu email para confirmar o cadastro.";
  }
}

async function handleRecover(e){
  e.preventDefault();
  const email=new FormData(e.target).get("email");
  const msg=$("authMessage"); if(msg) msg.textContent="Enviando...";
  const {error}=await sb.auth.resetPasswordForEmail(email);
  if(error){ if(msg) msg.textContent=error.message; return; }
  if(msg) msg.textContent="Email enviado!";
}

function bindAuth(){
  on("loginForm","submit",handleLogin);
  on("registerForm","submit",handleRegister);
  on("recoverForm","submit",handleRecover);
}

// --- Funções Auxiliares de Dados ---
const cat=(id)=>state.data.categories.find(c=>c.id===id);
const acc=(id)=>state.data.accounts.find(a=>a.id===id);
const txVM=(t)=>({...t,categoryName:cat(t.categoryId)?.name||"Sem categoria",accountName:acc(t.accountId)?.name||"Geral"});

// --- Gráficos ---
function draw(key,id,type,data){
  const ctx=$(id)?.getContext("2d"); if(!ctx)return;
  if(state.charts[key])state.charts[key].destroy();
  state.charts[key]=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type!=="bar"}}}});
}

// --- Navegação ---
function openView(view){
  const targetView = $(view + "View");
  if (!targetView) return;

  $$(".nav-link").forEach(l=>l.classList.toggle("active",l.dataset.view===view));
  $$(".mobile-tab").forEach(l=>l.classList.toggle("active",l.dataset.view===view));
  
  const viewTitleEl = $("viewTitle");
  const viewSubtitleEl = $("viewSubtitle");
  const topbarBrandEl = document.querySelector(".topbar-brand");

  if (viewTitleEl) viewTitleEl.textContent = title(view);

  // Ajuste para o mobile header discreto
  if (topbarBrandEl) {
    if (window.innerWidth <= 768) {
      if (view === "dashboard") {
        topbarBrandEl.style.display = "block";
        if (viewTitleEl) viewTitleEl.style.display = "none";
        if (viewSubtitleEl) viewSubtitleEl.style.display = "none";
      } else {
        topbarBrandEl.style.display = "none";
        if (viewTitleEl) {
          viewTitleEl.style.display = "block";
          // Ajuste fino para não encavalar no menu
          viewTitleEl.style.textAlign = "center"; 
        }
        if (viewSubtitleEl) viewSubtitleEl.style.display = "none";
      }
    } else {
      topbarBrandEl.style.display = "none";
      if (viewTitleEl) {
        viewTitleEl.style.display = "block";
        viewTitleEl.style.textAlign = "left";
      }
      if (viewSubtitleEl) viewSubtitleEl.style.display = "block";
    }
  }

  $$(".view").forEach(x=>x.classList.add("hidden"));
  targetView.classList.remove("hidden");
  animateView(targetView);
  
  if (viewSubtitleEl && window.innerWidth > 768) viewSubtitleEl.textContent = subtitle(view);
  const s=$("sidebar"); if(s) s.classList.remove("open");
  saveLastView(view);
  if(view==="insights") renderInsights();
  if(view==="settings") renderSettings();
  if(window.lucide) lucide.createIcons();

  // Esconder FAB na tela de transações para evitar redundância
  const fab = $("fabQuickAdd");
  if(fab) fab.style.display = (view === "transactions") ? "none" : "grid";
}
window.openView = openView;

function renderOnboarding(){
  const step=ONBOARDING_STEPS[state.onboardingIndex];
  if(!step) return;
  const s=$("onboardingStep"), t=$("onboardingTitle"), tx=$("onboardingText"), n=$("onboardingNext");
  if(s) s.textContent=`Passo ${state.onboardingIndex+1} de ${ONBOARDING_STEPS.length}`;
  if(t) t.textContent=step.title;
  if(tx) tx.textContent=step.text;
  openView(step.view);
  if(typeof step.focus === "function") step.focus();
}

function startOnboarding(force=false){
  if(!state.data.settings.onboardingDone || force){
    state.onboardingIndex=0;
    $("onboardingModal").classList.remove("hidden");
    renderOnboarding();
  }
}

function nextOnboardingStep(){
  state.onboardingIndex++;
  if(state.onboardingIndex >= ONBOARDING_STEPS.length){
    finishOnboarding(true);
  } else {
    renderOnboarding();
  }
}

function finishOnboarding(done=true){
  state.data.settings.onboardingDone=done;
  saveData();
  $("onboardingModal").classList.add("hidden");
}

function title(v){const m={dashboard:"Dashboard",transactions:"Nova Transação",statement:"Extrato",categories:"Categorias",cards:"Cartões e Faturas",recurring:"Recorrentes",goals:"Metas Financeiras",reports:"Relatórios",insights:"Insights",settings:"Ajustes"}; return m[v]||v}
function subtitle(v){const m={dashboard:"Visão geral das finanças",transactions:"Registre seus gastos e ganhos",statement:"Histórico detalhado",categories:"Organize seus tipos de gastos",cards:"Acompanhe o que está por vir",recurring:"Contas fixas e assinaturas",goals:"Planeje seus sonhos",reports:"Análise de desempenho",insights:"IA: Dicas e tendências",settings:"Preferências do sistema"}; return m[v]||""}

function bindUi(){
  on("transactionForm","submit",saveTransaction);
  on("categoryForm","submit",saveCategory);
  on("goalForm","submit",saveGoal);
  on("salaryForm","submit",saveSalaryAuto);
  on("transactionFilter","submit",filterTransactions);
  on("reportForm","submit",generateMonthlyReport);
  on("compareForm","submit",compareMonths);
  
  on("aiQuickInput", "keypress", (e) => {
    if (e.key === "Enter") handleAiInput(e.target.value);
  });
  
  const txTypeInput = $("txType");
  if (txTypeInput) {
    on("txType", "change", () => refreshSelects());
  }

  on("importBackupFile", "change", importBackupJson);
}

function refreshSelects(){
  const catSel=$("transactionCategory"); if(catSel){catSel.innerHTML=state.data.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
  const filterCat=$("filterCategory"); if(filterCat){filterCat.innerHTML=`<option value="">Todas</option>`+state.data.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
  const recurringCat=$("recurringCategory"); if(recurringCat){recurringCat.innerHTML=state.data.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
}

function renderCategories(){
  const list=$("categoryList"); if(!list) return;
  list.innerHTML=state.data.categories.map(c=>`
    <div class="list-item">
      <div class="list-item-icon" style="background: ${c.color}20; color: ${c.color}"><i data-lucide="${c.icon||'circle'}"></i></div>
      <div style="flex:1"><strong>${c.name}</strong><br><small>Teto: ${money(c.budget)}</small></div>
      <div class="list-actions">
        <button class="btn btn-ghost" onclick="editCategory('${c.id}')">Editar</button>
        <button class="btn btn-danger" onclick="removeCategory('${c.id}')">Excluir</button>
      </div>
    </div>
  `).join("")||"<p class='message'>Nenhuma categoria personalizada.</p>";
  if(window.lucide) lucide.createIcons();
}

function editCategory(id){
  const c=cat(id); if(!c) return;
  const f=$("categoryForm");
  f.id.value=c.id; f.name.value=c.name; f.color.value=c.color; f.icon.value=c.icon||"circle"; f.budget.value=c.budget||"";
}

function removeCategory(id){
  if(CATS.find(c=>c.id===id)){ toast("Categorias padrão não podem ser excluídas.",true); return; }
  if(!confirm("Excluir categoria?")) return;
  state.data.categories=state.data.categories.filter(c=>c.id!==id);
  saveData(); renderCategories(); refreshSelects();
}

function saveCategory(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get("id");
  const catData={id:id||uid("cat"),name:f.get("name"),color:f.get("color"),icon:f.get("icon")||"circle",budget:num(f.get("budget"))};
  if(id){
    const idx=state.data.categories.findIndex(c=>c.id===id);
    if(idx!==-1) state.data.categories[idx]=catData;
  } else {
    state.data.categories.push(catData);
  }
  saveData(); renderCategories(); refreshSelects(); e.target.reset(); f.set("id","");
}

function setTransactionType(type){
  const input=$("txType"); if(!input) return;
  input.value=type;
  $$(".type-toggle-btn").forEach(b=>b.classList.toggle("active",b.dataset.txType===type));
  refreshSelects();
}
window.setTransactionType = setTransactionType;

function setTransactionPaymentMethod(method){
  const input=$("paymentMethod"); if(!input) return;
  input.value=method;
  $$(".payment-toggle-btn").forEach(b=>{
    const btnMethod = b.getAttribute('onclick').match(/'([^']+)'/)[1];
    b.classList.toggle("active",btnMethod===method);
  });
  $("transactionCreditFields").classList.toggle("hidden",method!=="credit");
}
window.setTransactionPaymentMethod = setTransactionPaymentMethod;

function saveTransaction(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get("id");
  const txData={
    id:id||uid("tx"),
    type:f.get("type"),
    amount:num(f.get("amount")),
    categoryId:f.get("categoryId"),
    date:f.get("date"),
    description:f.get("description"),
    paymentMethod:f.get("paymentMethod"),
    installmentCount:num(f.get("installmentCount"))||1
  };

  if(id){
    const idx=state.data.transactions.findIndex(t=>t.id===id);
    if(idx!==-1) state.data.transactions[idx]=txData;
  } else {
    state.data.transactions.push(txData);
  }

  saveData();
  renderTransactions(state.data.transactions);
  renderDashboard();
  e.target.reset();
  f.set("id","");
  setTransactionType("income");
  setTransactionPaymentMethod("cash");
  toast("Transação salva!");
  openView("dashboard");
}

function renderTransactions(txs){
  const list=$("transactionList"); if(!list) return;
  list.innerHTML=txs.slice().sort((a,b)=>a.date<b.date?1:-1).map(t=>{
    const c=cat(t.categoryId);
    return `
    <div class="list-item">
      <div class="list-item-icon" style="background: ${c?.color}20; color: ${c?.color}"><i data-lucide="${c?.icon||'circle'}"></i></div>
      <div style="flex:1"><strong>${t.description||'Sem descrição'}</strong><br><small>${t.date} • ${c?.name||'Sem categoria'}</small></div>
      <div style="text-align:right; margin-right:1rem">
        <strong style="color:${t.type==="income"?'var(--primary)':'var(--danger)'}">${t.type==="income"?'+':'-'}${money(t.amount)}</strong><br>
        <small>${t.paymentMethod}</small>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost" onclick="editTransaction('${t.id}')">Editar</button>
        <button class="btn btn-danger" onclick="removeTransaction('${t.id}')">Excluir</button>
      </div>
    </div>
  `}).join("")||"<p class='message'>Nenhuma transação encontrada.</p>";
  if(window.lucide) lucide.createIcons();
}

function editTransaction(id){
  const t=state.data.transactions.find(x=>x.id===id); if(!t) return;
  openView("transactions");
  const f=$("transactionForm");
  f.id.value=t.id;
  setTransactionType(t.type);
  setTransactionPaymentMethod(t.paymentMethod);
  f.amount.value=t.amount;
  f.categoryId.value=t.categoryId;
  f.date.value=t.date;
  f.description.value=t.description||"";
  if(t.paymentMethod==="credit") f.installmentCount.value=t.installmentCount;
}

function removeTransaction(id){
  if(!confirm("Excluir transação?")) return;
  state.data.transactions=state.data.transactions.filter(t=>t.id!==id);
  saveData(); renderTransactions(state.data.transactions); renderDashboard();
}

function filterTransactions(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const catId=f.get("categoryId"), start=f.get("startDate"), end=f.get("endDate");
  let filtered=state.data.transactions;
  if(catId) filtered=filtered.filter(t=>t.categoryId===catId);
  if(start) filtered=filtered.filter(t=>t.date>=start);
  if(end) filtered=filtered.filter(t=>t.date<=end);
  renderTransactions(filtered);
}

function clearTransactionFilters(){
  $("transactionFilter").reset();
  renderTransactions(state.data.transactions);
}

function renderCards(){
  const txs=state.data.transactions;
  const creditTxs=txs.filter(t=>t.paymentMethod==="credit");
  
  // Parcelas restantes (simplificado: todas as que não foram pagas no mês atual ou futuro)
  const totalAmount=creditTxs.reduce((s,t)=>s+num(t.amount),0);
  if($("debtInstallmentsCount")) $("debtInstallmentsCount").textContent=String(creditTxs.length);
  if($("debtInstallmentsAmount")) $("debtInstallmentsAmount").textContent=money(totalAmount);
  
  const recurringCount=state.data.recurring.filter(r=>r.isActive).length;
  const recurringAmount=state.data.recurring.filter(r=>r.isActive).reduce((s,r)=>s+num(r.amount),0);
  if($("debtRecurringCount")) $("debtRecurringCount").textContent=String(recurringCount);
  if($("debtRecurringAmount")) $("debtRecurringAmount").textContent=money(recurringAmount);
}

function renderInvoices(e){
  if(e) e.preventDefault();
  const m = e ? new FormData(e.target).get("month") : month();
  const txs = state.data.transactions.filter(t => t.paymentMethod === "credit" && t.date.slice(0, 7) === m);
  const list = $("invoiceList"); if(!list) return;
  list.innerHTML = txs.map(t => `
    <div class="list-item">
      <div style="flex:1"><strong>${t.description}</strong><br><small>${t.date}</small></div>
      <strong>${money(t.amount)}</strong>
    </div>
  `).join("") || "<p class='message'>Nenhuma fatura para este mês.</p>";
}

function saveRecurring(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const rData={
    id:uid("rec"),
    type:f.get("type"),
    amount:num(f.get("amount")),
    frequency:f.get("frequency"),
    nextRunDate:f.get("nextRunDate"),
    categoryId:f.get("categoryId"),
    description:f.get("description"),
    isActive:true
  };
  state.data.recurring.push(rData);
  saveData(); renderRecurring(); e.target.reset();
}

function renderRecurring(){
  const list=$("recurringList"); if(!list) return;
  list.innerHTML=state.data.recurring.map(r=>`
    <div class="list-item">
      <div style="flex:1"><strong>${r.description}</strong><br><small>${r.frequency} • Próximo: ${r.nextRunDate}</small></div>
      <div style="text-align:right; margin-right:1rem"><strong>${money(r.amount)}</strong></div>
      <button class="btn btn-danger" onclick="removeRecurring('${r.id}')">Excluir</button>
    </div>
  `).join("")||"<p class='message'>Nenhum lançamento recorrente.</p>";
}

function removeRecurring(id){
  state.data.recurring=state.data.recurring.filter(r=>r.id!==id);
  saveData(); renderRecurring();
}

function runRecurringDue(silent=false){
  let count=0;
  state.data.recurring.forEach(r=>{
    while(r.isActive && r.nextRunDate <= today()){
      state.data.transactions.push({
        id:uid("tx"),
        type:r.type,
        amount:r.amount,
        categoryId:r.categoryId,
        date:r.nextRunDate,
        description:r.description + " (Recorrente)",
        paymentMethod:"cash",
        installmentCount:1
      });
      const d=new Date(r.nextRunDate+"T12:00:00");
      if(r.frequency==="daily") d.setDate(d.getDate()+1);
      else if(r.frequency==="weekly") d.setDate(d.getDate()+7);
      else if(r.frequency==="monthly") d.setMonth(d.getMonth()+1);
      r.nextRunDate=d.toISOString().slice(0,10);
      count++;
    }
  });
  if(count>0){
    saveData(); renderTransactions(state.data.transactions); renderDashboard();
    if(!silent) toast(`${count} lançamentos recorrentes processados!`);
  } else if(!silent) {
    toast("Nada para processar hoje.");
  }
}

function saveGoal(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get("id");
  const gData={
    id:id||uid("goal"),
    targetAmount:num(f.get("targetAmount")),
    currentAmount:num(f.get("currentAmount")),
    durationValue:num(f.get("durationValue")),
    durationUnit:f.get("durationUnit"),
    date:today()
  };
  if(id){
    const idx=state.data.goals.findIndex(g=>g.id===id);
    if(idx!==-1) state.data.goals[idx]=gData;
  } else {
    state.data.goals.push(gData);
  }
  saveData(); renderGoals(); e.target.reset(); f.set("id","");
}

function renderGoals(){
  const list=$("goalList"); if(!list) return;
  list.innerHTML=state.data.goals.map(g=>{
    const pct=Math.min(100,(g.currentAmount/g.targetAmount)*100);
    const remaining=g.targetAmount-g.currentAmount;
    const monthly=remaining/g.durationValue;
    return `
    <div class="card">
      <div style="display:flex; justify-content:space-between">
        <strong>Meta: ${money(g.targetAmount)}</strong>
        <button class="btn btn-danger" onclick="removeGoal('${g.id}')">Excluir</button>
      </div>
      <p>Já poupado: ${money(g.currentAmount)} (${pct.toFixed(1)}%)</p>
      <div class="progress" style="height:12px"><div class="progress-bar" style="width:${pct}%; background:var(--primary)"></div></div>
      <p><small>Faltam ${money(remaining)}. Guarde <strong>${money(monthly)}/${g.durationUnit==="months"?'mês':'ano'}</strong> por ${g.durationValue} ${g.durationUnit==="months"?'meses':'anos'}.</small></p>
      <button class="btn btn-secondary" onclick="contributeGoal('${g.id}')">Adicionar aporte</button>
    </div>
  `}).join("")||"<p class='message'>Nenhuma meta cadastrada.</p>";
}

function removeGoal(id){
  state.data.goals=state.data.goals.filter(g=>g.id!==id);
  saveData(); renderGoals();
}

function contributeGoal(id){
  const amount=num(prompt("Valor do aporte:"));
  if(!amount) return;
  const g=state.data.goals.find(x=>x.id===id);
  if(g){
    g.currentAmount += amount;
    saveData(); renderGoals();
  }
}

function toggleTheme(){
  const isDark=document.body.classList.toggle("dark");
  localStorage.setItem(KEYS.theme,isDark?"dark":"light");
  renderSettings();
}

function renderSettings(){
  const themeInfo=$("settingsThemeInfo");
  if(themeInfo) themeInfo.textContent="Tema atual: "+(document.body.classList.contains("dark")?"Escuro":"Claro");
}

function saveSalaryAuto(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const amount=num(f.get("amount")), day=num(f.get("day"));
  state.data.settings.salary={enabled:true,amount,day};
  
  // Criar ou atualizar recorrência de salário
  const existingRec=state.data.recurring.find(r=>r.description==="Salário Automático");
  const nextDate=new Date(); 
  nextDate.setDate(day);
  if(nextDate < new Date()) nextDate.setMonth(nextDate.getMonth()+1);

  const recData={
    id:existingRec?.id||uid("rec"),
    type:"income",
    amount,
    frequency:"monthly",
    nextRunDate:nextDate.toISOString().slice(0,10),
    categoryId:"cat_salary",
    description:"Salário Automático",
    isActive:true
  };

  if(existingRec){
    const idx=state.data.recurring.indexOf(existingRec);
    state.data.recurring[idx]=recData;
  } else {
    state.data.recurring.push(recData);
  }

  saveData();
  toast("Configuração de salário salva!");
  renderSalaryForm();
  renderRecurring();
}

function renderSalaryForm(){
  const s=state.data.settings.salary;
  if(!s || !s.enabled) return;
  if($("salaryAmount")) $("salaryAmount").value=s.amount;
  if($("salaryDay")) $("salaryDay").value=s.day;
  if($("salaryInfo")) $("salaryInfo").textContent=`Configurado: ${money(s.amount)} todo dia ${s.day}.`;
}

function exportBackupJson(){
  const data=JSON.stringify(state.data);
  const blob=new Blob([data],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`granaflow-backup-${today()}.json`;
  a.click();
}

function importBackupJson(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const data=safeParseData(ev.target.result);
    if(data){
      state.data=data;
      saveData();
      boot();
      toast("Backup importado!");
    } else {
      toast("Arquivo inválido.",true);
    }
  };
  reader.readAsText(file);
}

function clearAllData(){
  if(!confirm("Isso apagará todas as suas transações e metas. Continuar?")) return;
  state.data=emptyData();
  saveData();
  boot();
  toast("Dados limpos.");
}

function setLoadingUI(on){
  document.body.classList.toggle("loading-ui",on);
}

function animateValue(el,val,opts={}){
  if(!el)return;
  const start=num(el.dataset.val||0), end=num(val);
  const duration=400, startTime=performance.now();
  function step(now){
    const progress=Math.min(1,(now-startTime)/duration);
    const current=start+(end-start)*progress;
    el.textContent=opts.currency?money(current):Math.floor(current);
    if(progress<1) requestAnimationFrame(step); else el.dataset.val=end;
  }
  requestAnimationFrame(step);
}

function animateView(view){
  view.style.opacity="0";
  view.style.transform="translateY(10px)";
  setTimeout(()=>{
    view.style.transition="all 0.3s ease";
    view.style.opacity="1";
    view.style.transform="translateY(0)";
  },50);
}

const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

function quickAddExpense(){
  openView("transactions");
  setTransactionType("expense");
  setTimeout(()=>{$("txAmount")?.focus()},300);
}

// IA Helper
async function handleAiInput(val){
  if(!val || val.trim().length < 2) return;
  const input = val.toLowerCase().trim();
  
  // Regex simples: "valor descrição" ou "descrição valor"
  const amountMatch = input.match(/(\d+([.,]\d{1,2})?)/);
  if(amountMatch){
    const amount = num(amountMatch[0].replace(",", "."));
    const description = input.replace(amountMatch[0], "").trim();
    
    let type = "expense";
    let categoryId = "cat_others";
    
    // IA Básica: Aprender com o histórico
    if(state.aiLearning && state.aiLearning[description]){
      categoryId = state.aiLearning[description];
    } else {
      // Sugerir categoria por palavras-chave
      const keywords = {
        food: ["comida", "almoço", "janta", "ifood", "mercado", "pão", "lanche"],
        trans: ["uber", "gasolina", "ônibus", "metro", "combustível"],
        fun: ["cinema", "cerveja", "festa", "show", "netflix", "spotify"],
        home: ["aluguel", "luz", "água", "internet", "condomínio"],
        salary: ["salário", "pagamento", "recebi"]
      };

      for(const [catKey, words] of Object.entries(keywords)){
        if(words.some(w => description.includes(w))){
          const found = state.data.categories.find(c => c.id.includes(catKey));
          if(found) {
            categoryId = found.id;
            if(catKey === "salary") type = "income";
            break;
          }
        }
      }

      // Se não encontrou, perguntar ao usuário e aprender
      if(categoryId === "cat_others"){
        const categories = state.data.categories;
        const catOptions = categories.map((c, i) => `${i+1}. ${c.name}`).join("\n");
        const userChoice = prompt(`IA: Não reconheci a categoria para "${description}".\nEscolha o número:\n${catOptions}`);
        
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
  const insightText=r.expense>r.income*0.85 ? "Gastos altos! Você comprometeu mais de 85% da sua renda este mês." : "Suas finanças estão saudáveis. Continue assim!";
  
  const l=$("insightsList"); if(l) l.innerHTML=`<div class="list-item"><i data-lucide="sparkles"></i> <span>${insightText}</span></div>`;
  
  const trend=$("insightTrendList"); if(trend) trend.innerHTML="<small>Análise de tendência em desenvolvimento...</small>";
  const growth=$("insightTopGrowthList"); if(growth) growth.innerHTML="<small>Identificando categorias em alta...</small>";
  const notify=$("notificationList"); if(notify) notify.innerHTML="<small>Sem novas notificações.</small>";
  
  if(window.lucide) lucide.createIcons();
}

function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("./service-worker.js").catch(e=>console.error("SW erro:",e));
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
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
        setLoadingUI(false);
      }
    });

    if(window.lucide) lucide.createIcons();
    registerServiceWorker();
  }catch(e){console.error("Init erro:",e)}
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", initApp); else initApp();
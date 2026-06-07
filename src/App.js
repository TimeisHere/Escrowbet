import { useState, useEffect } from "react";

const SUPA_URL = "https://ciwgianwiltffwdeigpo.supabase.co";
const SUPA_KEY = "sb_publishable_De_LCVKbIza3eGBtiILLjQ_hM3LYb9F";

const h = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

async function signUp(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/signup`, { method:"POST", headers:h, body:JSON.stringify({email,password}) });
  return r.json();
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method:"POST", headers:h, body:JSON.stringify({email,password}) });
  return r.json();
}
async function signOut(token) {
  await fetch(`${SUPA_URL}/auth/v1/logout`, { method:"POST", headers:{...h, "Authorization":`Bearer ${token}`} });
}
async function dbGet(table, token, filter="") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?order=created_at.desc${filter}`, { headers:{...h,"Authorization":`Bearer ${token}`} });
  return r.json();
}
async function dbInsert(table, token, data) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method:"POST", headers:{...h,"Authorization":`Bearer ${token}`,"Prefer":"return=representation"}, body:JSON.stringify(data) });
  return r.json();
}
async function dbUpdate(table, token, id, data) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method:"PATCH", headers:{...h,"Authorization":`Bearer ${token}`,"Prefer":"return=representation"}, body:JSON.stringify(data) });
  return r.json();
}

const T = {
  bg:"#1c1f23", surface:"#252a30", panel:"#2e343c", border:"#3a424d",
  orange:"#e8751a", orangeDim:"#7a3c0d", text:"#d4dbe3",
  textDim:"#6b7a8a", textMuted:"#404d5c", green:"#2e7d52", red:"#8b2525", blue:"#1e5a8a",
};

const CATEGORIES = ["⛳ Golf","🎮 Video Game","🏀 Sports","🎯 Darts","🎱 Pool","🃏 Cards","🏌️ Other"];
const STATUS = { PENDING:"pending", ACTIVE:"active", SETTLED:"settled", DISPUTED:"disputed" };
const STATUS_COLORS = { pending:"#b87a10", active:"#2e7d52", settled:"#1e5a8a", disputed:"#8b2525" };
const STATUS_LABELS = { pending:"Awaiting Confirm", active:"Locked In", settled:"Settled", disputed:"Disputed" };

function uid(p="BET"){ return `${p}-${Math.random().toString(36).substr(2,6).toUpperCase()}`; }
function fmt(iso){ return new Date(iso).toLocaleString(); }
function now(){ return new Date().toISOString(); }

export default function App() {
  const [session, setSession] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [bets, setBets] = useState([]);
  const [parlays, setParlays] = useState([]);
  const [tab, setTab] = useState("bets");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const blankBet = { party2_email:"", amount:"", category:CATEGORIES[0], description:"", terms:"" };
  const [betForm, setBetForm] = useState(blankBet);
  const blankParlay = { name:"", party2_email:"", totalStake:"" };
  const [parlayForm, setParlayForm] = useState(blankParlay);
  const blankLeg = { description:"", category:CATEGORIES[0] };
  const [legs, setLegs] = useState([{...blankLeg}]);
  const [winnerSel, setWinnerSel] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sb_session");
    if(saved) setSession(JSON.parse(saved));
  }, []);

  useEffect(() => { if(session) { fetchBets(); fetchParlays(); } }, [session]);

  function toast_(msg, type="ok"){ setToast({msg,type}); setTimeout(()=>setToast(null),3200); }

  async function fetchBets() {
    const data = await dbGet("bets", session.access_token, `&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email})`);
    if(Array.isArray(data)) setBets(data);
  }

  async function fetchParlays() {
    const data = await dbGet("parlays", session.access_token, `&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email})`);
    if(Array.isArray(data)) setParlays(data);
  }

  async function handleAuth() {
    setAuthLoading(true); setAuthError("");
    if(authView === "login") {
      const d = await signIn(email, password);
      if(d.error) { setAuthError(d.error.message || d.error); }
      else { localStorage.setItem("sb_session", JSON.stringify(d)); setSession(d); }
    } else {
      const d = await signUp(email, password);
      if(d.error) setAuthError(d.error.message || d.error);
      else setAuthError("Check your email to confirm your account!");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await signOut(session.access_token);
    localStorage.removeItem("sb_session");
    setSession(null); setBets([]); setParlays([]);
  }

  async function createBet() {
    const f = betForm;
    if(!f.party2_email || !f.amount || !f.description) return toast_("Fill all required fields.", "err");
    if(f.party2_email.toLowerCase() === session.user.email.toLowerCase()) return toast_("Can't bet against yourself.", "err");
    const bet = {
      id: uid(), party1_id: session.user.id,
      party2_email: f.party2_email.toLowerCase(), party2_id: null,
      amount: parseFloat(f.amount), category: f.category,
      description: f.description, terms: f.terms,
      status: STATUS.PENDING, winner: null, created_at: now(),
      history: [{ action:`Bet created by ${session.user.email}`, time:now() }]
    };
    await dbInsert("bets", session.access_token, bet);
    setBetForm(blankBet); setView("list"); fetchBets();
    toast_(`${bet.id} created!`);
  }

  async function confirmBet(bet) {
    if(session.user.email.toLowerCase() !== bet.party2_email.toLowerCase())
      return toast_(`Only ${bet.party2_email} can confirm.`, "err");
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.ACTIVE, party2_id: session.user.id,
      history: [...bet.history, { action:`${session.user.email} confirmed — LOCKED 🔒`, time:now() }]
    });
    fetchBets(); setView("list"); toast_("Bet locked! 🔒");
  }

  async function settleBet(bet) {
    if(!winnerSel) return toast_("Select a winner.", "err");
    const winnerEmail = winnerSel === "party1" ? session.user.email : bet.party2_email;
    const loserEmail = winnerSel === "party1" ? bet.party2_email : session.user.email;
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.SETTLED, winner: winnerEmail,
      history: [...bet.history, { action:`✅ ${winnerEmail} wins $${bet.amount} from ${loserEmail}`, time:now() }]
    });
    fetchBets(); setWinnerSel(""); setView("list");
    toast_(`${winnerEmail} wins! 🏆`);
  }

  async function disputeBet(bet) {
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.DISPUTED,
      history: [...bet.history, { action:"⚠️ DISPUTED.", time:now() }]
    });
    fetchBets(); setView("list"); toast_("Flagged as disputed.", "err");
  }

  async function createParlay() {
    const f = parlayForm;
    if(!f.party2_email || !f.totalStake || legs.length < 2) return toast_("Need opponent email, stake, and 2+ legs.", "err");
    if(legs.some(l => !l.description)) return toast_("All legs need a description.", "err");
    const parlay = {
      id: uid("PAR"), party1_id: session.user.id,
      party2_email: f.party2_email.toLowerCase(), party2_id: null,
      name: f.name || `${session.user.email} vs ${f.party2_email} Parlay`,
      total_stake: parseFloat(f.totalStake),
      legs: legs.map((l,i) => ({...l, id:i, winner:null, settled:false})),
      status: STATUS.PENDING, overall_winner: null, created_at: now(),
      history: [{ action:`Parlay created by ${session.user.email} (${legs.length} legs)`, time:now() }]
    };
    await dbInsert("parlays", session.access_token, parlay);
    setParlayForm(blankParlay); setLegs([{...blankLeg}]); setView("list"); setTab("parlays");
    fetchParlays(); toast_(`${parlay.id} created!`);
  }

  async function confirmParlay(par) {
    if(session.user.email.toLowerCase() !== par.party2_email.toLowerCase())
      return toast_(`Only ${par.party2_email} can confirm.`, "err");
    await dbUpdate("parlays", session.access_token, par.id, {
      status: STATUS.ACTIVE, party2_id: session.user.id,
      history: [...par.history, { action:`${session.user.email} confirmed — LOCKED 🔒`, time:now() }]
    });
    fetchParlays(); setView("list"); toast_("Parlay locked! 🔒");
  }

  async function settleLeg(par, legId, winner) {
    const updatedLegs = par.legs.map(l => l.id===legId ? {...l, winner, settled:true} : l);
    const allSettled = updatedLegs.every(l => l.settled);
    let overallWinner = null; let newStatus = par.status;
    if(allSettled) {
      const p1Wins = updatedLegs.every(l => l.winner==="party1");
      const p2Wins = updatedLegs.every(l => l.winner==="party2");
      overallWinner = p1Wins ? session.user.email : p2Wins ? par.party2_email : "SPLIT — No winner";
      newStatus = STATUS.SETTLED;
    }
    const logEntry = { action:`Leg ${legId+1} settled: ${winner==="party1"?session.user.email:par.party2_email} wins`, time:now() };
    const finalLog = allSettled ? [...par.history, logEntry, { action:`🏆 Parlay: ${overallWinner}`, time:now() }] : [...par.history, logEntry];
    await dbUpdate("parlays", session.access_token, par.id, { legs:updatedLegs, overall_winner:overallWinner, status:newStatus, history:finalLog });
    fetchParlays(); toast_(allSettled ? `Parlay done! 🏆` : `Leg ${legId+1} settled.`);
  }

  async function disputeParlay(par) {
    await dbUpdate("parlays", session.access_token, par.id, {
      status: STATUS.DISPUTED,
      history: [...par.history, { action:"⚠️ DISPUTED.", time:now() }]
    });
    fetchParlays(); setView("list"); toast_("Parlay disputed.", "err");
  }

  const myEmail = session?.user?.email?.toLowerCase();
  const activeStake = [
    ...bets.filter(b=>b.status===STATUS.ACTIVE).map(b=>b.amount),
    ...parlays.filter(p=>p.status===STATUS.ACTIVE).map(p=>p.total_stake)
  ].reduce((s,v)=>s+v,0);
  const filteredBets = filter==="all" ? bets : bets.filter(b=>b.status===filter);
  const filteredParlays = filter==="all" ? parlays : parlays.filter(p=>p.status===filter);

  if(!session) return (
    <div style={{...S.root, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <style>{css}</style>
      <div style={S.authCard}>
        <div style={{fontSize:40, textAlign:"center", color:T.orange}}>⚖</div>
        <div style={{fontSize:24, fontWeight:"bold", letterSpacing:3, color:T.orange, textAlign:"center"}}>SnoVale</div>
        <div style={{fontSize:11, color:T.textDim, letterSpacing:2, textTransform:"uppercase", textAlign:"center", marginBottom:8}}>Side Bet Tracker</div>
        <div style={S.authTabs}>
          <button style={{...S.authTab,...(authView==="login"?S.authTabOn:{})}} onClick={()=>setAuthView("login")}>Login</button>
          <button style={{...S.authTab,...(authView==="signup"?S.authTabOn:{})}} onClick={()=>setAuthView("signup")}>Sign Up</button>
        </div>
        <input style={S.input} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} />
        <input style={S.input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} />
        {authError && <div style={{fontSize:13, color: authError.includes("Check") ? T.green : T.red}}>{authError}</div>}
        <button style={S.subBtn} onClick={handleAuth} disabled={authLoading}>{authLoading?"...":authView==="login"?"Login →":"Create Account →"}</button>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{css}</style>
      {toast && <div style={{...S.toast, background:toast.type==="err"?T.red:"#1c3d28"}}>{toast.msg}</div>}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={{fontSize:28, color:T.orange}}>⚖</span>
          <div><div style={{fontSize:20, fontWeight:"bold", letterSpacing:3, color:T.orange}}>SnoVale</div><div style={{fontSize:10, color:T.textDim, letterSpacing:2, textTransform:"uppercase"}}>Side Bet Tracker</div></div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div style={S.stats}>
            {[{l:"Active",v:bets.filter(b=>b.status===STATUS.ACTIVE).length+parlays.filter(p=>p.status===STATUS.ACTIVE).length},{l:"In Play",v:`$${activeStake.toFixed(2)}`},{l:"Settled",v:bets.filter(b=>b.status===STATUS.SETTLED).length+parlays.filter(p=>p.status===STATUS.SETTLED).length}].map(s=>(
              <div key={s.l} style={S.stat}><span style={S.statN}>{s.v}</span><span style={S.statL}>{s.l}</span></div>
            ))}
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
            <div style={{fontSize:11, color:T.textDim}}>{myEmail}</div>
            <button style={S.logoutBtn} onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {view==="list" && (
        <div style={S.page}>
          <div style={S.tabRow}>
            <button style={{...S.tab,...(tab==="bets"?S.tabOn:{})}} onClick={()=>setTab("bets")}>Single Bets <span style={S.tabCt}>{bets.length}</span></button>
            <button style={{...S.tab,...(tab==="parlays"?S.tabOn:{})}} onClick={()=>setTab("parlays")}>Parlays <span style={S.tabCt}>{parlays.length}</span></button>
          </div>
          <div style={S.toolbar}>
            <div style={S.filters}>
              {["all",STATUS.PENDING,STATUS.ACTIVE,STATUS.SETTLED,STATUS.DISPUTED].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{...S.fBtn,...(filter===f?S.fBtnOn:{})}}>{f==="all"?"All":STATUS_LABELS[f]}</button>
              ))}
            </div>
            <button style={S.newBtn} onClick={()=>setView(tab==="bets"?"createBet":"createParlay")}>+ New {tab==="bets"?"Bet":"Parlay"}</button>
          </div>
          {tab==="bets" && (filteredBets.length===0?<Empty label="No bets yet." />:<div style={S.list}>{filteredBets.map(b=><BetCard key={b.id} bet={b} onClick={()=>{setSelected(b);setView("detailBet");}} />)}</div>)}
          {tab==="parlays" && (filteredParlays.length===0?<Empty label="No parlays yet." />:<div style={S.list}>{filteredParlays.map(p=><ParlayCard key={p.id} par={p} onClick={()=>{setSelected(p);setView("detailParlay");}} />)}</div>)}
        </div>
      )}

      {view==="createBet" && (
        <div style={S.page}><Back onClick={()=>setView("list")} />
          <div style={S.card}><div style={S.cardTitle}>🎯 New Single Bet</div>
            <div style={S.g2}>
              <F label="Your Email" full><input style={{...S.input,opacity:0.6}} value={myEmail} disabled /></F>
              <F label="Opponent Email *" full><input style={S.input} type="email" placeholder="opponent@email.com" value={betForm.party2_email} onChange={e=>setBetForm({...betForm,party2_email:e.target.value})} /></F>
              <F label="Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={betForm.amount} onChange={e=>setBetForm({...betForm,amount:e.target.value})} /></F>
              <F label="Category"><select style={S.input} value={betForm.category} onChange={e=>setBetForm({...betForm,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></F>
              <F label="What's the Bet? *" full><input style={S.input} placeholder="e.g. Back 9 lowest score wins" value={betForm.description} onChange={e=>setBetForm({...betForm,description:e.target.value})} /></F>
              <F label="Terms" full><textarea style={{...S.input,height:72,resize:"vertical"}} placeholder="Handicaps, rules..." value={betForm.terms} onChange={e=>setBetForm({...betForm,terms:e.target.value})} /></F>
            </div>
            <div style={S.note}>⚠️ Your opponent must log in to confirm. Once confirmed the bet locks permanently.</div>
            <button style={S.subBtn} onClick={createBet}>Create Bet →</button>
          </div>
        </div>
      )}

      {view==="createParlay" && (
        <div style={S.page}><Back onClick={()=>setView("list")} />
          <div style={S.card}><div style={S.cardTitle}>🔗 New Parlay</div>
            <div style={S.info}>Chain multiple legs. <strong>All legs must be won by the same person</strong> to win the pot.</div>
            <div style={S.g2}>
              <F label="Parlay Name"><input style={S.input} placeholder="e.g. Sunday Sweep" value={parlayForm.name} onChange={e=>setParlayForm({...parlayForm,name:e.target.value})} /></F>
              <F label="Total Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={parlayForm.totalStake} onChange={e=>setParlayForm({...parlayForm,totalStake:e.target.value})} /></F>
              <F label="Your Email" full><input style={{...S.input,opacity:0.6}} value={myEmail} disabled /></F>
              <F label="Opponent Email *" full><input style={S.input} type="email" placeholder="opponent@email.com" value={parlayForm.party2_email} onChange={e=>setParlayForm({...parlayForm,party2_email:e.target.value})} /></F>
            </div>
            <div style={S.legsHdr}><span style={{fontWeight:"bold",color:T.text}}>Legs ({legs.length})</span><button style={S.addLeg} onClick={()=>setLegs(p=>[...p,{...blankLeg}])}>+ Add Leg</button></div>
            {legs.map((leg,i)=>(
              <div key={i} style={S.legCard}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <span style={{fontSize:12,color:T.orange,fontWeight:"bold"}}>Leg {i+1}</span>
                  {legs.length>2&&<button style={{background:"none",border:"none",color:T.textDim,cursor:"pointer"}} onClick={()=>setLegs(p=>p.filter((_,idx)=>idx!==i))}>✕</button>}
                </div>
                <div style={S.g2}>
                  <F label="Category"><select style={S.input} value={leg.category} onChange={e=>setLegs(p=>p.map((l,idx)=>idx===i?{...l,category:e.target.value}:l))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></F>
                  <F label="Description *" full><input style={S.input} placeholder="e.g. Front 9 lowest score" value={leg.description} onChange={e=>setLegs(p=>p.map((l,idx)=>idx===i?{...l,description:e.target.value}:l))} /></F>
                </div>
              </div>
            ))}
            <div style={S.note}>⚠️ All legs must be won by the same party to win.</div>
            <button style={S.subBtn} onClick={createParlay}>Create Parlay →</button>
          </div>
        </div>
      )}

      {view==="detailBet" && selected && (()=>{
        const bet = bets.find(b=>b.id===selected.id)||selected;
        const isParty1 = bet.party1_id===session.user.id;
        const isParty2 = myEmail===bet.party2_email?.toLowerCase();
        return (
          <div style={S.page}><Back onClick={()=>setView("list")} />
            <div style={S.card}>
              <DHeader id={bet.id} cat={bet.category} status={bet.status} />
              <Pot amount={`$${bet.amount}`} label="Pot" sub="Winner takes all" />
              <div style={S.parties}>
                <div style={{...S.pBox,...(bet.winner===myEmail?S.pWin:{})}}><div style={S.pName}>{isParty1?"You":bet.party2_email}</div><div style={S.pRole}>Creator</div>{bet.winner===myEmail&&isParty1&&<div style={S.wBdg}>🏆 Winner</div>}</div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(bet.winner===bet.party2_email?S.pWin:{})}}><div style={S.pName}>{bet.party2_email}</div><div style={S.pRole}>{bet.party2_id?"✅ Confirmed":"⏳ Pending"}</div>{bet.winner===bet.party2_email&&<div style={S.wBdg}>🏆 Winner</div>}</div>
              </div>
              <Sec title="Details"><Row k="Description" v={bet.description}/>{bet.terms&&<Row k="Terms" v={bet.terms}/>}<Row k="Created" v={fmt(bet.created_at)}/></Sec>
              {bet.status===STATUS.PENDING&&isParty2&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Confirm this bet</div><div style={S.aSub}>You've been challenged! Lock it in to accept.</div><button style={S.okBtn} onClick={()=>confirmBet(bet)}>Confirm & Lock 🔒</button></ABox>}
              {bet.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {bet.party2_email}</div><div style={S.aSub}>Ask them to log in and confirm.</div></ABox>}
              {bet.status===STATUS.ACTIVE&&(isParty1||isParty2)&&<ABox color={T.green}><div style={S.aTitle}>🏆 Settle the Bet</div><select style={S.input} value={winnerSel} onChange={e=>setWinnerSel(e.target.value)}><option value="">— Select Winner —</option><option value="party1">{isParty1?"You":bet.party2_email}</option><option value="party2">{bet.party2_email}</option></select><div style={{display:"flex",gap:10}}><button style={S.okBtn} onClick={()=>settleBet(bet)}>Settle ✅</button><button style={S.badBtn} onClick={()=>disputeBet(bet)}>Dispute ⚠️</button></div></ABox>}
              {bet.status===STATUS.SETTLED&&<ABox color={T.blue}><div style={S.aTitle}>✅ Settled</div><div style={S.aSub}>{bet.winner} wins ${bet.amount}!</div></ABox>}
              {bet.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <Log history={bet.history}/>
            </div>
          </div>
        );
      })()}

      {view==="detailParlay" && selected && (()=>{
        const par = parlays.find(p=>p.id===selected.id)||selected;
        const isParty1 = par.party1_id===session.user.id;
        const isParty2 = myEmail===par.party2_email?.toLowerCase();
        const sc = par.legs.filter(l=>l.settled).length;
        return (
          <div style={S.page}><Back onClick={()=>setView("list")} />
            <div style={S.card}>
              <DHeader id={par.id} cat={`🔗 ${par.legs.length}-Leg Parlay`} status={par.status}/>
              <div style={{fontSize:14,color:T.textDim,marginBottom:16,fontStyle:"italic"}}>{par.name}</div>
              <Pot amount={`$${par.total_stake}`} label="Parlay Pot" sub={`${sc}/${par.legs.length} legs settled`}/>
              <div style={S.parties}>
                <div style={{...S.pBox,...(par.overall_winner===myEmail?S.pWin:{})}}><div style={S.pName}>{isParty1?"You":par.party2_email}</div><div style={S.pRole}>Creator</div></div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(par.overall_winner===par.party2_email?S.pWin:{})}}><div style={S.pName}>{par.party2_email}</div><div style={S.pRole}>{par.party2_id?"✅ Confirmed":"⏳ Pending"}</div></div>
              </div>
              <Sec title={`Legs (${par.legs.length})`}>
                {par.legs.map((leg,i)=>(
                  <div key={leg.id} style={{...S.legDetail,borderColor:leg.settled?T.border:T.orange}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:T.orange,fontWeight:"bold"}}>Leg {i+1} — {leg.category}</span>
                      {leg.settled?<span style={{...S.badge,background:T.green}}>✅ {leg.winner==="party1"?(isParty1?"You":session.user.email):par.party2_email}</span>:<span style={{...S.badge,background:T.textMuted}}>Pending</span>}
                    </div>
                    <div style={{fontSize:13,color:T.textDim,fontStyle:"italic"}}>{leg.description}</div>
                    {par.status===STATUS.ACTIVE&&!leg.settled&&(isParty1||isParty2)&&<LegSettler leg={leg} par={par} onSettle={(id,w)=>settleLeg(par,id,w)}/>}
                  </div>
                ))}
              </Sec>
              {par.status===STATUS.PENDING&&isParty2&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Confirm this parlay</div><button style={S.okBtn} onClick={()=>confirmParlay(par)}>Confirm Parlay 🔒</button></ABox>}
              {par.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {par.party2_email}</div><div style={S.aSub}>Ask them to log in and confirm.</div></ABox>}
              {par.status===STATUS.ACTIVE&&sc<par.legs.length&&(isParty1||isParty2)&&<div style={{textAlign:"right",marginTop:12}}><button style={S.badBtn} onClick={()=>disputeParlay(par)}>Flag Dispute ⚠️</button></div>}
              {par.status===STATUS.SETTLED&&<ABox color={T.blue}><div style={S.aTitle}>✅ Parlay Settled</div><div style={S.aSub}>{par.overall_winner?.includes("SPLIT")?"Split — no winner.":`${par.overall_winner} wins $${par.total_stake}`}</div></ABox>}
              {par.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <Log history={par.history}/>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function LegSettler({leg,par,onSettle}){
  const [w,setW]=useState("");
  return(
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <select style={{...S.input,flex:1}} value={w} onChange={e=>setW(e.target.value)}>
        <option value="">Who won?</option><option value="party1">Creator</option><option value="party2">{par.party2_email}</option>
      </select>
      <button style={{...S.okBtn,padding:"8px 14px"}} onClick={()=>{if(w)onSettle(leg.id,w);}}>Settle</button>
    </div>
  );
}

function BetCard({bet,onClick}){
  return(
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{bet.id}</span><Bdg status={bet.status}/></div>
      <div style={S.cMid}><div style={S.pts}>You <span style={S.vs}>VS</span> {bet.party2_email}</div><div style={S.amt}>${bet.amount}</div></div>
      <div style={S.cBot}><span style={S.cat}>{bet.category}</span><span style={S.desc}>{bet.description}</span></div>
    </div>
  );
}

function ParlayCard({par,onClick}){
  const sc=par.legs.filter(l=>l.settled).length;
  return(
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{par.id} <span style={{color:"#e8751a"}}>· {par.legs.length} legs</span></span><Bdg status={par.status}/></div>
      <div style={S.cMid}><div style={S.pts}>You <span style={S.vs}>VS</span> {par.party2_email}</div><div style={S.amt}>${par.total_stake}</div></div>
      <div style={S.cBot}><span style={S.cat}>🔗 Parlay</span><span style={S.desc}>{par.name} · {sc}/{par.legs.length} settled</span></div>
    </div>
  );
}

function Bdg({status}){return <span style={{...S.badge,background:STATUS_COLORS[status]}}>{STATUS_LABELS[status]}</span>;}
function Pot({amount,label,sub}){return <div style={S.pot}><div style={S.potL}>{label}</div><div style={S.potA}>{amount}</div><div style={S.potS}>{sub}</div></div>;}
function DHeader({id,cat,status}){return <div style={S.dHdr}><div><div style={S.dId}>{id}</div><div style={S.dCat}>{cat}</div></div><Bdg status={status}/></div>;}
function Sec({title,children}){return <div style={S.sec}><div style={S.secT}>{title}</div>{children}</div>;}
function Row({k,v}){return <div style={S.row}><span style={S.rK}>{k}</span><span style={S.rV}>{v}</span></div>;}
function ABox({color,children}){return <div style={{...S.aBox,borderColor:color}}>{children}</div>;}
function Log({history}){return <Sec title="Activity Log">{history.map((h,i)=><div key={i} style={S.logRow}><span style={S.logDot}>◆</span><div><div style={S.logA}>{h.action}</div><div style={S.logT}>{fmt(h.time)}</div></div></div>)}</Sec>;}
function F({label,children,full}){return <div style={{display:"flex",flexDirection:"column",gap:5,...(full?{gridColumn:"1/-1"}:{})}}><label style={S.fLbl}>{label}</label>{children}</div>;}
function Back({onClick}){return <button style={S.back} onClick={onClick}>← Back</button>;}
function Empty({label}){return <div style={S.empty}><div style={{fontSize:44,marginBottom:12}}>🤝</div><div style={{color:"#6b7a8a"}}>{label}</div></div>;}

const S={
  root:{minHeight:"100vh",background:"#1c1f23",color:"#d4dbe3",fontFamily:"'Trebuchet MS',sans-serif",position:"relative"},
  toast:{position:"fixed",top:16,right:16,padding:"12px 20px",borderRadius:8,color:"#fff",fontSize:13,zIndex:9999,maxWidth:320,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"},
  authCard:{background:"#252a30",border:"1px solid #3a424d",borderRadius:16,padding:32,width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:14},
  authTabs:{display:"flex",borderBottom:"1px solid #3a424d",marginBottom:4},
  authTab:{flex:1,padding:"10px",background:"none",border:"none",color:"#6b7a8a",fontSize:14,cursor:"pointer",borderBottom:"2px solid transparent"},
  authTabOn:{color:"#e8751a",borderBottom:"2px solid #e8751a"},
  header:{background:"#252a30",borderBottom:"2px solid #e8751a",padding:"14px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12},
  logo:{display:"flex",alignItems:"center",gap:12},
  logoutBtn:{padding:"5px 14px",background:"none",border:"1px solid #3a424d",borderRadius:6,color:"#6b7a8a",fontSize:12,cursor:"pointer"},
  stats:{display:"flex",gap:24,flexWrap:"wrap"},
  stat:{display:"flex",flexDirection:"column",alignItems:"center"},
  statN:{fontSize:20,fontWeight:"bold",color:"#e8751a"},
  statL:{fontSize:10,color:"#6b7a8a",textTransform:"uppercase",letterSpacing:1},
  page:{maxWidth:800,margin:"0 auto",padding:"22px 14px 60px"},
  tabRow:{display:"flex",gap:4,marginBottom:18,borderBottom:"1px solid #3a424d"},
  tab:{padding:"10px 20px",background:"none",border:"none",color:"#6b7a8a",fontSize:14,cursor:"pointer",borderBottom:"2px solid transparent",marginBottom:-1},
  tabOn:{color:"#e8751a",borderBottom:"2px solid #e8751a"},
  tabCt:{marginLeft:6,background:"#2e343c",padding:"2px 7px",borderRadius:10,fontSize:11},
  toolbar:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16},
  filters:{display:"flex",gap:6,flexWrap:"wrap"},
  fBtn:{padding:"5px 12px",borderRadius:20,border:"1px solid #3a424d",background:"none",color:"#6b7a8a",fontSize:11,cursor:"pointer"},
  fBtnOn:{background:"#e8751a",borderColor:"#e8751a",color:"#000",fontWeight:"bold"},
  newBtn:{padding:"9px 20px",background:"#e8751a",color:"#000",border:"none",borderRadius:8,fontWeight:"bold",fontSize:13,cursor:"pointer"},
  list:{display:"flex",flexDirection:"column",gap:12},
  empty:{textAlign:"center",padding:"70px 20px"},
  betCard:{background:"#252a30",border:"1px solid #3a424d",borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.18s"},
  cTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  idTag:{fontFamily:"monospace",fontSize:11,color:"#404d5c"},
  cMid:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  pts:{fontSize:15,fontWeight:"bold",color:"#d4dbe3"},
  vs:{margin:"0 8px",fontSize:10,color:"#e8751a",letterSpacing:2},
  amt:{fontSize:20,fontWeight:"bold",color:"#e8751a",fontFamily:"monospace"},
  cBot:{display:"flex",gap:10,alignItems:"center"},
  cat:{fontSize:11,color:"#6b7a8a"},
  desc:{fontSize:12,color:"#6b7a8a",fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:300},
  badge:{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:"bold",color:"#fff",letterSpacing:0.5,whiteSpace:"nowrap"},
  card:{background:"#252a30",border:"1px solid #3a424d",borderRadius:14,padding:"24px 22px"},
  cardTitle:{fontSize:20,fontWeight:"bold",color:"#e8751a",marginBottom:20},
  g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  fLbl:{fontSize:11,color:"#6b7a8a",letterSpacing:1,textTransform:"uppercase"},
  input:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:8,padding:"9px 13px",color:"#d4dbe3",fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  note:{margin:"16px 0 12px",fontSize:12,color:"#6b7a8a",fontStyle:"italic"},
  subBtn:{width:"100%",padding:"13px",background:"#e8751a",color:"#000",border:"none",borderRadius:8,fontSize:15,fontWeight:"bold",cursor:"pointer"},
  info:{background:"#2e343c",border:"1px solid #3a424d",borderRadius:8,padding:"12px 14px",fontSize:13,color:"#6b7a8a",marginBottom:18,lineHeight:1.5},
  legsHdr:{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0 12px"},
  addLeg:{padding:"6px 14px",background:"#7a3c0d",color:"#e8751a",border:"1px solid #e8751a",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:"bold"},
  legCard:{background:"#2e343c",border:"1px solid #3a424d",borderRadius:10,padding:"14px",marginBottom:10},
  back:{background:"none",border:"none",color:"#e8751a",fontSize:13,cursor:"pointer",marginBottom:18,padding:0},
  dHdr:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},
  dId:{fontFamily:"monospace",fontSize:12,color:"#404d5c",marginBottom:4},
  dCat:{fontSize:17,color:"#d4dbe3",fontWeight:"bold"},
  pot:{background:"#1c1f23",border:"2px solid #e8751a",borderRadius:12,padding:"18px",textAlign:"center",marginBottom:20},
  potL:{fontSize:10,color:"#e8751a",letterSpacing:3,marginBottom:4,textTransform:"uppercase"},
  potA:{fontSize:40,fontWeight:"bold",color:"#e8751a",fontFamily:"monospace"},
  potS:{fontSize:11,color:"#6b7a8a",marginTop:4},
  parties:{display:"flex",alignItems:"center",gap:12,marginBottom:20},
  pBox:{flex:1,background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"14px",textAlign:"center"},
  pWin:{borderColor:"#e8751a",background:"#7a3c0d"},
  pName:{fontSize:16,fontWeight:"bold",marginBottom:4},
  pRole:{fontSize:11,color:"#6b7a8a"},
  wBdg:{marginTop:6,fontSize:12,color:"#e8751a"},
  vsCirc:{fontSize:12,fontWeight:"bold",color:"#e8751a",letterSpacing:2,flexShrink:0},
  sec:{borderTop:"1px solid #3a424d",paddingTop:18,marginTop:18},
  secT:{fontSize:10,color:"#404d5c",letterSpacing:2,textTransform:"uppercase",marginBottom:12},
  row:{display:"flex",justifyContent:"space-between",gap:12,padding:"7px 0",borderBottom:"1px solid #2e343c",fontSize:13},
  rK:{color:"#6b7a8a",flexShrink:0},
  rV:{color:"#d4dbe3",textAlign:"right"},
  aBox:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"18px",marginTop:18,display:"flex",flexDirection:"column",gap:10},
  aTitle:{fontSize:15,fontWeight:"bold",color:"#d4dbe3"},
  aSub:{fontSize:13,color:"#6b7a8a"},
  okBtn:{padding:"11px",background:"#2e7d52",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:"bold",cursor:"pointer"},
  badBtn:{padding:"11px",background:"#8b2525",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:"bold",cursor:"pointer"},
  legDetail:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"14px",marginBottom:10},
  logRow:{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #2e343c"},
  logDot:{color:"#e8751a",fontSize:8,marginTop:4,flexShrink:0},
  logA:{fontSize:13,color:"#d4dbe3",marginBottom:2},
  logT:{fontSize:11,color:"#404d5c",fontFamily:"monospace"},
};

const css=`
  *{box-sizing:border-box;}
  .hov:hover{border-color:#e8751a!important;}
  input:focus,select:focus,textarea:focus{border-color:#e8751a!important;}
  @media(max-width:520px){div[style*="grid-template-columns"]{grid-template-columns:1fr!important;}}
`;

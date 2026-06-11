import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config — move these to .env as REACT_APP_SUPA_URL etc. ──────────────────
const SUPA_URL  = process.env.REACT_APP_SUPA_URL  || "https://ciwgianwiltffwdeigpo.supabase.co";
const SUPA_KEY  = process.env.REACT_APP_SUPA_KEY  || "sb_publishable_De_LCVKbIza3eGBtiILLjQ_hM3LYb9F";
const STRIPE_PK = process.env.REACT_APP_STRIPE_PK || "pk_test_51Tfg1kJvqjWYKBEDb35hYcorxBX2WFBttLBCYg1uzBQMmrGJxiSCdn9aCpX59yKJcpajrgZJupxucYhUSEGRfIJS000lUzMGXr";

const h = { "Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${SUPA_KEY}` };

async function signUp(email,password){ const r=await fetch(`${SUPA_URL}/auth/v1/signup`,{method:"POST",headers:h,body:JSON.stringify({email,password})}); return r.json(); }
async function signIn(email,password){ const r=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:h,body:JSON.stringify({email,password})}); return r.json(); }
async function refreshSession(rt){ const r=await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:h,body:JSON.stringify({refresh_token:rt})}); return r.json(); }
async function resetPassword(email){ const r=await fetch(`${SUPA_URL}/auth/v1/recover`,{method:"POST",headers:h,body:JSON.stringify({email})}); return r.json(); }
async function signOut(token){ await fetch(`${SUPA_URL}/auth/v1/logout`,{method:"POST",headers:{...h,"Authorization":`Bearer ${token}`}}); }
async function dbGet(table,token,filter=""){ const r=await fetch(`${SUPA_URL}/rest/v1/${table}?order=created_at.desc${filter}`,{headers:{...h,"Authorization":`Bearer ${token}`}}); return r.json(); }
async function dbInsert(table,token,data){ const r=await fetch(`${SUPA_URL}/rest/v1/${table}`,{method:"POST",headers:{...h,"Authorization":`Bearer ${token}`,"Prefer":"return=representation"},body:JSON.stringify(data)}); return r.json(); }
async function dbUpdate(table,token,id,data){ const r=await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`,{method:"PATCH",headers:{...h,"Authorization":`Bearer ${token}`,"Prefer":"return=representation"},body:JSON.stringify(data)}); return r.json(); }
async function sendNotification(to,subject,message,betId){ try{ await fetch("/api/send-notification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,subject,message,betId})}); }catch(e){ console.log("Notification error:",e); } }

const T = {
  bg:"#1c1f23",surface:"#252a30",panel:"#2e343c",border:"#3a424d",
  orange:"#e8751a",orangeDim:"#7a3c0d",text:"#d4dbe3",
  textDim:"#6b7a8a",textMuted:"#404d5c",green:"#2e7d52",red:"#8b2525",blue:"#1e5a8a",purple:"#5b2d8a",
};

const CATEGORIES = [
  {id:"golf",   label:"Golf"},
  {id:"sports", label:"Sports"},
  {id:"gaming", label:"Gaming"},
  {id:"darts",  label:"Darts"},
  {id:"pool",   label:"Pool"},
  {id:"cards",  label:"Cards"},
  {id:"other",  label:"Other"},
];
const CAT_ICONS = { golf:"ti-golf",sports:"ti-trophy",gaming:"ti-device-gamepad-2",darts:"ti-target",pool:"ti-circle-dot",cards:"ti-cards",other:"ti-dots" };
const CAT_DISPLAY = (id) => { const c=CATEGORIES.find(c=>c.id===id); return c?`${c.label}`:id; };

const STATUS = { PENDING:"pending",AWAITING_P1_AUTH:"awaiting_p1_auth",AWAITING_P2_AUTH:"awaiting_p2_auth",ACTIVE:"active",AWAITING_REF:"awaiting_ref",SETTLING:"settling",SETTLED:"settled",DISPUTED:"disputed" };
const STATUS_COLORS = { pending:"#b87a10",awaiting_p1_auth:"#1e5a8a",awaiting_p2_auth:"#1e5a8a",active:"#2e7d52",awaiting_ref:"#5b2d8a",settling:"#b87a10",settled:"#2e7d52",disputed:"#8b2525" };
const STATUS_LABELS = { pending:"Awaiting Confirm",awaiting_p1_auth:"Card Required",awaiting_p2_auth:"Card Required",active:"Locked & Funded",awaiting_ref:"Ref Review",settling:"Processing",settled:"Settled",disputed:"Disputed" };

function uid(p="BET"){ return `${p}-${Math.random().toString(36).substr(2,6).toUpperCase()}`; }
function fmt(iso){ return new Date(iso).toLocaleString(); }
function now(){ return new Date().toISOString(); }
function initials(email){ return email ? email.substring(0,2).toUpperCase() : "??"; }
function shortEmail(email){ if(!email) return ""; const parts=email.split("@"); return parts[0].length>12 ? parts[0].substring(0,12)+"…" : parts[0]; }

// ─── Category Picker ──────────────────────────────────────────────────────────
function CategoryPicker({value,onChange}){
  return(
    <div style={S.pillRow}>
      {CATEGORIES.map(cat=>{
        const active=value===cat.id;
        return(
          <button key={cat.id} type="button" onClick={()=>onChange(cat.id)}
            style={{...S.catPill,...(active?S.catPillOn:{})}}>
            <i className={`ti ${CAT_ICONS[cat.id]}`} aria-hidden="true"
               style={{fontSize:15,color:active?"#e8751a":"#6b7a8a"}}/>
            <span style={{color:active?"#e8751a":"#6b7a8a"}}>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({title,body,confirmLabel,confirmColor,onConfirm,onCancel}){
  return(
    <div style={S.modalOverlay}>
      <div style={S.modalBox}>
        <div style={S.modalTitle}>{title}</div>
        <div style={S.modalBody}>{body}</div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button style={{...S.okBtn,background:confirmColor||T.red,flex:1}} onClick={onConfirm}>{confirmLabel||"Confirm"}</button>
          <button style={{...S.ghostBtn,flex:1}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Card Auth Form ───────────────────────────────────────────────────────────
function CardAuthForm({bet,session,role,onSuccess,onCancel}){
  const cardRef=useRef(null);
  const stripeRef=useRef(null);
  const cardElementRef=useRef(null);
  const [cardReady,setCardReady]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let mounted=true;
    function init(){ if(!window.Stripe||!cardRef.current){setTimeout(init,100);return;} if(!mounted)return;
      const stripe=window.Stripe(STRIPE_PK); stripeRef.current=stripe;
      const elements=stripe.elements();
      const card=elements.create("card",{style:{base:{color:"#d4dbe3",fontFamily:"Inter,sans-serif",fontSize:"16px","::placeholder":{color:"#6b7a8a"}},invalid:{color:"#e8751a"}}});
      card.mount(cardRef.current);
      card.on("ready",()=>{if(mounted)setCardReady(true);});
      card.on("change",e=>{if(mounted)setError(e.error?e.error.message:"");});
      cardElementRef.current=card;
    }
    init();
    return()=>{ mounted=false; try{if(cardElementRef.current)cardElementRef.current.destroy();}catch(e){} };
  },[]);

  async function handleAuthorize(){
    if(!cardElementRef.current||!stripeRef.current)return;
    setProcessing(true);setError("");
    try{
      const amount=bet.amount||bet.total_stake;
      const r=await fetch("/api/authorize-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,betId:bet.id,email:session.user.email,role,description:bet.description||bet.name})});
      const {clientSecret,paymentIntentId,error:apiError}=await r.json();
      if(apiError){setError(apiError);setProcessing(false);return;}
      const {error:stripeError,paymentIntent}=await stripeRef.current.confirmCardPayment(clientSecret,{payment_method:{card:cardElementRef.current,billing_details:{email:session.user.email}}});
      if(stripeError){setError(stripeError.message);setProcessing(false);return;}
      if(paymentIntent.status==="requires_capture")onSuccess(paymentIntentId);
      else{setError(`Unexpected status: ${paymentIntent.status}`);setProcessing(false);}
    }catch(e){setError(e.message);setProcessing(false);}
  }

  const amount=bet.amount||bet.total_stake;
  return(
    <div style={S.paymentForm}>
      <div style={S.aTitle}>Authorize Card to Lock Bet</div>
      <div style={S.aSub}>A hold of <strong style={{color:T.orange}}>${amount}</strong> will appear on your card.</div>
      <div style={{...S.aSub,color:T.green}}>You are only charged if you LOSE.</div>
      <div style={S.cardBox}><div ref={cardRef} style={{minHeight:24,padding:4}}/></div>
      {error&&<div style={{color:T.red,fontSize:13,padding:"8px 0"}}>{error}</div>}
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.okBtn,opacity:(!cardReady||processing)?0.6:1,flex:1}} onClick={handleAuthorize} disabled={!cardReady||processing}>
          {processing?"Authorizing…":`Authorize $${amount} Hold`}
        </button>
        <button style={S.ghostBtn} onClick={onCancel} disabled={processing}>Cancel</button>
      </div>
      <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>Powered by Stripe. Card details never touch SnoVale servers.</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [session,setSession]=useState(null);
  const [authView,setAuthView]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  const [bets,setBets]=useState([]);
  const [parlays,setParlays]=useState([]);
  const [tab,setTab]=useState("bets");
  const [view,setView]=useState("list");
  const [selected,setSelected]=useState(null);
  const [filter,setFilter]=useState("all");
  const [toast,setToast]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [logOpen,setLogOpen]=useState(false);
  const blankBet={party2_email:"",amount:"",category:"golf",description:"",terms:"",referee_email:""};
  const [betForm,setBetForm]=useState(blankBet);
  const blankParlay={name:"",party2_email:"",totalStake:"",referee_email:""};
  const [parlayForm,setParlayForm]=useState(blankParlay);
  const blankLeg={description:"",category:"golf"};
  const [legs,setLegs]=useState([{...blankLeg}]);
  const [winnerSel,setWinnerSel]=useState("");
  const refreshTimerRef=useRef(null);

  const scheduleRefresh=useCallback((sess)=>{
    if(refreshTimerRef.current)clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current=setTimeout(async()=>{
      try{
        const d=await refreshSession(sess.refresh_token);
        if(d.access_token){
          const next={...sess,access_token:d.access_token,refresh_token:d.refresh_token||sess.refresh_token};
          localStorage.setItem("sb_session",JSON.stringify(next));
          setSession(next);scheduleRefresh(next);
        }else{localStorage.removeItem("sb_session");setSession(null);}
      }catch(e){console.error("Session refresh failed:",e);}
    },55*60*1000);
  },[]);

  useEffect(()=>{
    const saved=localStorage.getItem("sb_session");
    if(saved){const sess=JSON.parse(saved);setSession(sess);scheduleRefresh(sess);}
    return()=>{if(refreshTimerRef.current)clearTimeout(refreshTimerRef.current);};
  },[scheduleRefresh]);

  const [refreshing,setRefreshing]=useState(false);
  const pollRef=useRef(null);

  async function refreshAll(manual=false){
    if(!session)return;
    if(manual)setRefreshing(true);
    await Promise.all([fetchBets(),fetchParlays()]);
    if(manual)setTimeout(()=>setRefreshing(false),600);
  }

  useEffect(()=>{
    if(session){
      fetchBets();fetchParlays();
      pollRef.current=setInterval(()=>{fetchBets();fetchParlays();},15000);
    }
    return()=>{if(pollRef.current)clearInterval(pollRef.current);};
  },[session]);

  function toast_(msg,type="ok"){setToast({msg,type});setTimeout(()=>setToast(null),3200);}

  async function fetchBets(){
    const data=await dbGet("bets",session.access_token,`&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email},referee_email.eq.${session.user.email})`);
    if(Array.isArray(data))setBets(data);
  }
  async function fetchParlays(){
    const data=await dbGet("parlays",session.access_token,`&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email},referee_email.eq.${session.user.email})`);
    if(Array.isArray(data))setParlays(data);
  }

  const REMOVABLE=[STATUS.SETTLED,STATUS.DISPUTED];

  async function hideBet(bet){
    const current=Array.isArray(bet.hidden_by)?bet.hidden_by:[];
    if(current.includes(session.user.id))return;
    await dbUpdate("bets",session.access_token,bet.id,{hidden_by:[...current,session.user.id]});
    fetchBets();setView("list");toast_("Bet removed from your list.");
  }
  async function hideParlay(par){
    const current=Array.isArray(par.hidden_by)?par.hidden_by:[];
    if(current.includes(session.user.id))return;
    await dbUpdate("parlays",session.access_token,par.id,{hidden_by:[...current,session.user.id]});
    fetchParlays();setView("list");toast_("Parlay removed from your list.");
  }

  async function handleAuth(){
    setAuthLoading(true);setAuthError("");
    if(authView==="login"){
      const d=await signIn(email,password);
      if(d.error)setAuthError(d.error.message||d.error);
      else{localStorage.setItem("sb_session",JSON.stringify(d));setSession(d);scheduleRefresh(d);}
    }else{
      const d=await signUp(email,password);
      if(d.error)setAuthError(d.error.message||d.error);
      else setAuthError("Check your email to confirm your account!");
    }
    setAuthLoading(false);
  }

  async function handleReset(){
    if(!email)return setAuthError("Enter your email first.");
    setAuthLoading(true);
    await resetPassword(email);
    setResetSent(true);setAuthLoading(false);
  }

  async function handleLogout(){
    if(refreshTimerRef.current)clearTimeout(refreshTimerRef.current);
    await signOut(session.access_token);
    localStorage.removeItem("sb_session");
    setSession(null);setBets([]);setParlays([]);
  }

  async function createBet(){
    const f=betForm;
    if(!f.party2_email||!f.amount||!f.description)return toast_("Fill all required fields.","err");
    if(f.party2_email.toLowerCase()===session.user.email.toLowerCase())return toast_("Can't bet against yourself.","err");
    const bet={
      id:uid(),party1_id:session.user.id,
      party2_email:f.party2_email.toLowerCase(),
      referee_email:f.referee_email?f.referee_email.toLowerCase():null,
      party1_email:session.user.email,party2_id:null,amount:parseFloat(f.amount),
      category:CAT_DISPLAY(f.category),description:f.description,terms:f.terms,
      status:STATUS.AWAITING_P1_AUTH,winner:null,
      payment_intent_id:null,payment_status:null,
      party1_payment_intent_id:null,party2_payment_intent_id:null,
      party1_payment_authorized:false,party2_payment_authorized:false,
      created_at:now(),
      history:[{action:`Bet created by ${session.user.email}`,time:now()}]
    };
    const inserted=await dbInsert("bets",session.access_token,bet);
    const newBet=Array.isArray(inserted)?inserted[0]:bet;
    setBetForm(blankBet);setSelected(newBet);setView("detailBet");fetchBets();
    toast_("Bet created! Authorize your card to lock it in.");
  }

  async function handleP1CardAuth(bet,paymentIntentId){
    await dbUpdate("bets",session.access_token,bet.id,{
      status:STATUS.PENDING,party1_payment_intent_id:paymentIntentId,party1_payment_authorized:true,
      history:[...bet.history,{action:`${session.user.email} authorized card`,time:now()}]
    });
    await sendNotification(bet.party2_email,`SnoVale — You've been challenged!`,
      `<strong>${session.user.email}</strong> challenged you!<br><strong>Bet:</strong> ${bet.description}<br><strong>Stake:</strong> $${bet.amount}<br>Log in to confirm.`,bet.id);
    fetchBets();setView("list");toast_("Card authorized! Opponent notified.");
  }

  async function confirmBet(bet){
    if(session.user.email.toLowerCase()!==bet.party2_email.toLowerCase())return toast_(`Only ${bet.party2_email} can confirm.`,"err");
    await dbUpdate("bets",session.access_token,bet.id,{
      status:STATUS.AWAITING_P2_AUTH,party2_id:session.user.id,
      history:[...bet.history,{action:`${session.user.email} confirmed — authorizing card`,time:now()}]
    });
    setSelected({...bet,status:STATUS.AWAITING_P2_AUTH,party2_id:session.user.id});
    fetchBets();toast_("Confirmed! Now authorize your card.");
  }

  async function handleP2CardAuth(bet,paymentIntentId){
    await dbUpdate("bets",session.access_token,bet.id,{
      status:STATUS.ACTIVE,party2_payment_intent_id:paymentIntentId,party2_payment_authorized:true,
      history:[...bet.history,{action:`${session.user.email} authorized card — BET LOCKED & FUNDED`,time:now()}]
    });
    fetchBets();setView("list");toast_("Bet fully locked and funded!");
  }

  async function submitOutcome(bet){
    if(!winnerSel)return toast_("Select a winner.","err");
    const winnerEmail=winnerSel==="party1"?session.user.email:bet.party2_email;
    const loserEmail=winnerSel==="party1"?bet.party2_email:session.user.email;
    if(bet.referee_email){
      await dbUpdate("bets",session.access_token,bet.id,{
        status:STATUS.AWAITING_REF,winner:winnerEmail,
        history:[...bet.history,{action:`Outcome submitted: ${winnerEmail} wins — awaiting referee`,time:now()}]
      });
      await sendNotification(bet.referee_email,`SnoVale — Referee action required`,`Outcome submitted: ${winnerEmail} wins $${bet.amount}. Log in to confirm.`,bet.id);
      toast_("Submitted! Referee notified.");
    }else{ await settleWithCapture(bet,winnerEmail,loserEmail); }
    fetchBets();setWinnerSel("");setView("list");
  }

  async function settleWithCapture(bet,winnerEmail,loserEmail){
    const isParty1Winner=winnerEmail!==bet.party2_email;
    const loserIntentId=isParty1Winner?bet.party2_payment_intent_id:bet.party1_payment_intent_id;
    const winnerIntentId=isParty1Winner?bet.party1_payment_intent_id:bet.party2_payment_intent_id;
    await dbUpdate("bets",session.access_token,bet.id,{status:STATUS.SETTLING,winner:winnerEmail,history:[...bet.history,{action:`Processing payment…`,time:now()}]});
    try{
      const r=await fetch("/api/capture-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({loserPaymentIntentId:loserIntentId,winnerPaymentIntentId:winnerIntentId,amount:bet.amount})});
      const result=await r.json();
      if(result.error)throw new Error(result.error);
      await dbUpdate("bets",session.access_token,bet.id,{status:STATUS.SETTLED,winner:winnerEmail,payment_status:"captured",history:[...bet.history,{action:`${winnerEmail} wins $${bet.amount}! Payment captured.`,time:now()}]});
      await sendNotification(winnerEmail,`SnoVale — You won!`,`You won $${bet.amount}! Payment processed.`,bet.id);
      await sendNotification(loserEmail,`SnoVale — Bet Settled`,`${winnerEmail} won. Your card was charged $${bet.amount}.`,bet.id);
      toast_(`${winnerEmail} wins! Payment processed.`);
    }catch(e){
      await dbUpdate("bets",session.access_token,bet.id,{status:STATUS.DISPUTED,history:[...bet.history,{action:`Payment failed: ${e.message}`,time:now()}]});
      toast_("Payment failed — flagged for review.","err");
    }
    fetchBets();
  }

  async function refereeConfirm(bet){
    if(session.user.email.toLowerCase()!==bet.referee_email?.toLowerCase())return toast_("Only the referee can confirm.","err");
    const loserEmail=bet.winner===bet.party2_email?session.user.email:bet.party2_email;
    await settleWithCapture(bet,bet.winner,loserEmail);fetchBets();setView("list");
  }
  async function refereeOverride(bet){
    if(session.user.email.toLowerCase()!==bet.referee_email?.toLowerCase())return toast_("Only the referee can override.","err");
    const newWinner=bet.winner===bet.party2_email?session.user.email:bet.party2_email;
    const loserEmail=newWinner===session.user.email?bet.party2_email:session.user.email;
    await settleWithCapture({...bet,winner:newWinner},newWinner,loserEmail);fetchBets();setView("list");
  }

  function triggerDispute(bet){
    setConfirm({
      title:"Release All Holds?",
      body:"This will release both card holds permanently. This action cannot be undone.",
      confirmLabel:"Yes, Release Holds",
      confirmColor:T.red,
      onConfirm:async()=>{ setConfirm(null); await disputeBet(bet); }
    });
  }
  async function disputeBet(bet){
    const ids=[bet.party1_payment_intent_id,bet.party2_payment_intent_id].filter(Boolean);
    if(ids.length>0){ try{await fetch("/api/release-hold",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentIntentIds:ids})});}catch(e){console.error(e);} }
    await dbUpdate("bets",session.access_token,bet.id,{status:STATUS.DISPUTED,history:[...bet.history,{action:"DISPUTED — all holds released.",time:now()}]});
    fetchBets();setView("list");toast_("Disputed — holds released.","err");
  }

  async function createParlay(){
    const f=parlayForm;
    if(!f.party2_email||!f.totalStake||legs.length<2)return toast_("Need opponent, stake, and 2+ legs.","err");
    if(legs.some(l=>!l.description))return toast_("All legs need a description.","err");
    const parlay={
      id:uid("PAR"),party1_id:session.user.id,
      party2_email:f.party2_email.toLowerCase(),
      referee_email:f.referee_email?f.referee_email.toLowerCase():null,
      party1_email:session.user.email,party2_id:null,
      name:f.name||`${session.user.email} vs ${f.party2_email} Parlay`,
      total_stake:parseFloat(f.totalStake),
      legs:legs.map((l,i)=>({...l,category:CAT_DISPLAY(l.category),id:i,winner:null,settled:false})),
      status:STATUS.AWAITING_P1_AUTH,overall_winner:null,
      payment_intent_id:null,payment_status:null,
      party1_payment_intent_id:null,party2_payment_intent_id:null,
      party1_payment_authorized:false,party2_payment_authorized:false,
      created_at:now(),
      history:[{action:`Parlay created by ${session.user.email}`,time:now()}]
    };
    const inserted=await dbInsert("parlays",session.access_token,parlay);
    const newParlay=Array.isArray(inserted)?inserted[0]:parlay;
    setParlayForm(blankParlay);setLegs([{...blankLeg}]);
    setSelected(newParlay);setView("detailParlay");setTab("parlays");fetchParlays();
    toast_("Parlay created! Authorize your card.");
  }

  async function handleP1ParlayCardAuth(par,paymentIntentId){
    await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.PENDING,party1_payment_intent_id:paymentIntentId,party1_payment_authorized:true,history:[...par.history,{action:`${session.user.email} authorized card`,time:now()}]});
    await sendNotification(par.party2_email,`SnoVale — You've been challenged to a Parlay!`,`${session.user.email} challenged you to a ${par.legs.length}-leg parlay! Stake: $${par.total_stake}. Log in to confirm.`,par.id);
    fetchParlays();setView("list");toast_("Card authorized! Opponent notified.");
  }
  async function confirmParlay(par){
    if(session.user.email.toLowerCase()!==par.party2_email.toLowerCase())return toast_(`Only ${par.party2_email} can confirm.`,"err");
    await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.AWAITING_P2_AUTH,party2_id:session.user.id,history:[...par.history,{action:`${session.user.email} confirmed — authorizing card`,time:now()}]});
    setSelected({...par,status:STATUS.AWAITING_P2_AUTH,party2_id:session.user.id});fetchParlays();toast_("Confirmed! Authorize your card.");
  }
  async function handleP2ParlayCardAuth(par,paymentIntentId){
    await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.ACTIVE,party2_payment_intent_id:paymentIntentId,party2_payment_authorized:true,history:[...par.history,{action:`${session.user.email} authorized card — PARLAY LOCKED & FUNDED`,time:now()}]});
    fetchParlays();setView("list");toast_("Parlay fully locked and funded!");
  }

  async function settleLeg(par,legId,winner){
    const updatedLegs=par.legs.map(l=>l.id===legId?{...l,winner,settled:true}:l);
    const allSettled=updatedLegs.every(l=>l.settled);
    let overallWinner=null;let newStatus=par.status;
    if(allSettled){
      const p1Wins=updatedLegs.every(l=>l.winner==="party1");
      const p2Wins=updatedLegs.every(l=>l.winner==="party2");
      overallWinner=p1Wins?session.user.email:p2Wins?par.party2_email:"SPLIT";
      newStatus=par.referee_email?STATUS.AWAITING_REF:STATUS.SETTLING;
    }
    const logEntry={action:`Leg ${legId+1}: ${winner==="party1"?session.user.email:par.party2_email} wins`,time:now()};
    const finalLog=allSettled?[...par.history,logEntry,{action:`All legs done`,time:now()}]:[...par.history,logEntry];
    await dbUpdate("parlays",session.access_token,par.id,{legs:updatedLegs,overall_winner:overallWinner,status:newStatus,history:finalLog});
    if(allSettled&&!par.referee_email&&overallWinner!=="SPLIT"){
      const isP1Win=overallWinner!==par.party2_email;
      try{
        await fetch("/api/capture-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({loserPaymentIntentId:isP1Win?par.party2_payment_intent_id:par.party1_payment_intent_id,winnerPaymentIntentId:isP1Win?par.party1_payment_intent_id:par.party2_payment_intent_id,amount:par.total_stake})});
        await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.SETTLED,payment_status:"captured",history:[...finalLog,{action:`${overallWinner} wins $${par.total_stake}!`,time:now()}]});
        toast_(`Parlay settled! ${overallWinner} wins!`);
      }catch(e){toast_("Payment error.","err");}
    }else if(allSettled&&overallWinner==="SPLIT"){
      const ids=[par.party1_payment_intent_id,par.party2_payment_intent_id].filter(Boolean);
      await fetch("/api/release-hold",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentIntentIds:ids})});
      await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.SETTLED,history:[...finalLog,{action:`Split — holds released.`,time:now()}]});
      toast_("Split parlay — holds released.");
    }else if(allSettled&&par.referee_email){
      await sendNotification(par.referee_email,`SnoVale — Referee action required`,`All legs settled. ${overallWinner} wins $${par.total_stake}. Log in to confirm.`,par.id);
      toast_("All legs done! Referee notified.");
    }else{ toast_(`Leg ${legId+1} settled.`); }
    fetchParlays();
  }

  async function refereeConfirmParlay(par){
    if(session.user.email.toLowerCase()!==par.referee_email?.toLowerCase())return toast_("Only the referee can confirm.","err");
    const isP1Win=par.overall_winner!==par.party2_email;
    try{
      await fetch("/api/capture-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({loserPaymentIntentId:isP1Win?par.party2_payment_intent_id:par.party1_payment_intent_id,winnerPaymentIntentId:isP1Win?par.party1_payment_intent_id:par.party2_payment_intent_id,amount:par.total_stake})});
      await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.SETTLED,payment_status:"captured",history:[...par.history,{action:`Referee confirmed! ${par.overall_winner} wins $${par.total_stake}.`,time:now()}]});
      fetchParlays();setView("list");toast_("Referee confirmed! Payment processed.");
    }catch(e){toast_("Payment error.","err");}
  }

  function triggerDisputeParlay(par){
    setConfirm({
      title:"Release All Holds?",
      body:"This will release both card holds permanently. This action cannot be undone.",
      confirmLabel:"Yes, Release Holds",
      confirmColor:T.red,
      onConfirm:async()=>{ setConfirm(null); await disputeParlay(par); }
    });
  }
  async function disputeParlay(par){
    const ids=[par.party1_payment_intent_id,par.party2_payment_intent_id].filter(Boolean);
    if(ids.length>0)await fetch("/api/release-hold",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentIntentIds:ids})});
    await dbUpdate("parlays",session.access_token,par.id,{status:STATUS.DISPUTED,history:[...par.history,{action:"DISPUTED — holds released.",time:now()}]});
    fetchParlays();setView("list");toast_("Disputed — holds released.","err");
  }

  const myEmail=session?.user?.email?.toLowerCase();
  const uid_=session?.user?.id;
  const activeStake=[
    ...bets.filter(b=>[STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLING].includes(b.status)).map(b=>b.amount),
    ...parlays.filter(p=>[STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLING].includes(p.status)).map(p=>p.total_stake)
  ].reduce((s,v)=>s+v,0);
  const totalWins=bets.filter(b=>b.status===STATUS.SETTLED&&b.winner===myEmail).length+parlays.filter(p=>p.status===STATUS.SETTLED&&p.overall_winner===myEmail).length;

  const ACTIVE_STATUSES=[STATUS.AWAITING_P1_AUTH,STATUS.PENDING,STATUS.AWAITING_P2_AUTH,STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLING];
  const END_STATUSES=[STATUS.SETTLED,STATUS.DISPUTED];

  // visible = not hidden by this user
  const visibleBets=bets.filter(b=>!b.hidden_by?.includes(uid_));
  const visibleParlays=parlays.filter(p=>!p.hidden_by?.includes(uid_));

  // "All" shows only open/active bets — settled+disputed live in their own filter
  const filteredBets=filter==="all"
    ?visibleBets.filter(b=>ACTIVE_STATUSES.includes(b.status))
    :visibleBets.filter(b=>b.status===filter);
  const filteredParlays=filter==="all"
    ?visibleParlays.filter(p=>ACTIVE_STATUSES.includes(p.status))
    :visibleParlays.filter(p=>p.status===filter);

  // counts for tab badges — only visible, only open
  const openBetCount=visibleBets.filter(b=>ACTIVE_STATUSES.includes(b.status)).length;
  const openParlayCount=visibleParlays.filter(p=>ACTIVE_STATUSES.includes(p.status)).length;

  // ── Auth Screen ─────────────────────────────────────────────────────────────
  if(!session) return(
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <style>{css}</style>
      <div style={S.authCard}>
        <div style={{textAlign:"center",marginBottom:8}}>
          <i className="ti ti-mountain" style={{fontSize:44,color:T.orange}} aria-hidden="true"/>
          <div style={{fontSize:26,fontWeight:"700",letterSpacing:2,color:T.orange,marginTop:4}}>SnoVale</div>
          <div style={{fontSize:11,color:T.textDim,letterSpacing:2,textTransform:"uppercase"}}>Side Bet Tracker</div>
        </div>
        {resetSent?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <i className="ti ti-mail-check" style={{fontSize:36,color:T.green}} aria-hidden="true"/>
            <div style={{color:T.green,marginTop:8,fontSize:14}}>Reset link sent — check your email.</div>
            <button style={{...S.ghostBtn,marginTop:16,width:"100%"}} onClick={()=>{setResetSent(false);setAuthView("login");}}>Back to Login</button>
          </div>
        ):(
          <>
            <div style={S.authTabs}>
              <button style={{...S.authTab,...(authView==="login"?S.authTabOn:{})}} onClick={()=>setAuthView("login")}>Login</button>
              <button style={{...S.authTab,...(authView==="signup"?S.authTabOn:{})}} onClick={()=>setAuthView("signup")}>Sign Up</button>
            </div>
            <input style={S.input} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>
            <input style={S.input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
            {authError&&<div style={{fontSize:13,color:authError.includes("Check")?T.green:T.red}}>{authError}</div>}
            <button style={S.subBtn} onClick={handleAuth} disabled={authLoading}>{authLoading?"…":authView==="login"?"Login →":"Create Account →"}</button>
            {authView==="login"&&(
              <button style={{background:"none",border:"none",color:T.textDim,fontSize:12,cursor:"pointer",textDecoration:"underline",padding:"4px 0"}} onClick={handleReset}>
                Forgot password?
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const currentBet=selected?(bets.find(b=>b.id===selected.id)||selected):null;
  const currentPar=selected?(parlays.find(p=>p.id===selected.id)||selected):null;

  return(
    <div style={S.root}>
      <style>{css}</style>
      {confirm&&<ConfirmModal {...confirm} onCancel={()=>setConfirm(null)}/>}
      {toast&&<div style={{...S.toast,background:toast.type==="err"?T.red:"#1c3d28"}}>{toast.msg}</div>}

      <header style={S.header}>
        <div style={S.logo}>
          <i className="ti ti-mountain" style={{fontSize:22,color:T.orange}} aria-hidden="true"/>
          <div>
            <div style={{fontSize:18,fontWeight:"700",letterSpacing:2,color:T.orange,lineHeight:1.1}}>SnoVale</div>
            <div style={{fontSize:9,color:T.textDim,letterSpacing:2,textTransform:"uppercase"}}>Side Bet Tracker</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={S.stats}>
            {[
              {l:"Active",v:bets.filter(b=>b.status===STATUS.ACTIVE).length+parlays.filter(p=>p.status===STATUS.ACTIVE).length},
              {l:"In Play",v:`$${activeStake.toFixed(2)}`},
              {l:"Wins",v:totalWins},
            ].map(s=>(
              <div key={s.l} style={S.stat}><span style={S.statN}>{s.v}</span><span style={S.statL}>{s.l}</span></div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <div style={{fontSize:11,color:T.textDim,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{myEmail}</div>
            <button style={S.logoutBtn} onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {/* ── List View ── */}
      {view==="list"&&(
        <div style={S.page}>
          <div style={S.tabRow}>
            <button style={{...S.tab,...(tab==="bets"?S.tabOn:{})}} onClick={()=>{setTab("bets");setFilter("all");}}>
              Bets <span style={S.tabCt}>{openBetCount}</span>
            </button>
            <button style={{...S.tab,...(tab==="parlays"?S.tabOn:{})}} onClick={()=>{setTab("parlays");setFilter("all");}}>
              Parlays <span style={S.tabCt}>{openParlayCount}</span>
            </button>
          </div>
          <div style={S.toolbar}>
            <div style={S.filters}>
              {[
                {f:"all",           label:"Open"},
                {f:STATUS.ACTIVE,   label:"Funded"},
                {f:STATUS.PENDING,  label:"Pending"},
                {f:STATUS.AWAITING_REF, label:"Ref Review"},
                {f:STATUS.SETTLED,  label:"Settled"},
                {f:STATUS.DISPUTED, label:"Disputed"},
              ].map(({f,label})=>(
                <button key={f} onClick={e=>{setFilter(f);e.currentTarget.blur();}} style={{...S.fBtn,...(filter===f?S.fBtnOn:{})}}>{label}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button style={S.refreshBtn} onClick={()=>refreshAll(true)} title="Refresh">
                <i className={`ti ti-refresh${refreshing?" spin":""}`} style={{fontSize:15}} aria-hidden="true"/>
              </button>
              <button style={S.newBtn} onClick={()=>setView(tab==="bets"?"createBet":"createParlay")}>
                <i className="ti ti-plus" aria-hidden="true"/> New {tab==="bets"?"Bet":"Parlay"}
              </button>
            </div>
          </div>
          {tab==="bets"&&(filteredBets.length===0
            ?<Empty label={filter==="all"?"No open bets.":filter===STATUS.SETTLED?"No settled bets.":filter===STATUS.DISPUTED?"No disputed bets.":"No bets here."} cta={filter==="all"?"Tap + New Bet to challenge someone.":undefined}/>
            :<div style={S.list}>{filteredBets.map(b=><BetCard key={b.id} bet={b} myEmail={myEmail} onClick={()=>{setSelected(b);setView("detailBet");}}/>)}</div>
          )}
          {tab==="parlays"&&(filteredParlays.length===0
            ?<Empty label={filter==="all"?"No open parlays.":filter===STATUS.SETTLED?"No settled parlays.":filter===STATUS.DISPUTED?"No disputed parlays.":"No parlays here."} cta={filter==="all"?"Tap + New Parlay to set up a multi-leg bet.":undefined}/>
            :<div style={S.list}>{filteredParlays.map(p=><ParlayCard key={p.id} par={p} myEmail={myEmail} onClick={()=>{setSelected(p);setView("detailParlay");}}/>)}</div>
          )}
        </div>
      )}

      {/* ── Create Bet ── */}
      {view==="createBet"&&(
        <div style={S.page}><Back onClick={()=>setView("list")}/>
          <div style={S.card}>
            <div style={S.cardTitle}>New Single Bet</div>
            <div style={S.g2}>
              <F label="Your Email" full><input style={{...S.input,opacity:0.6}} value={myEmail} disabled/></F>
              <F label="Opponent Email *" full><input style={S.input} type="email" placeholder="opponent@email.com" value={betForm.party2_email} onChange={e=>setBetForm({...betForm,party2_email:e.target.value})}/></F>
              <F label="Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={betForm.amount} onChange={e=>setBetForm({...betForm,amount:e.target.value})}/></F>
            </div>
            <div style={{height:14}}/>
            <F label="Category"><CategoryPicker value={betForm.category} onChange={v=>setBetForm({...betForm,category:v})}/></F>
            <div style={{height:14}}/>
            <div style={S.g2}>
              <F label="What's the Bet? *" full><input style={S.input} placeholder="e.g. Back 9 lowest score wins" value={betForm.description} onChange={e=>setBetForm({...betForm,description:e.target.value})}/></F>
              <F label="Terms / Notes" full><textarea style={{...S.input,height:72,resize:"vertical"}} placeholder="Handicaps, rules, tiebreakers…" value={betForm.terms} onChange={e=>setBetForm({...betForm,terms:e.target.value})}/></F>
            </div>
            <div style={S.sectionDivider}>Referee <span style={{fontWeight:"normal",color:T.textDim,fontSize:11}}>(Optional)</span></div>
            <div style={S.refBox}>
              <div style={S.refInfo}>A neutral third party who confirms the outcome before payment captures.</div>
              <F label="Referee Email"><input style={S.input} type="email" placeholder="referee@email.com" value={betForm.referee_email} onChange={e=>setBetForm({...betForm,referee_email:e.target.value})}/></F>
            </div>
            <div style={S.note}>Both parties authorize a card hold. Loser is charged automatically — winner receives the full stake.</div>
            <button style={S.subBtn} onClick={createBet}>Create Bet & Authorize Card →</button>
          </div>
        </div>
      )}

      {/* ── Create Parlay ── */}
      {view==="createParlay"&&(
        <div style={S.page}><Back onClick={()=>setView("list")}/>
          <div style={S.card}>
            <div style={S.cardTitle}>New Parlay</div>
            <div style={S.info}>All legs must be won by the same person. Both parties authorize cards upfront.</div>
            <div style={S.g2}>
              <F label="Parlay Name"><input style={S.input} placeholder="e.g. Sunday Sweep" value={parlayForm.name} onChange={e=>setParlayForm({...parlayForm,name:e.target.value})}/></F>
              <F label="Total Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={parlayForm.totalStake} onChange={e=>setParlayForm({...parlayForm,totalStake:e.target.value})}/></F>
              <F label="Your Email" full><input style={{...S.input,opacity:0.6}} value={myEmail} disabled/></F>
              <F label="Opponent Email *" full><input style={S.input} type="email" placeholder="opponent@email.com" value={parlayForm.party2_email} onChange={e=>setParlayForm({...parlayForm,party2_email:e.target.value})}/></F>
            </div>
            <div style={S.sectionDivider}>Referee <span style={{fontWeight:"normal",color:T.textDim,fontSize:11}}>(Optional)</span></div>
            <div style={S.refBox}>
              <div style={S.refInfo}>A neutral third party who confirms the final outcome.</div>
              <F label="Referee Email"><input style={S.input} type="email" placeholder="referee@email.com" value={parlayForm.referee_email} onChange={e=>setParlayForm({...parlayForm,referee_email:e.target.value})}/></F>
            </div>
            <div style={S.legsHdr}>
              <span style={{fontWeight:"600",color:T.text}}>Legs ({legs.length})</span>
              <button style={S.addLeg} onClick={()=>setLegs(p=>[...p,{...blankLeg}])}>+ Add Leg</button>
            </div>
            {legs.map((leg,i)=>(
              <div key={i} style={S.legCard}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <span style={{fontSize:12,color:T.orange,fontWeight:"600"}}>Leg {i+1}</span>
                  {legs.length>2&&<button style={{background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:16}} onClick={()=>setLegs(p=>p.filter((_,idx)=>idx!==i))}>×</button>}
                </div>
                <F label="Category"><CategoryPicker value={leg.category} onChange={v=>setLegs(p=>p.map((l,idx)=>idx===i?{...l,category:v}:l))}/></F>
                <div style={{height:10}}/>
                <F label="Description *" full><input style={S.input} placeholder="e.g. Front 9 lowest score" value={leg.description} onChange={e=>setLegs(p=>p.map((l,idx)=>idx===i?{...l,description:e.target.value}:l))}/></F>
              </div>
            ))}
            <div style={S.note}>Loser is charged automatically — winner receives the full stake.</div>
            <button style={S.subBtn} onClick={createParlay}>Create Parlay & Authorize Card →</button>
          </div>
        </div>
      )}

      {/* ── Bet Detail ── */}
      {view==="detailBet"&&currentBet&&(()=>{
        const bet=currentBet;
        const isParty1=bet.party1_id===session.user.id;
        const isParty2=myEmail===bet.party2_email?.toLowerCase();
        const isRef=myEmail===bet.referee_email?.toLowerCase();
        const needsP1Auth=bet.status===STATUS.AWAITING_P1_AUTH&&isParty1;
        const needsP2Auth=bet.status===STATUS.AWAITING_P2_AUTH&&isParty2;
        return(
          <div style={S.page}><Back onClick={()=>setView("list")}/>
            <div style={S.card}>
              <DHeader id={bet.id} cat={bet.category} status={bet.status}/>
              {bet.referee_email&&<div style={S.refBadge}><i className="ti ti-scale" style={{fontSize:12,marginRight:4}} aria-hidden="true"/>Refereed by {bet.referee_email}</div>}
              <Pot amount={`$${bet.amount}`} label="Pot" sub="Both cards authorized · Auto settlement"/>
              <div style={S.parties}>
                <div style={{...S.pBox,...(bet.winner===session.user.email&&isParty1?S.pWin:{})}}>
                  <div style={S.pAvatar}>{initials(isParty1?session.user.email:bet.party1_email)}</div>
                  <div style={S.pName}>{shortEmail(isParty1?session.user.email:bet.party1_email)}</div>
                  <div style={S.pRole}>Creator</div>
                  <div style={{fontSize:11,color:bet.party1_payment_authorized?T.green:T.textDim,marginTop:4}}>{bet.party1_payment_authorized?"Authorized":"Pending"}</div>
                  {bet.winner===session.user.email&&isParty1&&<div style={S.wBdg}>Winner</div>}
                </div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(bet.winner===bet.party2_email?S.pWin:{})}}>
                  <div style={S.pAvatar}>{initials(bet.party2_email)}</div>
                  <div style={S.pName}>{shortEmail(bet.party2_email)}</div>
                  <div style={S.pRole}>{bet.party2_id?"Confirmed":"Pending"}</div>
                  <div style={{fontSize:11,color:bet.party2_payment_authorized?T.green:T.textDim,marginTop:4}}>{bet.party2_payment_authorized?"Authorized":"Pending"}</div>
                  {bet.winner===bet.party2_email&&<div style={S.wBdg}>Winner</div>}
                </div>
              </div>
              <Sec title="Details">
                <Row k="Description" v={bet.description}/>
                {bet.terms&&<Row k="Terms" v={bet.terms}/>}
                <Row k="Created" v={fmt(bet.created_at)}/>
                {bet.referee_email&&<Row k="Referee" v={bet.referee_email}/>}
                {bet.payment_status&&<Row k="Payment" v={bet.payment_status==="captured"?"Captured":"Processing"}/>}
              </Sec>
              {needsP1Auth&&<CardAuthForm bet={bet} session={session} role="party1" onSuccess={pid=>handleP1CardAuth(bet,pid)} onCancel={()=>setView("list")}/>}
              {bet.status===STATUS.AWAITING_P1_AUTH&&!isParty1&&<ABox color={T.blue}><div style={S.aTitle}>Awaiting creator's card authorization</div></ABox>}
              {bet.status===STATUS.PENDING&&isParty2&&(
                <ABox color={T.orange}>
                  <div style={S.aTitle}>You've been challenged!</div>
                  <div style={S.aSub}><strong>{bet.description}</strong> · ${bet.amount} stake</div>
                  <div style={S.aSub}>You're only charged if you lose.</div>
                  <button style={S.okBtn} onClick={()=>confirmBet(bet)}>Accept & Authorize Card →</button>
                </ABox>
              )}
              {bet.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>Waiting for {bet.party2_email}</div><div style={S.aSub}>Your card is authorized. Waiting for opponent to confirm.</div></ABox>}
              {needsP2Auth&&<CardAuthForm bet={bet} session={session} role="party2" onSuccess={pid=>handleP2CardAuth(bet,pid)} onCancel={()=>setView("list")}/>}
              {bet.status===STATUS.AWAITING_P2_AUTH&&!isParty2&&<ABox color={T.blue}><div style={S.aTitle}>Opponent authorizing card…</div></ABox>}
              {bet.status===STATUS.ACTIVE&&(isParty1||isParty2)&&(
                <ABox color={T.green}>
                  <div style={S.aTitle}>Bet Funded — Submit Outcome</div>
                  <div style={S.aSub}>Both cards authorized. Loser charged automatically.</div>
                  {bet.referee_email&&<div style={S.aSub}>Referee confirms before payment captures.</div>}
                  <select style={S.input} value={winnerSel} onChange={e=>setWinnerSel(e.target.value)}>
                    <option value="">— Select Winner —</option>
                    <option value="party1">{isParty1?"You ("+shortEmail(session.user.email)+")":shortEmail(bet.party1_email)}</option>
                    <option value="party2">{isParty2?"You ("+shortEmail(session.user.email)+")":shortEmail(bet.party2_email)}</option>
                  </select>
                  <div style={{display:"flex",gap:10}}>
                    <button style={{...S.okBtn,flex:1}} onClick={()=>submitOutcome(bet)}>Submit Outcome</button>
                    <button style={S.badBtn} onClick={()=>triggerDispute(bet)}>Dispute</button>
                  </div>
                </ABox>
              )}
              {bet.status===STATUS.AWAITING_REF&&isRef&&<ABox color={T.purple}><div style={S.aTitle}>Confirm & Trigger Payment</div><div style={S.aSub}><strong style={{color:T.orange}}>{bet.winner}</strong> wins ${bet.amount}</div><div style={{display:"flex",gap:10}}><button style={S.okBtn} onClick={()=>refereeConfirm(bet)}>Confirm</button><button style={S.badBtn} onClick={()=>refereeOverride(bet)}>Override</button></div></ABox>}
              {bet.status===STATUS.AWAITING_REF&&!isRef&&<ABox color={T.purple}><div style={S.aTitle}>Awaiting Referee</div><div style={S.aSub}>{bet.referee_email} has been notified.</div></ABox>}
              {bet.status===STATUS.SETTLING&&<ABox color={T.orange}><div style={S.aTitle}>Processing Payment…</div></ABox>}
              {bet.status===STATUS.SETTLED&&<ABox color={T.green}><div style={S.aTitle}>Settled</div><div style={S.aSub}>{bet.winner} wins ${bet.amount}! Auto-processed.</div></ABox>}
              {bet.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>Disputed — Holds Released</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <CollapsibleLog history={bet.history} open={logOpen} onToggle={()=>setLogOpen(v=>!v)}/>
              {REMOVABLE.includes(bet.status)&&(isParty1||isParty2)&&(
                <div style={{marginTop:16,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
                  <button style={S.removeBtn} onClick={()=>setConfirm({
                    title:"Remove from your list?",
                    body:"This hides the bet from your view only. The other party's view is unaffected. This cannot be undone.",
                    confirmLabel:"Remove",
                    confirmColor:T.textMuted,
                    onConfirm:()=>{setConfirm(null);hideBet(bet);}
                  })}>
                    <i className="ti ti-trash" style={{fontSize:14}} aria-hidden="true"/> Remove from my list
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Parlay Detail ── */}
      {view==="detailParlay"&&currentPar&&(()=>{
        const par=currentPar;
        const isParty1=par.party1_id===session.user.id;
        const isParty2=myEmail===par.party2_email?.toLowerCase();
        const isRef=myEmail===par.referee_email?.toLowerCase();
        const needsP1Auth=par.status===STATUS.AWAITING_P1_AUTH&&isParty1;
        const needsP2Auth=par.status===STATUS.AWAITING_P2_AUTH&&isParty2;
        const sc=par.legs.filter(l=>l.settled).length;
        return(
          <div style={S.page}><Back onClick={()=>setView("list")}/>
            <div style={S.card}>
              <DHeader id={par.id} cat={`${par.legs.length}-Leg Parlay`} status={par.status}/>
              {par.referee_email&&<div style={S.refBadge}><i className="ti ti-scale" style={{fontSize:12,marginRight:4}} aria-hidden="true"/>Refereed by {par.referee_email}</div>}
              {par.name&&<div style={{fontSize:13,color:T.textDim,marginBottom:16,fontStyle:"italic"}}>{par.name}</div>}
              <Pot amount={`$${par.total_stake}`} label="Parlay Pot" sub={`${sc}/${par.legs.length} legs · Auto settlement`}/>
              <div style={S.parties}>
                <div style={{...S.pBox,...(par.overall_winner===myEmail?S.pWin:{})}}>
                  <div style={S.pAvatar}>{initials(isParty1?session.user.email:par.party2_email)}</div>
                  <div style={S.pName}>{shortEmail(isParty1?session.user.email:par.party1_email)}</div>
                  <div style={S.pRole}>Creator</div>
                  <div style={{fontSize:11,color:par.party1_payment_authorized?T.green:T.textDim,marginTop:4}}>{par.party1_payment_authorized?"Authorized":"Pending"}</div>
                </div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(par.overall_winner===par.party2_email?S.pWin:{})}}>
                  <div style={S.pAvatar}>{initials(par.party2_email)}</div>
                  <div style={S.pName}>{shortEmail(par.party2_email)}</div>
                  <div style={S.pRole}>{par.party2_id?"Confirmed":"Pending"}</div>
                  <div style={{fontSize:11,color:par.party2_payment_authorized?T.green:T.textDim,marginTop:4}}>{par.party2_payment_authorized?"Authorized":"Pending"}</div>
                </div>
              </div>
              <Sec title={`Legs (${par.legs.length})`}>
                {par.legs.map((leg,i)=>(
                  <div key={leg.id} style={{...S.legDetail,borderColor:leg.settled?T.border:T.orange}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:T.orange,fontWeight:"600"}}>Leg {i+1} — {leg.category}</span>
                      {leg.settled?<span style={{...S.badge,background:T.green}}>Won</span>:<span style={{...S.badge,background:T.textMuted}}>Pending</span>}
                    </div>
                    <div style={{fontSize:13,color:T.textDim,fontStyle:"italic"}}>{leg.description}</div>
                    {par.status===STATUS.ACTIVE&&!leg.settled&&(isParty1||isParty2)&&<LegSettler leg={leg} par={par} onSettle={(id,w)=>settleLeg(par,id,w)}/>}
                  </div>
                ))}
              </Sec>
              {needsP1Auth&&<CardAuthForm bet={par} session={session} role="party1" onSuccess={pid=>handleP1ParlayCardAuth(par,pid)} onCancel={()=>setView("list")}/>}
              {par.status===STATUS.AWAITING_P1_AUTH&&!isParty1&&<ABox color={T.blue}><div style={S.aTitle}>Creator authorizing card</div></ABox>}
              {par.status===STATUS.PENDING&&isParty2&&<ABox color={T.orange}><div style={S.aTitle}>You've been challenged to a Parlay!</div><div style={S.aSub}>{par.name} · ${par.total_stake} · {par.legs.length} legs</div><button style={S.okBtn} onClick={()=>confirmParlay(par)}>Accept & Authorize Card →</button></ABox>}
              {par.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>Waiting for {par.party2_email}</div></ABox>}
              {needsP2Auth&&<CardAuthForm bet={par} session={session} role="party2" onSuccess={pid=>handleP2ParlayCardAuth(par,pid)} onCancel={()=>setView("list")}/>}
              {par.status===STATUS.AWAITING_P2_AUTH&&!isParty2&&<ABox color={T.blue}><div style={S.aTitle}>Opponent authorizing card…</div></ABox>}
              {par.status===STATUS.ACTIVE&&sc<par.legs.length&&(isParty1||isParty2)&&<div style={{textAlign:"right",marginTop:12}}><button style={S.badBtn} onClick={()=>triggerDisputeParlay(par)}>Flag Dispute</button></div>}
              {par.status===STATUS.AWAITING_REF&&isRef&&<ABox color={T.purple}><div style={S.aTitle}>Confirm & Capture</div><div style={S.aSub}>{par.overall_winner} wins ${par.total_stake}</div><button style={S.okBtn} onClick={()=>refereeConfirmParlay(par)}>Confirm</button></ABox>}
              {par.status===STATUS.AWAITING_REF&&!isRef&&<ABox color={T.purple}><div style={S.aTitle}>Awaiting Referee</div></ABox>}
              {par.status===STATUS.SETTLING&&<ABox color={T.orange}><div style={S.aTitle}>Processing Payment…</div></ABox>}
              {par.status===STATUS.SETTLED&&<ABox color={T.green}><div style={S.aTitle}>Parlay Settled</div><div style={S.aSub}>{par.overall_winner?.includes("SPLIT")?"Split — holds released.":`${par.overall_winner} wins $${par.total_stake}!`}</div></ABox>}
              {par.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>Disputed — Holds Released</div></ABox>}
              <CollapsibleLog history={par.history} open={logOpen} onToggle={()=>setLogOpen(v=>!v)}/>
              {REMOVABLE.includes(par.status)&&(isParty1||isParty2)&&(
                <div style={{marginTop:16,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
                  <button style={S.removeBtn} onClick={()=>setConfirm({
                    title:"Remove from your list?",
                    body:"This hides the parlay from your view only. The other party's view is unaffected. This cannot be undone.",
                    confirmLabel:"Remove",
                    confirmColor:T.textMuted,
                    onConfirm:()=>{setConfirm(null);hideParlay(par);}
                  })}>
                    <i className="ti ti-trash" style={{fontSize:14}} aria-hidden="true"/> Remove from my list
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LegSettler({leg,par,onSettle}){
  const [w,setW]=useState("");
  return(
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <select style={{...S.input,flex:1}} value={w} onChange={e=>setW(e.target.value)}>
        <option value="">Who won?</option>
        <option value="party1">Creator</option>
        <option value="party2">{par.party2_email}</option>
      </select>
      <button style={{...S.okBtn,padding:"8px 14px"}} onClick={()=>{if(w)onSettle(leg.id,w);}}>Settle</button>
    </div>
  );
}

function BetCard({bet,myEmail,onClick}){
  const statusColor=STATUS_COLORS[bet.status]||T.textMuted;
  return(
    <div style={{...S.betCard,borderLeft:`3px solid ${statusColor}`}} className="hov" onClick={onClick}>
      <div style={S.cTop}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span style={S.idTag}>{bet.id}</span>
          {bet.referee_email&&<i className="ti ti-scale" style={{fontSize:12,color:T.purple,flexShrink:0}} aria-hidden="true"/>}
        </div>
        <Bdg status={bet.status}/>
      </div>
      <div style={S.cAmount}>${bet.amount}</div>
      <div style={S.cPlayers}>
        <span style={S.playerName}>{shortEmail(bet.party1_email||myEmail)}</span>
        <span style={S.vs}>VS</span>
        <span style={S.playerName}>{shortEmail(bet.party2_email)}</span>
      </div>
      <div style={S.cBot}>
        <span style={S.cat}>{bet.category}</span>
        <span style={S.desc}>{bet.description}</span>
      </div>
    </div>
  );
}

function ParlayCard({par,myEmail,onClick}){
  const sc=par.legs.filter(l=>l.settled).length;
  const statusColor=STATUS_COLORS[par.status]||T.textMuted;
  return(
    <div style={{...S.betCard,borderLeft:`3px solid ${statusColor}`}} className="hov" onClick={onClick}>
      <div style={S.cTop}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span style={S.idTag}>{par.id}</span>
          {par.referee_email&&<i className="ti ti-scale" style={{fontSize:12,color:T.purple,flexShrink:0}} aria-hidden="true"/>}
          <span style={{fontSize:11,color:T.orange,flexShrink:0}}>{par.legs.length} legs</span>
        </div>
        <Bdg status={par.status}/>
      </div>
      <div style={S.cAmount}>${par.total_stake}</div>
      <div style={S.cPlayers}>
        <span style={S.playerName}>{shortEmail(par.party1_email||myEmail)}</span>
        <span style={S.vs}>VS</span>
        <span style={S.playerName}>{shortEmail(par.party2_email)}</span>
      </div>
      <div style={S.cBot}>
        <span style={S.cat}>Parlay</span>
        <span style={S.desc}>{par.name} · {sc}/{par.legs.length} settled</span>
      </div>
    </div>
  );
}

function CollapsibleLog({history,open,onToggle}){
  return(
    <div style={{borderTop:`1px solid ${T.border}`,marginTop:18,paddingTop:14}}>
      <button style={{background:"none",border:"none",color:T.textDim,fontSize:11,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",gap:6,padding:0}} onClick={onToggle}>
        <i className={`ti ${open?"ti-chevron-up":"ti-chevron-down"}`} style={{fontSize:14}} aria-hidden="true"/>
        Activity Log ({history.length})
      </button>
      {open&&(
        <div style={{marginTop:12}}>
          {history.map((h,i)=>(
            <div key={i} style={S.logRow}>
              <span style={S.logDot}>◆</span>
              <div><div style={S.logA}>{h.action}</div><div style={S.logT}>{fmt(h.time)}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bdg({status}){return <span style={{...S.badge,background:STATUS_COLORS[status]||"#404d5c"}}>{STATUS_LABELS[status]||status}</span>;}
function Pot({amount,label,sub}){return <div style={S.pot}><div style={S.potL}>{label}</div><div style={S.potA}>{amount}</div><div style={S.potS}>{sub}</div></div>;}
function DHeader({id,cat,status}){return <div style={S.dHdr}><div><div style={S.dId}>{id}</div><div style={S.dCat}>{cat}</div></div><Bdg status={status}/></div>;}
function Sec({title,children}){return <div style={S.sec}><div style={S.secT}>{title}</div>{children}</div>;}
function Row({k,v}){return <div style={S.row}><span style={S.rK}>{k}</span><span style={S.rV}>{v}</span></div>;}
function ABox({color,children}){return <div style={{...S.aBox,borderColor:color}}>{children}</div>;}
function F({label,children,full}){return <div style={{display:"flex",flexDirection:"column",gap:5,...(full?{gridColumn:"1/-1"}:{})}}><label style={S.fLbl}>{label}</label>{children}</div>;}
function Back({onClick}){return <button style={S.back} onClick={onClick}><i className="ti ti-arrow-left" style={{fontSize:14,marginRight:4}} aria-hidden="true"/>Back</button>;}
function Empty({label,cta}){return <div style={S.empty}><i className="ti ti-handshake" style={{fontSize:44,color:T.textMuted}} aria-hidden="true"/><div style={{color:T.textDim,marginTop:12,fontSize:15}}>{label}</div>{cta&&<div style={{color:T.textMuted,fontSize:13,marginTop:6}}>{cta}</div>}</div>;}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",background:"#1c1f23",color:"#d4dbe3",fontFamily:"'Inter','Trebuchet MS',sans-serif",position:"relative",overflowX:"hidden",maxWidth:"100vw"},
  toast:{position:"fixed",top:16,right:16,padding:"12px 20px",borderRadius:8,color:"#fff",fontSize:13,zIndex:9999,maxWidth:320,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"},
  // Auth
  authCard:{background:"#252a30",border:"1px solid #3a424d",borderRadius:16,padding:32,width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:14},
  authTabs:{display:"flex",borderBottom:"1px solid #3a424d",marginBottom:4},
  authTab:{flex:1,padding:"10px",background:"none",border:"none",color:"#6b7a8a",fontSize:14,cursor:"pointer",borderBottom:"2px solid transparent"},
  authTabOn:{color:"#e8751a",borderBottom:"2px solid #e8751a"},
  // Modal
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,padding:"0 20px"},
  modalBox:{background:"#252a30",border:"1px solid #3a424d",borderRadius:14,padding:"24px 22px",maxWidth:380,width:"100%"},
  modalTitle:{fontSize:17,fontWeight:"600",color:"#d4dbe3",marginBottom:8},
  modalBody:{fontSize:13,color:"#6b7a8a",lineHeight:1.6},
  // Header
  header:{background:"#252a30",borderBottom:"2px solid #e8751a",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,overflow:"hidden"},
  logo:{display:"flex",alignItems:"center",gap:10},
  logoutBtn:{padding:"5px 14px",background:"none",border:"1px solid #3a424d",borderRadius:6,color:"#6b7a8a",fontSize:12,cursor:"pointer"},
  stats:{display:"flex",gap:20,flexWrap:"wrap"},
  stat:{display:"flex",flexDirection:"column",alignItems:"center"},
  statN:{fontSize:18,fontWeight:"700",color:"#e8751a"},
  statL:{fontSize:9,color:"#6b7a8a",textTransform:"uppercase",letterSpacing:1},
  // Page
  page:{maxWidth:800,margin:"0 auto",padding:"22px 12px 60px"},
  tabRow:{display:"flex",gap:4,marginBottom:18,borderBottom:"1px solid #3a424d"},
  tab:{padding:"10px 18px",background:"none",border:"none",color:"#6b7a8a",fontSize:14,cursor:"pointer",borderBottom:"2px solid transparent",marginBottom:-1},
  tabOn:{color:"#e8751a",borderBottom:"2px solid #e8751a"},
  tabCt:{marginLeft:6,background:"#2e343c",padding:"2px 7px",borderRadius:10,fontSize:11},
  toolbar:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16},
  filters:{display:"flex",gap:6,flexWrap:"wrap"},
  fBtn:{padding:"7px 12px",borderRadius:20,border:"1px solid #3a424d",background:"none",color:"#6b7a8a",fontSize:11,cursor:"pointer",minHeight:34,outline:"none"},
  fBtnOn:{background:"#e8751a",borderColor:"#e8751a",color:"#000",fontWeight:"600"},
  newBtn:{padding:"9px 18px",background:"#e8751a",color:"#000",border:"none",borderRadius:8,fontWeight:"600",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"},
  list:{display:"flex",flexDirection:"column",gap:10},
  empty:{textAlign:"center",padding:"70px 20px"},
  // Bet cards — redesigned with amount prominent + left accent border
  betCard:{background:"#252a30",border:"1px solid #3a424d",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"border-color 0.18s",overflow:"hidden"},
  cTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8},
  idTag:{fontFamily:"monospace",fontSize:10,color:"#404d5c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  cAmount:{fontSize:24,fontWeight:"700",color:"#e8751a",fontFamily:"monospace",marginBottom:6,letterSpacing:-0.5},
  cPlayers:{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"nowrap",overflow:"hidden"},
  playerName:{fontSize:13,color:"#d4dbe3",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"40%"},
  vs:{fontSize:10,color:"#e8751a",letterSpacing:2,flexShrink:0},
  cBot:{display:"flex",gap:10,alignItems:"center"},
  cat:{fontSize:11,color:"#6b7a8a",flexShrink:0},
  desc:{fontSize:12,color:"#6b7a8a",fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1},
  badge:{padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:"600",color:"#fff",letterSpacing:0.3,whiteSpace:"nowrap",flexShrink:0},
  // Card / form
  card:{background:"#252a30",border:"1px solid #3a424d",borderRadius:14,padding:"20px 16px"},
  cardTitle:{fontSize:18,fontWeight:"700",color:"#e8751a",marginBottom:20},
  g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  fLbl:{fontSize:11,color:"#6b7a8a",letterSpacing:1,textTransform:"uppercase"},
  input:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:8,padding:"9px 13px",color:"#d4dbe3",fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  note:{margin:"16px 0 12px",fontSize:12,color:"#6b7a8a"},
  subBtn:{width:"100%",padding:"13px",background:"#e8751a",color:"#000",border:"none",borderRadius:8,fontSize:15,fontWeight:"700",cursor:"pointer"},
  ghostBtn:{padding:"11px 18px",background:"none",border:"1px solid #3a424d",borderRadius:8,color:"#6b7a8a",fontSize:13,cursor:"pointer"},
  info:{background:"#2e343c",border:"1px solid #3a424d",borderRadius:8,padding:"12px 14px",fontSize:13,color:"#6b7a8a",marginBottom:18,lineHeight:1.5},
  sectionDivider:{fontSize:13,fontWeight:"600",color:"#e8751a",margin:"20px 0 10px",borderBottom:"1px solid #3a424d",paddingBottom:8},
  refBox:{background:"#1a1040",border:"1px solid #3a424d",borderRadius:10,padding:14,marginBottom:12,display:"flex",flexDirection:"column",gap:10},
  refInfo:{fontSize:12,color:"#6b7a8a",lineHeight:1.5},
  refBadge:{background:"#2a1a4a",border:"1px solid #5b2d8a",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#a78bda",marginBottom:16,display:"flex",alignItems:"center"},
  legsHdr:{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0 12px"},
  addLeg:{padding:"6px 14px",background:"#7a3c0d",color:"#e8751a",border:"1px solid #e8751a",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:"600"},
  legCard:{background:"#2e343c",border:"1px solid #3a424d",borderRadius:10,padding:"14px",marginBottom:10},
  back:{background:"none",border:"none",color:"#e8751a",fontSize:13,cursor:"pointer",marginBottom:18,padding:0,display:"flex",alignItems:"center"},
  // Detail
  dHdr:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},
  dId:{fontFamily:"monospace",fontSize:11,color:"#404d5c",marginBottom:4},
  dCat:{fontSize:16,color:"#d4dbe3",fontWeight:"600"},
  pot:{background:"#1c1f23",border:"2px solid #e8751a",borderRadius:12,padding:"18px",textAlign:"center",marginBottom:20},
  potL:{fontSize:10,color:"#e8751a",letterSpacing:3,marginBottom:4,textTransform:"uppercase"},
  potA:{fontSize:40,fontWeight:"700",color:"#e8751a",fontFamily:"monospace"},
  potS:{fontSize:11,color:"#6b7a8a",marginTop:4},
  parties:{display:"flex",alignItems:"center",gap:8,marginBottom:20,width:"100%",minWidth:0},
  pBox:{flex:1,minWidth:0,background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"12px 8px",textAlign:"center",overflow:"hidden"},
  pWin:{borderColor:"#e8751a",background:"#2a1500"},
  pAvatar:{width:36,height:36,borderRadius:"50%",background:"#2e343c",border:"1px solid #3a424d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:"600",color:"#e8751a",margin:"0 auto 8px"},
  pName:{fontSize:13,fontWeight:"600",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  pRole:{fontSize:11,color:"#6b7a8a"},
  wBdg:{marginTop:6,fontSize:11,color:"#e8751a",fontWeight:"600"},
  vsCirc:{fontSize:11,fontWeight:"700",color:"#e8751a",letterSpacing:1,flexShrink:0,padding:"0 2px"},
  sec:{borderTop:"1px solid #3a424d",paddingTop:18,marginTop:18},
  secT:{fontSize:10,color:"#404d5c",letterSpacing:2,textTransform:"uppercase",marginBottom:12},
  row:{display:"flex",justifyContent:"space-between",gap:12,padding:"7px 0",borderBottom:"1px solid #2e343c",fontSize:13},
  rK:{color:"#6b7a8a",flexShrink:0},
  rV:{color:"#d4dbe3",textAlign:"right"},
  aBox:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"18px",marginTop:18,display:"flex",flexDirection:"column",gap:10},
  aTitle:{fontSize:15,fontWeight:"600",color:"#d4dbe3"},
  aSub:{fontSize:13,color:"#6b7a8a"},
  okBtn:{padding:"11px 16px",background:"#2e7d52",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:"600",cursor:"pointer"},
  badBtn:{padding:"11px 16px",background:"#8b2525",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:"600",cursor:"pointer"},
  paymentForm:{background:"#1a1a2e",border:"1px solid #3a424d",borderRadius:10,padding:"20px",marginTop:18,display:"flex",flexDirection:"column",gap:12},
  cardBox:{background:"#0d0d1a",border:"1px solid #3a424d",borderRadius:8,padding:"16px"},
  legDetail:{background:"#1c1f23",border:"1px solid #3a424d",borderRadius:10,padding:"14px",marginBottom:10},
  logRow:{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #2e343c"},
  logDot:{color:"#e8751a",fontSize:8,marginTop:4,flexShrink:0},
  logA:{fontSize:13,color:"#d4dbe3",marginBottom:2},
  logT:{fontSize:11,color:"#404d5c",fontFamily:"monospace"},
  // Category picker
  pillRow:{display:"flex",flexWrap:"wrap",gap:8,marginTop:4},
  catPill:{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 13px",background:"#1c1f23",border:"1px solid #3a424d",borderRadius:6,cursor:"pointer",outline:"none",fontFamily:"inherit",fontSize:12,letterSpacing:"0.3px",transition:"border-color 0.12s,background 0.12s",whiteSpace:"nowrap"},
  catPillOn:{borderColor:"#e8751a",background:"#1e1208"},
  refreshBtn:{padding:"8px 10px",background:"none",border:"1px solid #3a424d",borderRadius:8,color:"#6b7a8a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  removeBtn:{background:"none",border:"1px solid #3a424d",borderRadius:8,padding:"9px 16px",color:"#6b7a8a",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css');
  *{box-sizing:border-box;}
  html,body{overflow-x:hidden;max-width:100vw;}
  body{font-family:'Inter','Trebuchet MS',sans-serif;}
  .hov:hover{border-color:#e8751a!important;}
  input:focus,select:focus,textarea:focus{border-color:#e8751a!important;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .spin{animation:spin 0.6s linear infinite;}
  @media(max-width:520px){
    div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr!important;}
  }
`;

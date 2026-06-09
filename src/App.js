import { useState, useEffect, useRef } from "react";

const SUPA_URL = "https://ciwgianwiltffwdeigpo.supabase.co";
const SUPA_KEY = "sb_publishable_De_LCVKbIza3eGBtiILLjQ_hM3LYb9F";
const STRIPE_PK = "pk_test_51Tfg1kJvqjWYKBEDb35hYcorxBX2WFBttLBCYg1uzBQMmrGJxiSCdn9aCpX59yKJcpajrgZJupxucYhUSEGRfIJS000lUzMGXr";

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
async function sendNotification(to, subject, message, betId) {
  try {
    await fetch("/api/send-notification", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ to, subject, message, betId })
    });
  } catch(e) { console.log("Notification error:", e); }
}

const T = {
  bg:"#1c1f23", surface:"#252a30", panel:"#2e343c", border:"#3a424d",
  orange:"#e8751a", orangeDim:"#7a3c0d", text:"#d4dbe3",
  textDim:"#6b7a8a", textMuted:"#404d5c", green:"#2e7d52", red:"#8b2525", blue:"#1e5a8a",
  purple:"#5b2d8a",
};

const CATEGORIES = ["⛳ Golf","🎮 Video Game","🏀 Sports","🎯 Darts","🎱 Pool","🃏 Cards","🏌️ Other"];
const STATUS = {
  PENDING:"pending", AWAITING_P1_AUTH:"awaiting_p1_auth", AWAITING_P2_AUTH:"awaiting_p2_auth",
  ACTIVE:"active", AWAITING_REF:"awaiting_ref", SETTLING:"settling", SETTLED:"settled", DISPUTED:"disputed"
};
const STATUS_COLORS = {
  pending:"#b87a10", awaiting_p1_auth:"#1e5a8a", awaiting_p2_auth:"#1e5a8a",
  active:"#2e7d52", awaiting_ref:"#5b2d8a", settling:"#b87a10", settled:"#2e7d52", disputed:"#8b2525"
};
const STATUS_LABELS = {
  pending:"Awaiting Confirm", awaiting_p1_auth:"Card Required", awaiting_p2_auth:"Card Required",
  active:"Locked & Funded 🔒", awaiting_ref:"Ref Review", settling:"Processing", settled:"Settled ✅", disputed:"Disputed"
};

function uid(p="BET"){ return `${p}-${Math.random().toString(36).substr(2,6).toUpperCase()}`; }
function fmt(iso){ return new Date(iso).toLocaleString(); }
function now(){ return new Date().toISOString(); }

function CardAuthForm({ bet, session, role, onSuccess, onCancel }) {
  const cardRef = useRef(null);
  const stripeRef = useRef(null);
  const cardElementRef = useRef(null);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    function init() {
      if(!window.Stripe || !cardRef.current) { setTimeout(init, 100); return; }
      if(!mounted) return;
      const stripe = window.Stripe(STRIPE_PK);
      stripeRef.current = stripe;
      const elements = stripe.elements();
      const card = elements.create("card", {
        style: {
          base: { color:"#d4dbe3", fontFamily:"Trebuchet MS, sans-serif", fontSize:"16px", "::placeholder":{ color:"#6b7a8a" } },
          invalid: { color:"#e8751a" }
        }
      });
      card.mount(cardRef.current);
      card.on("ready", () => { if(mounted) setCardReady(true); });
      card.on("change", e => { if(mounted) setError(e.error ? e.error.message : ""); });
      cardElementRef.current = card;
    }
    init();
    return () => {
      mounted = false;
      try { if(cardElementRef.current) cardElementRef.current.destroy(); } catch(e) {}
    };
  }, []);

  async function handleAuthorize() {
    if(!cardElementRef.current || !stripeRef.current) return;
    setProcessing(true); setError("");
    try {
      const amount = bet.amount || bet.total_stake;
      const r = await fetch("/api/authorize-card", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ amount, betId:bet.id, email:session.user.email, role, description:bet.description||bet.name })
      });
      const { clientSecret, paymentIntentId, error:apiError } = await r.json();
      if(apiError) { setError(apiError); setProcessing(false); return; }
      const { error:stripeError, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElementRef.current, billing_details: { email: session.user.email } }
      });
      if(stripeError) { setError(stripeError.message); setProcessing(false); return; }
      if(paymentIntent.status === "requires_capture") onSuccess(paymentIntentId);
      else { setError(`Unexpected status: ${paymentIntent.status}`); setProcessing(false); }
    } catch(e) { setError(e.message); setProcessing(false); }
  }

  const amount = bet.amount || bet.total_stake;
  return (
    <div style={S.paymentForm}>
      <div style={S.aTitle}>💳 Authorize Card to Lock Bet</div>
      <div style={S.aSub}>A hold of <strong style={{color:T.orange}}>${amount}</strong> will appear on your card.</div>
      <div style={{...S.aSub, color:T.green}}>✅ You are only charged if you LOSE.</div>
      <div style={S.cardBox}>
        <div ref={cardRef} style={{minHeight:24, padding:4}} />
      </div>
      {error && <div style={{color:T.red, fontSize:13, padding:"8px 0"}}>{error}</div>}
      <div style={{display:"flex", gap:10}}>
        <button style={{...S.okBtn, opacity:(!cardReady||processing)?0.6:1}} onClick={handleAuthorize} disabled={!cardReady||processing}>
          {processing ? "⏳ Authorizing..." : `Authorize $${amount} Hold 🔒`}
        </button>
        <button style={S.badBtn} onClick={onCancel} disabled={processing}>Cancel</button>
      </div>
      <div style={{fontSize:11, color:T.textMuted, marginTop:4}}>🔒 Powered by Stripe. Card details never touch SnoVale servers.</div>
    </div>
  );
}

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
  const blankBet = { party2_email:"", amount:"", category:CATEGORIES[0], description:"", terms:"", referee_email:"" };
  const [betForm, setBetForm] = useState(blankBet);
  const blankParlay = { name:"", party2_email:"", totalStake:"", referee_email:"" };
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
    const data = await dbGet("bets", session.access_token, `&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email},referee_email.eq.${session.user.email})`);
    if(Array.isArray(data)) setBets(data);
  }

  async function fetchParlays() {
    const data = await dbGet("parlays", session.access_token, `&or=(party1_id.eq.${session.user.id},party2_email.eq.${session.user.email},referee_email.eq.${session.user.email})`);
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
      party2_email: f.party2_email.toLowerCase(),
      referee_email: f.referee_email ? f.referee_email.toLowerCase() : null,
      party2_id: null, amount: parseFloat(f.amount),
      category: f.category, description: f.description, terms: f.terms,
      status: STATUS.AWAITING_P1_AUTH, winner: null,
      payment_intent_id: null, payment_status: null,
      party1_payment_intent_id: null, party2_payment_intent_id: null,
      party1_payment_authorized: false, party2_payment_authorized: false,
      created_at: now(),
      history: [{ action:`Bet created by ${session.user.email}`, time:now() }]
    };
    const inserted = await dbInsert("bets", session.access_token, bet);
    const newBet = Array.isArray(inserted) ? inserted[0] : bet;
    setBetForm(blankBet);
    setSelected(newBet);
    setView("detailBet");
    fetchBets();
    toast_(`Bet created! Authorize your card to lock it in.`);
  }

  async function handleP1CardAuth(bet, paymentIntentId) {
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.PENDING,
      party1_payment_intent_id: paymentIntentId,
      party1_payment_authorized: true,
      history: [...bet.history, { action:`${session.user.email} authorized card 💳`, time:now() }]
    });
    await sendNotification(
      bet.party2_email,
      `🏔 SnoVale — You've been challenged!`,
      `<strong>${session.user.email}</strong> has challenged you to a bet!<br><br><strong>Bet:</strong> ${bet.description}<br><strong>Stake:</strong> $${bet.amount}<br><strong>Category:</strong> ${bet.category}<br><br>Log in to SnoVale to confirm and authorize your card.`,
      bet.id
    );
    fetchBets(); setView("list");
    toast_("Card authorized! Opponent notified by email. 📧");
  }

  async function confirmBet(bet) {
    if(session.user.email.toLowerCase() !== bet.party2_email.toLowerCase())
      return toast_(`Only ${bet.party2_email} can confirm.`, "err");
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.AWAITING_P2_AUTH, party2_id: session.user.id,
      history: [...bet.history, { action:`${session.user.email} confirmed — authorizing card`, time:now() }]
    });
    const updated = {...bet, status: STATUS.AWAITING_P2_AUTH, party2_id: session.user.id};
    setSelected(updated);
    fetchBets();
    toast_("Confirmed! Now authorize your card.");
  }

  async function handleP2CardAuth(bet, paymentIntentId) {
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.ACTIVE,
      party2_payment_intent_id: paymentIntentId,
      party2_payment_authorized: true,
      history: [...bet.history, { action:`${session.user.email} authorized card — BET FULLY LOCKED & FUNDED 🔒💳`, time:now() }]
    });
    fetchBets(); setView("list");
    toast_("Bet fully locked and funded! 🔒💳");
  }

  async function submitOutcome(bet) {
    if(!winnerSel) return toast_("Select a winner.", "err");
    const winnerEmail = winnerSel === "party1" ? session.user.email : bet.party2_email;
    const loserEmail = winnerSel === "party1" ? bet.party2_email : session.user.email;
    if(bet.referee_email) {
      await dbUpdate("bets", session.access_token, bet.id, {
        status: STATUS.AWAITING_REF, winner: winnerEmail,
        history: [...bet.history, { action:`Outcome submitted: ${winnerEmail} wins — awaiting referee`, time:now() }]
      });
      await sendNotification(bet.referee_email, `🏔 SnoVale — Referee action required`, `Outcome submitted: ${winnerEmail} wins $${bet.amount}. Log in to confirm.`, bet.id);
      toast_("Submitted! Referee notified. ⚖️");
    } else {
      await settleWithCapture(bet, winnerEmail, loserEmail);
    }
    fetchBets(); setWinnerSel(""); setView("list");
  }

  async function settleWithCapture(bet, winnerEmail, loserEmail) {
    const isParty1Winner = winnerEmail !== bet.party2_email;
    const loserIntentId = isParty1Winner ? bet.party2_payment_intent_id : bet.party1_payment_intent_id;
    const winnerIntentId = isParty1Winner ? bet.party1_payment_intent_id : bet.party2_payment_intent_id;
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.SETTLING, winner: winnerEmail,
      history: [...bet.history, { action:`⚡ Processing payment...`, time:now() }]
    });
    try {
      const r = await fetch("/api/capture-payment", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ loserPaymentIntentId:loserIntentId, winnerPaymentIntentId:winnerIntentId, amount:bet.amount })
      });
      const result = await r.json();
      if(result.error) throw new Error(result.error);
      await dbUpdate("bets", session.access_token, bet.id, {
        status: STATUS.SETTLED, winner: winnerEmail, payment_status:"captured",
        history: [...bet.history, { action:`💳 ${winnerEmail} wins $${bet.amount}! Payment captured.`, time:now() }]
      });
      await sendNotification(winnerEmail, `🏔 SnoVale — You won! 🏆`, `You won $${bet.amount}! Payment processed. 💳`, bet.id);
      await sendNotification(loserEmail, `🏔 SnoVale — Bet Settled`, `${winnerEmail} won. Your card has been charged $${bet.amount}.`, bet.id);
      toast_(`${winnerEmail} wins! Payment processed. 🏆💳`);
    } catch(e) {
      await dbUpdate("bets", session.access_token, bet.id, {
        status: STATUS.DISPUTED,
        history: [...bet.history, { action:`⚠️ Payment failed: ${e.message}`, time:now() }]
      });
      toast_("Payment failed — flagged for review.", "err");
    }
    fetchBets();
  }

  async function refereeConfirm(bet) {
    if(session.user.email.toLowerCase() !== bet.referee_email?.toLowerCase())
      return toast_("Only the referee can confirm.", "err");
    const loserEmail = bet.winner === bet.party2_email ? session.user.email : bet.party2_email;
    await settleWithCapture(bet, bet.winner, loserEmail);
    fetchBets(); setView("list");
  }

  async function refereeOverride(bet) {
    if(session.user.email.toLowerCase() !== bet.referee_email?.toLowerCase())
      return toast_("Only the referee can override.", "err");
    const newWinner = bet.winner === bet.party2_email ? session.user.email : bet.party2_email;
    const loserEmail = newWinner === session.user.email ? bet.party2_email : session.user.email;
    await settleWithCapture({...bet, winner:newWinner}, newWinner, loserEmail);
    fetchBets(); setView("list");
  }

  async function disputeBet(bet) {
    const ids = [bet.party1_payment_intent_id, bet.party2_payment_intent_id].filter(Boolean);
    if(ids.length > 0) {
      try { await fetch("/api/release-hold", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({paymentIntentIds:ids}) }); }
      catch(e) { console.error(e); }
    }
    await dbUpdate("bets", session.access_token, bet.id, {
      status: STATUS.DISPUTED,
      history: [...bet.history, { action:"⚠️ DISPUTED — all holds released.", time:now() }]
    });
    fetchBets(); setView("list"); toast_("Disputed — holds released.", "err");
  }

  async function createParlay() {
    const f = parlayForm;
    if(!f.party2_email || !f.totalStake || legs.length < 2) return toast_("Need opponent, stake, and 2+ legs.", "err");
    if(legs.some(l => !l.description)) return toast_("All legs need a description.", "err");
    const parlay = {
      id: uid("PAR"), party1_id: session.user.id,
      party2_email: f.party2_email.toLowerCase(),
      referee_email: f.referee_email ? f.referee_email.toLowerCase() : null,
      party2_id: null,
      name: f.name || `${session.user.email} vs ${f.party2_email} Parlay`,
      total_stake: parseFloat(f.totalStake),
      legs: legs.map((l,i) => ({...l, id:i, winner:null, settled:false})),
      status: STATUS.AWAITING_P1_AUTH, overall_winner: null,
      payment_intent_id: null, payment_status: null,
      party1_payment_intent_id: null, party2_payment_intent_id: null,
      party1_payment_authorized: false, party2_payment_authorized: false,
      created_at: now(),
      history: [{ action:`Parlay created by ${session.user.email}`, time:now() }]
    };
    const inserted = await dbInsert("parlays", session.access_token, parlay);
    const newParlay = Array.isArray(inserted) ? inserted[0] : parlay;
    setParlayForm(blankParlay); setLegs([{...blankLeg}]);
    setSelected(newParlay);
    setView("detailParlay");
    setTab("parlays");
    fetchParlays();
    toast_(`Parlay created! Authorize your card.`);
  }

  async function handleP1ParlayCardAuth(par, paymentIntentId) {
    await dbUpdate("parlays", session.access_token, par.id, {
      status: STATUS.PENDING,
      party1_payment_intent_id: paymentIntentId,
      party1_payment_authorized: true,
      history: [...par.history, { action:`${session.user.email} authorized card 💳`, time:now() }]
    });
    await sendNotification(par.party2_email, `🏔 SnoVale — You've been challenged to a Parlay!`, `${session.user.email} challenged you to a ${par.legs.length}-leg parlay! Stake: $${par.total_stake}. Log in to confirm.`, par.id);
    fetchParlays(); setView("list");
    toast_("Card authorized! Opponent notified. 📧");
  }

  async function confirmParlay(par) {
    if(session.user.email.toLowerCase() !== par.party2_email.toLowerCase())
      return toast_(`Only ${par.party2_email} can confirm.`, "err");
    await dbUpdate("parlays", session.access_token, par.id, {
      status: STATUS.AWAITING_P2_AUTH, party2_id: session.user.id,
      history: [...par.history, { action:`${session.user.email} confirmed — authorizing card`, time:now() }]
    });
    const updated = {...par, status: STATUS.AWAITING_P2_AUTH, party2_id: session.user.id};
    setSelected(updated);
    fetchParlays();
    toast_("Confirmed! Authorize your card.");
  }

  async function handleP2ParlayCardAuth(par, paymentIntentId) {
    await dbUpdate("parlays", session.access_token, par.id, {
      status: STATUS.ACTIVE,
      party2_payment_intent_id: paymentIntentId,
      party2_payment_authorized: true,
      history: [...par.history, { action:`${session.user.email} authorized card — PARLAY LOCKED & FUNDED 🔒💳`, time:now() }]
    });
    fetchParlays(); setView("list");
    toast_("Parlay fully locked and funded! 🔒💳");
  }

  async function settleLeg(par, legId, winner) {
    const updatedLegs = par.legs.map(l => l.id===legId ? {...l, winner, settled:true} : l);
    const allSettled = updatedLegs.every(l => l.settled);
    let overallWinner = null; let newStatus = par.status;
    if(allSettled) {
      const p1Wins = updatedLegs.every(l => l.winner==="party1");
      const p2Wins = updatedLegs.every(l => l.winner==="party2");
      overallWinner = p1Wins ? session.user.email : p2Wins ? par.party2_email : "SPLIT";
      newStatus = par.referee_email ? STATUS.AWAITING_REF : STATUS.SETTLING;
    }
    const logEntry = { action:`Leg ${legId+1}: ${winner==="party1"?session.user.email:par.party2_email} wins`, time:now() };
    const finalLog = allSettled ? [...par.history, logEntry, { action:`All legs done`, time:now() }] : [...par.history, logEntry];
    await dbUpdate("parlays", session.access_token, par.id, { legs:updatedLegs, overall_winner:overallWinner, status:newStatus, history:finalLog });
    if(allSettled && !par.referee_email && overallWinner !== "SPLIT") {
      const isP1Win = overallWinner !== par.party2_email;
      try {
        await fetch("/api/capture-payment", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ loserPaymentIntentId:isP1Win?par.party2_payment_intent_id:par.party1_payment_intent_id, winnerPaymentIntentId:isP1Win?par.party1_payment_intent_id:par.party2_payment_intent_id, amount:par.total_stake }) });
        await dbUpdate("parlays", session.access_token, par.id, { status:STATUS.SETTLED, payment_status:"captured", history:[...finalLog,{action:`💳 ${overallWinner} wins $${par.total_stake}!`,time:now()}] });
        toast_(`Parlay settled! ${overallWinner} wins! 🏆💳`);
      } catch(e) { toast_("Payment error.", "err"); }
    } else if(allSettled && overallWinner === "SPLIT") {
      const ids = [par.party1_payment_intent_id, par.party2_payment_intent_id].filter(Boolean);
      await fetch("/api/release-hold", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({paymentIntentIds:ids}) });
      await dbUpdate("parlays", session.access_token, par.id, { status:STATUS.SETTLED, history:[...finalLog,{action:`Split — holds released.`,time:now()}] });
      toast_("Split parlay — holds released.");
    } else if(allSettled && par.referee_email) {
      await sendNotification(par.referee_email, `🏔 SnoVale — Referee action required`, `All legs settled. ${overallWinner} wins $${par.total_stake}. Log in to confirm.`, par.id);
      toast_("All legs done! Referee notified. ⚖️");
    } else {
      toast_(`Leg ${legId+1} settled.`);
    }
    fetchParlays();
  }

  async function refereeConfirmParlay(par) {
    if(session.user.email.toLowerCase() !== par.referee_email?.toLowerCase())
      return toast_("Only the referee can confirm.", "err");
    const isP1Win = par.overall_winner !== par.party2_email;
    try {
      await fetch("/api/capture-payment", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ loserPaymentIntentId:isP1Win?par.party2_payment_intent_id:par.party1_payment_intent_id, winnerPaymentIntentId:isP1Win?par.party1_payment_intent_id:par.party2_payment_intent_id, amount:par.total_stake }) });
      await dbUpdate("parlays", session.access_token, par.id, { status:STATUS.SETTLED, payment_status:"captured", history:[...par.history,{action:`⚖️ Referee confirmed! ${par.overall_winner} wins $${par.total_stake}. 💳`,time:now()}] });
      fetchParlays(); setView("list"); toast_("Referee confirmed! Payment processed. 🏆");
    } catch(e) { toast_("Payment error.", "err"); }
  }

  async function disputeParlay(par) {
    const ids = [par.party1_payment_intent_id, par.party2_payment_intent_id].filter(Boolean);
    if(ids.length > 0) await fetch("/api/release-hold", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({paymentIntentIds:ids}) });
    await dbUpdate("parlays", session.access_token, par.id, { status:STATUS.DISPUTED, history:[...par.history,{action:"⚠️ DISPUTED — holds released.",time:now()}] });
    fetchParlays(); setView("list"); toast_("Disputed — holds released.", "err");
  }

  const myEmail = session?.user?.email?.toLowerCase();
  const activeStake = [
    ...bets.filter(b=>[STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLING].includes(b.status)).map(b=>b.amount),
    ...parlays.filter(p=>[STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLING].includes(p.status)).map(p=>p.total_stake)
  ].reduce((s,v)=>s+v,0);
  const filteredBets = filter==="all" ? bets : bets.filter(b=>b.status===filter);
  const filteredParlays = filter==="all" ? parlays : parlays.filter(p=>p.status===filter);

  if(!session) return (
    <div style={{...S.root, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <style>{css}</style>
      <div style={S.authCard}>
        <div style={{fontSize:48, textAlign:"center"}}>🏔</div>
        <div style={{fontSize:28, fontWeight:"bold", letterSpacing:3, color:T.orange, textAlign:"center"}}>SnoVale</div>
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

  // Helper to get current bet from state
  const currentBet = selected ? (bets.find(b=>b.id===selected.id) || selected) : null;
  const currentPar = selected ? (parlays.find(p=>p.id===selected.id) || selected) : null;

  return (
    <div style={S.root}>
      <style>{css}</style>
      {toast && <div style={{...S.toast, background:toast.type==="err"?T.red:"#1c3d28"}}>{toast.msg}</div>}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={{fontSize:24}}>🏔</span>
          <div><div style={{fontSize:20, fontWeight:"bold", letterSpacing:3, color:T.orange}}>SnoVale</div><div style={{fontSize:10, color:T.textDim, letterSpacing:2, textTransform:"uppercase"}}>Side Bet Tracker</div></div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div style={S.stats}>
            {[
              {l:"Active", v:bets.filter(b=>b.status===STATUS.ACTIVE).length+parlays.filter(p=>p.status===STATUS.ACTIVE).length},
              {l:"In Play", v:`$${activeStake.toFixed(2)}`},
              {l:"Settled", v:bets.filter(b=>b.status===STATUS.SETTLED).length+parlays.filter(p=>p.status===STATUS.SETTLED).length}
            ].map(s=>(
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
              {["all",STATUS.AWAITING_P1_AUTH,STATUS.PENDING,STATUS.ACTIVE,STATUS.AWAITING_REF,STATUS.SETTLED,STATUS.DISPUTED].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{...S.fBtn,...(filter===f?S.fBtnOn:{})}}>{f==="all"?"All":STATUS_LABELS[f]}</button>
              ))}
            </div>
            <button style={S.newBtn} onClick={()=>setView(tab==="bets"?"createBet":"createParlay")}>+ New {tab==="bets"?"Bet":"Parlay"}</button>
          </div>
          {tab==="bets" && (filteredBets.length===0?<Empty label="No bets yet." />:<div style={S.list}>{filteredBets.map(b=><BetCard key={b.id} bet={b} myEmail={myEmail} onClick={()=>{setSelected(b);setView("detailBet");}} />)}</div>)}
          {tab==="parlays" && (filteredParlays.length===0?<Empty label="No parlays yet." />:<div style={S.list}>{filteredParlays.map(p=><ParlayCard key={p.id} par={p} myEmail={myEmail} onClick={()=>{setSelected(p);setView("detailParlay");}} />)}</div>)}
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
            <div style={S.sectionDivider}>⚖️ Referee (Optional)</div>
            <div style={S.refBox}>
              <div style={S.refInfo}>Neutral third party who confirms outcome before payment captures.</div>
              <F label="Referee Email"><input style={S.input} type="email" placeholder="referee@email.com" value={betForm.referee_email} onChange={e=>setBetForm({...betForm,referee_email:e.target.value})} /></F>
            </div>
            <div style={S.note}>💳 Both parties authorize a card hold. Loser charged automatically. 4% fee.</div>
            <button style={S.subBtn} onClick={createBet}>Create Bet & Authorize Card →</button>
          </div>
        </div>
      )}

      {view==="createParlay" && (
        <div style={S.page}><Back onClick={()=>setView("list")} />
          <div style={S.card}><div style={S.cardTitle}>🔗 New Parlay</div>
            <div style={S.info}>All legs must be won by the same person. Both parties authorize cards upfront.</div>
            <div style={S.g2}>
              <F label="Parlay Name"><input style={S.input} placeholder="e.g. Sunday Sweep" value={parlayForm.name} onChange={e=>setParlayForm({...parlayForm,name:e.target.value})} /></F>
              <F label="Total Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={parlayForm.totalStake} onChange={e=>setParlayForm({...parlayForm,totalStake:e.target.value})} /></F>
              <F label="Your Email" full><input style={{...S.input,opacity:0.6}} value={myEmail} disabled /></F>
              <F label="Opponent Email *" full><input style={S.input} type="email" placeholder="opponent@email.com" value={parlayForm.party2_email} onChange={e=>setParlayForm({...parlayForm,party2_email:e.target.value})} /></F>
            </div>
            <div style={S.sectionDivider}>⚖️ Referee (Optional)</div>
            <div style={S.refBox}>
              <div style={S.refInfo}>Neutral third party who confirms the final outcome.</div>
              <F label="Referee Email"><input style={S.input} type="email" placeholder="referee@email.com" value={parlayForm.referee_email} onChange={e=>setParlayForm({...parlayForm,referee_email:e.target.value})} /></F>
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
            <div style={S.note}>💳 4% SnoVale fee on settlement.</div>
            <button style={S.subBtn} onClick={createParlay}>Create Parlay & Authorize Card →</button>
          </div>
        </div>
      )}

      {view==="detailBet" && currentBet && (()=>{
        const bet = currentBet;
        const isParty1 = bet.party1_id===session.user.id;
        const isParty2 = myEmail===bet.party2_email?.toLowerCase();
        const isRef = myEmail===bet.referee_email?.toLowerCase();
        const needsP1Auth = bet.status===STATUS.AWAITING_P1_AUTH && isParty1;
        const needsP2Auth = bet.status===STATUS.AWAITING_P2_AUTH && isParty2;
        return (
          <div style={S.page}><Back onClick={()=>setView("list")} />
            <div style={S.card}>
              <DHeader id={bet.id} cat={bet.category} status={bet.status} />
              {bet.referee_email&&<div style={S.refBadge}>⚖️ Refereed by {bet.referee_email}</div>}
              <Pot amount={`$${bet.amount}`} label="Pot" sub="Both cards authorized · Auto settlement" />
              <div style={S.parties}>
                <div style={{...S.pBox,...(bet.winner===session.user.email&&isParty1?S.pWin:{})}}>
                 <div style={S.pName}>{isParty1?session.user.email:bet.party2_email}</div>
                  <div style={S.pRole}>Creator</div>
                  <div style={{fontSize:11,color:bet.party1_payment_authorized?T.green:T.textDim,marginTop:4}}>{bet.party1_payment_authorized?"💳 Authorized":"💳 Pending"}</div>
                  {bet.winner===session.user.email&&isParty1&&<div style={S.wBdg}>🏆 Winner</div>}
                </div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(bet.winner===bet.party2_email?S.pWin:{})}}>
                 <div style={S.pName}>{isParty2?session.user.email:bet.party2_email}</div>
                  <div style={S.pRole}>{bet.party2_id?"Confirmed":"⏳ Pending"}</div>
                  <div style={{fontSize:11,color:bet.party2_payment_authorized?T.green:T.textDim,marginTop:4}}>{bet.party2_payment_authorized?"💳 Authorized":"💳 Pending"}</div>
                  {bet.winner===bet.party2_email&&<div style={S.wBdg}>🏆 Winner</div>}
                </div>
              </div>
              <Sec title="Details">
                <Row k="Description" v={bet.description}/>
                {bet.terms&&<Row k="Terms" v={bet.terms}/>}
                <Row k="Created" v={fmt(bet.created_at)}/>
                {bet.referee_email&&<Row k="Referee" v={bet.referee_email}/>}
                {bet.payment_status&&<Row k="Payment" v={bet.payment_status==="captured"?"✅ Captured":"⏳ Processing"}/>}
              </Sec>

              {needsP1Auth && <CardAuthForm bet={bet} session={session} role="party1" onSuccess={(pid)=>handleP1CardAuth(bet,pid)} onCancel={()=>setView("list")} />}
              {bet.status===STATUS.AWAITING_P1_AUTH&&!isParty1&&<ABox color={T.blue}><div style={S.aTitle}>⏳ Awaiting creator's card authorization</div></ABox>}

              {bet.status===STATUS.PENDING&&isParty2&&(
                <ABox color={T.orange}>
                  <div style={S.aTitle}>🎯 You've been challenged!</div>
                  <div style={S.aSub}><strong>{bet.description}</strong> · ${bet.amount} stake</div>
                  <div style={S.aSub}>Accept and authorize your card. You're only charged if you lose.</div>
                  <button style={S.okBtn} onClick={()=>confirmBet(bet)}>Accept & Authorize Card →</button>
                </ABox>
              )}
              {bet.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {bet.party2_email}</div><div style={S.aSub}>Your card is authorized. Waiting for opponent to confirm and authorize.</div></ABox>}

              {needsP2Auth && <CardAuthForm bet={bet} session={session} role="party2" onSuccess={(pid)=>handleP2CardAuth(bet,pid)} onCancel={()=>setView("list")} />}
              {bet.status===STATUS.AWAITING_P2_AUTH&&!isParty2&&<ABox color={T.blue}><div style={S.aTitle}>💳 Opponent authorizing card...</div></ABox>}

              {bet.status===STATUS.ACTIVE&&(isParty1||isParty2)&&(
                <ABox color={T.green}>
                  <div style={S.aTitle}>🔒 Bet Funded — Submit Outcome</div>
                  <div style={S.aSub}>Both cards authorized. Loser charged automatically.</div>
                  {bet.referee_email&&<div style={S.aSub}>⚖️ Referee confirms before payment captures.</div>}
                  <select style={S.input} value={winnerSel} onChange={e=>setWinnerSel(e.target.value)}>
                    <option value="">— Select Winner —</option>
                    <option value="party1">{isParty1?"You":bet.party2_email}</option>
                    <option value="party2">{isParty2?"You":bet.party2_email}</option>
                  </select>
                  <div style={{display:"flex",gap:10}}>
                    <button style={S.okBtn} onClick={()=>submitOutcome(bet)}>Submit Outcome ✅</button>
                    <button style={S.badBtn} onClick={()=>disputeBet(bet)}>Dispute ⚠️</button>
                  </div>
                </ABox>
              )}
              {bet.status===STATUS.AWAITING_REF&&isRef&&<ABox color={T.purple}><div style={S.aTitle}>⚖️ Confirm & Trigger Payment</div><div style={S.aSub}><strong style={{color:T.orange}}>{bet.winner}</strong> wins ${bet.amount}</div><div style={{display:"flex",gap:10}}><button style={S.okBtn} onClick={()=>refereeConfirm(bet)}>Confirm ✅</button><button style={S.badBtn} onClick={()=>refereeOverride(bet)}>Override ⚖️</button></div></ABox>}
              {bet.status===STATUS.AWAITING_REF&&!isRef&&<ABox color={T.purple}><div style={S.aTitle}>⚖️ Awaiting Referee</div><div style={S.aSub}>{bet.referee_email} has been notified.</div></ABox>}
              {bet.status===STATUS.SETTLING&&<ABox color={T.orange}><div style={S.aTitle}>⚡ Processing Payment...</div></ABox>}
              {bet.status===STATUS.SETTLED&&<ABox color={T.green}><div style={S.aTitle}>✅ Settled</div><div style={S.aSub}>{bet.winner} wins ${bet.amount}! 💳 Auto-processed.</div></ABox>}
              {bet.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed — Holds Released</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <Log history={bet.history}/>
            </div>
          </div>
        );
      })()}

      {view==="detailParlay" && currentPar && (()=>{
        const par = currentPar;
        const isParty1 = par.party1_id===session.user.id;
        const isParty2 = myEmail===par.party2_email?.toLowerCase();
        const isRef = myEmail===par.referee_email?.toLowerCase();
        const needsP1Auth = par.status===STATUS.AWAITING_P1_AUTH && isParty1;
        const needsP2Auth = par.status===STATUS.AWAITING_P2_AUTH && isParty2;
        const sc = par.legs.filter(l=>l.settled).length;
        return (
          <div style={S.page}><Back onClick={()=>setView("list")} />
            <div style={S.card}>
              <DHeader id={par.id} cat={`🔗 ${par.legs.length}-Leg Parlay`} status={par.status}/>
              {par.referee_email&&<div style={S.refBadge}>⚖️ Refereed by {par.referee_email}</div>}
              <div style={{fontSize:14,color:T.textDim,marginBottom:16,fontStyle:"italic"}}>{par.name}</div>
              <Pot amount={`$${par.total_stake}`} label="Parlay Pot" sub={`${sc}/${par.legs.length} legs · Auto settlement`}/>
              <div style={S.parties}>
                <div style={{...S.pBox,...(par.overall_winner===myEmail?S.pWin:{})}}>
                  <div style={S.pName}>{isParty1?"You":par.party2_email}</div>
                  <div style={S.pRole}>Creator</div>
                  <div style={{fontSize:11,color:par.party1_payment_authorized?T.green:T.textDim,marginTop:4}}>{par.party1_payment_authorized?"💳 Authorized":"💳 Pending"}</div>
                </div>
                <div style={S.vsCirc}>VS</div>
                <div style={{...S.pBox,...(par.overall_winner===par.party2_email?S.pWin:{})}}>
                  <div style={S.pName}>{isParty2?"You":par.party2_email}</div>
                  <div style={S.pRole}>{par.party2_id?"Confirmed":"⏳ Pending"}</div>
                  <div style={{fontSize:11,color:par.party2_payment_authorized?T.green:T.textDim,marginTop:4}}>{par.party2_payment_authorized?"💳 Authorized":"💳 Pending"}</div>
                </div>
              </div>
              <Sec title={`Legs (${par.legs.length})`}>
                {par.legs.map((leg,i)=>(
                  <div key={leg.id} style={{...S.legDetail,borderColor:leg.settled?T.border:T.orange}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:T.orange,fontWeight:"bold"}}>Leg {i+1} — {leg.category}</span>
                      {leg.settled?<span style={{...S.badge,background:T.green}}>✅ {leg.winner==="party1"?(isParty1?"You":par.party2_email):(isParty2?"You":par.party2_email)}</span>:<span style={{...S.badge,background:T.textMuted}}>Pending</span>}
                    </div>
                    <div style={{fontSize:13,color:T.textDim,fontStyle:"italic"}}>{leg.description}</div>
                    {par.status===STATUS.ACTIVE&&!leg.settled&&(isParty1||isParty2)&&<LegSettler leg={leg} par={par} onSettle={(id,w)=>settleLeg(par,id,w)}/>}
                  </div>
                ))}
              </Sec>
              {needsP1Auth&&<CardAuthForm bet={par} session={session} role="party1" onSuccess={(pid)=>handleP1ParlayCardAuth(par,pid)} onCancel={()=>setView("list")} />}
              {par.status===STATUS.AWAITING_P1_AUTH&&!isParty1&&<ABox color={T.blue}><div style={S.aTitle}>⏳ Creator authorizing card</div></ABox>}
              {par.status===STATUS.PENDING&&isParty2&&<ABox color={T.orange}><div style={S.aTitle}>🔗 You've been challenged to a Parlay!</div><div style={S.aSub}>{par.name} · ${par.total_stake} · {par.legs.length} legs</div><button style={S.okBtn} onClick={()=>confirmParlay(par)}>Accept & Authorize Card →</button></ABox>}
              {par.status===STATUS.PENDING&&isParty1&&<ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {par.party2_email}</div></ABox>}
              {needsP2Auth&&<CardAuthForm bet={par} session={session} role="party2" onSuccess={(pid)=>handleP2ParlayCardAuth(par,pid)} onCancel={()=>setView("list")} />}
              {par.status===STATUS.AWAITING_P2_AUTH&&!isParty2&&<ABox color={T.blue}><div style={S.aTitle}>💳 Opponent authorizing card...</div></ABox>}
              {par.status===STATUS.ACTIVE&&sc<par.legs.length&&(isParty1||isParty2)&&<div style={{textAlign:"right",marginTop:12}}><button style={S.badBtn} onClick={()=>disputeParlay(par)}>Flag Dispute ⚠️</button></div>}
              {par.status===STATUS.AWAITING_REF&&isRef&&<ABox color={T.purple}><div style={S.aTitle}>⚖️ Confirm & Capture</div><div style={S.aSub}>{par.overall_winner} wins ${par.total_stake}</div><button style={S.okBtn} onClick={()=>refereeConfirmParlay(par)}>Confirm ✅</button></ABox>}
              {par.status===STATUS.AWAITING_REF&&!isRef&&<ABox color={T.purple}><div style={S.aTitle}>⚖️ Awaiting Referee</div></ABox>}
              {par.status===STATUS.SETTLING&&<ABox color={T.orange}><div style={S.aTitle}>⚡ Processing Payment...</div></ABox>}
              {par.status===STATUS.SETTLED&&<ABox color={T.green}><div style={S.aTitle}>✅ Parlay Settled</div><div style={S.aSub}>{par.overall_winner?.includes("SPLIT")?"Split — holds released.":`${par.overall_winner} wins $${par.total_stake}! 💳`}</div></ABox>}
              {par.status===STATUS.DISPUTED&&<ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed — Holds Released</div></ABox>}
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

function BetCard({bet,myEmail,onClick}){
  const isParty2 = myEmail===bet.party2_email?.toLowerCase();
  return(
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{bet.id}{bet.referee_email&&<span style={{color:"#5b2d8a",marginLeft:6}}>⚖️</span>}</span><Bdg status={bet.status}/></div>
      <div style={S.cMid}><div style={S.pts}>{isParty2?bet.party2_email:"You"} <span style={S.vs}>VS</span> {isParty2?"You":bet.party2_email}</div><div style={S.amt}>${bet.amount}</div></div>
      <div style={S.cBot}><span style={S.cat}>{bet.category}</span><span style={S.desc}>{bet.description}</span></div>
    </div>
  );
}

function ParlayCard({par,myEmail,onClick}){
  const sc=par.legs.filter(l=>l.settled).length;
  const isParty2 = myEmail===par.party2_email?.toLowerCase();
  return(
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{par.id}{par.referee_email&&<span style={{color:"#5b2d8a",marginLeft:6}}>⚖️</span>} <span style={{color:"#e8751a"}}>· {par.legs.length} legs</span></span><Bdg status={par.status}/></div>
      <div style={S.cMid}><div style={S.pts}>{isParty2?par.party2_email:"You"} <span style={S.vs}>VS</span> {isParty2?"You":par.party2_email}</div><div style={S.amt}>${par.total_stake}</div></div>
      <div style={S.cBot}><span style={S.cat}>🔗 Parlay</span><span style={S.desc}>{par.name} · {sc}/{par.legs.length} settled</span></div>
    </div>
  );
}

function Bdg({status}){return <span style={{...S.badge,background:STATUS_COLORS[status]||"#404d5c"}}>{STATUS_LABELS[status]||status}</span>;}
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
  sectionDivider:{fontSize:13,fontWeight:"bold",color:"#e8751a",margin:"20px 0 10px",borderBottom:"1px solid #3a424d",paddingBottom:8},
  refBox:{background:"#1a1040",border:"1px solid #3a424d",borderRadius:10,padding:14,marginBottom:12,display:"flex",flexDirection:"column",gap:10},
  refInfo:{fontSize:12,color:"#6b7a8a",lineHeight:1.5},
  refBadge:{background:"#2a1a4a",border:"1px solid #5b2d8a",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#a78bda",marginBottom:16},
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
  paymentForm:{background:"#1a1a2e",border:"1px solid #3a424d",borderRadius:10,padding:"20px",marginTop:18,display:"flex",flexDirection:"column",gap:12},
  cardBox:{background:"#0d0d1a",border:"1px solid #3a424d",borderRadius:8,padding:"16px"},
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

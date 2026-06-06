
import { useState } from "react";

const T = {
  bg:        "#1c1f23",
  surface:   "#252a30",
  panel:     "#2e343c",
  border:    "#3a424d",
  orange:    "#e8751a",
  orangeDim: "#7a3c0d",
  text:      "#d4dbe3",
  textDim:   "#6b7a8a",
  textMuted: "#404d5c",
  green:     "#2e7d52",
  red:       "#8b2525",
  blue:      "#1e5a8a",
};

const CATEGORIES = ["⛳ Golf", "🎮 Video Game", "🏀 Sports", "🎯 Darts", "🎱 Pool", "🃏 Cards", "🏌️ Other"];
const STATUS = { PENDING: "pending", ACTIVE: "active", SETTLED: "settled", DISPUTED: "disputed" };
const STATUS_COLORS = { pending: "#b87a10", active: "#2e7d52", settled: "#1e5a8a", disputed: "#8b2525" };
const STATUS_LABELS = { pending: "Awaiting Confirm", active: "Locked In", settled: "Settled", disputed: "Disputed" };

function uid(prefix = "BET") { return `${prefix}-${Math.random().toString(36).substr(2,6).toUpperCase()}`; }
function fmt(iso) { return new Date(iso).toLocaleString(); }
function now() { return new Date().toISOString(); }

export default function App() {
  const [bets, setBets] = useState([]);
  const [parlays, setParlays] = useState([]);
  const [tab, setTab] = useState("bets");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const blankBet = { party1:"", party2:"", amount:"", category: CATEGORIES[0], description:"", terms:"" };
  const [betForm, setBetForm] = useState(blankBet);
  const blankParlay = { name:"", party1:"", party2:"", totalStake:"" };
  const [parlayForm, setParlayForm] = useState(blankParlay);
  const blankLeg = { description:"", category: CATEGORIES[0] };
  const [legs, setLegs] = useState([{ ...blankLeg }]);
  const [confirmName, setConfirmName] = useState("");
  const [winnerSel, setWinnerSel] = useState("");

  function toast_(msg, type="ok") { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }

  function createBet() {
    const f = betForm;
    if (!f.party1 || !f.party2 || !f.amount || !f.description) return toast_("Fill all required fields.", "err");
    if (f.party1.trim().toLowerCase() === f.party2.trim().toLowerCase()) return toast_("Parties must be different.", "err");
    const bet = { id: uid(), ...f, amount: parseFloat(f.amount), status: STATUS.PENDING, createdAt: now(), confirmedBy: [], winner: null, history: [{ action: `Bet created by ${f.party1}`, time: now() }] };
    setBets(p => [bet, ...p]); setBetForm(blankBet); setView("list");
    toast_(`${bet.id} created!`);
  }

  function confirmBet(bet) {
    const name = confirmName.trim();
    if (!name) return toast_("Enter your name.", "err");
    if (name.toLowerCase() !== bet.party2.toLowerCase()) return toast_(`Only ${bet.party2} can confirm.`, "err");
    const updated = { ...bet, status: STATUS.ACTIVE, confirmedBy: [...bet.confirmedBy, name.toLowerCase()], history: [...bet.history, { action: `${name} confirmed — LOCKED 🔒`, time: now() }] };
    setBets(p => p.map(b => b.id === bet.id ? updated : b)); setSelected(updated); setConfirmName("");
    toast_("Bet locked! 🔒");
  }

  function settleBet(bet) {
    if (!winnerSel) return toast_("Select a winner.", "err");
    const loser = winnerSel === bet.party1 ? bet.party2 : bet.party1;
    const updated = { ...bet, status: STATUS.SETTLED, winner: winnerSel, history: [...bet.history, { action: `✅ ${winnerSel} wins $${bet.amount.toFixed(2)} from ${loser}`, time: now() }] };
    setBets(p => p.map(b => b.id === bet.id ? updated : b)); setSelected(updated); setWinnerSel("");
    toast_(`${winnerSel} wins! 🏆`);
  }

  function disputeBet(bet) {
    const updated = { ...bet, status: STATUS.DISPUTED, history: [...bet.history, { action: "⚠️ DISPUTED.", time: now() }] };
    setBets(p => p.map(b => b.id === bet.id ? updated : b)); setSelected(updated);
    toast_("Flagged as disputed.", "err");
  }

  function addLeg() { setLegs(p => [...p, { ...blankLeg }]); }
  function removeLeg(i) { setLegs(p => p.filter((_, idx) => idx !== i)); }
  function updateLeg(i, field, val) { setLegs(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l)); }

  function createParlay() {
    const f = parlayForm;
    if (!f.party1 || !f.party2 || !f.totalStake || legs.length < 2) return toast_("Need both parties, stake, and 2+ legs.", "err");
    if (legs.some(l => !l.description)) return toast_("All legs need a description.", "err");
    const parlay = { id: uid("PAR"), party1: f.party1, party2: f.party2, name: f.name || `${f.party1} vs ${f.party2} Parlay`, totalStake: parseFloat(f.totalStake), legs: legs.map((l, i) => ({ ...l, id: i, winner: null, settled: false })), status: STATUS.PENDING, createdAt: now(), confirmedBy: [], overallWinner: null, history: [{ action: `Parlay created by ${f.party1} (${legs.length} legs)`, time: now() }] };
    setParlays(p => [parlay, ...p]); setParlayForm(blankParlay); setLegs([{ ...blankLeg }]); setView("list"); setTab("parlays");
    toast_(`${parlay.id} created!`);
  }

  function confirmParlay(parlay) {
    const name = confirmName.trim();
    if (!name) return toast_("Enter your name.", "err");
    if (name.toLowerCase() !== parlay.party2.toLowerCase()) return toast_(`Only ${parlay.party2} can confirm.`, "err");
    const updated = { ...parlay, status: STATUS.ACTIVE, confirmedBy: [...parlay.confirmedBy, name.toLowerCase()], history: [...parlay.history, { action: `${name} confirmed — LOCKED 🔒`, time: now() }] };
    setParlays(p => p.map(pl => pl.id === parlay.id ? updated : pl)); setSelected(updated); setConfirmName("");
    toast_("Parlay locked! 🔒");
  }

  function settleLeg(parlay, legId, winner) {
    const updatedLegs = parlay.legs.map(l => l.id === legId ? { ...l, winner, settled: true } : l);
    const allSettled = updatedLegs.every(l => l.settled);
    let overallWinner = null; let newStatus = parlay.status;
    if (allSettled) {
      const p1Wins = updatedLegs.every(l => l.winner === parlay.party1);
      const p2Wins = updatedLegs.every(l => l.winner === parlay.party2);
      overallWinner = p1Wins ? parlay.party1 : p2Wins ? parlay.party2 : "SPLIT — No parlay winner";
      newStatus = STATUS.SETTLED;
    }
    const logEntry = { action: `Leg ${legId + 1} settled: ${winner} wins`, time: now() };
    const finalLog = allSettled ? [...parlay.history, logEntry, { action: `🏆 Parlay settled: ${overallWinner}`, time: now() }] : [...parlay.history, logEntry];
    const updated = { ...parlay, legs: updatedLegs, overallWinner, status: newStatus, history: finalLog };
    setParlays(p => p.map(pl => pl.id === parlay.id ? updated : pl)); setSelected(updated);
    toast_(allSettled ? `Parlay done! ${overallWinner} 🏆` : `Leg ${legId + 1} settled.`);
  }

  function disputeParlay(parlay) {
    const updated = { ...parlay, status: STATUS.DISPUTED, history: [...parlay.history, { action: "⚠️ Parlay DISPUTED.", time: now() }] };
    setParlays(p => p.map(pl => pl.id === parlay.id ? updated : pl)); setSelected(updated);
    toast_("Parlay disputed.", "err");
  }

  const activeStake = [...bets.filter(b => b.status === STATUS.ACTIVE).map(b => b.amount), ...parlays.filter(p => p.status === STATUS.ACTIVE).map(p => p.totalStake)].reduce((s, v) => s + v, 0);
  const filteredBets = filter === "all" ? bets : bets.filter(b => b.status === filter);
  const filteredParlays = filter === "all" ? parlays : parlays.filter(p => p.status === filter);

  return (
    <div style={S.root}>
      <style>{css}</style>
      {toast && <div style={{ ...S.toast, background: toast.type === "err" ? T.red : "#1c3d28" }}>{toast.msg}</div>}
      <header style={S.header}>
        <div style={S.logo}><span style={S.logoIcon}>⚖</span><div><div style={S.logoTitle}>ESCROW BET</div><div style={S.logoSub}>Side Bet Tracker</div></div></div>
        <div style={S.stats}>
          {[{ l:"Active", v: bets.filter(b=>b.status===STATUS.ACTIVE).length + parlays.filter(p=>p.status===STATUS.ACTIVE).length }, { l:"In Play", v:`$${activeStake.toFixed(2)}` }, { l:"Settled", v: bets.filter(b=>b.status===STATUS.SETTLED).length + parlays.filter(p=>p.status===STATUS.SETTLED).length }].map(s => (
            <div key={s.l} style={S.stat}><span style={S.statN}>{s.v}</span><span style={S.statL}>{s.l}</span></div>
          ))}
        </div>
      </header>

      {view === "list" && (
        <div style={S.page}>
          <div style={S.tabRow}>
            <button style={{ ...S.tab, ...(tab==="bets" ? S.tabOn : {}) }} onClick={() => setTab("bets")}>Single Bets <span style={S.tabCt}>{bets.length}</span></button>
            <button style={{ ...S.tab, ...(tab==="parlays" ? S.tabOn : {}) }} onClick={() => setTab("parlays")}>Parlays <span style={S.tabCt}>{parlays.length}</span></button>
          </div>
          <div style={S.toolbar}>
            <div style={S.filters}>
              {["all", STATUS.PENDING, STATUS.ACTIVE, STATUS.SETTLED, STATUS.DISPUTED].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ ...S.fBtn, ...(filter===f ? S.fBtnOn : {}) }}>{f==="all"?"All":STATUS_LABELS[f]}</button>
              ))}
            </div>
            <button style={S.newBtn} onClick={() => setView(tab==="bets"?"createBet":"createParlay")}>+ New {tab==="bets"?"Bet":"Parlay"}</button>
          </div>
          {tab==="bets" && (filteredBets.length===0 ? <Empty label="No bets yet." /> : <div style={S.list}>{filteredBets.map(b => <BetCard key={b.id} bet={b} onClick={() => { setSelected(b); setView("detailBet"); }} />)}</div>)}
          {tab==="parlays" && (filteredParlays.length===0 ? <Empty label="No parlays yet." /> : <div style={S.list}>{filteredParlays.map(p => <ParlayCard key={p.id} par={p} onClick={() => { setSelected(p); setView("detailParlay"); }} />)}</div>)}
        </div>
      )}

      {view === "createBet" && (
        <div style={S.page}>
          <Back onClick={() => setView("list")} />
          <div style={S.card}><div style={S.cardTitle}>🎯 New Single Bet</div>
            <div style={S.g2}>
              <F label="Your Name *"><input style={S.input} placeholder="Party 1" value={betForm.party1} onChange={e => setBetForm({...betForm, party1: e.target.value})} /></F>
              <F label="Opponent *"><input style={S.input} placeholder="Party 2" value={betForm.party2} onChange={e => setBetForm({...betForm, party2: e.target.value})} /></F>
              <F label="Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={betForm.amount} onChange={e => setBetForm({...betForm, amount: e.target.value})} /></F>
              <F label="Category"><select style={S.input} value={betForm.category} onChange={e => setBetForm({...betForm, category: e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></F>
              <F label="What's the Bet? *" full><input style={S.input} placeholder="e.g. Back 9 lowest score wins" value={betForm.description} onChange={e => setBetForm({...betForm, description: e.target.value})} /></F>
              <F label="Terms" full><textarea style={{ ...S.input, height:72, resize:"vertical" }} placeholder="Handicaps, rules..." value={betForm.terms} onChange={e => setBetForm({...betForm, terms: e.target.value})} /></F>
            </div>
            <div style={S.note}>⚠️ Once confirmed by both parties the bet locks permanently.</div>
            <button style={S.subBtn} onClick={createBet}>Create Bet →</button>
          </div>
        </div>
      )}

      {view === "createParlay" && (
        <div style={S.page}>
          <Back onClick={() => setView("list")} />
          <div style={S.card}><div style={S.cardTitle}>🔗 New Parlay</div>
            <div style={S.info}>Chain multiple legs. <strong>All legs must be won by the same person</strong> to win the pot.</div>
            <div style={S.g2}>
              <F label="Parlay Name"><input style={S.input} placeholder="e.g. Sunday Sweep" value={parlayForm.name} onChange={e => setParlayForm({...parlayForm, name: e.target.value})} /></F>
              <F label="Total Stake ($) *"><input style={S.input} type="number" placeholder="0.00" value={parlayForm.totalStake} onChange={e => setParlayForm({...parlayForm, totalStake: e.target.value})} /></F>
              <F label="Your Name *"><input style={S.input} placeholder="Party 1" value={parlayForm.party1} onChange={e => setParlayForm({...parlayForm, party1: e.target.value})} /></F>
              <F label="Opponent *"><input style={S.input} placeholder="Party 2" value={parlayForm.party2} onChange={e => setParlayForm({...parlayForm, party2: e.target.value})} /></F>
            </div>
            <div style={S.legsHdr}><span style={{ fontWeight:"bold", color:T.text }}>Legs ({legs.length})</span><button style={S.addLeg} onClick={addLeg}>+ Add Leg</button></div>
            {legs.map((leg, i) => (
              <div key={i} style={S.legCard}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:12, color:T.orange, fontWeight:"bold" }}>Leg {i+1}</span>
                  {legs.length > 2 && <button style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer" }} onClick={() => removeLeg(i)}>✕</button>}
                </div>
                <div style={S.g2}>
                  <F label="Category"><select style={S.input} value={leg.category} onChange={e => updateLeg(i,"category",e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></F>
                  <F label="Description *" full><input style={S.input} placeholder="e.g. Front 9 lowest score" value={leg.description} onChange={e => updateLeg(i,"description",e.target.value)} /></F>
                </div>
              </div>
            ))}
            <div style={S.note}>⚠️ All legs must be won by the same party to win.</div>
            <button style={S.subBtn} onClick={createParlay}>Create Parlay →</button>
          </div>
        </div>
      )}

      {view === "detailBet" && selected && (() => {
        const bet = bets.find(b => b.id === selected.id) || selected;
        return (
          <div style={S.page}><Back onClick={() => setView("list")} />
            <div style={S.card}>
              <DHeader id={bet.id} cat={bet.category} status={bet.status} />
              <Pot amount={`$${bet.amount.toFixed(2)}`} label="Pot" sub="Winner takes all" />
              <Parties p1={bet.party1} p2={bet.party2} winner={bet.winner} confirmed={bet.confirmedBy.includes(bet.party2.toLowerCase())} />
              <Sec title="Details"><Row k="Description" v={bet.description} />{bet.terms && <Row k="Terms" v={bet.terms} />}<Row k="Created" v={fmt(bet.createdAt)} /></Sec>
              {bet.status===STATUS.PENDING && <ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {bet.party2}</div><div style={S.aSub}>Share ID <strong style={{color:T.orange}}>{bet.id}</strong></div><input style={S.input} placeholder={`Type "${bet.party2}" to confirm`} value={confirmName} onChange={e => setConfirmName(e.target.value)} /><button style={S.okBtn} onClick={() => confirmBet(bet)}>Confirm & Lock 🔒</button></ABox>}
              {bet.status===STATUS.ACTIVE && <ABox color={T.green}><div style={S.aTitle}>🏆 Settle the Bet</div><select style={S.input} value={winnerSel} onChange={e => setWinnerSel(e.target.value)}><option value="">— Select Winner —</option><option>{bet.party1}</option><option>{bet.party2}</option></select><div style={{display:"flex",gap:10}}><button style={S.okBtn} onClick={() => settleBet(bet)}>Settle ✅</button><button style={S.badBtn} onClick={() => disputeBet(bet)}>Dispute ⚠️</button></div></ABox>}
              {bet.status===STATUS.SETTLED && <ABox color={T.blue}><div style={S.aTitle}>✅ Settled</div><div style={S.aSub}>{bet.winner} wins ${bet.amount.toFixed(2)}!</div></ABox>}
              {bet.status===STATUS.DISPUTED && <ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <Log history={bet.history} />
            </div>
          </div>
        );
      })()}

      {view === "detailParlay" && selected && (() => {
        const par = parlays.find(p => p.id === selected.id) || selected;
        const sc = par.legs.filter(l => l.settled).length;
        return (
          <div style={S.page}><Back onClick={() => setView("list")} />
            <div style={S.card}>
              <DHeader id={par.id} cat={`🔗 ${par.legs.length}-Leg Parlay`} status={par.status} />
              <div style={{ fontSize:14, color:T.textDim, marginBottom:16, fontStyle:"italic" }}>{par.name}</div>
              <Pot amount={`$${par.totalStake.toFixed(2)}`} label="Parlay Pot" sub={`${sc}/${par.legs.length} legs settled`} />
              <Parties p1={par.party1} p2={par.party2} winner={par.overallWinner} confirmed={par.confirmedBy.includes(par.party2.toLowerCase())} />
              <Sec title={`Legs (${par.legs.length})`}>
                {par.legs.map((leg, i) => (
                  <div key={leg.id} style={{ ...S.legDetail, borderColor: leg.settled ? T.border : T.orange }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:T.orange, fontWeight:"bold" }}>Leg {i+1} — {leg.category}</span>
                      {leg.settled ? <span style={{ ...S.badge, background:T.green }}>✅ {leg.winner}</span> : <span style={{ ...S.badge, background:T.textMuted }}>Pending</span>}
                    </div>
                    <div style={{ fontSize:13, color:T.textDim, fontStyle:"italic" }}>{leg.description}</div>
                    {par.status===STATUS.ACTIVE && !leg.settled && <LegSettler leg={leg} par={par} onSettle={(id,w) => settleLeg(par,id,w)} />}
                  </div>
                ))}
              </Sec>
              {par.status===STATUS.PENDING && <ABox color={T.orange}><div style={S.aTitle}>⏳ Waiting for {par.party2}</div><div style={S.aSub}>Share <strong style={{color:T.orange}}>{par.id}</strong></div><input style={S.input} placeholder={`Type "${par.party2}" to confirm`} value={confirmName} onChange={e => setConfirmName(e.target.value)} /><button style={S.okBtn} onClick={() => confirmParlay(par)}>Confirm Parlay 🔒</button></ABox>}
              {par.status===STATUS.ACTIVE && sc < par.legs.length && <div style={{textAlign:"right",marginTop:12}}><button style={S.badBtn} onClick={() => disputeParlay(par)}>Flag Dispute ⚠️</button></div>}
              {par.status===STATUS.SETTLED && <ABox color={T.blue}><div style={S.aTitle}>✅ Parlay Settled</div><div style={S.aSub}>{par.overallWinner?.includes("SPLIT") ? "Split — no single winner." : `${par.overallWinner} wins $${par.totalStake.toFixed(2)}`}</div></ABox>}
              {par.status===STATUS.DISPUTED && <ABox color={T.red}><div style={S.aTitle}>⚠️ Disputed</div><div style={S.aSub}>Resolve manually.</div></ABox>}
              <Log history={par.history} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function LegSettler({ leg, par, onSettle }) {
  const [w, setW] = useState("");
  return (
    <div style={{ display:"flex", gap:8, marginTop:10 }}>
      <select style={{ ...S.input, flex:1 }} value={w} onChange={e => setW(e.target.value)}>
        <option value="">Who won?</option><option>{par.party1}</option><option>{par.party2}</option>
      </select>
      <button style={{ ...S.okBtn, padding:"8px 14px" }} onClick={() => { if(w) onSettle(leg.id, w); }}>Settle</button>
    </div>
  );
}

function BetCard({ bet, onClick }) {
  return (
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{bet.id}</span><Bdg status={bet.status} /></div>
      <div style={S.cMid}><div style={S.pts}>{bet.party1} <span style={S.vs}>VS</span> {bet.party2}</div><div style={S.amt}>${bet.amount.toFixed(2)}</div></div>
      <div style={S.cBot}><span style={S.cat}>{bet.category}</span><span style={S.desc}>{bet.description}</span></div>
    </div>
  );
}

function ParlayCard({ par, onClick }) {
  const sc = par.legs.filter(l => l.settled).length;
  return (
    <div style={S.betCard} className="hov" onClick={onClick}>
      <div style={S.cTop}><span style={S.idTag}>{par.id} <span style={{color:"#e8751a"}}>· {par.legs.length} legs</span></span><Bdg status={par.status} /></div>
      <div style={S.cMid}><div style={S.pts}>{par.party1} <span style={S.vs}>VS</span> {par.party2}</div><div style={S.amt}>${par.totalStake.toFixed(2)}</div></div>
      <div style={S.cBot}><span style={S.cat}>🔗 Parlay</span><span style={S.desc}>{par.name} · {sc}/{par.legs.length} settled</span></div>
    </div>
  );
}

function Bdg({ status }) { return <span style={{ ...S.badge, background: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>; }
function Pot({ amount, label, sub }) { return <div style={S.pot}><div style={S.potL}>{label}</div><div style={S.potA}>{amount}</div><div style={S.potS}>{sub}</div></div>; }
function Parties({ p1, p2, winner, confirmed }) {
  return (
    <div style={S.parties}>
      <div style={{ ...S.pBox, ...(winner===p1 ? S.pWin : {}) }}><div style={S.pName}>{p1}</div><div style={S.pRole}>Creator</div>{winner===p1 && <div style={S.wBdg}>🏆 Winner</div>}</div>
      <div style={S.vsCirc}>VS</div>
      <div style={{ ...S.pBox, ...(winner===p2 ? S.pWin : {}) }}><div style={S.pName}>{p2}</div><div style={S.pRole}>{confirmed?"✅ Confirmed":"⏳ Pending"}</div>{winner===p2 && <div style={S.wBdg}>🏆 Winner</div>}</div>
    </div>
  );
}
function DHeader({ id, cat, status }) { return <div style={S.dHdr}><div><div style={S.dId}>{id}</div><div style={S.dCat}>{cat}</div></div><Bdg status={status} /></div>; }
function Sec({ title, children }) { return <div style={S.sec}><div style={S.secT}>{title}</div>{children}</div>; }
function Row({ k, v }) { return <div style={S.row}><span style={S.rK}>{k}</span><span style={S.rV}>{v}</span></div>; }
function ABox({ color, children }) { return <div style={{ ...S.aBox, borderColor: color }}>{children}</div>; }
function Log({ history }) { return <Sec title="Activity Log">{history.map((h,i) => <div key={i} style={S.logRow}><span style={S.logDot}>◆</span><div><div style={S.logA}>{h.action}</div><div style={S.logT}>{fmt(h.time)}</div></div></div>)}</Sec>; }
function F({ label, children, full }) { return <div style={{ display:"flex", flexDirection:"column", gap:5, ...(full?{gridColumn:"1/-1"}:{}) }}><label style={S.fLbl}>{label}</label>{children}</div>; }
function Back({ onClick }) { return <button style={S.back} onClick={onClick}>← Back</button>; }
function Empty({ label }) { return <div style={S.empty}><div style={{fontSize:44,marginBottom:12}}>🤝</div><div style={{color:"#6b7a8a"}}>{label}</div></div>; }

const S = {
  root:    { minHeight:"100vh", background:"#1c1f23", color:"#d4dbe3", fontFamily:"'Trebuchet MS',sans-serif", position:"relative" },
  toast:   { position:"fixed", top:16, right:16, padding:"12px 20px", borderRadius:8, color:"#fff", fontSize:13, zIndex:9999, maxWidth:320, boxShadow:"0 4px 24px rgba(0,0,0,0.5)" },
  header:  { background:"#252a30", borderBottom:"2px solid #e8751a", padding:"14px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 },
  logo:    { display:"flex", alignItems:"center", gap:12 },
  logoIcon:{ fontSize:28, color:"#e8751a" },
  logoTitle:{ fontSize:20, fontWeight:"bold", letterSpacing:3, color:"#e8751a" },
  logoSub: { fontSize:10, color:"#6b7a8a", letterSpacing:2, textTransform:"uppercase" },
  stats:   { display:"flex", gap:24, flexWrap:"wrap" },
  stat:    { display:"flex", flexDirection:"column", alignItems:"center" },
  statN:   { fontSize:20, fontWeight:"bold", color:"#e8751a" },
  statL:   { fontSize:10, color:"#6b7a8a", textTransform:"uppercase", letterSpacing:1 },
  page:    { maxWidth:800, margin:"0 auto", padding:"22px 14px 60px" },
  tabRow:  { display:"flex", gap:4, marginBottom:18, borderBottom:"1px solid #3a424d" },
  tab:     { padding:"10px 20px", background:"none", border:"none", color:"#6b7a8a", fontSize:14, cursor:"pointer", borderBottom:"2px solid transparent", marginBottom:-1 },
  tabOn:   { color:"#e8751a", borderBottom:"2px solid #e8751a" },
  tabCt:   { marginLeft:6, background:"#2e343c", padding:"2px 7px", borderRadius:10, fontSize:11 },
  toolbar: { display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:16 },
  filters: { display:"flex", gap:6, flexWrap:"wrap" },
  fBtn:    { padding:"5px 12px", borderRadius:20, border:"1px solid #3a424d", background:"none", color:"#6b7a8a", fontSize:11, cursor:"pointer" },
  fBtnOn:  { background:"#e8751a", borderColor:"#e8751a", color:"#000", fontWeight:"bold" },
  newBtn:  { padding:"9px 20px", background:"#e8751a", color:"#000", border:"none", borderRadius:8, fontWeight:"bold", fontSize:13, cursor:"pointer" },
  list:    { display:"flex", flexDirection:"column", gap:12 },
  empty:   { textAlign:"center", padding:"70px 20px" },
  betCard: { background:"#252a30", border:"1px solid #3a424d", borderRadius:12, padding:"16px 18px", cursor:"pointer", transition:"border-color 0.18s" },
  cTop:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  idTag:   { fontFamily:"monospace", fontSize:11, color:"#404d5c" },
  cMid:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  pts:     { fontSize:15, fontWeight:"bold", color:"#d4dbe3" },
  vs:      { margin:"0 8px", fontSize:10, color:"#e8751a", letterSpacing:2 },
  amt:     { fontSize:20, fontWeight:"bold", color:"#e8751a", fontFamily:"monospace" },
  cBot:    { display:"flex", gap:10, alignItems:"center" },
  cat:     { fontSize:11, color:"#6b7a8a" },
  desc:    { fontSize:12, color:"#6b7a8a", fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:300 },
  badge:   { padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:"bold", color:"#fff", letterSpacing:0.5, whiteSpace:"nowrap" },
  card:    { background:"#252a30", border:"1px solid #3a424d", borderRadius:14, padding:"24px 22px" },
  cardTitle:{ fontSize:20, fontWeight:"bold", color:"#e8751a", marginBottom:20 },
  g2:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  fLbl:    { fontSize:11, color:"#6b7a8a", letterSpacing:1, textTransform:"uppercase" },
  input:   { background:"#1c1f23", border:"1px solid #3a424d", borderRadius:8, padding:"9px 13px", color:"#d4dbe3", fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  note:    { margin:"16px 0 12px", fontSize:12, color:"#6b7a8a", fontStyle:"italic" },
  subBtn:  { width:"100%", padding:"13px", background:"#e8751a", color:"#000", border:"none", borderRadius:8, fontSize:15, fontWeight:"bold", cursor:"pointer" },
  info:    { background:"#2e343c", border:"1px solid #3a424d", borderRadius:8, padding:"12px 14px", fontSize:13, color:"#6b7a8a", marginBottom:18, lineHeight:1.5 },
  legsHdr: { display:"flex", justifyContent:"space-between", alignItems:"center", margin:"20px 0 12px" },
  addLeg:  { padding:"6px 14px", background:"#7a3c0d", color:"#e8751a", border:"1px solid #e8751a", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:"bold" },
  legCard: { background:"#2e343c", border:"1px solid #3a424d", borderRadius:10, padding:"14px", marginBottom:10 },
  back:    { background:"none", border:"none", color:"#e8751a", fontSize:13, cursor:"pointer", marginBottom:18, padding:0 },
  dHdr:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 },
  dId:     { fontFamily:"monospace", fontSize:12, color:"#404d5c", marginBottom:4 },
  dCat:    { fontSize:17, color:"#d4dbe3", fontWeight:"bold" },
  pot:     { background:"#1c1f23", border:"2px solid #e8751a", borderRadius:12, padding:"18px", textAlign:"center", marginBottom:20 },
  potL:    { fontSize:10, color:"#e8751a", letterSpacing:3, marginBottom:4, textTransform:"uppercase" },
  potA:    { fontSize:40, fontWeight:"bold", color:"#e8751a", fontFamily:"monospace" },
  potS:    { fontSize:11, color:"#6b7a8a", marginTop:4 },
  parties: { display:"flex", alignItems:"center", gap:12, marginBottom:20 },
  pBox:    { flex:1, background:"#1c1f23", border:"1px solid #3a424d", borderRadius:10, padding:"14px", textAlign:"center" },
  pWin:    { borderColor:"#e8751a", background:"#7a3c0d" },
  pName:   { fontSize:16, fontWeight:"bold", marginBottom:4 },
  pRole:   { fontSize:11, color:"#6b7a8a" },
  wBdg:    { marginTop:6, fontSize:12, color:"#e8751a" },
  vsCirc:  { fontSize:12, fontWeight:"bold", color:"#e8751a", letterSpacing:2, flexShrink:0 },
  sec:     { borderTop:"1px solid #3a424d", paddingTop:18, marginTop:18 },
  secT:    { fontSize:10, color:"#404d5c", letterSpacing:2, textTransform:"uppercase", marginBottom:12 },
  row:     { display:"flex", justifyContent:"space-between", gap:12, padding:"7px 0", borderBottom:"1px solid #2e343c", fontSize:13 },
  rK:      { color:"#6b7a8a", flexShrink:0 },
  rV:      { color:"#d4dbe3", textAlign:"right" },
  aBox:    { background:"#1c1f23", border:"1px solid #3a424d", borderRadius:10, padding:"18px", marginTop:18, display:"flex", flexDirection:"column", gap:10 },
  aTitle:  { fontSize:15, fontWeight:"bold", color:"#d4dbe3" },
  aSub:    { fontSize:13, color:"#6b7a8a" },
  okBtn:   { padding:"11px", background:"#2e7d52", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:"bold", cursor:"pointer" },
  badBtn:  { padding:"11px", background:"#8b2525", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:"bold", cursor:"pointer" },
  legDetail:{ background:"#1c1f23", border:"1px solid #3a424d", borderRadius:10, padding:"14px", marginBottom:10 },
  logRow:  { display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid #2e343c" },
  logDot:  { color:"#e8751a", fontSize:8, marginTop:4, flexShrink:0 },
  logA:    { fontSize:13, color:"#d4dbe3", marginBottom:2 },
  logT:    { fontSize:11, color:"#404d5c", fontFamily:"monospace" },
};

const css = `
  * { box-sizing: border-box; }
  .hov:hover { border-color: #e8751a !important; }
  input:focus, select:focus, textarea:focus { border-color: #e8751a !important; }
  @media (max-width:520px) { div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; } }
`;

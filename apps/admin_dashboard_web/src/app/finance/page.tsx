"use client";
import SupportInbox from "./support-inbox";

import { FormEvent, useEffect, useState } from "react";

type Policy = {revision:number; commissionBps:number; platformFeeMinor:string; changedBy?:string; createdAt?:string};
type Provider = {id:string; name:string; email:string; jobs:number; held:string; completedCollections:string; commission:string; platformFees:string; available:string; payoutPending:string};
type Job = {id:string; status:string; totalAmount:string; commission:string; platformFee:string; providerNet:string; commissionPercent:number; pricingRevision:number; paymentMode:string};
type Collections = {paymentMode:string; providers:Provider[]; nextCursor:string|null; totals:{kind:string; amount:string}[]};
type PendingKyc = {id:string; name:string; email:string; phoneNumber:string; secondaryPhone:string; address:string; idType:string; submittedAt:string; kycStatus:string};
const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const inr = (value:string|number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(value));

export default function Finance() {
  const [token,setToken] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [resetMode,setResetMode] = useState<"login"|"request"|"reset">("login");
  const [resetToken,setResetToken] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [data,setData] = useState<Collections|null>(null);
  const [policy,setPolicy] = useState<Policy|null>(null);
  const [history,setHistory] = useState<Policy[]>([]);
  const [percent,setPercent] = useState("0");
  const [fee,setFee] = useState("2");
  const [travelMinimum,setTravelMinimum] = useState("50");
  const [travelIncludedKm,setTravelIncludedKm] = useState("2.5");
  const [travelPerKm,setTravelPerKm] = useState("8");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [selected,setSelected] = useState<Provider|null>(null);
  const [jobs,setJobs] = useState<Job[]>([]);
  const [jobCursor,setJobCursor] = useState<string|null>(null);
  const [pendingKyc,setPendingKyc] = useState<PendingKyc[]>([]);
  const [canReviewKyc,setCanReviewKyc] = useState(false);
  const [kycPreview,setKycPreview] = useState<{id:string;front:string;back:string}|null>(null);
  useEffect(()=>()=>{if(kycPreview){URL.revokeObjectURL(kycPreview.front);URL.revokeObjectURL(kycPreview.back);}},[kycPreview]);

  async function request(path:string, auth:string, body?:unknown, method?:string) {
    const r = await fetch(base+path,{method:method||(body===undefined?"GET":"POST"),headers:{"Content-Type":"application/json",...(auth?{Authorization:`Bearer ${auth}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const result = await r.json();
    if (!r.ok) throw new Error(Array.isArray(result.message)?result.message.join(", "):result.message||"Request failed");
    return result;
  }
  async function load(auth:string, after?:string) {
    setBusy(true); setError("");
    try {
      const collections:Collections = await request(`/admin/finance/collections${after?`?after=${after}`:""}`,auth);
      setData(previous=>after&&previous?{...collections,providers:[...previous.providers,...collections.providers]}:collections);
      if (!after) {
        try { setPendingKyc(await request("/users/mechanics/pending",auth)); setCanReviewKyc(true); }
        catch { setPendingKyc([]); setCanReviewKyc(false); }
        const settings = await request("/admin/finance/settings",auth);
        setPolicy(settings.policy); setHistory(settings.history);
        setPercent(String(settings.policy.commissionBps/100)); setFee(String(Number(settings.policy.platformFeeMinor)/100));
        setTravelMinimum(String(Number(settings.policy.travelMinimumMinor ?? 5000)/100)); setTravelIncludedKm(String(Number(settings.policy.travelIncludedMeters ?? 2500)/1000)); setTravelPerKm(String(Number(settings.policy.travelPerKmMinor ?? 800)/100));
      }
    } catch(e) { setError(e instanceof Error?e.message:"Unable to load finance"); }
    finally { setBusy(false); }
  }
  useEffect(()=>{ const saved=sessionStorage.getItem("qmFinanceToken"); if(saved){setToken(saved); void load(saved);} },[]);
  async function login(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request("/auth/admin-login","",{email,password});
      if (!["SUPER_ADMIN","CEO"].includes(result.role)) throw new Error("This account does not have finance access.");
      sessionStorage.setItem("qmFinanceToken",result.accessToken); setToken(result.accessToken); setPassword(""); await load(result.accessToken);
    } catch(e) { setError(e instanceof Error?e.message:"Login failed"); }
    finally { setBusy(false); }
  }
  async function requestPasswordReset(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("/auth/forgot-password","",{email});
      setNotice(result.message); setResetMode("reset");
    } catch(e) { setError(e instanceof Error?e.message:"Unable to request password reset"); }
    finally { setBusy(false); }
  }
  async function resetPassword(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("/auth/reset-password","",{token:resetToken,newPassword});
      setNotice(result.message); setResetToken(""); setNewPassword(""); setResetMode("login");
    } catch(e) { setError(e instanceof Error?e.message:"Unable to reset password"); }
    finally { setBusy(false); }
  }
  async function save(e:FormEvent) {
    e.preventDefault(); if(!policy||busy)return;
    if(!window.confirm(`Apply ${percent}% commission and ${inr(fee)} customer platform fee to future quotations? Existing quotations stay unchanged.`))return;
    setBusy(true);setError("");setNotice("");
    try { await request("/admin/finance/settings",token,{commissionPercent:percent,platformFee:fee,travelMinimum,travelIncludedKm,travelPerKm,expectedRevision:policy.revision}); await load(token);setNotice("Pricing saved. Existing quotations keep their original rates."); }
    catch(e){setError(e instanceof Error?e.message:"Save failed");}finally{setBusy(false);}
  }
  async function viewJobs(p:Provider, before?:string) {
    setBusy(true);setError("");
    if(!before){setSelected(p);setJobs([]);setJobCursor(null);}
    try {const result=await request(`/admin/finance/jobs?providerId=${p.id}${before?`&before=${before}`:""}`,token);setJobs(old=>before?[...old,...result.jobs]:result.jobs);setJobCursor(result.nextCursor);}
    catch(e){setError(e instanceof Error?e.message:"Unable to load jobs");}finally{setBusy(false);}
  }
  async function reviewKyc(provider:PendingKyc, status:"APPROVED"|"REJECTED") {
    if(status==="APPROVED"&&kycPreview?.id!==provider.id){setError("Open and review both ID photos before approving KYC.");return;}
    if(!window.confirm(`${status === "APPROVED" ? "Approve" : "Reject"} KYC for ${provider.name}? Confirm the front and back ID photos, address, and contact details have been reviewed.`)) return;
    setBusy(true);setError("");
    try {
      await request(`/users/mechanics/${provider.id}/kyc`,token,{status,submittedAt:provider.submittedAt},"PATCH");
      setPendingKyc(previous=>previous.filter(item=>item.id!==provider.id));
      if(kycPreview?.id===provider.id)setKycPreview(null);
      setNotice(`KYC ${status.toLowerCase()} for ${provider.name}.`);
    } catch(e) {setError(e instanceof Error?e.message:"KYC review failed");}
    finally {setBusy(false);}
  }
  async function viewKyc(provider:PendingKyc) {
    setBusy(true);setError("");
    try {
      const images = await Promise.all(["front","back"].map(async side=>{
        const response = await fetch(`${base}/users/mechanics/${provider.id}/kyc/document/${side}`,
          {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error(`Unable to load ${side} ID photo`);
        return response.blob();
      }));
      setKycPreview({id:provider.id,front:URL.createObjectURL(images[0]),back:URL.createObjectURL(images[1])});
    } catch(e) {setError(e instanceof Error?e.message:"Unable to load ID photos");}
    finally {setBusy(false);}
  }
  const inputClass="block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white mt-2";
  const buttonClass="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-40 hover:bg-blue-500";
  return <main className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-10 space-y-7">
    {token&&<SupportInbox token={token}/>}
    <header className="flex flex-wrap justify-between gap-4"><div><p className="text-blue-400 text-sm">QuickMechanic Admin</p><h1 className="text-3xl font-semibold">Collections & pricing</h1><p className="text-slate-400 mt-2">Customer payments, provider earnings and company revenue.</p></div>{token&&<div className="flex gap-2 items-start"><button className={buttonClass} disabled={busy} onClick={()=>load(token)}>Refresh</button><button className="p-3 border border-slate-600 rounded-lg" onClick={()=>{sessionStorage.removeItem("qmFinanceToken");setToken("");setData(null);setJobs([]);setSelected(null);}}>Sign out</button></div>}</header>
    {error&&<p role="alert" className="p-4 rounded-lg bg-red-950 border border-red-700">{error}</p>}
    {notice&&<p role="status" className="text-emerald-300">{notice}</p>}
    {busy&&<p role="status" className="text-blue-300">Loading…</p>}
    {!token&&resetMode==="login"?<form onSubmit={login} className="max-w-md p-6 border border-slate-700 rounded-xl space-y-5"><h2 className="text-xl">Administrator sign in</h2><label className="block">Email<input className={inputClass} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Password<input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className={buttonClass} disabled={busy}>Sign in</button><button type="button" className="block text-sm text-blue-300 underline" onClick={()=>setResetMode("request")}>Forgot password?</button><p className="text-sm text-slate-400">Use an existing super administrator or CEO account. No default password.</p></form>
    :!token&&resetMode==="request"?<form onSubmit={requestPasswordReset} className="max-w-md p-6 border border-slate-700 rounded-xl space-y-5"><h2 className="text-xl">Reset administrator password</h2><label className="block">Email<input className={inputClass} type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className={buttonClass} disabled={busy}>Send reset token</button><button type="button" className="block text-sm text-blue-300 underline" onClick={()=>setResetMode("login")}>Back to sign in</button></form>
    :!token?<form onSubmit={resetPassword} className="max-w-md p-6 border border-slate-700 rounded-xl space-y-5"><h2 className="text-xl">Choose a new password</h2><label className="block">Reset token<input className={inputClass} required value={resetToken} onChange={e=>setResetToken(e.target.value)}/></label><label className="block">New password<input className={inputClass} type="password" minLength={8} autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><button className={buttonClass} disabled={busy}>Save new password</button><button type="button" className="block text-sm text-blue-300 underline" onClick={()=>setResetMode("login")}>Back to sign in</button></form>:<>
      {data&&<p className={`p-4 rounded-lg border ${data.paymentMode==="live"?"border-emerald-700 bg-emerald-950":"border-amber-600 bg-amber-950"}`}><strong>{data.paymentMode==="live"?"LIVE PAYMENTS":"TEST MODE — NO REAL MONEY"}</strong> · {data.paymentMode}. Withdrawals reserve funds; bank payout processing is separate.</p>}
      {data&&<section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[["Provider earnings released","PROVIDER_CREDIT"],["Company commission","COMPANY_COMMISSION"],["Customer platform fees","PLATFORM_FEE"],["Customer refunds","CUSTOMER_REFUND"]].map(([label,kind])=><article key={kind} className="p-5 bg-slate-900 border border-slate-800 rounded-xl"><p className="text-slate-400">{label}</p><p className="text-2xl mt-2">{inr(data.totals.find(t=>t.kind===kind)?.amount||"0")}</p></article>)}</section>}
      {canReviewKyc&&<section className="p-6 bg-slate-900 rounded-xl space-y-4">
        <h2 className="text-xl font-semibold">Provider KYC review</h2>
        <p className="text-sm text-slate-400">Review both private ID images, address and contact details before approving. Only approved providers can take jobs.</p>
        {pendingKyc.length===0?<p className="text-slate-400">No submitted applications are awaiting review.</p>:pendingKyc.map(provider=><div key={provider.id} className="border-t border-slate-700 pt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3"><div>
            <p className="font-semibold">{provider.name} · {provider.idType.replaceAll("_"," ")}</p>
            <p className="text-sm text-slate-400">{provider.email} · Primary {provider.phoneNumber} · Secondary {provider.secondaryPhone}</p>
            <p className="text-sm text-slate-300">Address: {provider.address}</p>
            <p className="text-xs text-slate-500">Submitted {new Date(provider.submittedAt).toLocaleString()}</p>
          </div><div className="flex gap-2">
            <button className="rounded-lg border border-slate-500 px-4 py-3" disabled={busy} onClick={()=>viewKyc(provider)}>View ID photos</button>
            <button className={buttonClass} disabled={busy||kycPreview?.id!==provider.id} onClick={()=>reviewKyc(provider,"APPROVED")}>Approve</button>
            <button className="rounded-lg border border-red-600 px-4 py-3 text-red-200 disabled:opacity-40" disabled={busy} onClick={()=>reviewKyc(provider,"REJECTED")}>Reject</button>
          </div></div>
          {kycPreview?.id===provider.id&&<div className="grid sm:grid-cols-2 gap-4"><figure><figcaption className="text-sm mb-2">Front of ID</figcaption><img src={kycPreview.front} alt="Front of provider ID" className="max-h-80 w-full object-contain bg-slate-950 rounded-lg"/></figure><figure><figcaption className="text-sm mb-2">Back of ID</figcaption><img src={kycPreview.back} alt="Back of provider ID" className="max-h-80 w-full object-contain bg-slate-950 rounded-lg"/></figure></div>}
        </div>)}
      </section>}
      {policy&&<section className="grid lg:grid-cols-2 gap-6"><form onSubmit={save} className="p-6 bg-slate-900 rounded-xl space-y-5"><h2 className="text-xl font-semibold">Pricing for new quotations</h2><label className="block">Commission (%) deducted from quotation<input className={inputClass} type="number" min="0" max="100" step="0.01" required value={percent} onChange={e=>setPercent(e.target.value)}/></label><label className="block">Customer platform fee (₹2–₹5, or ₹0 to disable)<input className={inputClass} type="number" min="0" max="5" step="0.01" required value={fee} onChange={e=>setFee(e.target.value)}/></label><p className="text-sm text-slate-400">The platform fee is paid by the customer. Provider earnings equal the quotation minus commission. The customer does not see a separate commission line.</p><p>Example for ₹1,000 quotation: quotation {inr(1000)}, platform fee {inr(Number(fee)||0)}, total {inr(1000+(Number(fee)||0))}. Provider receives {inr(1000*(1-(Number(percent)||0)/100))}.</p><button className={buttonClass} disabled={busy}>Save pricing</button><p className="text-xs text-slate-400">Current revision: {policy.revision}</p></form><div className="p-6 bg-slate-900 rounded-xl"><h2 className="text-xl mb-4">Pricing changes</h2>{history.length===0?<p>No changes yet. Default platform fee: ₹2; commission: 0%.</p>:history.map(h=><div key={h.revision} className="py-3 border-b border-slate-700"><p>Revision {h.revision} · {h.commissionBps/100}% · fee {inr(Number(h.platformFeeMinor)/100)}</p><p className="text-sm text-slate-400">{h.createdAt?new Date(h.createdAt).toLocaleString():""}</p><p className="text-xs break-all text-slate-500">Admin {h.changedBy}</p></div>)}</div></section>}
      {data&&<section className="space-y-4"><h2 className="text-xl font-semibold">Provider collections</h2><div className="overflow-auto rounded-xl border border-slate-700"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-slate-800"><tr>{["Provider","Jobs","Held for jobs","Completed collections","Commission","Platform fees","Available wallet","Payout pending","History"].map(x=><th key={x} className="p-4">{x}</th>)}</tr></thead><tbody>{data.providers.map(p=><tr key={p.id} className="border-t border-slate-800"><td className="p-4">{p.name}<div className="text-xs text-slate-400">{p.email}</div></td><td className="p-4">{p.jobs}</td>{[p.held,p.completedCollections,p.commission,p.platformFees,p.available,p.payoutPending].map((v,i)=><td key={i} className="p-4">{inr(v)}</td>)}<td className="p-4"><button className="text-blue-300 underline" disabled={busy} onClick={()=>viewJobs(p)}>View jobs</button></td></tr>)}</tbody></table></div>{data.providers.length===0&&<p>No providers found.</p>}{data.nextCursor&&<button className={buttonClass} disabled={busy} onClick={()=>load(token,data.nextCursor!)}>Load more providers</button>}</section>}
      {selected&&<section className="space-y-4"><h2 className="text-xl">Job settlements · {selected.name}</h2><div className="overflow-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead><tr>{["Job ID","Status","Customer total","Commission","Platform fee","Provider net","Policy"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{jobs.map(j=><tr key={j.id} className="border-t border-slate-800"><td className="p-3 font-mono">{j.id}</td><td className="p-3">{j.status}</td><td className="p-3">{inr(j.totalAmount)}</td><td className="p-3">{inr(j.commission)} ({j.commissionPercent}%)</td><td className="p-3">{inr(j.platformFee)}</td><td className="p-3">{inr(j.providerNet)}</td><td className="p-3">{j.pricingRevision??"Legacy"}</td></tr>)}</tbody></table></div><p className="text-sm text-slate-400">Net earnings are released only for completed jobs. Cancelled jobs do not earn commission or platform fees.</p>{jobCursor&&<button className={buttonClass} disabled={busy} onClick={()=>viewJobs(selected,jobCursor)}>Load more jobs</button>}</section>}
    </>}
  </main>;
}

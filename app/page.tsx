'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type DashboardData = {
  source: string;
  generatedAt?: string;
  channel?: any;
  counts?: any;
  opportunities?: any[];
  pipeline?: any[];
  scheduled?: any[];
  learnings?: any[];
  decisions?: any[];
  recentHistory?: any[];
  metrics?: any[];
  flags?: string[];
  message?: string;
};

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tone(value?: string) {
  const v = String(value || '').toUpperCase();
  if (['HIGH','PUBLISHED','COMPLETE','READY_TO_PUBLISH','APPROVED','READY'].includes(v)) return 'positive';
  if (['MEDIUM','REVIEW','PENDING','RESEARCHING','IN_PROGRESS','SCRIPTING','CREATIVE','PRODUCTION','QA'].includes(v)) return 'warn';
  if (['FAILED','CANCELLED','IGNORE','REJECTED','ARCHIVED'].includes(v)) return 'danger';
  return '';
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('overview');
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setActionMessage('');
    try {
      const r = await fetch('/api/dashboard', { cache: 'no-store' });
      const j = await r.json();
      setData(j);
    } catch (error: unknown) {
      setData({ source: 'ERROR', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function performAction(action: 'APPROVE' | 'REJECT' | 'START_RESEARCH', opportunityId: string, title: string) {
    let reason = '';
    if (action === 'REJECT') reason = window.prompt(`Reason for rejecting:\n${title}`, '') || '';
    if (action !== 'REJECT' && !window.confirm(`${action.replaceAll('_', ' ')}?\n\n${title}`)) return;
    setActingId(opportunityId);
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, opportunityId, reason }) });
      const result = await r.json();
      if (!r.ok || !result.ok) throw new Error(result.message || 'Action failed');
      setActionMessage(`${action.replaceAll('_', ' ')} recorded for “${title}”.`);
      await refresh();
    } catch (error: unknown) {
      setActionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setActingId(null);
    }
  }

  async function copyCommand(title: string) {
    const command = `Produzir no HeyGen: ${title}`;
    try {
      await navigator.clipboard.writeText(command);
      setActionMessage(`Command copied: ${command}`);
    } catch {
      setActionMessage(command);
    }
  }

  useEffect(() => { refresh(); }, []);

  if (loading && !data) return <main><div className="empty big-empty">Connecting to Neon…</div></main>;

  if (!data || data.source !== 'NEON') {
    return <main>
      <header className="topbar"><div><div className="eyebrow">MEDIA OPERATING SYSTEM / COMMAND CENTER</div><h1>How The World Works</h1><p>Operational cockpit</p></div><div className="actions"><span className="badge danger">DATABASE OFFLINE</span><button onClick={refresh}>Retry</button></div></header>
      <section className="error-card"><div className="hero-label">LIVE DATA REQUIRED</div><h2>Dashboard is not connected to Neon.</h2><p>{data?.message || 'The API did not return live Neon data.'}</p><p className="sub">Set DATABASE_URL in the Vercel project and redeploy. This dashboard will not show fabricated or stale snapshot data.</p></section>
    </main>;
  }

  const c = data.counts || {};
  const nav = ['overview','radar','pipeline','schedule','learning'];
  const opportunities = useMemo(() => (data.opportunities || []).filter(o => !['REJECTED','ARCHIVED'].includes(String(o.status || '').toUpperCase())).slice(0, 8), [data.opportunities]);
  const pipeline = useMemo(() => (data.pipeline || []).slice(0, 12), [data.pipeline]);
  const schedule = useMemo(() => (data.scheduled || []).slice(0, 12), [data.scheduled]);
  const learnings = useMemo(() => (data.learnings || []).slice(0, 8), [data.learnings]);
  const history = useMemo(() => (data.recentHistory || []).slice(0, 10), [data.recentHistory]);

  const needsYou = opportunities.filter(o => ['REVIEW','APPROVED'].includes(String(o.status || '').toUpperCase())).slice(0,3);
  const readyForHeyGen = pipeline.filter(p => String(p.current_state || '').toUpperCase() === 'APPROVED' || (String(p.content_status || '').toUpperCase() === 'READY' && String(p.production_status || '').toUpperCase() === 'NOT_STARTED')).slice(0,3);

  return <main>
    <header className="topbar"><div><div className="eyebrow">MEDIA OPERATING SYSTEM / COMMAND CENTER</div><h1>{data.channel?.name || 'How The World Works'}</h1><p>{data.channel?.promise || 'Operational cockpit'}</p></div><div className="actions"><span className="status-dot"/><span className="badge positive">NEON LIVE</span><button onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></header>

    <nav className="nav-tabs">{nav.map(item => <button key={item} className={active === item ? 'nav-tab active' : 'nav-tab'} onClick={() => setActive(item)}>{item}</button>)}</nav>
    {actionMessage && <div className="action-message">{actionMessage}</div>}

    {active === 'overview' && <>
      <section className="hero-grid">
        <div className="hero-card"><div className="hero-label">WHAT NEEDS YOU</div><div className="hero-title">{needsYou.length ? `${needsYou.length} editorial decisions` : 'Nothing waiting for you'}</div><div className="hero-copy">Your job is to decide. The system handles research, queueing and reconciliation around those decisions.</div></div>
        <div className="hero-card decision"><div className="hero-label">READY FOR HEYGEN</div><div className="hero-title">{readyForHeyGen.length ? `${readyForHeyGen.length} production item${readyForHeyGen.length > 1 ? 's' : ''}` : 'Nothing ready yet'}</div><div className="hero-copy">Production happens here in ChatGPT. Say “Produzir no HeyGen: [title]”.</div></div>
      </section>
      <section className="stats">{[['OPPORTUNITIES',c.opportunities,'Radar'],['RESEARCHING',c.researching,'Active'],['APPROVED',c.approved,'Gate'],['IN PRODUCTION',c.in_production,'Creative'],['SCHEDULED',c.scheduled,'Pending'],['PUBLISHED',c.published,'Live']].map(([a,b,d]) => <div className="stat" key={a as string}><div className="stat-kicker">{a}</div><div className="stat-value">{b ?? 0}</div><div className="stat-note">{d}</div></div>)}</section>

      <section className="grid-2">
        <Panel title="Do This Now" meta="Human actions">{needsYou.length ? needsYou.map((o,i) => <div className="action-row" key={o.id || i}><div><strong>{o.title}</strong><div className="sub">{o.pillar} · {o.priority} · {o.status}</div></div><div className="action-row-buttons"><button onClick={() => performAction('START_RESEARCH', o.id, o.title)}>Research</button><button onClick={() => performAction('APPROVE', o.id, o.title)}>Approve</button><button className="danger-btn" onClick={() => performAction('REJECT', o.id, o.title)}>Reject</button></div></div>) : <div className="empty">No editorial decisions waiting.</div>}</Panel>
        <Panel title="Produce Next" meta="ChatGPT + HeyGen">{readyForHeyGen.length ? readyForHeyGen.map((p,i) => <div className="action-row" key={p.id || i}><div><strong>{p.title}</strong><div className="sub">{p.current_state} · {p.production_status || '—'}</div></div><button onClick={() => copyCommand(p.title)}>Copy command</button></div>) : <div className="empty">The queue is still preparing the next production package.</div>}</Panel>
      </section>

      <section className="grid-2"><Panel title="Publication Schedule" meta="Metricool">{schedule.slice(0,6).map((p,i) => <ScheduleRow key={i} item={p}/>)}</Panel><Panel title="Signals & Flags" meta="Learning Engine">{(data.flags || []).map((f,i)=><div className="flag" key={i}><span>●</span>{f}</div>)}<div className="mini-grid"><div><strong>{c.performance || 0}</strong><span>metric samples</span></div><div><strong>{c.learnings || 0}</strong><span>durable learnings</span></div><div><strong>{c.decisions || 0}</strong><span>decisions logged</span></div></div></Panel></section>
    </>}

    {active === 'radar' && <section className="single-panel"><Panel title="Opportunity Radar" meta={`${opportunities.length} shown`}>{opportunities.map((o,i)=><Opportunity key={o.id || i} item={o} onAction={performAction} actingId={actingId}/>)}</Panel></section>}
    {active === 'pipeline' && <section className="single-panel"><Panel title="Production Pipeline" meta={`${pipeline.length} items`}>{pipeline.map((p,i)=><PipelineRow key={p.id || i} item={p}/>)}</Panel></section>}
    {active === 'schedule' && <section className="single-panel"><Panel title="Publication Schedule" meta="Metricool records">{schedule.map((p,i)=><ScheduleRow key={i} item={p} detailed/>)}</Panel></section>}
    {active === 'learning' && <section className="grid-2"><Panel title="Latest Learnings" meta={`${learnings.length} shown`}>{learnings.length ? learnings.map((l,i)=><div className="learning-card" key={i}><div className="learning-title">{l.learning || 'Learning recorded'}</div><div className="learning-copy">{l.action || l.interpretation || 'No action recorded.'}</div><div className="learning-meta"><span className="badge">{l.confidence || 'UNSPECIFIED'}</span><span>{fmtDate(l.created_at)}</span></div></div>) : <div className="empty">NO DATA YET</div>}</Panel><Panel title="Historical State Changes" meta={`${history.length} shown`}>{history.length ? history.map((h,i)=><div className="history" key={i}><strong>{h.title}</strong><div className="sub">{h.field_name}: {h.old_value || '—'} → {h.new_value || '—'} · {h.source || 'unknown'} · {fmtDate(h.changed_at)}</div></div>) : <div className="empty">No state history available.</div>}</Panel></section>}

    <footer>Source: NEON LIVE · {data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-US') : '—'} · Neon is the system of record</footer>
  </main>;
}

function Panel({title,meta,children}:{title:string;meta:string;children:ReactNode}){return <div className="panel"><div className="panel-head"><h2>{title}</h2><span>{meta}</span></div>{children}</div>;}

function Opportunity({item,onAction,actingId}:{item:any;onAction:(action:'APPROVE'|'REJECT'|'START_RESEARCH',id:string,title:string)=>void;actingId:string|null}){const busy=!!item.id&&actingId===item.id; return <div className="op"><div className="op-top"><div className="op-title">{item.title}</div><div className="chips"><span className="badge">{item.pillar}</span><span className={`badge ${tone(item.priority)}`}>{item.priority}</span><span className={`badge ${tone(item.status)}`}>{item.status}</span></div></div><div className="op-next">Next: {item.next_action || 'Review editorial opportunity'}</div><div className="sub">Discovered {fmtDate(item.discovered_at)}</div><div className="op-actions"><button disabled={busy} onClick={()=>onAction('START_RESEARCH',item.id,item.title)}>Research</button><button disabled={busy} onClick={()=>onAction('APPROVE',item.id,item.title)}>Approve</button><button className="danger-btn" disabled={busy} onClick={()=>onAction('REJECT',item.id,item.title)}>Reject</button></div></div>}

function PipelineRow({item}:{item:any}){return <div className="pipeline-card"><div className="pipeline-title">{item.title}</div><div className="pipeline-meta"><span className={`state ${tone(item.current_state)}`}>{item.current_state || 'UNKNOWN'}</span><span>production {item.production_status || '—'}</span><span>publication {item.publication_status || '—'}</span><span>updated {fmtDate(item.updated_at)}</span></div></div>}

function ScheduleRow({item,detailed=false}:{item:any;detailed?:boolean}){return <div className="row"><div className="row-main"><strong>{item.title}</strong><div className="sub">{item.platform} · {fmtDate(item.scheduled_at)}{item.published_at ? ` · published ${fmtDate(item.published_at)}` : ''}</div>{detailed && item.external_post_id && <div className="sub">External post: {item.external_post_id}</div>}</div><span className={`badge ${tone(item.status)}`}>{item.status}</span></div>}

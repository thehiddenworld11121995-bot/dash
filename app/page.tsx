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

const snapshot: DashboardData = {
  source: 'SNAPSHOT',
  channel: { name: 'How The World Works', niche: 'Engineering / Technology / Infrastructure', promise: 'The systems, machines and ideas behind everyday life.' },
  counts: { opportunities: 4, researching: 4, approved: 0, in_production: 0, scheduled: 5, published: 0, performance: 0, learnings: 0, decisions: 0 },
  opportunities: [
    { title: 'How a MASSIVE Steel Block Becomes a Giant Industrial Gear', pillar: 'Machines', priority: 'HIGH', status: 'REVIEW', next_action: 'Research technical process and packaging' },
    { title: 'Why Modern Factories Look Almost Empty', pillar: 'Systems', priority: 'MEDIUM', status: 'REVIEW', next_action: 'Research automation economics and visuals' },
    { title: 'The Machines That Turn Pressure Into Power', pillar: 'Technology', priority: 'MEDIUM', status: 'REVIEW', next_action: 'Research hydraulic systems and examples' },
    { title: 'How Robots Are Replacing the Most Repetitive Factory Jobs', pillar: 'Technology', priority: 'MEDIUM', status: 'REVIEW', next_action: 'Research factory robotics evidence' },
  ],
  pipeline: [
    { title: 'The Giant Machine That Eats the Earth', current_state: 'READY_TO_PUBLISH' },
    { title: 'How Does a Giant Tunnel Boring Machine Actually Move Underground?', current_state: 'READY_TO_PUBLISH' },
  ],
  scheduled: [
    { title: 'The Giant Machine That Eats the Earth', platform: 'YouTube', scheduled_at: '2026-09-17 16:00', status: 'PENDING' },
    { title: 'The Giant Machine That Eats the Earth', platform: 'TikTok', scheduled_at: '2026-09-17 10:00', status: 'PENDING' },
    { title: 'How Does a Giant Tunnel Boring Machine Actually Move Underground?', platform: 'YouTube', scheduled_at: '2026-09-18 16:00', status: 'PENDING' },
  ],
  learnings: [], flags: ['4 content items are researching.', '5 publication records are pending; none is published.', 'NO DATA YET: first-party performance metrics are not available.'],
  decisions: [], recentHistory: [], metrics: [],
};

function fmtDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tone(value?: string) {
  const v = String(value || '').toUpperCase();
  if (['HIGH', 'PUBLISHED', 'COMPLETE', 'READY_TO_PUBLISH'].includes(v)) return 'positive';
  if (['MEDIUM', 'REVIEW', 'PENDING', 'RESEARCHING', 'IN_PROGRESS'].includes(v)) return 'warn';
  if (['FAILED', 'CANCELLED', 'IGNORE'].includes(v)) return 'danger';
  return '';
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(snapshot);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('overview');

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard', { cache: 'no-store' });
      const j = await r.json();
      setData(j.source === 'NEON' ? j : snapshot);
    } catch {
      setData(snapshot);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);
  const c = data.counts || snapshot.counts;
  const nav = ['overview', 'radar', 'pipeline', 'schedule', 'learning'];
  const visibleOpps = useMemo(() => (data.opportunities || []).slice(0, 6), [data.opportunities]);
  const visiblePipeline = useMemo(() => (data.pipeline || []).slice(0, 10), [data.pipeline]);
  const visibleSchedule = useMemo(() => (data.scheduled || []).slice(0, 10), [data.scheduled]);
  const visibleLearnings = useMemo(() => (data.learnings || []).slice(0, 8), [data.learnings]);
  const visibleHistory = useMemo(() => (data.recentHistory || []).slice(0, 8), [data.recentHistory]);

  const stats = [
    ['OPPORTUNITIES', c.opportunities, 'Radar'],
    ['RESEARCHING', c.researching, 'Active'],
    ['APPROVED', c.approved, 'Gate'],
    ['IN PRODUCTION', c.in_production, 'Creative'],
    ['SCHEDULED', c.scheduled, 'Pending'],
    ['PUBLISHED', c.published, 'Live'],
  ];

  return <main>
    <header className="topbar">
      <div>
        <div className="eyebrow">MEDIA OPERATING SYSTEM / COMMAND CENTER</div>
        <h1>{data.channel?.name || 'How The World Works'}</h1>
        <p>{data.channel?.promise || snapshot.channel?.promise}</p>
      </div>
      <div className="actions">
        <span className="status-dot" />
        <span className="badge">{data.source === 'NEON' ? 'NEON LIVE' : 'SNAPSHOT'}</span>
        <button onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
    </header>

    <nav className="nav-tabs" aria-label="Dashboard sections">
      {nav.map((item) => <button key={item} className={active === item ? 'nav-tab active' : 'nav-tab'} onClick={() => setActive(item)}>{item}</button>)}
    </nav>

    {active === 'overview' && <>
      <section className="hero-grid">
        <div className="hero-card"><div className="hero-label">CHANNEL BRAIN</div><div className="hero-title">{data.channel?.niche || snapshot.channel?.niche}</div><div className="hero-copy">Discovery → research → production → publication → learning, with the database as the system of record.</div></div>
        <div className="hero-card decision"><div className="hero-label">DECISION QUEUE</div><div className="hero-title">{c.opportunities || 0} opportunities need review</div><div className="hero-copy">Radar can research and prepare. Human approval remains the editorial gate.</div></div>
      </section>
      <section className="stats">{stats.map(([a, b, d]) => <div className="stat" key={a as string}><div className="stat-kicker">{a}</div><div className="stat-value">{b}</div><div className="stat-note">{d}</div></div>)}</section>
      <section className="grid-2">
        <Panel title="Opportunity Radar" meta="Latest">{visibleOpps.map((o, i) => <Opportunity key={i} item={o} />)}</Panel>
        <Panel title="Production Pipeline" meta={`${(data.pipeline || []).length} items`}>{visiblePipeline.map((p, i) => <PipelineRow key={i} item={p} />)}</Panel>
      </section>
      <section className="grid-2">
        <Panel title="Publication Schedule" meta="Metricool">{visibleSchedule.slice(0, 6).map((p, i) => <ScheduleRow key={i} item={p} />)}</Panel>
        <Panel title="Signals & Flags" meta="Learning Engine">{(data.flags || []).map((f, i) => <div className="flag" key={i}><span>●</span>{f}</div>)}<div className="mini-grid"><div><strong>{c.performance || 0}</strong><span>metric samples</span></div><div><strong>{c.learnings || 0}</strong><span>durable learnings</span></div><div><strong>{c.decisions || 0}</strong><span>decisions logged</span></div></div></Panel>
      </section>
    </>}

    {active === 'radar' && <section className="single-panel"><Panel title="Opportunity Radar" meta={`${visibleOpps.length} shown`}>{visibleOpps.map((o, i) => <Opportunity key={i} item={o} detailed />)}</Panel></section>}

    {active === 'pipeline' && <section className="single-panel"><Panel title="Production Pipeline" meta={`${visiblePipeline.length} items`}>{visiblePipeline.map((p, i) => <div className="pipeline-card" key={i}><div className="pipeline-title">{p.title}</div><div className="pipeline-meta"><span className={`state ${tone(p.content_status || p.current_state)}`}>{p.content_status || p.current_state || 'UNKNOWN'}</span><span>{p.production_status || '—'}</span><span>{p.publication_status || '—'}</span><span>Updated {fmtDate(p.updated_at)}</span></div></div>)}</Panel></section>}

    {active === 'schedule' && <section className="single-panel"><Panel title="Publication Schedule" meta="Metricool records">{visibleSchedule.map((p, i) => <ScheduleRow key={i} item={p} detailed />)}</Panel></section>}

    {active === 'learning' && <section className="grid-2">
      <Panel title="Latest Learnings" meta={`${visibleLearnings.length} shown`}>{visibleLearnings.length ? visibleLearnings.map((l, i) => <div className="learning-card" key={i}><div className="learning-title">{l.learning || 'Learning recorded'}</div><div className="learning-copy">{l.action || l.interpretation || 'No action recorded.'}</div><div className="learning-meta"><span className="badge">{l.confidence || 'UNSPECIFIED'}</span><span>{fmtDate(l.created_at)}</span></div></div>) : <div className="empty">No durable learnings yet. The system will say NO DATA YET rather than fabricate a lesson.</div>}</Panel>
      <Panel title="Historical State Changes" meta={`${visibleHistory.length} shown`}>{visibleHistory.length ? visibleHistory.map((h, i) => <div className="history" key={i}><strong>{h.title}</strong><div className="sub">{h.field_name}: {h.old_value || '—'} → {h.new_value || '—'} · {h.source || 'unknown'} · {fmtDate(h.changed_at)}</div></div>) : <div className="empty">No state history available yet.</div>}</Panel>
    </section>}

    <footer>Source: {data.source} · {data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-US') : 'fallback snapshot'} · Neon is the system of record</footer>
  </main>;
}

function Panel({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return <div className="panel"><div className="panel-head"><h2>{title}</h2><span>{meta}</span></div>{children}</div>;
}

function Opportunity({ item, detailed = false }: { item: any; detailed?: boolean }) {
  return <div className="op"><div className="op-top"><div className="op-title">{item.title}</div><div className="chips"><span className="badge">{item.pillar}</span><span className={`badge ${tone(item.priority)}`}>{item.priority}</span><span className={`badge ${tone(item.status)}`}>{item.status}</span></div></div>{detailed && item.metadata && <div className="op-next">Signals recorded in Radar metadata.</div>}<div className="op-next">Next: {item.next_action || 'Review editorial opportunity'}</div><div className="sub">Discovered {fmtDate(item.discovered_at)}</div></div>;
}

function PipelineRow({ item }: { item: any }) {
  return <div className="row"><div className="row-main"><strong>{item.title}</strong><div className="sub">{item.current_state} · production {item.production_status || '—'} · publication {item.publication_status || '—'}</div></div></div>;
}

function ScheduleRow({ item, detailed = false }: { item: any; detailed?: boolean }) {
  return <div className="row"><div className="row-main"><strong>{item.title}</strong><div className="sub">{item.platform} · {fmtDate(item.scheduled_at)}{item.published_at ? ` · published ${fmtDate(item.published_at)}` : ''}</div>{detailed && item.external_post_id && <div className="sub">External post: {item.external_post_id}</div>}</div><span className={`badge ${tone(item.status)}`}>{item.status}</span></div>;
}

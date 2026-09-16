import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ source: 'SNAPSHOT', message: 'DATABASE_URL not configured' });

  try {
    const sql = neon(url);
    const [channel] = await sql<Row[]>`select id, name, niche, editorial_promise as promise, market, language from channels where channel_key='how-the-world-works' limit 1`;
    if (!channel) return NextResponse.json({ source: 'SNAPSHOT', message: 'Channel not found in Neon' });

    const [opportunities, pipeline, scheduled, learnings, decisions, recentHistory, metrics] = await Promise.all([
      sql<Row[]>`select title, pillar, priority, status, next_action, discovered_at, metadata from opportunities where channel_id=${channel.id} order by discovered_at desc limit 20`,
      sql<Row[]>`select ci.id, ci.title, ci.content_status, ci.production_status, ci.publication_status, ci.performance_status, coalesce(pq.current_state, ci.status) as current_state, ci.updated_at from content_items ci left join production_queue pq on pq.content_item_id=ci.id where ci.channel_id=${channel.id} order by ci.updated_at desc`,
      sql<Row[]>`select ci.title, p.platform, p.scheduled_at, p.status, p.external_post_id, p.published_at from publications p join content_items ci on ci.id=p.content_item_id where ci.channel_id=${channel.id} order by p.scheduled_at asc nulls last`,
      sql<Row[]>`select learning, action, confidence, observation, interpretation, created_at from learnings where channel_id=${channel.id} order by created_at desc limit 12`,
      sql<Row[]>`select entity_type, decision, reason, decided_by, created_at from decisions where channel_id=${channel.id} order by created_at desc limit 12`,
      sql<Row[]>`select c.title, h.field_name, h.old_value, h.new_value, h.source, h.changed_at from content_state_history h join content_items c on c.id=h.content_item_id where c.channel_id=${channel.id} order by h.changed_at desc limit 16`,
      sql<Row[]>`select c.title, p.platform, pm.measured_at, pm.impressions, pm.views, pm.vph, pm.ctr, pm.avd_seconds, pm.apv, pm.subscribers_gained, pm.likes, pm.comments, pm.shares, pm.long_term_velocity from performance_metrics pm join publications p on p.id=pm.publication_id join content_items c on c.id=p.content_item_id where c.channel_id=${channel.id} order by pm.measured_at desc limit 20`,
    ]);

    const counts = {
      opportunities: opportunities.length,
      researching: pipeline.filter((x) => x.current_state === 'RESEARCHING').length,
      approved: pipeline.filter((x) => x.current_state === 'APPROVED').length,
      in_production: pipeline.filter((x) => ['SCRIPTING','CREATIVE','PRODUCTION','QA'].includes(x.current_state)).length,
      scheduled: scheduled.filter((x) => ['PENDING','SCHEDULED'].includes(x.status)).length,
      published: scheduled.filter((x) => x.status === 'PUBLISHED').length,
      performance: metrics.length,
      learnings: learnings.length,
      decisions: decisions.length,
    };

    const flags: string[] = [];
    if (counts.researching) flags.push(`${counts.researching} content items are researching.`);
    if (counts.scheduled && !counts.published) flags.push(`${counts.scheduled} publication records are pending; none is published yet.`);
    if (!metrics.length) flags.push('NO DATA YET: first-party performance metrics are not available.');
    if (!learnings.length) flags.push('No durable learnings yet.');

    const latestMetric = metrics[0] || null;
    if (latestMetric) flags.push(`Latest performance sample: ${latestMetric.views ?? 0} views on ${latestMetric.platform}.`);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: 'NEON',
      channel,
      counts,
      opportunities,
      pipeline,
      scheduled,
      learnings,
      decisions,
      recentHistory,
      metrics,
      flags,
    });
  } catch (e: any) {
    return NextResponse.json({ source: 'SNAPSHOT', message: String(e?.message || e) });
  }
}

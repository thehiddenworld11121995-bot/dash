import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ source: 'DATABASE_OFFLINE', message: 'DATABASE_URL is not configured in Vercel.' }, { status: 503 });

  try {
    const sql = neon(url);
    const [channel] = (await sql`
      select id, name, niche, editorial_promise as promise, market, language
      from channels where channel_key='how-the-world-works' limit 1
    `) as Row[];
    if (!channel) return NextResponse.json({ source: 'DATABASE_OFFLINE', message: 'Channel how-the-world-works was not found in Neon.' }, { status: 503 });

    const [opportunities, pipeline, scheduled, learnings, decisions, recentHistory, metrics] = await Promise.all([
      sql`select id, title, pillar, priority, status, next_action, discovered_at, metadata from opportunities where channel_id=${channel.id} and status not in ('REJECTED','ARCHIVED') order by discovered_at desc limit 20`,
      sql`select ci.id, ci.opportunity_id, ci.title, ci.pillar, ci.format, ci.content_type, ci.hook, ci.thesis, ci.payoff, ci.notes, ci.content_status, ci.production_status, ci.publication_status, ci.performance_status, coalesce(pq.current_state, ci.status) as current_state, pq.research_status, pq.title_status, pq.hook_status, pq.thumbnail_status, pq.next_action, pq.priority_reason, ci.updated_at from content_items ci left join production_queue pq on pq.content_item_id=ci.id where ci.channel_id=${channel.id} order by ci.updated_at desc limit 20`,
      sql`select ci.title, p.platform, p.scheduled_at, p.status, p.external_post_id, p.published_at from publications p join content_items ci on ci.id=p.content_item_id where ci.channel_id=${channel.id} order by p.scheduled_at asc nulls last`,
      sql`select learning, action, confidence, observation, interpretation, created_at from learnings where channel_id=${channel.id} order by created_at desc limit 12`,
      sql`select entity_type, decision, reason, decided_by, created_at from decisions where channel_id=${channel.id} order by created_at desc limit 12`,
      sql`select c.title, h.field_name, h.old_value, h.new_value, h.source, h.changed_at from content_state_history h join content_items c on c.id=h.content_item_id where c.channel_id=${channel.id} order by h.changed_at desc limit 16`,
      sql`select c.title, p.platform, pm.measured_at, pm.impressions, pm.views, pm.vph, pm.ctr, pm.avd_seconds, pm.apv, pm.subscribers_gained, pm.likes, pm.comments, pm.shares, pm.long_term_velocity from performance_metrics pm join publications p on p.id=pm.publication_id join content_items c on c.id=p.content_item_id where c.channel_id=${channel.id} order by pm.measured_at desc limit 20`,
    ]) as Row[][];

    const counts = {
      opportunities: opportunities.length,
      researching: pipeline.filter(x => String(x.current_state).toUpperCase()==='RESEARCHING').length,
      approved: pipeline.filter(x => String(x.current_state).toUpperCase()==='APPROVED').length,
      in_production: pipeline.filter(x => ['SCRIPTING','CREATIVE','PRODUCTION','QA'].includes(String(x.current_state).toUpperCase())).length,
      ready_for_heygen: pipeline.filter(x => String(x.current_state).toUpperCase()==='APPROVED' || (String(x.content_status).toUpperCase()==='READY' && String(x.production_status).toUpperCase()==='NOT_STARTED')).length,
      scheduled: scheduled.filter(x => ['PENDING','SCHEDULED'].includes(String(x.status).toUpperCase())).length,
      published: scheduled.filter(x => String(x.status).toUpperCase()==='PUBLISHED').length,
      performance: metrics.length,
      learnings: learnings.length,
      decisions: decisions.length,
    };

    const flags: string[] = [];
    if (counts.researching) flags.push(`${counts.researching} content items are researching.`);
    if (counts.ready_for_heygen) flags.push(`${counts.ready_for_heygen} item(s) are ready for the HeyGen production decision.`);
    if (counts.scheduled && !counts.published) flags.push(`${counts.scheduled} publication record(s) are scheduled/pending; none is confirmed published yet.`);
    if (!metrics.length) flags.push('NO DATA YET: first-party performance metrics are not available.');
    if (!learnings.length) flags.push('No durable learnings yet.');

    return NextResponse.json({ generatedAt:new Date().toISOString(), source:'NEON', channel, counts, opportunities, pipeline, scheduled, learnings, decisions, recentHistory, metrics, flags });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ source:'DATABASE_OFFLINE', message }, { status:503 });
  }
}

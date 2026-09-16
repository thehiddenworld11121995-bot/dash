import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

type Action =
  | 'APPROVE'
  | 'REJECT'
  | 'START_RESEARCH'
  | 'START_SCRIPTING'
  | 'START_CREATIVE'
  | 'START_PRODUCTION'
  | 'START_QA'
  | 'COMPLETE_PRODUCTION';

type Body = {
  action?: Action;
  opportunityId?: string;
  contentItemId?: string;
  reason?: string;
};

type Row = Record<string, any>;

const transitions: Record<string, { state: string; production: string; queueResearch?: string; queueProduction?: string; nextAction: string }> = {
  START_SCRIPTING: { state: 'SCRIPTING', production: 'IN_PROGRESS', nextAction: 'Prepare script and title package' },
  START_CREATIVE: { state: 'CREATIVE', production: 'IN_PROGRESS', nextAction: 'Prepare visual direction and thumbnail' },
  START_PRODUCTION: { state: 'PRODUCTION', production: 'IN_PROGRESS', nextAction: 'Produce and assemble the video' },
  START_QA: { state: 'QA', production: 'QA', nextAction: 'Run factual, visual, audio, title and thumbnail QA' },
  COMPLETE_PRODUCTION: { state: 'READY_TO_PUBLISH', production: 'COMPLETE', nextAction: 'Prepare publication / scheduling' },
};

export async function POST(request: Request) {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ ok: false, message: 'DATABASE_URL not configured' }, { status: 500 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  const opportunityId = body.opportunityId;
  const contentItemId = body.contentItemId;

  if (!action || !['APPROVE','REJECT','START_RESEARCH','START_SCRIPTING','START_CREATIVE','START_PRODUCTION','START_QA','COMPLETE_PRODUCTION'].includes(action)) {
    return NextResponse.json({ ok: false, message: 'Valid action is required' }, { status: 400 });
  }
  if (!opportunityId && !contentItemId) {
    return NextResponse.json({ ok: false, message: 'opportunityId or contentItemId is required' }, { status: 400 });
  }

  try {
    const sql = neon(url);
    let content: Row | undefined;
    let opportunity: Row | undefined;

    if (opportunityId) {
      [opportunity] = await sql`
        select o.id, o.channel_id, o.title, o.status, ci.id as content_item_id
        from opportunities o
        left join content_items ci on ci.opportunity_id = o.id
        where o.id = ${opportunityId}
          and o.channel_id = (select id from channels where channel_key = 'how-the-world-works' limit 1)
        limit 1
      ` as Row[];
      if (opportunity?.content_item_id) {
        [content] = await sql`
          select id, title, status, content_status, production_status, publication_status, performance_status
          from content_items where id = ${opportunity.content_item_id} limit 1
        ` as Row[];
      }
    } else {
      [content] = await sql`
        select ci.id, ci.title, ci.channel_id, ci.opportunity_id, ci.status, ci.content_status,
               ci.production_status, ci.publication_status, ci.performance_status
        from content_items ci
        where ci.id = ${contentItemId}
          and ci.channel_id = (select id from channels where channel_key = 'how-the-world-works' limit 1)
        limit 1
      ` as Row[];
      if (content?.opportunity_id) {
        [opportunity] = await sql`select id, channel_id, title, status from opportunities where id = ${content.opportunity_id} limit 1` as Row[];
      }
    }

    if (!opportunity && !content) return NextResponse.json({ ok: false, message: 'Item not found' }, { status: 404 });

    const channelId = opportunity?.channel_id || content?.channel_id;
    const itemId = content?.id || opportunity?.content_item_id;
    const title = content?.title || opportunity?.title || 'Untitled content';
    const now = new Date().toISOString();
    const reason = (body.reason || '').trim() || `Dashboard action: ${action}`;

    if (action === 'START_RESEARCH') {
      await sql`update opportunities set status = 'RESEARCHING', next_action = 'Research authoritative sources and prepare editorial brief' where id = ${opportunity?.id || opportunityId}`;
      if (itemId) {
        await sql`update content_items set status = 'RESEARCHING', production_status = 'IN_PROGRESS', performance_status = 'WAITING', updated_at = now() where id = ${itemId}`;
        await sql`update production_queue set current_state = 'RESEARCHING', research_status = 'IN_PROGRESS', next_action = 'Research authoritative sources and prepare editorial brief', updated_at = now() where content_item_id = ${itemId}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${itemId}, 'current_state', ${content?.status || opportunity?.status || null}, 'RESEARCHING', 'DASHBOARD', jsonb_build_object('action','START_RESEARCH','at',${now}))`;
      }
    } else if (action === 'APPROVE') {
      await sql`update opportunities set status = 'APPROVED', next_action = 'Move into production gates' where id = ${opportunity?.id || opportunityId}`;
      if (itemId) {
        await sql`update content_items set status = 'APPROVED', content_status = 'READY', production_status = 'NOT_STARTED', updated_at = now() where id = ${itemId}`;
        await sql`update production_queue set current_state = 'APPROVED', research_status = coalesce(research_status,'COMPLETE'), next_action = 'Begin scripting after editorial gate', updated_at = now() where content_item_id = ${itemId}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${itemId}, 'current_state', ${content?.status || opportunity?.status || null}, 'APPROVED', 'DASHBOARD', jsonb_build_object('action','APPROVE','at',${now}))`;
      }
    } else if (action === 'REJECT') {
      await sql`update opportunities set status = 'REJECTED', next_action = 'No further action unless revisited' where id = ${opportunity?.id || opportunityId}`;
      if (itemId) {
        await sql`update content_items set status = 'REJECTED', content_status = 'ARCHIVED', production_status = 'NOT_STARTED', updated_at = now() where id = ${itemId}`;
        await sql`update production_queue set current_state = 'REJECTED', next_action = 'Archived after editorial rejection', updated_at = now() where content_item_id = ${itemId}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${itemId}, 'current_state', ${content?.status || opportunity?.status || null}, 'REJECTED', 'DASHBOARD', jsonb_build_object('action','REJECT','at',${now}))`;
      }
    } else {
      if (!itemId) return NextResponse.json({ ok: false, message: 'Production transition requires a content item' }, { status: 400 });
      const transition = transitions[action];
      const oldState = content?.status || 'UNKNOWN';
      await sql`update content_items set status = ${transition.state}, production_status = ${transition.production}, updated_at = now() where id = ${itemId}`;
      await sql`update production_queue set current_state = ${transition.state}, production_status = ${transition.production}, next_action = ${transition.nextAction}, updated_at = now() where content_item_id = ${itemId}`;
      await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${itemId}, 'current_state', ${oldState}, ${transition.state}, 'DASHBOARD', jsonb_build_object('action',${action},'at',${now}))`;
    }

    await sql`insert into decisions (channel_id, entity_type, entity_id, decision, reason, decided_by) values (${channelId}, 'opportunity', ${opportunity?.id || opportunityId || itemId}, ${action}, ${reason}, 'dashboard')`;
    return NextResponse.json({ ok: true, action, opportunityId: opportunity?.id || opportunityId || null, contentItemId: itemId || null, title });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

type Action = 'APPROVE' | 'REJECT' | 'START_RESEARCH';

type Body = {
  action?: Action;
  opportunityId?: string;
  reason?: string;
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
  if (!action || !opportunityId || !['APPROVE', 'REJECT', 'START_RESEARCH'].includes(action)) {
    return NextResponse.json({ ok: false, message: 'action and opportunityId are required' }, { status: 400 });
  }

  try {
    const sql = neon(url);
    const [opportunity] = await sql`
      select o.id, o.channel_id, o.title, o.status,
             ci.id as content_item_id
      from opportunities o
      left join content_items ci on ci.opportunity_id = o.id
      where o.id = ${opportunityId}
        and o.channel_id = (select id from channels where channel_key = 'how-the-world-works' limit 1)
      limit 1
    ` as Array<Record<string, any>>;

    if (!opportunity) return NextResponse.json({ ok: false, message: 'Opportunity not found' }, { status: 404 });

    const now = new Date().toISOString();
    const reason = (body.reason || '').trim() || `Dashboard action: ${action}`;

    if (action === 'START_RESEARCH') {
      await sql`update opportunities set status = 'RESEARCHING', next_action = 'Research authoritative sources and prepare editorial brief' where id = ${opportunityId}`;
      if (opportunity.content_item_id) {
        await sql`update content_items set status = 'RESEARCHING', production_status = 'IN_PROGRESS', performance_status = 'WAITING', updated_at = now() where id = ${opportunity.content_item_id}`;
        await sql`update production_queue set current_state = 'RESEARCHING', research_status = 'IN_PROGRESS', next_action = 'Research authoritative sources and prepare editorial brief', updated_at = now() where content_item_id = ${opportunity.content_item_id}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${opportunity.content_item_id}, 'current_state', ${opportunity.status}, 'RESEARCHING', 'DASHBOARD', jsonb_build_object('action','START_RESEARCH','at',${now}))`;
      }
      await sql`insert into decisions (channel_id, entity_type, entity_id, decision, reason, decided_by) values (${opportunity.channel_id}, 'opportunity', ${opportunityId}, 'START_RESEARCH', ${reason}, 'dashboard')`;
    }

    if (action === 'APPROVE') {
      await sql`update opportunities set status = 'APPROVED', next_action = 'Move into production gates' where id = ${opportunityId}`;
      if (opportunity.content_item_id) {
        await sql`update content_items set status = 'APPROVED', content_status = 'READY', production_status = 'NOT_STARTED', updated_at = now() where id = ${opportunity.content_item_id}`;
        await sql`update production_queue set current_state = 'APPROVED', research_status = coalesce(research_status,'COMPLETE'), next_action = 'Begin scripting after editorial gate', updated_at = now() where content_item_id = ${opportunity.content_item_id}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${opportunity.content_item_id}, 'current_state', ${opportunity.status}, 'APPROVED', 'DASHBOARD', jsonb_build_object('action','APPROVE','at',${now}))`;
      }
      await sql`insert into decisions (channel_id, entity_type, entity_id, decision, reason, decided_by) values (${opportunity.channel_id}, 'opportunity', ${opportunityId}, 'APPROVE', ${reason}, 'dashboard')`;
    }

    if (action === 'REJECT') {
      await sql`update opportunities set status = 'REJECTED', next_action = 'No further action unless revisited' where id = ${opportunityId}`;
      if (opportunity.content_item_id) {
        await sql`update content_items set status = 'REJECTED', content_status = 'ARCHIVED', production_status = 'NOT_STARTED', updated_at = now() where id = ${opportunity.content_item_id}`;
        await sql`update production_queue set current_state = 'REJECTED', next_action = 'Archived after editorial rejection', updated_at = now() where content_item_id = ${opportunity.content_item_id}`;
        await sql`insert into content_state_history (content_item_id, field_name, old_value, new_value, source, metadata) values (${opportunity.content_item_id}, 'current_state', ${opportunity.status}, 'REJECTED', 'DASHBOARD', jsonb_build_object('action','REJECT','at',${now}))`;
      }
      await sql`insert into decisions (channel_id, entity_type, entity_id, decision, reason, decided_by) values (${opportunity.channel_id}, 'opportunity', ${opportunityId}, 'REJECT', ${reason}, 'dashboard')`;
    }

    return NextResponse.json({ ok: true, action, opportunityId, title: opportunity.title });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

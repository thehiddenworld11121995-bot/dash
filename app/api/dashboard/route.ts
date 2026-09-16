import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET(){
  const url = process.env.DATABASE_URL;
  if(!url) return NextResponse.json({ source:'SNAPSHOT', message:'DATABASE_URL not configured' });
  try{
    const sql = neon(url);
    const [channel] = await sql`select name, niche, editorial_promise as promise from channels where channel_key='how-the-world-works' limit 1`;
    const opportunities = await sql`select title, pillar, priority, status, next_action, discovered_at from opportunities where channel_id=(select id from channels where channel_key='how-the-world-works' limit 1) order by discovered_at desc limit 20`;
    const pipeline = await sql`select ci.title, ci.content_status, ci.production_status, ci.publication_status, ci.performance_status, coalesce(pq.current_state, ci.status) as current_state from content_items ci left join production_queue pq on pq.content_item_id=ci.id where ci.channel_id=(select id from channels where channel_key='how-the-world-works' limit 1) order by ci.updated_at desc`;
    const scheduled = await sql`select ci.title, p.platform, p.scheduled_at, p.status, p.external_post_id from publications p join content_items ci on ci.id=p.content_item_id where ci.channel_id=(select id from channels where channel_key='how-the-world-works' limit 1) order by p.scheduled_at asc nulls last`;
    const learnings = await sql`select learning, action, confidence, created_at from learnings where channel_id=(select id from channels where channel_key='how-the-world-works' limit 1) order by created_at desc limit 20`;
    const counts = { opportunities:opportunities.length, researching:pipeline.filter((x:any)=>x.current_state==='RESEARCHING').length, approved:pipeline.filter((x:any)=>x.current_state==='APPROVED').length, in_production:pipeline.filter((x:any)=>['SCRIPTING','CREATIVE','PRODUCTION','QA'].includes(x.current_state)).length, scheduled:scheduled.filter((x:any)=>['PENDING','SCHEDULED'].includes(x.status)).length, published:scheduled.filter((x:any)=>x.status==='PUBLISHED').length, performance:0, learnings:learnings.length, decisions:0 };
    const flags:string[]=[]; if(counts.researching) flags.push(`${counts.researching} content items are researching.`); if(counts.scheduled&&!counts.published) flags.push(`${counts.scheduled} publication records are pending; none is published.`); if(!learnings.length) flags.push('No durable learnings yet.');
    return NextResponse.json({generatedAt:new Date().toISOString(),source:'NEON',channel:channel||{name:'How The World Works',niche:'',promise:''},counts,opportunities,pipeline,scheduled,learnings,flags});
  }catch(e:any){ return NextResponse.json({source:'SNAPSHOT',message:String(e?.message||e)}); }
}

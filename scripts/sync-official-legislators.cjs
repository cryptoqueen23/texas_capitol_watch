// Validate the official LRL 89th Legislature historical baseline only.
// Do not use this historical list to certify incoming 90th Legislature party assignments.
const fs=require('node:fs');
const url='https://www.lrl.texas.gov/legeLeaders/members/memberselect.cfm';
const decode=s=>String(s).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function parse(html){
 const heading=decode((html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)||[])[0]||'');
 if(!/members.elect of the 89th legislature/i.test(heading))throw Error('Unexpected LRL heading: '+heading);
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>decode(c[1])));
 const header=rows.find(r=>r.some(c=>/^name$/i.test(c))&&r.some(c=>/^party$/i.test(c)));
 if(!header)throw Error('Official LRL table header not found; page format may have changed');
 const column=label=>header.findIndex(c=>c.toLowerCase()===label);
 const ix={name:column('name'),chamber:column('chamber'),district:column('district'),party:column('party')};
 if(Object.values(ix).some(i=>i<0))throw Error('Missing required official LRL columns');
 const members=rows.map(r=>({name:r[ix.name],chamber:r[ix.chamber],district:r[ix.district],party:r[ix.party]}))
 .filter(x=>x.name&&/^[HS]$/.test(x.chamber)&&/^\d{1,3}$/.test(x.district)&&/^[RD]$/.test(x.party))
 .map(x=>({...x,district:Number(x.district),source:url,sourceSession:'89',status:'historical-baseline'}));
 if(members.length<150||members.length>181)throw Error('Only '+members.length+' official records parsed; refusing overwrite (table rows: '+rows.length+')');
 const districts=new Set(members.map(m=>m.chamber+'-'+m.district));
 if(districts.size!==members.length)throw Error('Duplicate districts in official directory');
 return {source:url,sourceHeading:heading,sourceSession:'89',note:'Official 89th Legislature reference only; not a certified 2027 roster.',members};
}
if(require.main===module)(async()=>{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; TexasCapitolWatchdog/1.0)','Accept':'text/html'}});if(!r.ok)throw Error('LRL HTTP '+r.status);const data=parse(await r.text());fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/legislators-89-official.json',JSON.stringify(data,null,2)+'\n');console.log('Validated historical official directory:',data.members.length)})().catch(e=>{console.error(e);process.exitCode=1});
module.exports={parse};

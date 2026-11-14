// Fetch the Texas Legislative Reference Library's official member directory.
// IMPORTANT: the LRL page currently identifies itself as the 89th Legislature.
// Never relabel its records as confirmed 90th Legislature members.
const fs=require("node:fs");
const url="https://www.lrl.texas.gov/legeLeaders/members/memberselect.cfm";
const decode=s=>s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&[a-z]+;/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
(async()=>{
 const r=await fetch(url,{headers:{"User-Agent":"TexasCapitolWatchdog/1.0 public directory sync"}});
 if(!r.ok)throw Error("LRL HTTP "+r.status);
 const html=await r.text();
 const heading=decode((html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)||[])[0]||"");
 if(!/members.elect of the 89th legislature/i.test(heading))throw Error("Unexpected LRL heading; manual review required: "+heading);
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...x[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(y=>decode(y[1])));
 const members=rows.filter(c=>c.length>=5&&/^[HS]$/.test(c[1])&&/^\d+$/.test(c[2])&&/^[RD]$/.test(c[4])).map(c=>({name:c[0],chamber:c[1],district:Number(c[2]),party:c[4],source:url,sourceSession:"89",status:"historical-baseline"}));
 if(members.length<150)throw Error("Only "+members.length+" official records parsed; refusing overwrite");
 const districts=new Set(members.map(m=>m.chamber+"-"+m.district));
 if(districts.size!==members.length)throw Error("Duplicate districts in official directory");
 fs.mkdirSync("data",{recursive:true});
 fs.writeFileSync("data/legislators-89-official.json",JSON.stringify({source:url,sourceHeading:heading,sourceSession:"89",note:"Official 89th Legislature reference only; not a certified 2027 roster.",members},null,2)+"\n");
 console.log("Official 89th Legislature baseline:",members.length,"members");
})().catch(e=>{console.error(e);process.exitCode=1});

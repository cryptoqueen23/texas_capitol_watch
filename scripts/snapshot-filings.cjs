// Archive bills filed on the current Texas date using official cumulative session reports.
// Node 20+, no external dependencies. Never overwrite a valid archive with an empty result.
const fs=require("node:fs/promises");
const path=require("node:path");
const SOURCES={house:"https://capitol.texas.gov/reports/Report.aspx?ID=housefiled&LegSess=90R",senate:"https://capitol.texas.gov/reports/Report.aspx?ID=senatefiled&LegSess=90R"};
const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
const part=t=>parts.find(p=>p.type===t).value;
const date=part("year")+"-"+part("month")+"-"+part("day");
const texasActionDate=Number(part("month"))+"/"+Number(part("day"))+"/"+part("year");
function decode(s){return String(s).replace(/&nbsp;|&#160;|&#xA0;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function parse(html,chamber){
 const plain=decode(html),marker=/\b(HB|SB|HJR|SJR|HCR|SCR|HR|SR)\s*(\d{1,5})\s+Author\s*:/gi;
 const matches=[...plain.matchAll(marker)],items=[];
 for(let i=0;i<matches.length;i++){
  const m=matches[i],entry=plain.slice(m.index+m[0].length,i+1<matches.length?matches[i+1].index:plain.length);
  const action=(entry.match(/Last Action\s*:\s*([\s\S]*?)\s+Caption\s*:/i)||[])[1]||"";
  const caption=(entry.match(/Caption\s*:\s*([\s\S]*)/i)||[])[1]||"";
  const bill=m[1].toUpperCase()+Number(m[2]);
  if(!caption||!(chamber==="house"?/^(HB|HJR|HCR|HR)/:/^(SB|SJR|SCR|SR)/).test(bill))continue;
  items.push({bill,action:action.trim(),caption:caption.trim()});
 }
 if(matches.length<10||items.length<10)throw Error(chamber+" official report parse incomplete: "+items.length+" records");
 const expected=Number((plain.match(/Number of Bills:\s*([\d,]+)/i)||[])[1]?.replace(/,/g,"")||0);
 if(expected&&items.length<expected*.9)throw Error(chamber+" incomplete report "+items.length+"/"+expected);
 return items;
}
async function run(){
 const entries={};
 for(const [chamber,url] of Object.entries(SOURCES)){
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; TexasCapitolWatchdog/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(chamber+" HTTP "+response.status);
  const items=parse(await response.text(),chamber);
  const bills=items.filter(x=>{const match=x.action.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);return !!match&&match[1].split("/").map((v,i)=>i<2?String(Number(v)):v).join("/")===texasActionDate&&/\b[HS] Filed\b/i.test(x.action)}).map(x=>x.bill);
  entries[chamber]={source:url,reportCount:items.length,count:bills.length,bills:[...new Set(bills)].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))};
 }
 const folder=path.join("data","filings");await fs.mkdir(folder,{recursive:true});
 const file=path.join(folder,date+".json");
 let previous=null;try{previous=JSON.parse(await fs.readFile(file,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
 const snapshot={date,timeZone:"America/Chicago",checkedAt:new Date().toISOString(),note:"Bills whose latest official action is Filed on the Texas date. Later actions can change this count; it is not an immutable first-filing record.",...entries};
 if(previous&&JSON.stringify(previous.house?.bills)===JSON.stringify(entries.house.bills)&&JSON.stringify(previous.senate?.bills)===JSON.stringify(entries.senate.bills)){console.log("No filing changes");return}
 if(previous&&(entries.house.count+entries.senate.count)<(previous.house?.count||0)+(previous.senate?.count||0))throw Error("Refusing shrinking same-day archive; later actions may have replaced filed status");
 await fs.writeFile(file,JSON.stringify(snapshot,null,2)+"\n");
 console.log("Saved",file,entries.house.count,entries.senate.count);
}
run().catch(e=>{console.error("Snapshot aborted:",e.message);process.exitCode=1});

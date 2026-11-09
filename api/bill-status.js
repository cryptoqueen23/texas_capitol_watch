const ROOT="https://capitol.texas.gov";
function clean(s){return String(s||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();}
function pick(html,label,next){const t=clean(html),p=t.indexOf(label);if(p<0)return null;let end=t.length;for(const n of next){const i=t.indexOf(n,p+label.length);if(i>=0&&i<end)end=i}return t.slice(p+label.length,end).trim().slice(0,650)||null}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const bill=String(req.query.bill||"").toUpperCase().replace(/\s+/g,"");
 const session=String(req.query.session||"90R").toUpperCase();
 if(!/^(HB|SB|HJR|SJR|HCR|SCR|HR|SR)[1-9]\d{0,4}$/.test(bill)||!/^\d{2}[RSC]\d?$/.test(session))return res.status(400).json({error:"Enter a valid bill number and session"});
 const history=ROOT+"/billlookup/History.aspx?LegSess="+encodeURIComponent(session)+"&Bill="+encodeURIComponent(bill);
 const details=ROOT+"/BillLookup/History.aspx?LegSess="+encodeURIComponent(session)+"&Bill="+encodeURIComponent(bill);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const response=await fetch(history,{signal:controller.signal,headers:{"Accept":"text/html","User-Agent":"TexasCapitolWatchdog/1.0 public bill explainer"}});
  if(!response.ok)throw Error("Official site returned HTTP "+response.status);
  const html=await response.text();
  const text=clean(html);
  if(!/\b(?:History for|Last Action:|Caption Text:|Bill History|Actions)\b/i.test(text))throw Error("Official history page could not be verified");
  const lastAction=pick(html,"Last Action:",["Caption Version:","Caption Text:","Author:"]);
  const caption=pick(html,"Caption Text:",["Author:","Coauthor:","Sponsor:","Subjects:"]);
  const author=pick(html,"Author:",["Coauthor:","Sponsor:","Subjects:"]);
  const committee=pick(html,"House Committee:",["House Committee Status:","Senate Committee:","Actions are in"]);
  const senateCommittee=pick(html,"Senate Committee:",["Senate Committee Status:","House Committee:","Actions are in"]);
  res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=900");
  return res.status(200).json({bill,session,source:"Texas Legislature Online",sourceUrl:details,checkedAt:new Date().toISOString(),lastAction:lastAction||null,caption:caption||null,author:author||null,houseCommittee:committee||null,senateCommittee:senateCommittee||null,verified:!!(lastAction||caption),note:"Official history is authoritative. Extracted fields may be unavailable or incomplete; verify details on the linked official page. No status is inferred from a bill number."});
 }catch(e){return res.status(502).json({bill,session,sourceUrl:history,verified:false,error:"Official bill history unavailable. Open the source link for current information."})}finally{clearTimeout(timer)}
}
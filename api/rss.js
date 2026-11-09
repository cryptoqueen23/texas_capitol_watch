const TYPES = new Set(["upcomingmeetingshouse","upcomingmeetingssenate","upcomingcalendarshouse","upcomingcalendarssenate","todaysbilltext","todaysfiscalnotes","todaysbillanalyses","todaysfiledhouse","todaysfiledsenate","todaysbillspassed"]);
function decode(s){return String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));}
function field(xml,name){const m=xml.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));return m?decode(m[1].trim()):"";}
export default async function handler(req,res){
 const type=String(req.query.type||"");
 if(!TYPES.has(type))return res.status(400).json({error:"Invalid feed"});
 try{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
 let response;try{response=await fetch("https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type="+type,{headers:{"Accept":"application/rss+xml, application/xml, text/xml"},signal:controller.signal});}finally{clearTimeout(timer);}
 if(!response.ok)throw Error("Source unavailable");
 const xml=await response.text();const matches=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,20);
 const items=matches.map(m=>{const v=m[1];const link=field(v,"link").trim();return {title:field(v,"title").replace(/<[^>]*>/g,"").trim(),description:field(v,"description").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,350),date:field(v,"pubDate"),link:/^https:\/\/(?:www\.)?(?:capitol\.texas\.gov|legis\.state\.tx\.us)(?:\/|$)/i.test(link)?link:null};}).filter(x=>x.title);
 res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");return res.status(200).json({items,source:"Texas Legislature Online",type});
 }catch(e){return res.status(502).json({error:"The official feed is temporarily unavailable. Please try again."});}
}
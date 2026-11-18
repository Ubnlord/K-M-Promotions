interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MEDIA_BUCKET?: R2Bucket;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}
type Row = Record<string, any>;
const json = (data: unknown, status=200, headers: Record<string,string>={}) => new Response(JSON.stringify(data), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const fail = (message:string,status=400) => json({error:message},status);
const clean = (v:unknown,n=2000) => typeof v==="string"?v.trim().slice(0,n):"";
const validUrl = (v:string) => { try { const u=new URL(v); return u.protocol==="https:"||u.protocol==="http:"; } catch { return false; } };
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const b64 = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s:string) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function sign(value:string, secret:string) {
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));
}
async function session(request:Request,env:Env) {
 const token=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("km_session="))?.slice(11);
 if(!token)return null;
 const [payload,sig]=token.split(".");
 if(!payload||!sig)return null;
 try { const raw=new TextDecoder().decode(unb64(payload)); if(await sign(payload,env.SESSION_SECRET)!==sig)return null; const s=JSON.parse(raw); return s.exp>Date.now()&&s.email===env.ADMIN_EMAIL?s:null; } catch { return null; }
}
async function requireAdmin(request:Request,env:Env) { return await session(request,env); }
const cookie=(value:string,maxAge:number)=>`km_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
async function all(db:D1Database,sql:string,...params:any[]) { const r=await db.prepare(sql).bind(...params).all(); return r.results as Row[]; }
async function first(db:D1Database,sql:string,...params:any[]) { return await db.prepare(sql).bind(...params).first<Row>(); }
function product(row:Row,origin:string) {
 const media=JSON.parse(row.media_json||"[]").map((m:Row)=>({...m,url:`${origin}/api/media/${encodeURIComponent(m.path)}`}));
 return {id:row.id,name:row.name,category:row.category,description:row.description,price:row.price,currency:row.currency,affiliateUrl:row.affiliate_url,published:!!row.published,clicks:row.clicks||0,media,imageUrl:media[0]?.url||""};
}
async function mediaUpload(env:Env,input:any[]) {
 if(!env.MEDIA_BUCKET)throw new Error("Media storage is not enabled yet. Enable R2 and connect the MEDIA_BUCKET binding.");
 if(input.length>10)throw new Error("A product can have up to 10 photos/videos.");
 const out=[];
 for(const f of input) {
  const type=clean(f.type,100), allowed=["image/png","image/jpeg","image/webp","video/mp4","video/webm","video/quicktime"];
  if(!allowed.includes(type)||typeof f.data!=="string"||f.data.length>16800000)throw new Error("Unsupported media format or file too large. Use PNG/JPG/WebP or MP4/WebM/MOV up to 12 MB each.");
  const ext=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"} as Record<string,string>)[type];
  const key=`products/${Date.now()}-${id()}.${ext}`;
  const bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0));
  await env.MEDIA_BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
  out.push({path:key,type,name:clean(f.name,180)});
 }
 return out;
}
async function handle(request:Request,env:Env):Promise<Response> {
 const url=new URL(request.url), p=url.pathname, method=request.method;
 if(p==="/api/_healthcheck")return json({ok:true,service:"K-M Promotions & Affiliate Hub",database:"connected"});
 if(p==="/api/auth/me"&&method==="GET"){const s=await session(request,env);return json({user:s?{email:s.email}:null});}
 if(p==="/api/auth/login"&&method==="POST"){
  const b=await request.json<any>().catch(()=>({}));
  if(clean(b.email,254).toLowerCase()!==env.ADMIN_EMAIL.toLowerCase()||!env.ADMIN_PASSWORD||clean(b.password,500)!==env.ADMIN_PASSWORD)return fail("Invalid administrator email or password.",401);
  const payload=b64(new TextEncoder().encode(JSON.stringify({email:env.ADMIN_EMAIL,exp:Date.now()+8*60*60*1000})));
  const token=payload+"."+await sign(payload,env.SESSION_SECRET);
  return json({ok:true,user:{email:env.ADMIN_EMAIL}},200,{"set-cookie":cookie(token,8*60*60)});
 }
 if(p==="/api/auth/logout"&&method==="POST")return json({ok:true},200,{"set-cookie":cookie("",0)});
 const adminPath=p.startsWith("/api/admin/");
 const user=adminPath?await requireAdmin(request,env):null;
 if(adminPath&&!user)return fail("Administrator sign-in required.",401);
 if(p==="/api/products"&&method==="GET"){
  const rows=await all(env.DB,"SELECT * FROM products WHERE published=1 ORDER BY created_at DESC LIMIT 200");
  return json({products:rows.map(r=>product(r,url.origin))});
 }
 if(p.startsWith("/api/media/")&&method==="GET"){
  if(!env.MEDIA_BUCKET)return fail("Media storage is not configured.",503);
  const key=decodeURIComponent(p.slice("/api/media/".length));
  if(!key.startsWith("products/"))return fail("Not found.",404);
  const obj=await env.MEDIA_BUCKET.get(key); if(!obj)return fail("Media not found.",404);
  return new Response(obj.body,{headers:{"content-type":obj.httpMetadata?.contentType||"application/octet-stream","cache-control":"public, max-age=31536000, immutable"}});
 }
 if(p.startsWith("/api/click/")&&method==="GET"){
  const pid=decodeURIComponent(p.slice("/api/click/".length)), item=await first(env.DB,"SELECT * FROM products WHERE id=? AND published=1",pid);
  if(!item||!validUrl(item.affiliate_url))return fail("This offer is no longer available.",404);
  await env.DB.batch([
   env.DB.prepare("UPDATE products SET clicks=clicks+1 WHERE id=?").bind(pid),
   env.DB.prepare("INSERT INTO click_events(id,product_id,product_name,created_at) VALUES(?,?,?,?)").bind(id(),pid,item.name,now())
  ]);
  return Response.redirect(item.affiliate_url,302);
 }
 if(p==="/api/enquiries"&&method==="POST"){
  const b=await request.json<any>().catch(()=>({})), name=clean(b.name,120),email=clean(b.email,254).toLowerCase(),type=clean(b.type,80),message=clean(b.message,3000);
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||message.length<10||!type)return fail("Please provide a valid name, email, enquiry type and message.");
  const eid=id(); await env.DB.prepare("INSERT INTO enquiries(id,name,email,business,type,message,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(eid,name,email,clean(b.business,160),type,message,"new",now()).run();
  return json({ok:true,id:eid});
 }
 if(p==="/api/admin/products"&&method==="GET"){
  const rows=await all(env.DB,"SELECT * FROM products ORDER BY created_at DESC LIMIT 200");return json({products:rows.map(r=>product(r,url.origin))});
 }
 if(p==="/api/admin/products"&&method==="POST"){
  const b=await request.json<any>(), name=clean(b.name,160),category=clean(b.category,60),description=clean(b.description,1500),affiliateUrl=clean(b.affiliateUrl,2000);
  if(name.length<2||description.length<10||!category||!validUrl(affiliateUrl))return fail("Enter a product name, category, description and valid destination URL.");
  let media:any[]=[];try{media=Array.isArray(b.media)?await mediaUpload(env,b.media):[];}catch(e){return fail((e as Error).message,400);}
  const pid=id(),t=now();await env.DB.prepare("INSERT INTO products(id,name,category,description,price,currency,affiliate_url,published,clicks,media_json,image_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(pid,name,category,description,clean(b.price,40),clean(b.currency,8)||"NGN",affiliateUrl,b.published?1:0,0,JSON.stringify(media),media[0]?.path||"",t,t).run();
  return json({ok:true,id:pid});
 }
 const productMatch=p.match(/^\/api\/admin\/products\/([^/]+)$/);
 if(productMatch&&method==="PUT"){
  const pid=decodeURIComponent(productMatch[1]), old=await first(env.DB,"SELECT * FROM products WHERE id=?",pid);if(!old)return fail("Product not found.",404);
  const b=await request.json<any>(), vals:any={};
  for(const [k,col,max] of [["name","name",160],["category","category",60],["description","description",1500],["price","price",40],["currency","currency",8]] as any)if(b[k]!==undefined)vals[col]=clean(b[k],max);
  if(b.affiliateUrl!==undefined){if(!validUrl(clean(b.affiliateUrl,2000)))return fail("Enter a valid destination URL.");vals.affiliate_url=clean(b.affiliateUrl,2000);}
  if(b.published!==undefined)vals.published=b.published?1:0;
  if(Array.isArray(b.media)){try{vals.media_json=JSON.stringify(await mediaUpload(env,b.media));vals.image_path=JSON.parse(vals.media_json)[0]?.path||"";}catch(e){return fail((e as Error).message);}}
  const keys=Object.keys(vals);if(!keys.length)return fail("No product changes supplied.");
  vals.updated_at=now();await env.DB.prepare("UPDATE products SET "+keys.map(k=>k+"=?").join(",")+" WHERE id=?").bind(...keys.map(k=>vals[k]),pid).run();return json({ok:true});
 }
 if(productMatch&&method==="DELETE"){const pid=decodeURIComponent(productMatch[1]);await env.DB.prepare("DELETE FROM products WHERE id=?").bind(pid).run();return json({ok:true});}
 if(p==="/api/admin/enquiries"&&method==="GET")return json({enquiries:await all(env.DB,"SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 200")});
 const enquiryMatch=p.match(/^\/api\/admin\/enquiries\/([^/]+)$/);
 if(enquiryMatch&&method==="PUT"){const b=await request.json<any>(),status=clean(b.status,30);if(!["new","in_progress","contacted","closed"].includes(status))return fail("Choose a valid enquiry status.");const r=await env.DB.prepare("UPDATE enquiries SET status=?,updated_at=? WHERE id=?").bind(status,now(),decodeURIComponent(enquiryMatch[1])).run();return r.meta.changes?json({ok:true}):fail("Enquiry not found.",404);}
 if(p==="/api/admin/campaigns"&&method==="GET")return json({campaigns:await all(env.DB,"SELECT id,name,channel,destination_url AS destinationUrl,budget,start_date AS startDate,end_date AS endDate,status,notes,created_at AS createdAt FROM campaigns ORDER BY created_at DESC LIMIT 200")});
 if(p==="/api/admin/campaigns"&&method==="POST"){
  const b=await request.json<any>(),name=clean(b.name,160),channel=clean(b.channel,60),dest=clean(b.destinationUrl,2000),status=clean(b.status,20)||"draft";
  if(name.length<2||!channel||!validUrl(dest)||!["draft","active","paused","completed"].includes(status))return fail("Enter a campaign name, channel and valid destination URL.");
  const cid=id(),t=now();await env.DB.prepare("INSERT INTO campaigns(id,name,channel,destination_url,budget,start_date,end_date,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(cid,name,channel,dest,clean(b.budget,80),clean(b.startDate,10),clean(b.endDate,10),status,clean(b.notes,2000),t,t).run();return json({ok:true,id:cid});
 }
 const campMatch=p.match(/^\/api\/admin\/campaigns\/([^/]+)$/);
 if(campMatch&&method==="PUT"){const b=await request.json<any>(),status=clean(b.status,20);if(!["draft","active","paused","completed"].includes(status))return fail("Choose a valid campaign status.");await env.DB.prepare("UPDATE campaigns SET status=?,updated_at=? WHERE id=?").bind(status,now(),decodeURIComponent(campMatch[1])).run();return json({ok:true});}
 if(campMatch&&method==="DELETE"){await env.DB.prepare("DELETE FROM campaigns WHERE id=?").bind(decodeURIComponent(campMatch[1])).run();return json({ok:true});}
 if(p==="/api/admin/analytics"&&method==="GET"){
  const [products,campaigns,enquiries,events]=await Promise.all([all(env.DB,"SELECT * FROM products"),all(env.DB,"SELECT * FROM campaigns"),all(env.DB,"SELECT * FROM enquiries"),all(env.DB,"SELECT * FROM click_events ORDER BY created_at DESC LIMIT 500")]);
  const dayMap=new Map<string,number>();for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dayMap.set(d.toISOString().slice(0,10),0);}for(const e of events){const d=String(e.created_at).slice(0,10);if(dayMap.has(d))dayMap.set(d,(dayMap.get(d)||0)+1);}
  const last7=Date.now()-7*86400000,prev7=Date.now()-14*86400000;
  return json({totalClicks:products.reduce((s,x)=>s+Number(x.clicks||0),0),clicks7:events.filter(x=>Date.parse(x.created_at)>=last7).length,previous7:events.filter(x=>Date.parse(x.created_at)>=prev7&&Date.parse(x.created_at)<last7).length,liveOffers:products.filter(x=>x.published).length,campaigns:campaigns.filter(x=>x.status==="active").length,enquiries:enquiries.length,daily:Array.from(dayMap,([date,clicks])=>({date,clicks})),recent:events.slice(0,12).map(x=>({id:x.id,productName:x.product_name,createdAt:x.created_at}))});
 }
 if(p==="/api/admin/conversions"&&method==="GET")return json({conversions:await all(env.DB,"SELECT id,network,transaction_id AS transactionId,product_id AS productId,product_name AS productName,revenue,commission,currency,country,status,converted_at AS convertedAt,created_at AS createdAt FROM conversions ORDER BY created_at DESC LIMIT 200")});
 if(p==="/api/admin/conversions"&&method==="POST"){
  const b=await request.json<any>(),network=clean(b.network,100),tx=clean(b.transactionId,180),currency=clean(b.currency,8).toUpperCase(),revenue=Number(b.revenue),commission=Number(b.commission),status=clean(b.status,20);
  if(!network||!tx||!["NGN","USD","GBP","EUR","KES","GHS","ZAR"].includes(currency)||!Number.isFinite(revenue)||revenue<0||!Number.isFinite(commission)||commission<0||commission>revenue||!["verified","pending","rejected"].includes(status))return fail("Check network, transaction ID, currency and amounts.");
  const dup=await first(env.DB,"SELECT id FROM conversions WHERE network=? AND transaction_id=?",network,tx);if(dup)return fail("This network transaction ID is already recorded.",409);
  let productName="";if(b.productId){const pr=await first(env.DB,"SELECT name FROM products WHERE id=?",clean(b.productId,120));if(!pr)return fail("Product not found.",404);productName=pr.name;}
  const cid=id();await env.DB.prepare("INSERT INTO conversions(id,network,transaction_id,product_id,product_name,revenue,commission,currency,country,status,converted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(cid,network,tx,clean(b.productId,120),productName,revenue,commission,currency,clean(b.country,80),status,clean(b.convertedAt,10)||now().slice(0,10),now()).run();return json({ok:true,id:cid});
 }
 if(p==="/api/admin/payouts"&&method==="GET")return json({payouts:await all(env.DB,"SELECT id,network,amount,currency,reference,status,created_at AS createdAt,paid_at AS paidAt FROM payouts ORDER BY created_at DESC LIMIT 200")});
 if(p==="/api/admin/payouts"&&method==="POST"){
  const b=await request.json<any>(),network=clean(b.network,100),currency=clean(b.currency,8).toUpperCase(),amount=Number(b.amount),status=clean(b.status,20);
  if(!network||!["NGN","USD","GBP","EUR","KES","GHS","ZAR"].includes(currency)||!Number.isFinite(amount)||amount<=0||!["pending","paid"].includes(status))return fail("Enter a valid payout.");
  const pid=id(),t=now();await env.DB.prepare("INSERT INTO payouts(id,network,amount,currency,reference,status,created_at,paid_at) VALUES(?,?,?,?,?,?,?,?)").bind(pid,network,amount,currency,clean(b.reference,180),status,t,status==="paid"?t:"").run();return json({ok:true,id:pid});
 }
 const payoutMatch=p.match(/^\/api\/admin\/payouts\/([^/]+)$/);
 if(payoutMatch&&method==="PUT"){const b=await request.json<any>(),status=clean(b.status,20);if(!["pending","paid"].includes(status))return fail("Invalid payout status.");await env.DB.prepare("UPDATE payouts SET status=?,paid_at=? WHERE id=?").bind(status,status==="paid"?now():"",decodeURIComponent(payoutMatch[1])).run();return json({ok:true});}
 if(p.startsWith("/api/"))return fail("Not found.",404);
 return env.ASSETS.fetch(request);
}
export default { async fetch(request:Request,env:Env) { try { return await handle(request,env); } catch(e) { console.error("K-M Worker error",e); return fail("The service is temporarily unavailable.",500); } } };

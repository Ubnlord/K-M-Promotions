import {
  router, json, error, db, storage, increment,
  requireAuth, requireAdminEmailAllowlist
} from '@appdeploy/sdk';

const ADMIN_EMAILS = ['munachimsokenneth@gmail.com'];
const PRODUCT_TABLE = 'km_affiliate_products';
const ENQUIRY_TABLE = 'km_promotion_enquiries';
const CAMPAIGN_TABLE = 'km_promotion_campaigns';
const CLICK_TABLE = 'km_affiliate_click_events';
const CONVERSION_TABLE = 'km_affiliate_conversions';
const PAYOUT_TABLE = 'km_affiliate_payouts';

type ProductInput = {
  name?: string; category?: string; description?: string; price?: string;
  currency?: string; affiliateUrl?: string; published?: boolean;
  media?: Array<{ name?: string; type?: string; data?: string }>;
};
function clean(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; }
  catch { return false; }
}
async function productWithImage(item: Record<string, unknown> & { id: string }) {
  const paths = Array.isArray(item.media) ? (item.media as Array<Record<string, unknown>>).map(media => typeof media.path === 'string' ? media.path : '').filter(Boolean) : [];
  if (!paths.length && typeof item.imagePath === 'string' && item.imagePath) paths.push(item.imagePath);
  let media: Array<{ path: string; type: string; url: string; name?: string }> = [];
  try {
    const urls = paths.length ? await storage.url(paths) : [];
    media = paths.map((path, index) => ({ path, type: String((item.media as Array<Record<string, unknown>> | undefined)?.[index]?.type ?? 'image/jpeg'), name: String((item.media as Array<Record<string, unknown>> | undefined)?.[index]?.name ?? ''), url: urls.find(entry => entry.path === path)?.url ?? '' }));
  } catch { media = []; }
  return { ...item, media, imageUrl: media[0]?.url ?? '' };
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ ok: true, service: 'K-M Promotions & Affiliate Hub' })],

  'GET /api/products': [async () => {
    try {
      const result = await db.list<Record<string, unknown>>(PRODUCT_TABLE, { limit: 100 });
      const visible = result.items.filter(item => item.published === true);
      return json({ products: await Promise.all(visible.map(item => productWithImage(item))) });
    } catch (err) {
      console.error('Failed to list K-M products', err);
      return error('Products are temporarily unavailable.', 503);
    }
  }],

  'GET /api/click/:id': [async ({ params }) => {
    try {
      const [item] = await db.get<Record<string, unknown>>(PRODUCT_TABLE, [params.id]);
      if (!item || item.published !== true) return error('This offer is no longer available.', 404);
      const url = clean(item.affiliateUrl, 2000);
      if (!validUrl(url)) return error('This offer link is invalid.', 400);
      await db.tx.update(PRODUCT_TABLE, [{
        id: params.id,
        record: { clicks: increment(1) }
      }], { patch: true });
      try { await db.add(CLICK_TABLE, [{ productId: params.id, productName: clean(item.name,160), createdAt: new Date().toISOString() }]); }
      catch (eventErr) { console.error('Could not store affiliate click event', eventErr); }
      return {
        statusCode: 302,
        headers: { Location: url, 'Cache-Control': 'no-store' },
        body: ''
      };
    } catch (err) {
      console.error('Failed to record affiliate click', err);
      return error('Unable to open this offer right now.', 503);
    }
  }],

  'POST /api/enquiries': [async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const name = clean(input.name, 120);
    const email = clean(input.email, 254).toLowerCase();
    const business = clean(input.business, 160);
    const type = clean(input.type, 80);
    const message = clean(input.message, 3000);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || !type) {
      return error('Please provide a valid name, email, enquiry type and message.', 400);
    }
    try {
      const [id] = await db.add(ENQUIRY_TABLE, [{
        name, email, business, type, message, status: 'new',
        createdAt: new Date().toISOString()
      }]);
      if (!id) return error('We could not save your enquiry. Please try again.', 503);
      return json({ ok: true, id });
    } catch (err) {
      console.error('Failed to save K-M promotion enquiry', err);
      return error('We could not save your enquiry. Please try again later.', 503);
    }
  }],

  'GET /api/admin/enquiries': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      try {
        const result = await db.list(ENQUIRY_TABLE, { limit: 50 });
        return json({ enquiries: result.items });
      } catch (err) {
        console.error('Failed to load K-M enquiries', err);
        return error('Unable to load enquiries.', 503);
      }
    }
  ],

  'PUT /api/admin/enquiries/:id': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ({ params, body }) => {
      const status = clean((body as Record<string, unknown> | undefined)?.status, 30);
      if (!['new', 'in_progress', 'contacted', 'closed'].includes(status)) return error('Choose a valid enquiry status.', 400);
      try {
        const [updated] = await db.tx.update(ENQUIRY_TABLE, [{ id: params.id, record: { status, updatedAt: new Date().toISOString() } }], { patch: true });
        return updated ? json({ ok: true }) : error('Enquiry not found.', 404);
      } catch (err) {
        console.error('Failed to update K-M enquiry status', err);
        return error('Unable to update enquiry status.', 503);
      }
    }
  ],

  'GET /api/admin/analytics': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      try {
        const [products, campaigns, enquiries, events] = await Promise.all([
          db.list<Record<string, unknown>>(PRODUCT_TABLE, { limit: 100 }),
          db.list<Record<string, unknown>>(CAMPAIGN_TABLE, { limit: 100 }),
          db.list<Record<string, unknown>>(ENQUIRY_TABLE, { limit: 100 }),
          db.list<Record<string, unknown>>(CLICK_TABLE, { limit: 500 })
        ]);
        const now = new Date();
        const start = new Date(now); start.setDate(start.getDate()-29); start.setHours(0,0,0,0);
        const dayMap = new Map<string, number>();
        for (let i=0;i<30;i++) { const day=new Date(start); day.setDate(start.getDate()+i); dayMap.set(day.toISOString().slice(0,10),0); }
        const eventItems = events.items;
        for (const event of eventItems) { const day=String(event.createdAt??'').slice(0,10); if(dayMap.has(day)) dayMap.set(day,(dayMap.get(day)??0)+1); }
        const today = now.toISOString().slice(0,10);
        const last7 = new Date(now); last7.setDate(last7.getDate()-6); last7.setHours(0,0,0,0);
        const prev7 = new Date(last7); prev7.setDate(prev7.getDate()-7);
        const clicks7 = eventItems.filter(e=>new Date(String(e.createdAt)).getTime()>=last7.getTime()).length;
        const previous7 = eventItems.filter(e=>{const t=new Date(String(e.createdAt)).getTime();return t>=prev7.getTime()&&t<last7.getTime();}).length;
        return json({ totalClicks: products.items.reduce((sum,p)=>sum+Number(p.clicks??0),0), clicks7, previous7, liveOffers: products.items.filter(p=>p.published===true).length, campaigns: campaigns.items.filter(c=>c.status==='active').length, enquiries: enquiries.items.length, daily: Array.from(dayMap,([date,clicks])=>({date,clicks})), recent: eventItems.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,12).map(e=>({id:e.id,productName:e.productName,createdAt:e.createdAt})) });
      } catch (err) { console.error('Failed to load K-M analytics', err); return error('Unable to load performance analytics.',503); }
    }
  ],

  'GET /api/admin/campaigns': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async () => {
      try { const result = await db.list(CAMPAIGN_TABLE, { limit: 100 }); return json({ campaigns: result.items }); }
      catch (err) { console.error('Failed to list K-M campaigns', err); return error('Unable to load campaigns.', 503); }
    }
  ],

  'POST /api/admin/campaigns': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ({ body }) => {
      const input = (body ?? {}) as Record<string, unknown>;
      const name = clean(input.name, 160);
      const channel = clean(input.channel, 60);
      const destinationUrl = clean(input.destinationUrl, 2000);
      const status = clean(input.status, 20) || 'draft';
      if (name.length < 2 || !channel || !validUrl(destinationUrl) || !['draft','active','paused','completed'].includes(status)) return error('Enter a campaign name, channel and valid destination URL.', 400);
      if (clean(input.startDate, 10) && clean(input.endDate, 10) && clean(input.endDate, 10) < clean(input.startDate, 10)) return error('End date cannot be before start date.', 400);
      try {
        const [id] = await db.add(CAMPAIGN_TABLE, [{ name, channel, destinationUrl, budget: clean(input.budget, 80), startDate: clean(input.startDate, 10), endDate: clean(input.endDate, 10), status, notes: clean(input.notes, 2000), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        return id ? json({ ok: true, id }) : error('Could not save campaign.', 503);
      } catch (err) { console.error('Failed to create K-M campaign', err); return error('Could not save campaign.', 503); }
    }
  ],

  'PUT /api/admin/campaigns/:id': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ({ params, body }) => {
      const status = clean((body as Record<string, unknown> | undefined)?.status, 20);
      if (!['draft','active','paused','completed'].includes(status)) return error('Choose a valid campaign status.', 400);
      try { const [updated] = await db.tx.update(CAMPAIGN_TABLE, [{ id: params.id, record: { status, updatedAt: new Date().toISOString() } }], { patch: true }); return updated ? json({ ok: true }) : error('Campaign not found.', 404); }
      catch (err) { console.error('Failed to update K-M campaign', err); return error('Could not update campaign.', 503); }
    }
  ],

  'DELETE /api/admin/campaigns/:id': [
    requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ({ params }) => {
      try { const [deleted] = await db.delete(CAMPAIGN_TABLE, [params.id]); return deleted ? json({ ok: true }) : error('Campaign not found.', 404); }
      catch (err) { console.error('Failed to delete K-M campaign', err); return error('Could not delete campaign.', 503); }
    }
  ],

  'GET /api/admin/conversions': [requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS), async () => { try { const result=await db.list(CONVERSION_TABLE,{limit:100}); return json({conversions:result.items}); } catch(err) { console.error(err); return error('Unable to load conversions.',503); } }],
  'POST /api/admin/conversions': [requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS), async ({body}) => {
    const input=(body??{}) as Record<string,unknown>; const network=clean(input.network,100), transactionId=clean(input.transactionId,180), currency=clean(input.currency,8).toUpperCase(), revenue=Number(input.revenue), commission=Number(input.commission), status=clean(input.status,20);
    if(!network||!transactionId||!['NGN','USD','GBP','EUR','KES','GHS','ZAR'].includes(currency)||!Number.isFinite(revenue)||revenue<0||!Number.isFinite(commission)||commission<0||commission>revenue||!['verified','pending','rejected'].includes(status)) return error('Check network, transaction ID, currency and amounts. Commission cannot exceed revenue.',400);
    try { const prior=await db.list<Record<string,unknown>>(CONVERSION_TABLE,{limit:100}); if(prior.items.some(x=>x.network===network&&x.transactionId===transactionId)) return error('This network transaction ID is already recorded.',409);
      const productId=clean(input.productId,120); let productName=''; if(productId){const [p]=await db.get<Record<string,unknown>>(PRODUCT_TABLE,[productId]);if(!p)return error('Product not found.',404);productName=clean(p.name,160);}
      const [id]=await db.add(CONVERSION_TABLE,[{network,transactionId,productId,productName,revenue,commission,currency,country:clean(input.country,80),status,convertedAt:clean(input.convertedAt,10)||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString()}]); return id?json({ok:true,id}):error('Could not save conversion.',503);
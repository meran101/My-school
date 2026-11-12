const $ = s => document.querySelector(s);
const TODAY = new Date().toISOString().slice(0, 10);
let D, ORIG, CTX, token = localStorage.gh_token || '', me = JSON.parse(localStorage.gh_me || 'null'), dirty = false, _n = 0;
if (token && !me) { token = ''; localStorage.removeItem('gh_token'); } // جلسة قديمة بلا اسم: يلزم تسجيل الدخول من جديد
let editing = !!(token && me);
let cfg = JSON.parse(localStorage.gh_cfg || 'null') || guess();
const pv = {}; // معاينة الصور المرفوعة قبل أن يعيد GitHub Pages بناء الموقع
const SUBJECTS = ['اللغة العربية', 'اللغة الإنجليزية', 'التربية الإسلامية', 'الرياضيات', 'الفيزياء', 'الكيمياء', 'الأحياء'];
const ACTS = [['text', 'تعديل النصوص'], ['img', 'إضافة صور'], ['file', 'رفع ملفات وروابط'], ['add', 'إضافة عناصر وصفحات'], ['del', 'حذف']];
// الصلاحية المطلوبة لكل زر ('admin' = للمدير فقط)
const ACT = { img: 'img', clr: 'img', upfile: 'file', add: 'add', addpick: 'add', up: 'add', down: 'add', delb: 'del', del: 'del', addmenu: 'admin', mup: 'admin', mdown: 'admin', mdel: 'admin', mkcode: 'admin', delmember: 'admin', inboxcfg: 'admin', inboxbackup: 'admin', inboximport: 'admin', openmsg: 'admin', reloadmsgs: 'admin', schoolimg: 'admin', schoolclr: 'admin', schoolpos: 'admin', liveadd: 'admin', livedel: 'admin' };

function guess() {
  const h = location.hostname, gh = h.endsWith('.github.io');
  return { owner: gh ? h.split('.')[0] : '', repo: gh ? (location.pathname.split('/')[1] || h) : '', branch: 'main' };
}
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => e(s).replace(/\n/g, '<br>');
const im = s => e(pv[s] || s);
const safe = u => /^(https?:\/\/|tel:|mailto:|[\w\/.\-%]+$)/.test(u) ? e(u) : '#';
const uid = () => 'i' + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 4);
const clone = o => JSON.parse(JSON.stringify(o));
const gp = k => k.reduce((o, x) => o[x], D);
const get = p => gp(p.split('.'));
const set = (p, v) => { const k = p.split('.'), l = k.pop(); gp(k)[l] = v; };
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const isAdmin = () => !!me && me.role === 'admin';
const ED = () => editing && !!token && !!me;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4000); }

/* ---------- التشفير: رمز كل مادة يفتح مفتاح الحفظ للمدرس ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const toB = u => btoa(String.fromCharCode(...new Uint8Array(u)));
const fromB = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const norm = s => s.toUpperCase().replace(/[\s-]/g, '');
async function keyOf(code, salt) {
  const m = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(code, text) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  return { salt: toB(salt), iv: toB(iv), ct: toB(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(code, salt), enc.encode(text))) };
}
async function unseal(code, v) {
  try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB(v.iv) }, await keyOf(code, fromB(v.salt)), fromB(v.ct))); } catch (x) { return null; }
}
function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12));
  return [...r].map(x => A[x % 32]).join('').replace(/(.{4})(?=.)/g, '$1-');
}

/* ---------- البيانات: تحويل وتجهيز ---------- */
function migrate(o) {
  if (o.map) return o;
  const map = {}, mk = (title, blocks) => { const id = uid(); map[id] = { id, title, blocks }; return id; };
  const card = n => ({ t: 'card', title: n.title, text: n.text, date: n.date, src: n.image });
  const sub = x => x.link ? { t: 'btn', text: x.name, url: x.link } : { t: 'page', ref: mk(x.name, []) };
  const contact = [['الهاتف', o.contact.phone], ['البريد', o.contact.email], ['العنوان', o.contact.address]].filter(x => x[1]).map(x => ({ t: 'p', text: x[0] + ': ' + x[1] }));
  const menu = [
    mk('المرحلة', [{ t: 'hero', title: o.home.title, text: o.home.intro, src: o.home.hero }, ...o.stages.map(s => ({ t: 'page', ref: mk(s.name, s.subjects.map(sub)) }))]),
    mk('الأخبار', o.news.map(card)),
    mk('معرض الصور', o.gallery.map(g => ({ t: 'img', src: g.src, text: g.caption }))),
    mk('عن المدرسة', [...(o.about.image ? [{ t: 'img', src: o.about.image, text: '' }] : []), { t: 'p', text: o.about.text }]),
    mk('تواصل معنا', contact.length ? contact : [{ t: 'p', text: 'اكتب بيانات التواصل هنا' }])
  ];
  (o.pages || []).forEach(p => menu.push(mk(p.title, [{ t: 'p', text: p.text }, ...p.images.map(s => ({ t: 'img', src: s, text: '' }))])));
  return { school: o.school, urgent: o.urgent, menu, map };
}
const KEYS = ['school', 'urgent', 'menu', 'codes', 'stageRoot', 'newsPage', 'contactForm', 'ticketSeeded', 'live', 'schoolImg', 'inbox', 'aboutSeeded'];
function ensure(d) {
  d.members = d.members || []; d.codes = d.codes || {}; d.live = d.live || []; d.schoolImg = d.schoolImg || { src: '', pos: 'center' };
  const mp = d.map;
  if (!d.stageRoot) d.stageRoot = d.menu.find(id => mp[id].title === 'المرحلة') || d.menu[0];
  if (!d.newsPage) d.newsPage = d.menu.find(id => mp[id].title === 'الأخبار') || '';
  ((mp[d.stageRoot] || {}).blocks || []).filter(b => b.t === 'page').forEach(b => ((mp[b.ref] || {}).blocks || []).filter(x => x.t === 'page' && mp[x.ref]).forEach(x => { mp[x.ref].subject = mp[x.ref].subject || mp[x.ref].title; }));
  if (!d.ticketSeeded) {
    const c = d.menu.find(id => mp[id].title === 'تواصل معنا');
    if (c) mp[c].blocks.push(DEF.ticket());
    d.ticketSeeded = true;
  }
  if (!d.aboutSeeded) { // صفحة «اعرف عنا» مع المساعد الذكي
    if (!d.menu.some(id => (mp[id] || {}).title === 'اعرف عنا')) {
      const id = uid(); mp[id] = { id, title: 'اعرف عنا', blocks: [DEF.chat()] }; d.menu.push(id);
    }
    d.aboutSeeded = true;
  }
  return d;
}
function removePage(id) { const p = D.map[id]; if (!p) return; p.blocks.forEach(b => b.t === 'page' && removePage(b.ref)); delete D.map[id]; }
const parentOf = id => Object.values(D.map).find(p => p.blocks.some(b => b.t === 'page' && b.ref === id));
const stages = () => ((D.map[D.stageRoot] || {}).blocks || []).filter(b => b.t === 'page').map(b => b.ref);
const scopes = () => [...stages().map(id => [id, D.map[id].title]), ...(D.newsPage && D.map[D.newsPage] ? [[D.newsPage, D.map[D.newsPage].title]] : [])];

/* ---------- الصلاحيات (تُطبَّق في الواجهة) ---------- */
function scopeOf(pid) {
  let id = pid, prev = null;
  for (let n = 0; id && n < 30; n++) {
    if (id === D.newsPage) return { scope: id, ok: true };
    if (stages().includes(id)) return { scope: id, ok: !!prev && ((D.map[prev] || {}).subject || (D.map[prev] || {}).title) === me.subject };
    prev = id; const par = parentOf(id); id = par && par.id;
  }
  return null;
}
function can(action, pid = CTX) {
  if (!me) return false;
  if (me.role === 'admin') return true;
  const s = scopeOf(pid); if (!s || !s.ok) return false;
  const m = D.members.find(x => x.id === me.id);
  return !!(m && m.perms && m.perms[s.scope] && m.perms[s.scope][action]);
}
const canPath = (action, p) => p.startsWith('map.') ? can(action, p.split('.')[1]) : isAdmin();
const anyPerm = pid => ACTS.some(([k]) => can(k, pid));
function guardOk() { // فحص احتياطي قبل الحفظ: المدرس لا يحفظ إلا ما يخص صلاحياته
  if (!me || me.role === 'admin') return true;
  const J = JSON.stringify;
  if (KEYS.some(k => J(D[k]) !== J(ORIG[k]))) return false;
  const om = Object.fromEntries(ORIG.members.map(m => [m.id, m]));
  const nop = m => { const c = { ...m }; delete c.photo; return J(c); };
  if (D.members.some(m => om[m.id] ? (m.id === me.id ? nop(m) !== nop(om[m.id]) : J(m) !== J(om[m.id])) : m.id !== me.id)) return false;
  if (ORIG.members.some(m => !D.members.find(x => x.id === m.id))) return false;
  return Object.keys(D.map).every(pid => J(D.map[pid]) === J(ORIG.map[pid]) || anyPerm(pid));
}

/* ---------- عناصر قابلة للتعديل المباشر ---------- */
const T = (tag, p, cls = '', ph = '') => (ED() && canPath('text', p))
  ? `<${tag} class="ed ${cls}" contenteditable="plaintext-only" data-e="${p}" data-ph="${ph}">${e(get(p))}</${tag}>`
  : `<${tag} class="${cls}">${nl(get(p))}</${tag}>`;
const eb = (a, attrs, label, cls = '') => {
  const need = ACT[a], ok = ED() && (need === 'admin' ? isAdmin() : need ? can(need) : true);
  return ok ? `<button class="eb ${cls}" data-a="${a}" ${attrs}>${label}</button>` : '';
};
const imgCtl = p => { const c = eb('img', `data-p="${p}"`, get(p) ? 'تغيير الصورة' : 'إضافة صورة') + (get(p) ? eb('clr', `data-p="${p}"`, 'إزالة الصورة', 'dn') : ''); return c ? `<span class="ec">${c}</span>` : ''; };

/* ---------- المساعد: «اعرف عنا» ---------- */
const CHAT = []; let chatBusy = false;
const nz = x => String(x || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const STOP = new Set(['من', 'في', 'على', 'الي', 'الى', 'عن', 'ما', 'هل', 'هو', 'هي', 'ماذا', 'كيف', 'اين', 'متي', 'هذا', 'هذه', 'ذلك', 'لماذا', 'كم', 'لي', 'لنا', 'عند', 'مع']);
const toks = q => nz(q).split(/[^\u0621-\u063A\u0641-\u064Aa-z0-9]+/).filter(w => w.length > 1).map(w => w.length > 3 && w.startsWith('ال') ? w.slice(2) : w).filter(w => !STOP.has(w)).flatMap(w => w.length > 4 && /^[اتينسبلوف]/.test(w) ? [w, w.slice(1)] : [w]);
function siteChunks() { // نصوص الموقع كلها مقسّمة حسب العنصر
  const out = [], sch = D.school || {};
  if (sch.name) out.push({ id: '', page: 'المدرسة', text: [sch.name, sch.subtitle].filter(Boolean).join(' - ') });
  Object.values(D.map).forEach(pg => pg.blocks.forEach(b => {
    let t = '';
    if (b.t === 'p' || b.t === 'h') t = b.text; else if (b.t === 'card') t = [b.title, b.date, b.text].filter(Boolean).join(': ');
    else if (b.t === 'btn') t = b.text; else if (b.t === 'img') t = b.text; else if (b.t === 'hero') t = [b.title, b.text].filter(Boolean).join(': ');
    t = String(t || '').trim(); if (t) out.push({ id: pg.id, page: pg.title, text: t });
  }));
  return out;
}
function localAnswer(q) {
  const qs = toks(q); if (!qs.length) return null;
  const sc = siteChunks().map(c => { const hay = nz(c.text), pt = nz(c.page); let n = 0; qs.forEach(w => { if (hay.includes(w)) n += 1; if (pt.includes(w)) n += 1.5; }); return { c, n }; })
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  if (!sc.length) return null;
  return { t: sc.map(x => x.c.text).join('\n\n'), links: [...new Map(sc.filter(x => x.c.id).map(x => [x.c.id, { id: x.c.id, title: x.c.page }])).values()] };
}
async function aiAnswer(q) {
  const ctx = siteChunks().map(c => `[${c.page}] ${c.text}`).join('\n').slice(0, 7000);
  const sys = `أنت مساعد ذكي ودود في الموقع الرسمي لـ «${(D.school || {}).name || 'المدرسة'}»، وطلابك وزوارك عرب. أجب بالعربية الفصحى المبسطة وبوضوح واختصار عن أي سؤال، سواء كان عن المدرسة أو سؤالاً عاماً (علوم، دراسة، ثقافة، معلومات عامة...). القاعدة: أي معلومة تخص هذه المدرسة تحديداً (الدوام، الأسماء، التواريخ، الأرقام، الأخبار) خذها من معلومات الموقع أدناه فقط، وإذا لم تجدها فقل ذلك واقترح صفحة «تواصل معنا» ولا تخترعها. أما الأسئلة العامة فأجب عنها من معرفتك، وإذا لم تكن متأكداً فاذكر ذلك بصراحة. لا تُجب عن أي محتوى غير لائق أو ضار، ووجّه الطالب بلطف نحو ما ينفعه.\n\nمعلومات الموقع:\n${ctx}`;
  const hist = CHAT.slice(-7, -1).filter(m => !m.err).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t.slice(0, 500) }));
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ model: 'openai', temperature: 0.3, messages: [{ role: 'system', content: sys }, ...hist, { role: 'user', content: q }] }) });
    if (!r.ok) return null;
    const j = await r.json(), t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return t ? String(t).trim().slice(0, 2500) : null;
  } catch (x) { return null; } finally { clearTimeout(tm); }
}
function chatHTML() {
  return CHAT.map(m => m.r === 'u' ? `<div class="cm u">${nl(m.t)}</div>` : `<div class="cm b">${m.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : nl(m.t)}${(m.links || []).map(l => `<a class="cl" href="#p-${e(l.id)}">‹ ${e(l.title)}</a>`).join('')}</div>`).join('');
}
function chatDraw() { const l = $('#chatlog'); if (l) { l.innerHTML = chatHTML(); l.scrollTop = l.scrollHeight; } }

/* ---------- أنواع العناصر ---------- */
const B = {
  hero: (b, p) => `<section class="hero" style="${b.src ? `background-image:linear-gradient(rgba(20,54,92,.75),rgba(20,54,92,.75)),url('${im(b.src)}')` : ''}">${T('h1', p + '.title', '', 'العنوان الكبير')}${T('p', p + '.text', '', 'نص ترحيبي')}${imgCtl(p + '.src')}</section>`,
  h: (b, p) => T('h2', p + '.text', '', 'عنوان'),
  p: (b, p) => T('p', p + '.text', '', 'اكتب هنا'),
  img: (b, p) => `<figure>${b.src ? `<img src="${im(b.src)}" alt="${e(b.text)}" ${ED() ? '' : `data-zoom="${im(b.src)}"`}>` : ''}${imgCtl(p + '.src')}${T('figcaption', p + '.text', '', 'وصف الصورة')}</figure>`,
  card: (b, p) => `<article class="card">${b.src ? `<img src="${im(b.src)}" alt="">` : ''}<div class="cb">${imgCtl(p + '.src')}${T('time', p + '.date', '', 'التاريخ')}${T('h3', p + '.title', '', 'العنوان')}${T('p', p + '.text', '', 'النص')}</div></article>`,
  btn: (b, p) => ED() && (canPath('text', p) || can('file'))
    ? `<div class="btn">${T('span', p + '.text', '', 'نص الزر')}</div>${can('file') ? `<div class="row"><input data-b="${p}.url" placeholder="الرابط (https://...)" value="${e(b.url)}">${eb('upfile', `data-p="${p}.url"`, 'رفع ملف')}</div>` : ''}`
    : `<a class="btn" href="${safe(b.url)}" target="_blank" rel="noopener">${e(b.text)}</a>`,
  page: (b, p, i) => {
    const c = D.map[b.ref]; if (!c) return '';
    return ED() && canPath('text', `map.${b.ref}.title`)
      ? `<div class="bar c${i % 3}"><div>${T('b', `map.${b.ref}.title`, '', 'عنوان الصفحة')}<span>${c.blocks.length} عناصر</span></div><a class="eb" href="#p-${b.ref}">فتح وتعديل</a></div>`
      : `<a class="bar c${i % 3}" href="#p-${b.ref}"><b>${e(c.title)}</b><span>فتح</span></a>`;
  },
  ticket: (b, p) => `<div class="panel">${T('h3', p + '.title', '', 'عنوان اللوحة')}${T('p', p + '.text', '', 'نص اللوحة')}<button class="btn" data-a="ticket">إرسال تذكرة</button></div>`,
  chat: (b, p) => `<div class="panel chat">${T('h3', p + '.title', '', 'عنوان المساعد')}${T('p', p + '.text', '', 'وصف المساعد')}${ED() && isAdmin() ? `<label class="hint"><input type="checkbox" data-c="${p}.ai" ${b.ai !== false ? 'checked' : ''}> الذكاء الاصطناعي: يجيب عن الأسئلة العامة أيضاً (وإذا أُلغي يُجيب من نصوص الموقع فقط)</label>` : ''}<div id="chatlog" class="chatlog" aria-live="polite">${chatHTML()}</div><div class="chips">${['ما هي المدرسة؟', 'كيف أتواصل مع الإدارة؟', 'اشرح لي قانون نيوتن الأول'].map(q => `<button class="chip" data-a="chatq" data-k="${e(q)}">${e(q)}</button>`).join('')}</div><div class="chatin"><input id="chatq" maxlength="300" placeholder="اسأل عن المدرسة أو أي موضوع..." data-ai="${b.ai !== false ? 1 : 0}" autocomplete="off"><button class="btn" data-a="chatsend">إرسال</button></div>${CHAT.length ? '<button class="eb" data-a="chatclear" style="background:#eef2f6">مسح المحادثة</button>' : ''}</div>`,
  hr: () => '<hr>'
};
const KINDS = [['h', 'عنوان'], ['p', 'نص'], ['img', 'صورة'], ['card', 'خبر أو بطاقة'], ['btn', 'زر رابط أو ملف'], ['page', 'صفحة داخلية جديدة'], ['hr', 'فاصل'], ['hero', 'غلاف كبير'], ['ticket', 'لوحة تذكرة التواصل'], ['chat', 'مساعد ذكي (اعرف عنا)']];
const DEF = {
  h: () => ({ t: 'h', text: '' }), p: () => ({ t: 'p', text: '' }), img: () => ({ t: 'img', src: '', text: '' }),
  card: () => ({ t: 'card', title: '', text: '', date: TODAY, src: '' }), btn: () => ({ t: 'btn', text: 'زر جديد', url: '' }),
  hr: () => ({ t: 'hr' }), ticket: () => ({ t: 'ticket', title: 'راسلنا', text: 'لديك استفسار أو ملاحظة؟ اكتب لنا تذكرة وستصل رسالتك إلى إدارة المدرسة.' }), hero: () => ({ t: 'hero', title: 'عنوان كبير', text: '', src: '' }),
  chat: () => ({ t: 'chat', title: 'اسألنا عن المدرسة', text: 'مساعد ذكي يجيب عن أسئلتك حول المدرسة اعتماداً على محتوى هذا الموقع.', ai: true }),
  page: () => { const id = uid(); D.map[id] = { id, title: 'صفحة جديدة', blocks: [] }; return { t: 'page', ref: id }; }
};
const kindOk = (k, pid) => isAdmin() || (k === 'hero' || k === 'ticket' || k === 'chat' ? false : k === 'img' ? can('img', pid) : k === 'btn' ? can('file', pid) : true);

const addBar = (pid, i) => ED() && can('add') ? `<button class="addbar" data-a="addpick" data-pid="${pid}" data-i="${i}">+ إضافة هنا</button>` : '';
const blk = (b, pid, i) => {
  const at = `data-pid="${pid}" data-i="${i}"`, c = eb('up', at + ' title="للأعلى"', '▲') + eb('down', at + ' title="للأسفل"', '▼') + eb('delb', at, 'حذف', 'dn');
  return `<div class="blk t-${b.t}">${c ? `<div class="bc">${c}</div>` : ''}${B[b.t] ? B[b.t](b, `map.${pid}.blocks.${i}`, i) : ''}</div>${addBar(pid, i + 1)}`;
};
function pageView(pid) {
  CTX = pid;
  const p = D.map[pid], par = parentOf(pid), hero = p.blocks[0] && p.blocks[0].t === 'hero';
  const head = `<div class="blk ph">${par ? `<a class="back" href="#p-${par.id}">‹ ${e(par.title)}</a>` : ''}${T('h1', `map.${pid}.title`, '', 'عنوان الصفحة')}</div>`;
  const bl = p.blocks.map((b, i) => blk(b, pid, i));
  const out = hero ? [bl[0], head, ...bl.slice(1)] : [head, addBar(pid, 0), ...bl];
  if (!bl.length && !ED()) out.push('<p class="blk empty">هذه الصفحة فارغة حالياً.</p>');
  return out.join('');
}

/* ---------- رسائل التواصل: صندوق وارد داخل الموقع (مشفّر، يقرؤه المدير فقط) ---------- */
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inbox/{id} {
      allow create: if request.resource.data.keys().hasOnly(['ek','iv','ct','ts'])
                    && request.resource.data.ct.size() < 12000;
      allow read: if true;
    }
  }
}`;
const fsUrl = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(D.inbox.project)}/databases/(default)/documents/inbox`;
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
async function sealMsg(pubJwk, obj) { // تشفير مختلط: AES للرسالة وRSA للمفتاح
  const pub = await crypto.subtle.importKey('jwk', pubJwk, RSA, false, ['encrypt']);
  const ak = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ak, enc.encode(JSON.stringify(obj)));
  const ek = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, await crypto.subtle.exportKey('raw', ak));
  return { ek: toB(ek), iv: toB(iv), ct: toB(ct) };
}
async function openMsg(priv, v) {
  try {
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, fromB(v.ek));
    const ak = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB(v.iv) }, ak, fromB(v.ct))));
  } catch (x) { return null; }
}
let MSGS = [];
function messagesView() {
  if (!isAdmin()) return '<section class="wrap"><h1>هذه الصفحة للمدير فقط</h1></section>';
  if (!D.inbox || !D.inbox.pub) return '<section class="wrap"><h1>رسائل التواصل</h1><p class="empty">لم يُفعَّل صندوق الرسائل بعد. افتح «حساب المدير» واتبع خطوات «صندوق رسائل التواصل».</p><a class="btn" href="#admin">حساب المدير</a></section>';
  if (!localStorage.gh_inboxkey) return '<section class="wrap"><h1>رسائل التواصل</h1><p class="empty">مفتاح قراءة الرسائل غير موجود على هذا الجهاز. افتح «حساب المدير» واستورد المفتاح من النسخة الاحتياطية.</p><a class="btn" href="#admin">حساب المدير</a></section>';
  return '<section class="wrap"><h1>رسائل التواصل</h1><p><button class="eb" data-a="reloadmsgs">تحديث</button></p><div id="msgs"><p class="empty">جارٍ تحميل الرسائل...</p></div></section>';
}
async function loadMessages() {
  const box = $('#msgs'); if (!box) return;
  try {
    const priv = await crypto.subtle.importKey('jwk', JSON.parse(localStorage.gh_inboxkey), RSA, false, ['decrypt']);
    const docs = []; let tok = '';
    do {
      const r = await fetch(`${fsUrl()}?pageSize=300&key=${encodeURIComponent(D.inbox.key)}` + (tok ? `&pageToken=${encodeURIComponent(tok)}` : ''));
      if (!r.ok) throw 0;
      const j = await r.json(); docs.push(...(j.documents || [])); tok = j.nextPageToken || '';
    } while (tok && docs.length < 2000);
    const out = [];
    for (const d of docs) {
      const f = d.fields || {}, sv = k => f[k] && f[k].stringValue;
      if (!sv('ek') || !sv('iv') || !sv('ct')) continue;
      const m = await openMsg(priv, { ek: sv('ek'), iv: sv('iv'), ct: sv('ct') });
      if (m && typeof m.msg === 'string') out.push({ name: String(m.name || ''), msg: m.msg, ts: sv('ts') || d.createTime || '' });
    }
    out.sort((a, b) => b.ts.localeCompare(a.ts)); MSGS = out;
    box.innerHTML = out.length ? `<p class="hint">${out.length} رسالة، الأحدث أولاً. اضغط على الرسالة لقراءتها.</p><div class="msgs">${out.map((m, i) => `<button class="msgrow" data-a="openmsg" data-i="${i}"><b>${e(m.name)}</b><time>${e(fmtT(m.ts))}</time><span>${e(m.msg.slice(0, 70))}${m.msg.length > 70 ? '…' : ''}</span></button>`).join('')}</div>` : '<p class="empty">لا توجد رسائل بعد.</p>';
  } catch (x) { box.innerHTML = '<p class="empty">تعذّر تحميل الرسائل. تأكد من إعداد الصندوق في «حساب المدير» ومن صحة مفتاح القراءة.</p>'; }
}

/* ---------- صفحة live: صور حية ينشرها المدير ---------- */
const fmtT = s => { try { return new Date(s).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }); } catch (x) { return ''; } };
function liveView() {
  const list = D.live.map((x, i) => [x, i]).reverse(); // الأحدث أولاً
  const adm = isAdmin();
  const add = ED() && adm ? `<p>${eb('liveadd', '', '+ إضافة صورة حية', 'add')}</p>` : adm ? '<p class="hint">شغّل «تشغيل التحرير» لإضافة صور حية.</p>' : '';
  return `<section class="wrap live"><h1><span class="livedot"></span>live</h1><p class="hint">صور حية تُنشر مباشرة من المدير. تتحدث الصفحة تلقائياً.</p>${add}`
    + (list.length ? `<div class="grid">${list.map(([x, i]) => `<figure class="card"><img src="${im(x.src)}" alt="" data-zoom="${im(x.src)}"><div class="cb"><time>${e(fmtT(x.ts))}</time>${T('p', `live.${i}.text`, '', 'وصف الصورة')}${eb('livedel', `data-i="${i}"`, 'حذف', 'dn')}</div></figure>`).join('')}</div>` : '<p class="empty">لا توجد صور حية بعد.</p>')
    + '</section>';
}

/* ---------- حساب المدير وحساب المدرسين ---------- */
const initial = n => e((n || '؟').trim()[0] || '؟');
const avatar = (m, big) => m && m.photo ? `<img class="av ${big ? 'big' : ''}" src="${im(m.photo)}" alt="">` : `<div class="av ${big ? 'big' : ''}">${initial(m && m.name)}</div>`;
const myMember = () => me && D.members.find(x => x.id === me.id);
const profile = () => { const m = myMember() || me; return `<div class="prof">${avatar(m, 1)}<div><h1>${e(me.name)}</h1><p>${me.role === 'admin' ? 'المدير' : 'مدرس ' + e(me.subject)}</p>
  <button class="eb" data-a="myphoto">${m.photo ? 'تغيير الصورة' : 'إضافة صورة شخصية'}</button>${m.photo ? '<button class="eb dn" data-a="delphoto">إزالة الصورة</button>' : ''}</div></div>`; };
function adminView() {
  if (isAdmin()) {
    const codes = JSON.parse(localStorage.gh_codes || '{}');
    return `<section class="wrap adm">${profile()}
    <h2>رموز المدرسين</h2><p class="hint">أعطِ كل مدرس رمز مادته. عند إنشاء رمز جديد يبطل الرمز القديم لمن يسجّل الدخول بعده.</p>
    ${SUBJECTS.map(s => `<div class="row"><b class="grow">${e(s)}</b>${codes[s] ? `<code class="code">${e(codes[s])}</code><button class="eb" data-a="copycode" data-s="${e(s)}">نسخ</button>` : `<span class="empty">${D.codes[s] ? 'يوجد رمز (غير ظاهر على هذا الجهاز)' : 'لا يوجد رمز'}</span>`}<button class="eb" data-a="mkcode" data-s="${e(s)}">${D.codes[s] ? 'تجديد الرمز' : 'إنشاء رمز'}</button></div>`).join('')}
    <h2>صندوق رسائل التواصل</h2>
    <details><summary>طريقة الإعداد (مرة واحدة، مجاناً)</summary><ol class="hint">
      <li>افتح console.firebase.google.com وأنشئ مشروعاً جديداً (يمكنك إيقاف Analytics).</li>
      <li>من القائمة: Build ثم Firestore Database ثم Create database (اختر أي موقع، ووضع Production).</li>
      <li>افتح تبويب Rules والصق القواعد التالية مكان القديمة ثم Publish:<pre class="rules">${e(RULES)}</pre></li>
      <li>من إعدادات المشروع (⚙️) ثم General ثم «Your apps» أضف تطبيق ويب (&lt;/&gt;) وانسخ قيمتي projectId وapiKey.</li>
      <li>الصقهما أدناه، اضغط «حفظ إعداد الصندوق» ثم «حفظ ونشر».</li></ol></details>
    <label>Project ID<input id="fp" dir="ltr" value="${e((D.inbox || {}).project || '')}"></label>
    <label>API Key<input id="fk" dir="ltr" value="${e((D.inbox || {}).key || '')}"></label>
    <p class="hint">الحالة: ${D.inbox && D.inbox.pub ? 'الصندوق مُعدّ' : 'الصندوق غير مُعدّ'}، ${localStorage.gh_inboxkey ? 'مفتاح القراءة موجود على هذا الجهاز' : 'مفتاح القراءة غير موجود على هذا الجهاز'}.</p>
    <button class="eb" data-a="inboxcfg">حفظ إعداد الصندوق</button>
    ${localStorage.gh_inboxkey ? '<button class="eb" data-a="inboxbackup">نسخ نسخة احتياطية من مفتاح القراءة</button>' : ''}
    <details><summary>استيراد مفتاح القراءة (للدخول من جهاز آخر)</summary>
      <label>الصق المفتاح المنسوخ<textarea id="ik" dir="ltr" rows="3"></textarea></label><button class="eb" data-a="inboximport">استيراد</button></details>
    <h2>المدرسون والصلاحيات</h2>${membersAdmin()}
    <p><button class="btn" data-a="save">حفظ ونشر</button> <button class="btn ghost" data-a="logout">تسجيل الخروج</button></p></section>`;
  }
  if (me) return `<section class="wrap"><h1>هذه الصفحة للمدير فقط</h1><a class="btn" href="#teachers">حساب المدرسين</a></section>`;
  return `<section class="wrap adm"><h1>دخول المدير</h1>
    <p>اكتب اسمك ورمز الوصول (Token) الذي أنشأته من حساب GitHub. يُحفظ على هذا الجهاز فقط.</p>
    <label>الاسم<input id="an" autocomplete="off"></label>
    <label>رمز الوصول<input id="tk" type="password" autocomplete="off"></label>
    <details><summary>إعدادات متقدمة</summary>
      <label>اسم حساب GitHub<input id="ow" value="${e(cfg.owner)}"></label>
      <label>اسم المستودع (Repository)<input id="rp" value="${e(cfg.repo)}"></label>
      <label>الفرع (Branch)<input id="br" value="${e(cfg.branch)}"></label></details>
    <button class="btn" data-a="login">دخول</button></section>`;
}
function membersAdmin() {
  const sc = scopes(), list = D.members.map((m, i) => [m, i]).filter(([m]) => m.role === 'teacher');
  if (!list.length) return '<p class="empty">لم يسجّل أي مدرس بعد.</p>';
  return list.map(([m, i]) => {
    m.perms = m.perms || {}; sc.forEach(([id]) => { m.perms[id] = m.perms[id] || {}; });
    return `<div class="sub"><div class="row">${avatar(m)}<b class="grow">${e(m.name)} <small>(${e(m.subject)})</small></b><button class="eb dn" data-a="delmember" data-i="${i}">حذف العضو</button></div>
      <div class="tbl"><table><tr><th></th>${ACTS.map(([, l]) => `<th>${l}</th>`).join('')}</tr>
      ${sc.map(([id, l]) => `<tr><td>${e(l)}</td>${ACTS.map(([k]) => `<td><input type="checkbox" data-c="members.${i}.perms.${id}.${k}" ${m.perms[id][k] ? 'checked' : ''} aria-label="${e(l)}"></td>`).join('')}</tr>`).join('')}</table></div></div>`;
  }).join('');
}
function teachersView() {
  if (!me) return `<section class="wrap adm"><h1>حساب المدرسين</h1>
    <p>اكتب اسمك واختر مادتك وأدخل الرمز الذي أعطاك إياه المدير.</p>
    <label>الاسم<input id="tn" autocomplete="off"></label>
    <label>المادة<select id="ts">${SUBJECTS.map(s => `<option>${e(s)}</option>`).join('')}</select></label>
    <label>الرمز<input id="tc" autocomplete="off" placeholder="XXXX-XXXX-XXXX" dir="ltr"></label>
    <button class="btn" data-a="tlogin">دخول</button></section>`;
  const mine = me.role === 'teacher' ? D.members.find(x => x.id === me.id) : null;
  const perm = mine ? scopes().map(([id, l]) => { const g = ACTS.filter(([k]) => mine.perms && mine.perms[id] && mine.perms[id][k]).map(x => x[1]); return `<li><b>${e(l)}:</b> ${g.length ? g.join('، ') : 'لا توجد صلاحيات بعد'}</li>`; }).join('') : '';
  const ordered = [...D.members.filter(m => m.role === 'admin'), ...D.members.filter(m => m.role !== 'admin')];
  return `<section class="wrap">${profile()}${mine ? `<h2>صلاحياتك</h2><ul class="perm">${perm}</ul><p class="hint">تعديلاتك تقتصر على صفحة مادتك داخل المراحل المسموحة لك.</p>` : ''}
    <h2>أعضاء الموقع</h2><div class="mem">${ordered.map(m => `<div class="mc2">${avatar(m)}<div><b>${e(m.name)}</b><span>${m.role === 'admin' ? 'المدير' : 'مدرس ' + e(m.subject)}</span></div></div>`).join('')}</div>
    <p><button class="btn ghost" data-a="logout">تسجيل الخروج</button></p></section>`;
}

/* ---------- GitHub API ---------- */
async function gh(path, opt = {}) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}` + (opt.method ? '' : `?ref=${cfg.branch}`);
  return fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
}
async function put(path, content, msg) {
  let sha; const g = await gh(path);
  if (g.ok) sha = (await g.json()).sha;
  const r = await gh(path, { method: 'PUT', body: JSON.stringify({ message: msg, content, branch: cfg.branch, sha }) });
  if (!r.ok) throw new Error(r.status);
}
function merge(base, mine, remote) { // يدمج تعديلاتي فوق آخر نسخة محفوظة حتى لا تُمحى تعديلات الآخرين
  const out = clone(remote), J = JSON.stringify;
  KEYS.forEach(k => { if (J(mine[k]) !== J(base[k])) out[k] = mine[k]; });
  const pm = (a, b, o) => new Set([...Object.keys(a), ...Object.keys(b)]).forEach(id => { if (J(b[id]) !== J(a[id])) { if (b[id] === undefined) delete o[id]; else o[id] = b[id]; } });
  pm(base.map, mine.map, out.map);
  const idx = l => Object.fromEntries((l || []).map(m => [m.id, m])), om = idx(out.members);
  pm(idx(base.members), idx(mine.members), om); out.members = Object.values(om);
  return out;
}
async function saveData(quiet) {
  if (!guardOk()) { toast('بعض تعديلاتك خارج صلاحياتك ولم تُحفظ.'); return false; }
  try {
    const g = await gh('data.json'); if (!g.ok) throw 0;
    const j = await g.json(); let remote = null;
    try { remote = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))))); } catch (x) { }
    const out = ensure(remote && remote.map ? merge(ORIG, D, remote) : clone(D));
    const r = await gh('data.json', { method: 'PUT', body: JSON.stringify({ message: 'تحديث محتوى الموقع', content: b64(JSON.stringify(out, null, 2)), branch: cfg.branch, sha: j.sha }) });
    if (!r.ok) throw 0;
    D = out; ORIG = clone(out); dirty = false;
    if (!quiet) { toast('تم الحفظ. ستظهر التغييرات للزوار خلال دقيقة تقريباً.'); render(1); }
    return true;
  } catch (x) { toast('فشل الحفظ. تحقق من الاتصال أو من صلاحيات الرمز.'); return false; }
}
function pickImage(cb, sq) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => {
    if (!i.files[0]) return; toast('جارٍ رفع الصورة...');
    try {
      const b = await createImageBitmap(i.files[0]), side = Math.min(b.width, b.height);
      const s = sq ? Math.min(1, 400 / side) : Math.min(1, 1400 / Math.max(b.width, b.height));
      const c = document.createElement('canvas'); c.width = Math.round((sq ? side : b.width) * s); c.height = Math.round((sq ? side : b.height) * s);
      if (sq) c.getContext('2d').drawImage(b, (b.width - side) / 2, (b.height - side) / 2, side, side, 0, 0, c.width, c.height);
      else c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', .85), path = 'images/' + Date.now() + '.jpg';
      await put(path, url.split(',')[1], 'رفع صورة'); pv[path] = url; dirty = true; cb(path);
      toast('تم رفع الصورة. اضغط «حفظ ونشر» لتثبيت التغييرات.');
    } catch (x) { toast('تعذّر رفع الصورة. تأكد من الرمز وصلاحياته.'); }
  };
  i.click();
}
function pickFile(cb) {
  const i = document.createElement('input'); i.type = 'file';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    if (f.size > 20e6) return toast('الملف كبير. الحد الأقصى 20 ميغابايت.');
    toast('جارٍ رفع الملف...');
    const r = new FileReader();
    r.onload = async () => {
      try {
        const ext = (f.name.match(/\.(\w{1,5})$/) || ['', 'dat'])[1], path = 'files/' + Date.now() + '.' + ext;
        await put(path, r.result.split(',')[1], 'رفع ملف'); dirty = true; cb(path);
        toast('تم رفع الملف. اضغط «حفظ ونشر» لتثبيت التغييرات.');
      } catch (x) { toast('تعذّر رفع الملف. تأكد من الرمز وصلاحياته.'); }
    };
    r.readAsDataURL(f);
  };
  i.click();
}
const persist = () => { localStorage.gh_token = token; localStorage.gh_cfg = JSON.stringify(cfg); localStorage.gh_me = JSON.stringify(me); };

/* ---------- صورة المدرسة في أعلى الموقع ---------- */
function schoolImgHtml() {
  const si = D.schoolImg, adm = ED() && isAdmin();
  if (!si.src && !adm) return '';
  const pos = ['right', 'center', 'left'].includes(si.pos) ? si.pos : 'center';
  const ctl = adm ? `<div class="ec">${eb('schoolimg', '', si.src ? 'تغيير صورة المدرسة' : 'إضافة صورة المدرسة')}${si.src ? eb('schoolclr', '', 'إزالة', 'dn') : ''}${si.src ? [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']].map(([kk, l]) => eb('schoolpos', `data-k="${kk}"`, l, pos === kk ? 'add' : '')).join('') : ''}</div>` : '';
  return `<div class="si si-${pos}">${si.src ? `<img src="${im(si.src)}" alt="${e(D.school.name)}">` : ''}${ctl}</div>`;
}

/* ---------- العرض ---------- */
function render(keep) {
  const y = scrollY, h = (location.hash || '').slice(1), special = h === 'admin' || h === 'teachers' || h === 'messages' || h === 'live';
  const cur = h.startsWith('p-') && D.map[h.slice(2)] ? h.slice(2) : D.menu[0];
  $('#app').innerHTML = h === 'admin' ? adminView() : h === 'teachers' ? teachersView() : h === 'messages' ? messagesView() : h === 'live' ? liveView() : cur ? pageView(cur) : `<section class="wrap"><p class="empty">لا توجد صفحات بعد.</p>${eb('addmenu', '', '+ إضافة صفحة', 'add')}</section>`;
  if (h === 'messages' && isAdmin()) loadMessages();
  const br = $('#brand'), adm = ED() && isAdmin();
  br.innerHTML = adm ? `${T('span', 'school.name', '', 'اسم المدرسة')}<small>${T('span', 'school.subtitle', '', 'عنوان فرعي')}</small>` : `${e(D.school.name)}<small>${e(D.school.subtitle)}</small>`;
  adm ? br.removeAttribute('href') : br.setAttribute('href', '#p-' + D.menu[0]);
  document.title = D.school.name;
  $('#ticker').innerHTML = adm ? `<b>عاجل</b>${T('span', 'urgent', '', 'اكتب الخبر العاجل هنا (اتركه فارغاً لإخفائه)')}` : D.urgent ? `<b>عاجل</b><span>${e(D.urgent)}</span>` : '';
  $('#drawer').innerHTML = D.menu.map((id, k) => `<div class="mi"><a href="#p-${id}" class="${!special && id === cur ? 'on' : ''}">${e(D.map[id].title)}</a>${adm ? `<span class="mc"><button data-a="mup" data-i="${k}" aria-label="أعلى">▲</button><button data-a="mdown" data-i="${k}" aria-label="أسفل">▼</button><button class="dn" data-a="mdel" data-i="${k}" aria-label="حذف">✕</button></span>` : ''}</div>`).join('')
    + `<a href="#live" class="${h === 'live' ? 'on' : ''}"><span class="livedot"></span>live</a>`
    + (adm ? `<a href="#" data-a="addmenu">+ إضافة صفحة جديدة</a>` : '')
    + `<hr><a href="#admin" class="${h === 'admin' ? 'on' : ''}">حساب المدير</a><a href="#teachers" class="sublink ${h === 'teachers' ? 'on' : ''}">حساب المدرسين</a>${isAdmin() ? `<a href="#messages" class="sublink sub2 ${h === 'messages' ? 'on' : ''}">رسائل التواصل</a>` : ''}`;
  let si = $('#schoolimg'); if (!si) { si = document.createElement('div'); si.id = 'schoolimg'; $('#ticker').after(si); }
  si.innerHTML = schoolImgHtml();
  $('#foot').innerHTML = e(D.school.name);
  let m = $('#me'); if (!m) { m = document.createElement('a'); m.id = 'me'; $('header').append(m); }
  m.href = me && me.role === 'admin' ? '#admin' : '#teachers';
  m.innerHTML = me ? `${avatar(myMember() || me)}<span class="nm">${e(me.name)}</span>` : '';
  m.hidden = !me;
  let t = $('#tools'); if (!t) { t = document.createElement('div'); t.id = 'tools'; document.body.append(t); }
  t.innerHTML = token && me ? `<button data-a="toggle">${editing ? 'إيقاف التحرير' : 'تشغيل التحرير'}</button>${editing ? '<button class="sv" data-a="save">حفظ ونشر</button>' : ''}` : '';
  menu(false); scrollTo(0, keep ? y : 0);
}
function menu(o) { $('#drawer').classList.toggle('open', o); $('#overlay').classList.toggle('open', o); $('#burger').classList.toggle('open', o); $('#burger').setAttribute('aria-expanded', o); }
function modal(html) { $('#mbody').innerHTML = html; $('#modal').hidden = false; }

/* ---------- الأحداث ---------- */
$('#burger').onclick = () => menu(!$('#drawer').classList.contains('open'));
$('#overlay').onclick = () => menu(false);
const closeModal = () => { $('#modal').hidden = true; };
$('#modal').onclick = ev => { if (ev.target.id === 'modal' || ev.target.classList.contains('x')) closeModal(); };
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { closeModal(); menu(false); }
  if (ev.key === 'Enter' && ev.target.id === 'chatq') { ev.preventDefault(); const b = $('[data-a="chatsend"]'); if (b) b.click(); }
  if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.e && ev.target.tagName !== 'P') ev.preventDefault(); // سطر واحد للعناوين
});
addEventListener('hashchange', () => render());
addEventListener('beforeunload', ev => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.b && canPath('file', t.dataset.b)) { set(t.dataset.b, t.value); dirty = true; }
  else if (t.dataset.e && canPath('text', t.dataset.e)) { set(t.dataset.e, t.innerText.replace(/\n$/, '')); dirty = true; }
  else if (t.dataset.c && isAdmin()) { set(t.dataset.c, t.checked); dirty = true; }
});
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-a],[data-zoom]'); if (!el) return;
  const { a, p, i, pid, k, s, zoom } = el.dataset;
  if (zoom) return modal(`<img src="${zoom}" alt="">`);
  ev.preventDefault();
  const need = ACT[a];
  if (need && !(need === 'admin' ? isAdmin() : can(need, pid || CTX))) return toast('ليست لديك صلاحية لهذا الإجراء.');
  const ch = f => () => { dirty = true; f(); render(1); };            // تعديل ثم إعادة رسم
  const mch = f => () => { dirty = true; f(); render(1); menu(true); }; // تعديل القائمة وإبقاؤها مفتوحة
  const bl = () => D.map[pid].blocks, n = +i;
  const swap = (arr, x, y) => { if (y >= 0 && y < arr.length) [arr[x], arr[y]] = [arr[y], arr[x]]; };
  const A = {
    login: async () => {
      const nm = $('#an').value.trim(); if (!nm) return toast('اكتب اسمك أولاً.');
      token = $('#tk').value.trim(); cfg = { owner: $('#ow').value.trim(), repo: $('#rp').value.trim(), branch: $('#br').value.trim() || 'main' };
      const r = await gh('data.json');
      if (!r.ok) { token = ''; return toast('بيانات الدخول غير صحيحة'); }
      let m = D.members.find(x => x.role === 'admin');
      if (!m) { m = { id: uid(), name: nm, role: 'admin' }; D.members.unshift(m); } else m.name = nm;
      me = { id: m.id, name: nm, role: 'admin' }; persist(); editing = true; dirty = true;
      await saveData(true); toast('أهلاً ' + nm + '. أنت الآن في وضع التحرير.');
      location.hash = '#p-' + D.menu[0]; render();
    },
    tlogin: async () => {
      const nm = $('#tn').value.trim(), sub = $('#ts').value, code = $('#tc').value.trim();
      if (!nm || !code) return toast('اكتب الاسم والرمز.');
      const v = D.codes[sub]; if (!v) return toast('لم ينشئ المدير رمزاً لهذه المادة بعد.');
      toast('جارٍ التحقق...');
      const tk = await unseal(code, v); if (!tk) return toast('الرمز غير صحيح لهذه المادة.');
      token = tk;
      let m = D.members.find(x => x.role === 'teacher' && x.name === nm && x.subject === sub);
      if (!m) { m = { id: uid(), name: nm, role: 'teacher', subject: sub, perms: {}, joined: TODAY }; D.members.push(m); dirty = true; }
      me = { id: m.id, name: nm, role: 'teacher', subject: sub }; persist(); editing = true;
      if (dirty) await saveData(true);
      toast('أهلاً ' + nm); location.hash = '#teachers'; render();
    },
    logout: () => { token = ''; me = null; editing = false; ['gh_token', 'gh_me'].forEach(x => localStorage.removeItem(x)); render(); },
    toggle: () => { editing = !editing; render(1); },
    chatq: () => { $('#chatq').value = k; A.chatsend(); },
    chatclear: () => { CHAT.length = 0; render(1); },
    chatsend: async () => {
      const inp = $('#chatq'), q = inp ? inp.value.trim().slice(0, 300) : ''; if (!q || chatBusy) return;
      chatBusy = true; inp.value = ''; CHAT.push({ r: 'u', t: q }); const typing = { r: 'b', typing: true }; CHAT.push(typing); chatDraw();
      try {
        let ans = null, ai = inp.dataset.ai === '1' ? await aiAnswer(q) : null;
        if (ai) ans = { t: ai };
        else ans = localAnswer(q) || { t: 'لم أجد إجابة عن سؤالك في محتوى الموقع، والإجابة عن الأسئلة العامة تحتاج الاتصال بالذكاء الاصطناعي وهو غير متاح الآن. أعد المحاولة بعد قليل، أو راسل الإدارة من صفحة «تواصل معنا».' };
        CHAT[CHAT.indexOf(typing)] = { r: 'b', t: ans.t, links: ans.links || [] };
      } catch (x) { CHAT[CHAT.indexOf(typing)] = { r: 'b', t: 'حدث خطأ. حاول مرة أخرى.', err: 1 }; }
      chatBusy = false; chatDraw(); const i2 = $('#chatq'); if (i2) i2.focus();
    },
    mkcode: async () => {
      const code = genCode(); toast('جارٍ إنشاء الرمز...');
      D.codes[s] = await seal(code, token); dirty = true;
      const c = JSON.parse(localStorage.gh_codes || '{}'); c[s] = code; localStorage.gh_codes = JSON.stringify(c);
      render(1); toast('تم إنشاء الرمز. اضغط «حفظ ونشر» ليعمل مع المدرسين.');
    },
    copycode: () => { const c = JSON.parse(localStorage.gh_codes || '{}')[s]; navigator.clipboard && navigator.clipboard.writeText(c); toast('تم نسخ الرمز.'); },
    myphoto: () => pickImage(path => { const m = myMember(); if (m) { m.photo = path; dirty = true; } render(1); }, true),
    delphoto: () => { const m = myMember(); if (m) { delete m.photo; dirty = true; render(1); } },
    ticket: () => modal(`<h2>تذكرة جديدة</h2><label class="fl">الاسم<input id="tname" maxlength="60" autocomplete="name"></label><label class="fl">الرسالة<textarea id="tmsg" rows="5" maxlength="1500"></textarea></label><input id="thp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn" data-a="sendticket">إرسال</button>`),
    sendticket: async () => {
      if (window.__sending) return; // منع الإرسال المزدوج
      const nm = $('#tname').value.trim(), msg = $('#tmsg').value.trim();
      if (!nm || !msg) return toast('اكتب الاسم والرسالة.');
      if ($('#thp').value) return closeModal(); // فخ للروبوتات
      if (!D.inbox || !D.inbox.pub || !D.inbox.project) return toast('خدمة الرسائل غير مفعّلة بعد.');
      if (Date.now() - (+localStorage.gh_last || 0) < 60000) return toast('انتظر دقيقة قبل إرسال رسالة أخرى.');
      window.__sending = true; const prevLast = localStorage.gh_last; localStorage.gh_last = Date.now(); el.disabled = true;
      try {
        const sl = await sealMsg(D.inbox.pub, { name: nm, msg }), sv = stringValue => ({ stringValue });
        const r = await fetch(`${fsUrl()}?key=${encodeURIComponent(D.inbox.key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { ek: sv(sl.ek), iv: sv(sl.iv), ct: sv(sl.ct), ts: sv(new Date().toISOString()) } }) });
        if (!r.ok) throw 0;
        closeModal(); toast('تم إرسال رسالتك. شكراً لتواصلك معنا.');
      } catch (x) { if (prevLast) localStorage.gh_last = prevLast; else localStorage.removeItem('gh_last'); el.disabled = false; toast('تعذّر الإرسال. حاول لاحقاً.'); }
      finally { window.__sending = false; }
    },
    inboxcfg: async () => {
      const project = $('#fp').value.trim(), key = $('#fk').value.trim();
      if (!/^[a-z0-9-]{4,}$/i.test(project) || key.length < 20) return toast('تحقق من Project ID وAPI Key.');
      const old = D.inbox || {};
      let pub = old.pub;
      if (!pub) {
        const kp = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
        pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
        localStorage.gh_inboxkey = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey));
      }
      D.inbox = { project, key, pub }; dirty = true; render(1);
      toast('تم حفظ الإعداد. اضغط «حفظ ونشر» ثم انسخ نسخة احتياطية من مفتاح القراءة.');
    },
    inboxbackup: () => { navigator.clipboard && navigator.clipboard.writeText(localStorage.gh_inboxkey || ''); toast('تم نسخ المفتاح. احفظه في مكان آمن ولا تشاركه مع أحد.'); },
    inboximport: async () => {
      try {
        const j = JSON.parse($('#ik').value.trim());
        await crypto.subtle.importKey('jwk', j, RSA, false, ['decrypt']);
        localStorage.gh_inboxkey = JSON.stringify(j); render(1); toast('تم استيراد مفتاح القراءة.');
      } catch (x) { toast('المفتاح غير صالح.'); }
    },
    openmsg: () => { const m = MSGS[n]; if (m) modal(`<h2>${e(m.name)}</h2><time class="hint">${e(fmtT(m.ts))}</time><p>${nl(m.msg)}</p>`); },
    schoolimg: () => pickImage(path => { D.schoolImg.src = path; render(1); }),
    schoolclr: ch(() => { D.schoolImg.src = ''; }),
    schoolpos: ch(() => { D.schoolImg.pos = k; }),
    reloadmsgs: () => loadMessages(),
    liveadd: () => pickImage(async path => {
      D.live.push({ id: uid(), src: path, text: '', ts: new Date().toISOString() }); dirty = true; render(1);
      if (await saveData(true)) { render(1); toast('تم نشر الصورة الحية. ستظهر للزوار خلال دقيقة تقريباً.'); }
    }),
    livedel: () => { if (confirm('حذف هذه الصورة الحية؟')) ch(() => D.live.splice(n, 1))(); },
    delmember: () => { if (confirm('حذف هذا العضو؟')) ch(() => D.members.splice(n, 1))(); },
    addpick: () => modal(`<h2>ماذا تريد أن تضيف؟</h2><div class="pk">${KINDS.filter(([kk]) => kindOk(kk, pid)).map(([kk, l]) => `<button class="eb" data-a="add" data-k="${kk}" data-pid="${pid}" data-i="${n}">${l}</button>`).join('')}</div>`),
    add: () => { if (!kindOk(k, pid)) return toast('ليست لديك صلاحية لهذا النوع.'); closeModal(); dirty = true; const b = DEF[k](); bl().splice(n, 0, b); render(1); if (k === 'img') pickImage(path => { b.src = path; render(1); }); },
    up: ch(() => swap(bl(), n, n - 1)),
    down: ch(() => swap(bl(), n, n + 1)),
    delb: () => {
      const b = bl()[n];
      if (confirm(b.t === 'page' ? 'حذف هذه الصفحة وكل ما بداخلها؟' : 'هل أنت متأكد من الحذف؟')) ch(() => { if (b.t === 'page') removePage(b.ref); bl().splice(n, 1); })();
    },
    img: () => pickImage(path => { set(p, path); render(1); }),
    clr: ch(() => set(p, '')),
    upfile: () => pickFile(path => { set(p, path); render(1); }),
    addmenu: () => { const id = uid(); dirty = true; D.map[id] = { id, title: 'صفحة جديدة', blocks: [] }; D.menu.push(id); location.hash = '#p-' + id; },
    mup: mch(() => swap(D.menu, n, n - 1)),
    mdown: mch(() => swap(D.menu, n, n + 1)),
    mdel: () => { if (confirm('حذف هذه الصفحة وكل ما بداخلها؟')) mch(() => { removePage(D.menu[n]); D.menu.splice(n, 1); })(); },
    save: () => { toast('جارٍ الحفظ...'); return saveData(false); }
  };
  A[a] && A[a]();
});

setInterval(async () => { // تحديث تلقائي لصفحة live عند نشر صور جديدة
  if (!D || location.hash !== '#live' || dirty || document.hidden) return;
  try {
    const r = await fetch('data.json?' + Date.now()); if (!r.ok) return;
    const nl = (await r.json()).live || [];
    if (JSON.stringify(nl) !== JSON.stringify(D.live)) { D.live = nl; ORIG.live = clone(nl); render(1); }
  } catch (x) { }
}, 30000);

fetch('data.json?' + Date.now()).then(r => r.json()).then(d => {
  const old = !d.map; D = ensure(migrate(d)); ORIG = clone(D);
  if (old && token) dirty = true; // البيانات القديمة حُوّلت: يلزم «حفظ ونشر» لتثبيتها
  render();
}).catch(() => { $('#app').innerHTML = '<p class="wrap">تعذّر تحميل البيانات. افتح الموقع عبر GitHub Pages وليس كملف مباشر.</p>'; });


/* ---------- الحركة: التقدم أثناء التمرير والظهور التدريجي ---------- */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pg = document.createElement('div'); pg.id = 'prog'; pg.setAttribute('aria-hidden', 'true'); document.body.appendChild(pg);
  let tick = false;
  const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; pg.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; tick = false; };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('rv-on');
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .08 });
  const scan = () => {
    if (ED()) { document.querySelectorAll('#app .rv:not(.in)').forEach(n => n.classList.add('in')); return; } // لا حركة أثناء التحرير
    document.querySelectorAll('#app .blk:not(.t-hero):not(.ph), #app .msgrow, #app .mc2').forEach((n, i) => { if (!n.dataset.rv) { n.dataset.rv = 1; n.classList.add('rv'); n.style.transitionDelay = Math.min(i % 6, 5) * 50 + 'ms'; io.observe(n); } });
  };
  new MutationObserver(scan).observe($('#app'), { childList: true }); scan();
})();

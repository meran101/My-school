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
const ACT = { img: 'img', clr: 'img', upfile: 'file', add: 'add', addpick: 'add', up: 'add', down: 'add', delb: 'del', del: 'del', addmenu: 'admin', mup: 'admin', mdown: 'admin', mdel: 'admin', mkcode: 'admin', delmember: 'admin', msgcfg: 'admin', reloadmsgs: 'admin', liveadd: 'admin', livedel: 'admin' };

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
const KEYS = ['school', 'urgent', 'menu', 'codes', 'stageRoot', 'newsPage', 'contactForm', 'ticketSeeded', 'live'];
function ensure(d) {
  d.members = d.members || []; d.codes = d.codes || {}; d.live = d.live || [];
  const mp = d.map;
  if (!d.stageRoot) d.stageRoot = d.menu.find(id => mp[id].title === 'المرحلة') || d.menu[0];
  if (!d.newsPage) d.newsPage = d.menu.find(id => mp[id].title === 'الأخبار') || '';
  ((mp[d.stageRoot] || {}).blocks || []).filter(b => b.t === 'page').forEach(b => ((mp[b.ref] || {}).blocks || []).filter(x => x.t === 'page' && mp[x.ref]).forEach(x => { mp[x.ref].subject = mp[x.ref].subject || mp[x.ref].title; }));
  if (!d.ticketSeeded) {
    const c = d.menu.find(id => mp[id].title === 'تواصل معنا');
    if (c) mp[c].blocks.push(DEF.ticket());
    d.ticketSeeded = true;
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
  hr: () => '<hr>'
};
const KINDS = [['h', 'عنوان'], ['p', 'نص'], ['img', 'صورة'], ['card', 'خبر أو بطاقة'], ['btn', 'زر رابط أو ملف'], ['page', 'صفحة داخلية جديدة'], ['hr', 'فاصل'], ['hero', 'غلاف كبير'], ['ticket', 'لوحة تذكرة التواصل']];
const DEF = {
  h: () => ({ t: 'h', text: '' }), p: () => ({ t: 'p', text: '' }), img: () => ({ t: 'img', src: '', text: '' }),
  card: () => ({ t: 'card', title: '', text: '', date: TODAY, src: '' }), btn: () => ({ t: 'btn', text: 'زر جديد', url: '' }),
  hr: () => ({ t: 'hr' }), ticket: () => ({ t: 'ticket', title: 'راسلنا', text: 'لديك استفسار أو ملاحظة؟ اكتب لنا تذكرة وستصل رسالتك إلى إدارة المدرسة.' }), hero: () => ({ t: 'hero', title: 'عنوان كبير', text: '', src: '' }),
  page: () => { const id = uid(); D.map[id] = { id, title: 'صفحة جديدة', blocks: [] }; return { t: 'page', ref: id }; }
};
const kindOk = (k, pid) => isAdmin() || (k === 'hero' || k === 'ticket' ? false : k === 'img' ? can('img', pid) : k === 'btn' ? can('file', pid) : true);

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

/* ---------- رسائل التواصل (عبر نموذج Google) ---------- */
function parseFormLink(u) {
  try {
    const id = (u.match(/\/forms\/d\/e\/([\w-]+)/) || [])[1];
    const ents = [...u.matchAll(/entry\.(\d+)=([^&]*)/g)].map(m => ({ k: 'entry.' + m[1], v: decodeURIComponent(m[2].replace(/\+/g, ' ')) }));
    if (!id || ents.length < 2) return null;
    const nm = ents.find(x => /اسم|name/i.test(x.v)) || ents[0];
    const ms = ents.find(x => x !== nm && /رسال|msg|message/i.test(x.v)) || ents.find(x => x !== nm);
    return { id, name: nm.k, msg: ms.k };
  } catch (x) { return null; }
}
function parseCSV(t) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
function messagesView() {
  if (!isAdmin()) return '<section class="wrap"><h1>هذه الصفحة للمدير فقط</h1></section>';
  if (!localStorage.gh_msgcsv) return '<section class="wrap"><h1>رسائل التواصل</h1><p class="empty">لم تُضبط الرسائل بعد. افتح «حساب المدير» وأدخل رابط جدول الإجابات.</p><a class="btn" href="#admin">حساب المدير</a></section>';
  return '<section class="wrap"><h1>رسائل التواصل</h1><p><button class="eb" data-a="reloadmsgs">تحديث</button></p><div id="msgs"><p class="empty">جارٍ تحميل الرسائل...</p></div></section>';
}
async function loadMessages() {
  const box = $('#msgs'); if (!box) return;
  try {
    const u = localStorage.gh_msgcsv, r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) throw 0;
    const rows = parseCSV(await r.text()).slice(1).filter(x => x[1] || x[2]).reverse();
    box.innerHTML = rows.length ? `<p class="hint">${rows.length} رسالة، الأحدث أولاً.</p>` + rows.map(x => `<article class="card msg"><div class="cb"><time>${e(x[0])}</time><h3>${e(x[1])}</h3><p>${nl(x[2])}</p></div></article>`).join('') : '<p class="empty">لا توجد رسائل بعد.</p>';
  } catch (x) { box.innerHTML = '<p class="empty">تعذّر تحميل الرسائل. تأكد أن الجدول منشور على الويب بصيغة CSV.</p>'; }
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
    <h2>إعداد رسائل التواصل</h2>
    <details><summary>طريقة الإعداد (مرة واحدة)</summary><ol class="hint">
      <li>افتح forms.google.com وأنشئ نموذجاً بسؤالين بهذا الترتيب: «الاسم» (إجابة قصيرة) ثم «الرسالة» (فقرة).</li>
      <li>من تبويب «الردود» اربط النموذج بجدول Google Sheets.</li>
      <li>في النموذج: القائمة ⋮ ثم «الحصول على رابط معبأ مسبقاً»، واكتب كلمة «اسم» في السؤال الأول وكلمة «رسالة» في الثاني، ثم انسخ الرابط والصقه أدناه.</li>
      <li>في الجدول: ملف ثم مشاركة ثم «النشر على الويب»، اختر ورقة الردود وصيغة CSV، ثم انسخ الرابط والصقه أدناه.</li></ol></details>
    <label>رابط النموذج المعبأ مسبقاً<input id="gf" dir="ltr" placeholder="https://docs.google.com/forms/d/e/..."></label>
    <label>رابط جدول الإجابات (CSV)<input id="gc" dir="ltr" value="${e(localStorage.gh_msgcsv || '')}"></label>
    <p class="hint">الحالة: ${D.contactForm ? 'النموذج مفعّل' : 'النموذج غير مفعّل'}، ${localStorage.gh_msgcsv ? 'رابط الرسائل محفوظ على هذا الجهاز' : 'رابط الرسائل غير محفوظ'}.</p>
    <button class="eb" data-a="msgcfg">حفظ الإعداد</button>
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
      const nm = $('#tname').value.trim(), msg = $('#tmsg').value.trim();
      if (!nm || !msg) return toast('اكتب الاسم والرسالة.');
      if ($('#thp').value) return closeModal(); // فخ للروبوتات
      const f = D.contactForm; if (!f) return toast('خدمة الرسائل غير مفعّلة بعد.');
      if (Date.now() - (+localStorage.gh_last || 0) < 60000) return toast('انتظر دقيقة قبل إرسال رسالة أخرى.');
      try {
        await fetch(`https://docs.google.com/forms/d/e/${f.id}/formResponse`, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ [f.name]: nm, [f.msg]: msg }) });
        localStorage.gh_last = Date.now(); closeModal(); toast('تم إرسال رسالتك. شكراً لتواصلك معنا.');
      } catch (x) { toast('تعذّر الإرسال. حاول لاحقاً.'); }
    },
    msgcfg: () => {
      const gf = $('#gf').value.trim(), gc = $('#gc').value.trim();
      if (gf) { const c = parseFormLink(gf); if (!c) return toast('الرابط غير صحيح. استخدم رابط «الحصول على رابط معبأ مسبقاً».'); D.contactForm = c; dirty = true; }
      if (gc) { if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(gc)) return toast('رابط الجدول غير صحيح.'); localStorage.gh_msgcsv = gc; }
      render(1); toast('تم حفظ الإعداد. اضغط «حفظ ونشر» ليعمل النموذج للزوار.');
    },
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

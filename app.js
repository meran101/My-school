const $ = s => document.querySelector(s);
const TODAY = new Date().toISOString().slice(0, 10);
let D, token = localStorage.gh_token || '', editing = !!token, dirty = false, _n = 0;
let cfg = JSON.parse(localStorage.gh_cfg || 'null') || guess();
const pv = {}; // معاينة الصور المرفوعة قبل أن يعيد GitHub Pages بناء الموقع

function guess() {
  const h = location.hostname, gh = h.endsWith('.github.io');
  return { owner: gh ? h.split('.')[0] : '', repo: gh ? (location.pathname.split('/')[1] || h) : '', branch: 'main' };
}
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => e(s).replace(/\n/g, '<br>');
const im = s => e(pv[s] || s);
const safe = u => /^(https?:\/\/|tel:|mailto:|[\w\/.\-%]+$)/.test(u) ? e(u) : '#';
const uid = () => 'i' + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 4);
const gp = k => k.reduce((o, x) => o[x], D);
const get = p => gp(p.split('.'));
const set = (p, v) => { const k = p.split('.'), l = k.pop(); gp(k)[l] = v; };
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const ED = () => editing && !!token;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }

/* ---------- تحويل البيانات القديمة تلقائياً إلى نظام الصفحات والعناصر ---------- */
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
function removePage(id) { const p = D.map[id]; if (!p) return; p.blocks.forEach(b => b.t === 'page' && removePage(b.ref)); delete D.map[id]; }
const parentOf = id => Object.values(D.map).find(p => p.blocks.some(b => b.t === 'page' && b.ref === id));

/* ---------- عناصر قابلة للتعديل المباشر ---------- */
const T = (tag, p, cls = '', ph = '') => ED()
  ? `<${tag} class="ed ${cls}" contenteditable="plaintext-only" data-e="${p}" data-ph="${ph}">${e(get(p))}</${tag}>`
  : `<${tag} class="${cls}">${nl(get(p))}</${tag}>`;
const eb = (a, attrs, label, cls = '') => ED() ? `<button class="eb ${cls}" data-a="${a}" ${attrs}>${label}</button>` : '';
const imgCtl = p => ED() ? `<span class="ec">${eb('img', `data-p="${p}"`, get(p) ? 'تغيير الصورة' : 'إضافة صورة')}${get(p) ? eb('clr', `data-p="${p}"`, 'إزالة الصورة', 'dn') : ''}</span>` : '';

/* ---------- أنواع العناصر ---------- */
const B = {
  hero: (b, p) => `<section class="hero" style="${b.src ? `background-image:linear-gradient(rgba(20,54,92,.75),rgba(20,54,92,.75)),url('${im(b.src)}')` : ''}">${T('h1', p + '.title', '', 'العنوان الكبير')}${T('p', p + '.text', '', 'نص ترحيبي')}${imgCtl(p + '.src')}</section>`,
  h: (b, p) => T('h2', p + '.text', '', 'عنوان'),
  p: (b, p) => T('p', p + '.text', '', 'اكتب هنا'),
  img: (b, p) => `<figure>${b.src ? `<img src="${im(b.src)}" alt="${e(b.text)}" ${ED() ? '' : `data-zoom="${im(b.src)}"`}>` : ''}${imgCtl(p + '.src')}${T('figcaption', p + '.text', '', 'وصف الصورة')}</figure>`,
  card: (b, p) => `<article class="card">${b.src ? `<img src="${im(b.src)}" alt="">` : ''}<div class="cb">${imgCtl(p + '.src')}${T('time', p + '.date', '', 'التاريخ')}${T('h3', p + '.title', '', 'العنوان')}${T('p', p + '.text', '', 'النص')}</div></article>`,
  btn: (b, p) => ED()
    ? `<div class="btn">${T('span', p + '.text', '', 'نص الزر')}</div><div class="row"><input data-b="${p}.url" placeholder="الرابط (https://...)" value="${e(b.url)}">${eb('upfile', `data-p="${p}.url"`, 'رفع ملف')}</div>`
    : `<a class="btn" href="${safe(b.url)}" target="_blank" rel="noopener">${e(b.text)}</a>`,
  page: (b, p, i) => {
    const c = D.map[b.ref]; if (!c) return '';
    return ED() ? `<div class="bar c${i % 3}"><div>${T('b', `map.${b.ref}.title`, '', 'عنوان الصفحة')}<span>${c.blocks.length} عناصر</span></div><a class="eb" href="#p-${b.ref}">فتح وتعديل</a></div>`
      : `<a class="bar c${i % 3}" href="#p-${b.ref}"><b>${e(c.title)}</b><span>فتح</span></a>`;
  },
  hr: () => '<hr>'
};
const KINDS = [['h', 'عنوان'], ['p', 'نص'], ['img', 'صورة'], ['card', 'خبر أو بطاقة'], ['btn', 'زر رابط أو ملف'], ['page', 'صفحة داخلية جديدة'], ['hr', 'فاصل'], ['hero', 'غلاف كبير']];
const DEF = {
  h: () => ({ t: 'h', text: '' }), p: () => ({ t: 'p', text: '' }), img: () => ({ t: 'img', src: '', text: '' }),
  card: () => ({ t: 'card', title: '', text: '', date: TODAY, src: '' }), btn: () => ({ t: 'btn', text: 'زر جديد', url: '' }),
  hr: () => ({ t: 'hr' }), hero: () => ({ t: 'hero', title: 'عنوان كبير', text: '', src: '' }),
  page: () => { const id = uid(); D.map[id] = { id, title: 'صفحة جديدة', blocks: [] }; return { t: 'page', ref: id }; }
};

const addBar = (pid, i) => ED() ? `<button class="addbar" data-a="addpick" data-pid="${pid}" data-i="${i}">+ إضافة هنا</button>` : '';
const blk = (b, pid, i) => `<div class="blk t-${b.t}">${ED() ? `<div class="bc"><button class="eb" data-a="up" data-pid="${pid}" data-i="${i}" aria-label="للأعلى">▲</button><button class="eb" data-a="down" data-pid="${pid}" data-i="${i}" aria-label="للأسفل">▼</button><button class="eb dn" data-a="delb" data-pid="${pid}" data-i="${i}">حذف</button></div>` : ''}${B[b.t] ? B[b.t](b, `map.${pid}.blocks.${i}`, i) : ''}</div>${addBar(pid, i + 1)}`;
function pageView(pid) {
  const p = D.map[pid], par = parentOf(pid), hero = p.blocks[0] && p.blocks[0].t === 'hero';
  const head = `<div class="blk ph">${par ? `<a class="back" href="#p-${par.id}">‹ ${e(par.title)}</a>` : ''}${T('h1', `map.${pid}.title`, '', 'عنوان الصفحة')}</div>`;
  const bl = p.blocks.map((b, i) => blk(b, pid, i));
  const out = hero ? [bl[0], head, ...bl.slice(1)] : [head, addBar(pid, 0), ...bl];
  if (!bl.length && !ED()) out.push('<p class="blk empty">هذه الصفحة فارغة حالياً.</p>');
  return out.join('');
}
function adminView() {
  return token
    ? `<section class="wrap"><h1>أنت مسجّل الدخول</h1><p>تنقّل بين الصفحات واضغط على أي نص لتعديله، واستخدم أزرار «إضافة» و«حذف» الظاهرة. ثم اضغط «حفظ ونشر» من الشريط السفلي.</p><button class="btn" data-a="logout">تسجيل الخروج</button></section>`
    : `<section class="wrap adm"><h1>دخول المدير</h1>
      <p>أدخل رمز الوصول (Token) الذي أنشأته من حساب GitHub. يُحفظ على هذا الجهاز فقط.</p>
      <label>رمز الوصول<input id="tk" type="password" autocomplete="off"></label>
      <label>اسم حساب GitHub<input id="ow" value="${e(cfg.owner)}"></label>
      <label>اسم المستودع (Repository)<input id="rp" value="${e(cfg.repo)}"></label>
      <label>الفرع (Branch)<input id="br" value="${e(cfg.branch)}"></label>
      <button class="btn" data-a="login">دخول</button></section>`;
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
function pickImage(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => {
    if (!i.files[0]) return; toast('جارٍ رفع الصورة...');
    try {
      const b = await createImageBitmap(i.files[0]), s = Math.min(1, 1400 / Math.max(b.width, b.height));
      const c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s);
      c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
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

/* ---------- العرض ---------- */
function render(keep) {
  const y = scrollY, h = (location.hash || '').slice(1), admin = h === 'admin';
  const cur = h.startsWith('p-') && D.map[h.slice(2)] ? h.slice(2) : D.menu[0];
  $('#app').innerHTML = admin ? adminView() : cur ? pageView(cur) : `<section class="wrap"><p class="empty">لا توجد صفحات بعد.</p>${eb('addmenu', '', '+ إضافة صفحة', 'add')}</section>`;
  const br = $('#brand');
  br.innerHTML = ED() ? `${T('span', 'school.name', '', 'اسم المدرسة')}<small>${T('span', 'school.subtitle', '', 'عنوان فرعي')}</small>` : `${e(D.school.name)}<small>${e(D.school.subtitle)}</small>`;
  ED() ? br.removeAttribute('href') : br.setAttribute('href', '#p-' + D.menu[0]);
  document.title = D.school.name;
  $('#ticker').innerHTML = ED() ? `<b>عاجل</b>${T('span', 'urgent', '', 'اكتب الخبر العاجل هنا (اتركه فارغاً لإخفائه)')}` : D.urgent ? `<b>عاجل</b><span>${e(D.urgent)}</span>` : '';
  $('#drawer').innerHTML = D.menu.map((id, k) => `<div class="mi"><a href="#p-${id}" class="${!admin && id === cur ? 'on' : ''}">${e(D.map[id].title)}</a>${ED() ? `<span class="mc"><button data-a="mup" data-i="${k}" aria-label="أعلى">▲</button><button data-a="mdown" data-i="${k}" aria-label="أسفل">▼</button><button class="dn" data-a="mdel" data-i="${k}" aria-label="حذف">✕</button></span>` : ''}</div>`).join('')
    + (ED() ? `<a href="#" data-a="addmenu">+ إضافة صفحة جديدة</a>` : '') + `<hr><a href="#admin" class="${admin ? 'on' : ''}">${token ? 'حساب المدير' : 'دخول المدير'}</a>`;
  $('#foot').innerHTML = e(D.school.name);
  let t = $('#tools'); if (!t) { t = document.createElement('div'); t.id = 'tools'; document.body.append(t); }
  t.innerHTML = token ? `<button data-a="toggle">${editing ? 'إيقاف التحرير' : 'تشغيل التحرير'}</button>${editing ? '<button class="sv" data-a="save">حفظ ونشر</button>' : ''}` : '';
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
  if (t.dataset.b) { set(t.dataset.b, t.value); dirty = true; }
  else if (t.dataset.e) { set(t.dataset.e, t.innerText.replace(/\n$/, '')); dirty = true; }
});
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-a],[data-zoom]'); if (!el) return;
  const { a, p, i, pid, k, zoom } = el.dataset;
  if (zoom) return modal(`<img src="${zoom}" alt="">`);
  ev.preventDefault();
  const ch = f => () => { dirty = true; f(); render(1); };            // تعديل ثم إعادة رسم
  const mch = f => () => { dirty = true; f(); render(1); menu(true); }; // تعديل القائمة وإبقاؤها مفتوحة
  const bl = () => D.map[pid].blocks, n = +i;
  const swap = (arr, x, y) => { if (y >= 0 && y < arr.length) [arr[x], arr[y]] = [arr[y], arr[x]]; };
  const A = {
    login: async () => {
      token = $('#tk').value.trim(); cfg = { owner: $('#ow').value.trim(), repo: $('#rp').value.trim(), branch: $('#br').value.trim() || 'main' };
      const r = await gh('data.json');
      if (!r.ok) { token = ''; return toast('بيانات الدخول غير صحيحة'); }
      localStorage.gh_token = token; localStorage.gh_cfg = JSON.stringify(cfg); editing = true;
      toast('تم الدخول. أنت الآن في وضع التحرير.'); location.hash = '#p-' + D.menu[0];
    },
    logout: () => { token = ''; editing = false; localStorage.removeItem('gh_token'); render(); },
    toggle: () => { editing = !editing; render(1); },
    addpick: () => modal(`<h2>ماذا تريد أن تضيف؟</h2><div class="pk">${KINDS.map(([kk, l]) => `<button class="eb" data-a="add" data-k="${kk}" data-pid="${pid}" data-i="${n}">${l}</button>`).join('')}</div>`),
    add: () => { closeModal(); dirty = true; const b = DEF[k](); bl().splice(n, 0, b); render(1); if (k === 'img') pickImage(path => { b.src = path; render(1); }); },
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
    save: async () => {
      toast('جارٍ الحفظ...');
      try { await put('data.json', b64(JSON.stringify(D, null, 2)), 'تحديث محتوى الموقع'); dirty = false; toast('تم الحفظ. ستظهر التغييرات للزوار خلال دقيقة تقريباً.'); }
      catch (x) { toast('فشل الحفظ. تحقق من صلاحيات الرمز.'); }
    }
  };
  A[a] && A[a]();
});

fetch('data.json?' + Date.now()).then(r => r.json()).then(d => {
  const old = !d.map; D = migrate(d);
  if (old && token) dirty = true; // البيانات القديمة حُوّلت: يلزم «حفظ ونشر» لتثبيتها
  render();
}).catch(() => { $('#app').innerHTML = '<p class="wrap">تعذّر تحميل البيانات. افتح الموقع عبر GitHub Pages وليس كملف مباشر.</p>'; });

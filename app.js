const $ = s => document.querySelector(s);
const TODAY = new Date().toISOString().slice(0, 10);
let D, token = localStorage.gh_token || '';
let cfg = JSON.parse(localStorage.gh_cfg || 'null') || guess();
const pv = {}; // معاينة الصور المرفوعة قبل أن يعيد GitHub Pages بناء الموقع

function guess() {
  const h = location.hostname, gh = h.endsWith('.github.io');
  return { owner: gh ? h.split('.')[0] : '', repo: gh ? (location.pathname.split('/')[1] || h) : '', branch: 'main' };
}
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = s => e(s).replace(/\n/g, '<br>');
const im = s => e(pv[s] || s);
const safe = u => /^(https?:\/\/|[\w\/.\-%]+$)/.test(u) ? e(u) : '#';
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const gp = k => k.reduce((o, x) => o[x], D);
const get = p => gp(p.split('.'));
const set = (p, v) => { const k = p.split('.'), l = k.pop(); gp(k)[l] = v; };
const b64 = s => btoa(unescape(encodeURIComponent(s)));

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }

/* ---------- صفحات الزوار ---------- */
const card = n => `<article class="card">${n.image ? `<img src="${im(n.image)}" alt="">` : ''}<div class="cb"><time>${e(n.date)}</time><h3>${e(n.title)}</h3><p>${nl(n.text)}</p></div></article>`;
const R = {
  stage: () => `<section class="hero" style="${D.home.hero ? `background-image:linear-gradient(rgba(20,54,92,.75),rgba(20,54,92,.75)),url('${im(D.home.hero)}')` : ''}">
      <h1>${e(D.home.title)}</h1><p>${nl(D.home.intro)}</p></section>
    <section class="wrap"><h1>المرحلة</h1>
      <div class="bars">${D.stages.map((s, i) => `<button class="bar c${i % 3}" data-open="${i}"><b>${e(s.name)}</b><span>${s.subjects.length} مواد</span></button>`).join('')}</div></section>
    <section class="wrap"><h2>آخر الأخبار</h2><div class="grid">${D.news.slice(0, 3).map(card).join('') || '<p class="empty">لا توجد أخبار بعد.</p>'}</div>
      <a class="btn ghost" href="#news">كل الأخبار</a></section>`,
  news: () => `<section class="wrap"><h1>الأخبار</h1><div class="grid">${D.news.map(card).join('') || '<p class="empty">لا توجد أخبار بعد.</p>'}</div></section>`,
  gallery: () => `<section class="wrap"><h1>معرض الصور</h1><div class="grid gal">${D.gallery.map(g => `<figure><img src="${im(g.src)}" alt="${e(g.caption)}" data-zoom="${im(g.src)}"><figcaption>${e(g.caption)}</figcaption></figure>`).join('') || '<p class="empty">لا توجد صور بعد.</p>'}</div></section>`,
  about: () => `<section class="wrap prose"><h1>عن المدرسة</h1>${D.about.image ? `<img src="${im(D.about.image)}" alt="">` : ''}<p>${nl(D.about.text)}</p></section>`,
  contact: () => `<section class="wrap prose"><h1>تواصل معنا</h1>${D.contact.phone ? `<p>الهاتف: <a href="tel:${e(D.contact.phone)}">${e(D.contact.phone)}</a></p>` : ''}${D.contact.email ? `<p>البريد: ${e(D.contact.email)}</p>` : ''}${D.contact.address ? `<p>العنوان: ${nl(D.contact.address)}</p>` : ''}</section>`,
  admin: () => token ? adminView() : loginView()
};
const pageView = p => `<section class="wrap prose"><h1>${e(p.title)}</h1><p>${nl(p.text)}</p><div class="grid gal">${p.images.map(s => `<figure><img src="${im(s)}" alt="" data-zoom="${im(s)}"></figure>`).join('')}</div></section>`;

/* ---------- لوحة المدير ---------- */
const inp = (p, ph = '') => `<input data-b="${p}" placeholder="${ph}" value="${e(get(p))}">`;
const fld = (l, p, area) => `<label>${l}${area ? `<textarea data-b="${p}" rows="4">${e(get(p))}</textarea>` : inp(p)}</label>`;
const imgf = (l, p) => { const v = get(p); return `<div class="imgf"><span>${l}</span>${v ? `<img src="${im(v)}" alt="">` : ''}<button data-a="img" data-p="${p}">${v ? 'تغيير الصورة' : 'رفع صورة'}</button>${v ? `<button class="danger" data-a="clr" data-p="${p}">إزالة</button>` : ''}</div>`; };
const delBtn = (p, i, t = 'حذف') => `<button class="danger" data-a="del" data-p="${p}" data-i="${i}">${t}</button>`;

function loginView() {
  return `<section class="wrap adm"><h1>دخول المدير</h1>
  <p>أدخل رمز الوصول (Token) الذي أنشأته من حساب GitHub. يُحفظ على هذا الجهاز فقط.</p>
  <label>رمز الوصول<input id="tk" type="password" autocomplete="off"></label>
  <label>اسم حساب GitHub<input id="ow" value="${e(cfg.owner)}"></label>
  <label>اسم المستودع (Repository)<input id="rp" value="${e(cfg.repo)}"></label>
  <label>الفرع (Branch)<input id="br" value="${e(cfg.branch)}"></label>
  <button class="btn" data-a="login">دخول</button></section>`;
}
function adminView() {
  return `<section class="wrap adm"><h1>لوحة تحكم المدير</h1>
  <p>عدّل ما تريد ثم اضغط «حفظ ونشر». تظهر التغييرات للزوار بعد دقيقة تقريباً.</p>
  <details open><summary>المدرسة والخبر العاجل</summary>${fld('اسم المدرسة', 'school.name')}${fld('عنوان فرعي', 'school.subtitle')}${fld('الخبر العاجل (اتركه فارغاً لإخفائه)', 'urgent')}</details>
  <details><summary>الصفحة الأولى (المرحلة)</summary>${fld('العنوان الكبير', 'home.title')}${fld('النص', 'home.intro', 1)}${imgf('صورة الغلاف', 'home.hero')}</details>
  <details><summary>الأخبار</summary><button data-a="addNews">إضافة خبر</button>
    ${D.news.map((n, i) => `<div class="sub">${fld('العنوان', `news.${i}.title`)}${fld('النص', `news.${i}.text`, 1)}${fld('التاريخ', `news.${i}.date`)}${imgf('صورة الخبر', `news.${i}.image`)}${delBtn('news', i, 'حذف الخبر')}</div>`).join('')}</details>
  <details><summary>المراحل والمواد</summary><button data-a="addStage">إضافة مرحلة</button>
    ${D.stages.map((s, i) => `<div class="sub">${fld('اسم المرحلة', `stages.${i}.name`)}
      ${s.subjects.map((x, j) => `<div class="row">${inp(`stages.${i}.subjects.${j}.name`, 'اسم المادة')}${inp(`stages.${i}.subjects.${j}.link`, 'رابط (اختياري)')}${delBtn(`stages.${i}.subjects`, j)}</div>`).join('')}
      <button data-a="addSub" data-i="${i}">إضافة مادة</button>${delBtn('stages', i, 'حذف المرحلة')}</div>`).join('')}</details>
  <details><summary>معرض الصور</summary><button data-a="addGal">إضافة صورة</button>
    ${D.gallery.map((g, i) => `<div class="row"><img src="${im(g.src)}" alt="">${inp(`gallery.${i}.caption`, 'وصف الصورة')}${delBtn('gallery', i)}</div>`).join('')}</details>
  <details><summary>عن المدرسة</summary>${fld('النص', 'about.text', 1)}${imgf('الصورة', 'about.image')}</details>
  <details><summary>التواصل</summary>${fld('الهاتف', 'contact.phone')}${fld('البريد', 'contact.email')}${fld('العنوان', 'contact.address', 1)}</details>
  <details><summary>صفحات إضافية</summary><button data-a="addPage">إضافة صفحة</button>
    ${D.pages.map((p, i) => `<div class="sub">${fld('عنوان الصفحة', `pages.${i}.title`)}${fld('النص', `pages.${i}.text`, 1)}
      <div class="row">${p.images.map((s, j) => `<span><img src="${im(s)}" alt="">${delBtn(`pages.${i}.images`, j, 'x')}</span>`).join('')}</div>
      <button data-a="addPImg" data-i="${i}">إضافة صورة</button>${delBtn('pages', i, 'حذف الصفحة')}</div>`).join('')}</details>
  <p><button class="danger" data-a="logout">تسجيل الخروج</button></p>
  <div id="savebar"><button class="btn" data-a="save">حفظ ونشر التغييرات</button></div></section>`;
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
      await put(path, url.split(',')[1], 'رفع صورة'); pv[path] = url; cb(path);
      toast('تم رفع الصورة. اضغط «حفظ ونشر» لتثبيت التغييرات.');
    } catch (x) { toast('تعذّر رفع الصورة. تأكد من الرمز وصلاحياته.'); }
  };
  i.click();
}

/* ---------- العرض والقائمة ---------- */
function render(keep) {
  const y = scrollY, h = (location.hash || '#stage').slice(1);
  let html;
  if (h.startsWith('p-')) { const p = D.pages.find(x => x.id === h.slice(2)); html = p ? pageView(p) : R.stage(); }
  else html = (R[h] || R.stage)();
  $('#app').innerHTML = html;
  $('#brand').innerHTML = `${e(D.school.name)}<small>${e(D.school.subtitle)}</small>`;
  document.title = D.school.name;
  $('#ticker').innerHTML = D.urgent ? `<b>عاجل</b><span>${e(D.urgent)}</span>` : '';
  const items = [['stage', 'المرحلة'], ['news', 'الأخبار'], ['gallery', 'معرض الصور'], ['about', 'عن المدرسة'], ['contact', 'تواصل معنا'], ...D.pages.map(p => ['p-' + p.id, p.title])];
  $('#drawer').innerHTML = items.map(([k, t]) => `<a href="#${k}" class="${k === h ? 'on' : ''}">${e(t)}</a>`).join('') + `<hr><a href="#admin" class="${h === 'admin' ? 'on' : ''}">دخول المدير</a>`;
  $('#foot').innerHTML = `${e(D.school.name)}${D.contact.phone ? ' | ' + e(D.contact.phone) : ''}`;
  menu(false); scrollTo(0, keep ? y : 0);
}
function menu(o) { $('#drawer').classList.toggle('open', o); $('#overlay').classList.toggle('open', o); $('#burger').classList.toggle('open', o); $('#burger').setAttribute('aria-expanded', o); }
function modal(html) { $('#mbody').innerHTML = html; $('#modal').hidden = false; }

/* ---------- الأحداث ---------- */
$('#burger').onclick = () => menu(!$('#drawer').classList.contains('open'));
$('#overlay').onclick = () => menu(false);
$('#modal').onclick = ev => { if (ev.target.id === 'modal' || ev.target.classList.contains('x')) $('#modal').hidden = true; };
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { $('#modal').hidden = true; menu(false); } });
addEventListener('hashchange', () => render());
document.addEventListener('input', ev => { const p = ev.target.dataset.b; if (p) set(p, ev.target.value); });
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-a],[data-open],[data-zoom]'); if (!t) return;
  const { a, p, i, open, zoom } = t.dataset;
  if (open !== undefined) { const s = D.stages[open]; return modal(`<h2>${e(s.name)}</h2><ul class="subs">${s.subjects.map(x => `<li>${x.link ? `<a href="${safe(x.link)}" target="_blank" rel="noopener">${e(x.name)}</a>` : e(x.name)}</li>`).join('')}</ul>`); }
  if (zoom) return modal(`<img src="${zoom}" alt="">`);
  const A = {
    login: async () => {
      token = $('#tk').value.trim(); cfg = { owner: $('#ow').value.trim(), repo: $('#rp').value.trim(), branch: $('#br').value.trim() || 'main' };
      const r = await gh('data.json');
      if (!r.ok) { token = ''; return toast('بيانات الدخول غير صحيحة'); }
      localStorage.gh_token = token; localStorage.gh_cfg = JSON.stringify(cfg); render();
    },
    logout: () => { token = ''; localStorage.removeItem('gh_token'); render(); },
    img: () => pickImage(path => { set(p, path); render(1); }),
    clr: () => { set(p, ''); render(1); },
    del: () => { if (confirm('هل أنت متأكد من الحذف؟')) { gp(p.split('.')).splice(+i, 1); render(1); } },
    addNews: () => { D.news.unshift({ id: uid(), title: 'خبر جديد', text: '', date: TODAY, image: '' }); render(1); },
    addStage: () => { D.stages.push({ name: 'مرحلة جديدة', subjects: [] }); render(1); },
    addSub: () => { D.stages[i].subjects.push({ name: 'مادة جديدة', link: '' }); render(1); },
    addGal: () => pickImage(path => { D.gallery.push({ src: path, caption: '' }); render(1); }),
    addPage: () => { D.pages.push({ id: uid(), title: 'صفحة جديدة', text: '', images: [] }); render(1); },
    addPImg: () => pickImage(path => { D.pages[i].images.push(path); render(1); }),
    save: async () => {
      toast('جارٍ الحفظ...');
      try { await put('data.json', b64(JSON.stringify(D, null, 2)), 'تحديث محتوى الموقع'); toast('تم الحفظ. ستظهر التغييرات خلال دقيقة تقريباً.'); }
      catch (x) { toast('فشل الحفظ. تحقق من صلاحيات الرمز.'); }
    }
  };
  A[a] && A[a]();
});

fetch('data.json?' + Date.now()).then(r => r.json()).then(d => { D = d; render(); })
  .catch(() => { $('#app').innerHTML = '<p class="wrap">تعذّر تحميل البيانات. افتح الموقع عبر GitHub Pages وليس كملف مباشر.</p>'; });

const $ = s => document.querySelector(s);
const TODAY = new Date().toISOString().slice(0, 10);
let D, token = localStorage.gh_token || '', editing = !!token, dirty = false;
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
const ED = () => editing && !!token;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }

/* ---------- عناصر قابلة للتعديل المباشر ---------- */
// نص: عادي للزائر، وقابل للكتابة عليه مباشرة للمدير
const T = (tag, p, cls = '', ph = '') => ED()
  ? `<${tag} class="ed ${cls}" contenteditable="plaintext-only" data-e="${p}" data-ph="${ph}">${e(get(p))}</${tag}>`
  : `<${tag} class="${cls}">${nl(get(p))}</${tag}>`;
const eb = (a, attrs, label, cls = '') => ED() ? `<button class="eb ${cls}" data-a="${a}" ${attrs}>${label}</button>` : '';
const imgCtl = p => ED() ? `<span class="ec">${eb('img', `data-p="${p}"`, get(p) ? 'تغيير الصورة' : 'إضافة صورة')}${get(p) ? eb('clr', `data-p="${p}"`, 'إزالة الصورة', 'dn') : ''}</span>` : '';

/* ---------- صفحات الموقع ---------- */
const card = (n, i) => `<article class="card">${n.image ? `<img src="${im(n.image)}" alt="">` : ''}<div class="cb">${imgCtl(`news.${i}.image`)}${T('time', `news.${i}.date`, '', 'التاريخ')}${T('h3', `news.${i}.title`, '', 'عنوان الخبر')}${T('p', `news.${i}.text`, '', 'نص الخبر')}${eb('del', `data-p="news" data-i="${i}"`, 'حذف الخبر', 'dn')}</div></article>`;
const bar = (s, i) => ED()
  ? `<div class="bar c${i % 3}"><div>${T('b', `stages.${i}.name`, '', 'اسم المرحلة')}<span>${s.subjects.length} مواد</span></div><div class="ec"><button class="eb" data-open="${i}">تعديل المواد</button>${eb('del', `data-p="stages" data-i="${i}"`, 'حذف المرحلة', 'dn')}</div></div>`
  : `<button class="bar c${i % 3}" data-open="${i}"><b>${e(s.name)}</b><span>${s.subjects.length} مواد</span></button>`;

const R = {
  stage: () => `<section class="hero" style="${D.home.hero ? `background-image:linear-gradient(rgba(20,54,92,.75),rgba(20,54,92,.75)),url('${im(D.home.hero)}')` : ''}">
      ${T('h1', 'home.title', '', 'العنوان الكبير')}${T('p', 'home.intro', '', 'نص ترحيبي')}${imgCtl('home.hero')}</section>
    <section class="wrap"><h1>المرحلة</h1><div class="bars">${D.stages.map(bar).join('')}</div>${eb('addStage', '', '+ إضافة مرحلة', 'add')}</section>
    <section class="wrap"><h2>آخر الأخبار</h2>${eb('addNews', '', '+ إضافة خبر', 'add')}<div class="grid">${D.news.slice(0, 3).map(card).join('') || '<p class="empty">لا توجد أخبار بعد.</p>'}</div>
      <a class="btn ghost" href="#news">كل الأخبار</a></section>`,
  news: () => `<section class="wrap"><h1>الأخبار</h1>${eb('addNews', '', '+ إضافة خبر', 'add')}<div class="grid">${D.news.map(card).join('') || '<p class="empty">لا توجد أخبار بعد.</p>'}</div></section>`,
  gallery: () => `<section class="wrap"><h1>معرض الصور</h1>${eb('addGal', '', '+ إضافة صورة', 'add')}<div class="grid gal">${D.gallery.map((g, i) => `<figure><img src="${im(g.src)}" alt="${e(g.caption)}" ${ED() ? '' : `data-zoom="${im(g.src)}"`}>${T('figcaption', `gallery.${i}.caption`, '', 'وصف الصورة')}${eb('del', `data-p="gallery" data-i="${i}"`, 'حذف الصورة', 'dn')}</figure>`).join('') || '<p class="empty">لا توجد صور بعد.</p>'}</div></section>`,
  about: () => `<section class="wrap prose"><h1>عن المدرسة</h1>${imgCtl('about.image')}${D.about.image ? `<img src="${im(D.about.image)}" alt="">` : ''}${T('p', 'about.text', '', 'اكتب نبذة عن المدرسة')}</section>`,
  contact: () => `<section class="wrap prose"><h1>تواصل معنا</h1>${[['phone', 'الهاتف'], ['email', 'البريد'], ['address', 'العنوان']].map(([k, l]) =>
    ED() ? `<p>${l}: ${T('span', `contact.${k}`, 'inl', l)}</p>` : D.contact[k] ? `<p>${l}: ${k === 'phone' ? `<a href="tel:${e(D.contact.phone)}">${e(D.contact.phone)}</a>` : nl(D.contact[k])}</p>` : '').join('')}</section>`,
  admin: () => token
    ? `<section class="wrap"><h1>أنت مسجّل الدخول</h1><p>تنقّل بين الصفحات وعدّل مباشرة: اكتب على النصوص، واضغط أزرار الإضافة والحذف الظاهرة. ثم اضغط «حفظ ونشر» من الشريط السفلي.</p><button class="btn" data-a="logout">تسجيل الخروج</button></section>`
    : `<section class="wrap adm"><h1>دخول المدير</h1>
      <p>أدخل رمز الوصول (Token) الذي أنشأته من حساب GitHub. يُحفظ على هذا الجهاز فقط.</p>
      <label>رمز الوصول<input id="tk" type="password" autocomplete="off"></label>
      <label>اسم حساب GitHub<input id="ow" value="${e(cfg.owner)}"></label>
      <label>اسم المستودع (Repository)<input id="rp" value="${e(cfg.repo)}"></label>
      <label>الفرع (Branch)<input id="br" value="${e(cfg.branch)}"></label>
      <button class="btn" data-a="login">دخول</button></section>`
};
const pageView = (p, i) => `<section class="wrap prose">${T('h1', `pages.${i}.title`, '', 'عنوان الصفحة')}${T('p', `pages.${i}.text`, '', 'اكتب هنا')}
  <div class="grid gal">${p.images.map((s, j) => `<figure><img src="${im(s)}" alt="" ${ED() ? '' : `data-zoom="${im(s)}"`}>${eb('del', `data-p="pages.${i}.images" data-i="${j}"`, 'حذف الصورة', 'dn')}</figure>`).join('')}</div>
  ${eb('addPImg', `data-i="${i}"`, '+ إضافة صورة', 'add')}${eb('delPage', `data-i="${i}"`, 'حذف هذه الصفحة', 'dn')}</section>`;

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

/* ---------- العرض ---------- */
function render(keep) {
  const y = scrollY, h = (location.hash || '#stage').slice(1);
  let html;
  if (h.startsWith('p-')) { const i = D.pages.findIndex(x => x.id === h.slice(2)); html = i > -1 ? pageView(D.pages[i], i) : R.stage(); }
  else html = (R[h] || R.stage)();
  $('#app').innerHTML = html;
  const br = $('#brand');
  br.innerHTML = ED() ? `${T('span', 'school.name', '', 'اسم المدرسة')}<small>${T('span', 'school.subtitle', '', 'عنوان فرعي')}</small>` : `${e(D.school.name)}<small>${e(D.school.subtitle)}</small>`;
  ED() ? br.removeAttribute('href') : br.setAttribute('href', '#stage');
  document.title = D.school.name;
  $('#ticker').innerHTML = ED() ? `<b>عاجل</b>${T('span', 'urgent', '', 'اكتب الخبر العاجل هنا (اتركه فارغاً لإخفائه)')}` : D.urgent ? `<b>عاجل</b><span>${e(D.urgent)}</span>` : '';
  const items = [['stage', 'المرحلة'], ['news', 'الأخبار'], ['gallery', 'معرض الصور'], ['about', 'عن المدرسة'], ['contact', 'تواصل معنا'], ...D.pages.map(p => ['p-' + p.id, p.title])];
  $('#drawer').innerHTML = items.map(([k, t]) => `<a href="#${k}" class="${k === h ? 'on' : ''}">${e(t)}</a>`).join('')
    + (ED() ? `<a href="#" data-a="addPage">+ إضافة صفحة جديدة</a>` : '') + `<hr><a href="#admin" class="${h === 'admin' ? 'on' : ''}">${token ? 'حساب المدير' : 'دخول المدير'}</a>`;
  $('#foot').innerHTML = `${e(D.school.name)}${D.contact.phone ? ' | ' + e(D.contact.phone) : ''}`;
  let t = $('#tools'); if (!t) { t = document.createElement('div'); t.id = 'tools'; document.body.append(t); }
  t.innerHTML = token ? `<button data-a="toggle">${editing ? 'إيقاف التحرير' : 'تشغيل التحرير'}</button>${editing ? '<button class="sv" data-a="save">حفظ ونشر</button>' : ''}` : '';
  menu(false); scrollTo(0, keep ? y : 0);
}
function menu(o) { $('#drawer').classList.toggle('open', o); $('#overlay').classList.toggle('open', o); $('#burger').classList.toggle('open', o); $('#burger').setAttribute('aria-expanded', o); }
function modal(html) { $('#mbody').innerHTML = html; $('#modal').hidden = false; }
function stageModal(i) {
  const s = D.stages[i];
  modal(ED()
    ? `<h2>${T('span', `stages.${i}.name`, '', 'اسم المرحلة')}</h2>${s.subjects.map((x, j) => `<div class="row">${T('span', `stages.${i}.subjects.${j}.name`, 'grow', 'اسم المادة')}<input data-b="stages.${i}.subjects.${j}.link" placeholder="رابط (اختياري)" value="${e(x.link)}"><button class="eb dn" data-a="delSub" data-i="${i}" data-j="${j}">حذف</button></div>`).join('')}<button class="eb add" data-a="addSub" data-i="${i}">+ إضافة مادة</button>`
    : `<h2>${e(s.name)}</h2><ul class="subs">${s.subjects.map(x => `<li>${x.link ? `<a href="${safe(x.link)}" target="_blank" rel="noopener">${e(x.name)}</a>` : e(x.name)}</li>`).join('')}</ul>`);
}

/* ---------- الأحداث ---------- */
$('#burger').onclick = () => menu(!$('#drawer').classList.contains('open'));
$('#overlay').onclick = () => menu(false);
const closeModal = () => { if (!$('#modal').hidden) { $('#modal').hidden = true; if (ED()) render(1); } };
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
  const t = ev.target.closest('[data-a],[data-open],[data-zoom]'); if (!t) return;
  const { a, p, i, j, open, zoom } = t.dataset;
  if (open !== undefined) return stageModal(+open);
  if (zoom) return modal(`<img src="${zoom}" alt="">`);
  ev.preventDefault();
  const ch = f => () => { dirty = true; f(); render(1); }; // تعديل ثم إعادة رسم
  const A = {
    login: async () => {
      token = $('#tk').value.trim(); cfg = { owner: $('#ow').value.trim(), repo: $('#rp').value.trim(), branch: $('#br').value.trim() || 'main' };
      const r = await gh('data.json');
      if (!r.ok) { token = ''; return toast('بيانات الدخول غير صحيحة'); }
      localStorage.gh_token = token; localStorage.gh_cfg = JSON.stringify(cfg); editing = true;
      toast('تم الدخول. أنت الآن في وضع التحرير.'); location.hash = '#stage';
    },
    logout: () => { token = ''; editing = false; localStorage.removeItem('gh_token'); render(); },
    toggle: () => { editing = !editing; render(1); },
    img: () => pickImage(path => { set(p, path); render(1); }),
    clr: ch(() => set(p, '')),
    del: () => { if (confirm('هل أنت متأكد من الحذف؟')) ch(() => gp(p.split('.')).splice(+i, 1))(); },
    addNews: ch(() => D.news.unshift({ id: uid(), title: '', text: '', date: TODAY, image: '' })),
    addStage: ch(() => D.stages.push({ name: 'مرحلة جديدة', subjects: [] })),
    addSub: () => { dirty = true; D.stages[i].subjects.push({ name: '', link: '' }); stageModal(+i); },
    delSub: () => { if (confirm('حذف هذه المادة؟')) { dirty = true; D.stages[i].subjects.splice(+j, 1); stageModal(+i); } },
    addGal: () => pickImage(path => { D.gallery.push({ src: path, caption: '' }); render(1); }),
    addPage: () => { const id = uid(); dirty = true; D.pages.push({ id, title: 'صفحة جديدة', text: '', images: [] }); location.hash = '#p-' + id; },
    delPage: () => { if (confirm('حذف هذه الصفحة بالكامل؟')) { dirty = true; D.pages.splice(+i, 1); location.hash = '#stage'; } },
    addPImg: () => pickImage(path => { D.pages[i].images.push(path); render(1); }),
    save: async () => {
      toast('جارٍ الحفظ...');
      try { await put('data.json', b64(JSON.stringify(D, null, 2)), 'تحديث محتوى الموقع'); dirty = false; toast('تم الحفظ. ستظهر التغييرات للزوار خلال دقيقة تقريباً.'); }
      catch (x) { toast('فشل الحفظ. تحقق من صلاحيات الرمز.'); }
    }
  };
  A[a] && A[a]();
});

fetch('data.json?' + Date.now()).then(r => r.json()).then(d => { D = d; render(); })
  .catch(() => { $('#app').innerHTML = '<p class="wrap">تعذّر تحميل البيانات. افتح الموقع عبر GitHub Pages وليس كملف مباشر.</p>'; });

'use strict';

// ===== 設定 =====
const MAX_EDGE = 2400;      // 長辺の上限(px)。これより大きい画像は縮小
const JPEG_QUALITY = 0.8;   // JPEG画質(0〜1)
const PX_TO_PT = 0.75;      // 1px = 0.75pt (96dpi相当)。ページは画像サイズそのまま

// ===== 状態 =====
let items = [];   // { id, file, thumb, rot, name }
let nextId = 1;

const $ = (s) => document.querySelector(s);
const listEl = $('#list');
const fileInput = $('#fileInput');

// ===== アイコン =====
const ICON = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  rotL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5h5"/><path d="M4.6 9A8 8 0 1 1 6 17.3"/></svg>',
  rotR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v5h-5"/><path d="M19.4 9A8 8 0 1 0 18 17.3"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
};

// ===== 画像の読み込み =====
$('#pickBtn').addEventListener('click', () => fileInput.click());
$('#addBtn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  fileInput.value = '';
  if (!files.length) return;
  let failed = 0;
  showProgress('画像を読み込んでいます…', 0);
  for (let i = 0; i < files.length; i++) {
    try {
      const thumb = await makeThumb(files[i]);
      items.push({ id: nextId++, file: files[i], thumb, rot: 0, name: files[i].name || `画像${nextId}` });
    } catch (e) {
      console.error(e);
      failed++;
    }
    showProgress('画像を読み込んでいます…', (i + 1) / files.length);
  }
  hideProgress();
  render();
  if (failed) toast(`${failed}枚の画像を読み込めませんでした`);
});

async function decode(file) {
  // EXIFの向きを反映してデコード
  return await createImageBitmap(file, { imageOrientation: 'from-image' });
}

async function makeThumb(file) {
  const bmp = await decode(file);
  const s = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.75));
  return URL.createObjectURL(blob);
}

// ===== 一覧の表示 =====
function render() {
  const has = items.length > 0;
  $('#empty').classList.toggle('hidden', has);
  $('#bar').classList.toggle('hidden', !has);
  $('#clearBtn').classList.toggle('hidden', !has);
  $('#count').textContent = has ? `${items.length}枚` : '';

  listEl.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = it.id;
    li.innerHTML = `
      <button class="handle" aria-label="ドラッグで並べかえ">${ICON.grip}</button>
      <span class="num">${i + 1}</span>
      <div class="thumb"><img alt="" src="${it.thumb}" style="transform:rotate(${it.rot}deg)"></div>
      <div class="meta">
        <div class="name"></div>
        <div class="tools">
          <button class="tool" data-act="up" aria-label="上へ" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="tool" data-act="rotL" aria-label="左に回転(270°)">${ICON.rotL}</button>
          <button class="tool" data-act="rotR" aria-label="右に回転(90°)">${ICON.rotR}</button>
          <button class="tool" data-act="down" aria-label="下へ" ${i === items.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <span></span>
          <button class="tool del" data-act="del" aria-label="削除">${ICON.del}</button>
        </div>
      </div>`;
    li.querySelector('.name').textContent = it.name;
    li.querySelector('.handle').addEventListener('pointerdown', (e) => startDrag(e, li));
    listEl.appendChild(li);
  });
}

function indexOfId(id) { return items.findIndex((x) => x.id === id); }

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tool');
  if (!btn) return;
  const li = btn.closest('.item');
  const idx = indexOfId(Number(li.dataset.id));
  const it = items[idx];
  switch (btn.dataset.act) {
    case 'up': move(idx, idx - 1); break;
    case 'down': move(idx, idx + 1); break;
    case 'rotR':
      it.rot = it.rot + 90;
      li.querySelector('.thumb img').style.transform = `rotate(${it.rot}deg)`;
      break;
    case 'rotL':
      it.rot = it.rot - 90;
      li.querySelector('.thumb img').style.transform = `rotate(${it.rot}deg)`;
      break;
    case 'del':
      URL.revokeObjectURL(it.thumb);
      items.splice(idx, 1);
      render();
      break;
  }
});

function move(from, to) {
  if (to < 0 || to >= items.length) return;
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  render();
  const li = listEl.querySelector(`[data-id="${it.id}"]`);
  li.classList.add('flash');
  const r = li.getBoundingClientRect();
  if (r.top < 70 || r.bottom > innerHeight - 100) li.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

$('#clearBtn').addEventListener('click', () => {
  if (!confirm('すべての画像を消しますか？')) return;
  items.forEach((it) => URL.revokeObjectURL(it.thumb));
  items = [];
  render();
});

// ===== ドラッグで並べかえ =====
function startDrag(e, li) {
  e.preventDefault();
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);
  li.classList.add('dragging');
  const grab = e.clientY - li.getBoundingClientRect().top;
  let y = e.clientY;
  let raf = 0;
  if (navigator.vibrate) navigator.vibrate(10);

  const update = () => {
    // 隣の要素の中央を越えたら入れ替え
    let moved = true;
    while (moved) {
      moved = false;
      const next = li.nextElementSibling;
      const prev = li.previousElementSibling;
      if (next) {
        const r = next.getBoundingClientRect();
        if (y > r.top + r.height / 2) { listEl.insertBefore(next, li); moved = true; continue; }
      }
      if (prev) {
        const r = prev.getBoundingClientRect();
        if (y < r.top + r.height / 2) { listEl.insertBefore(li, prev); moved = true; }
      }
    }
    li.style.transform = 'none';
    const natural = li.getBoundingClientRect().top;
    li.style.transform = `translateY(${y - grab - natural}px)`;
    renumber();
  };

  const autoScroll = () => {
    const edge = 90;
    let dy = 0;
    if (y < edge) dy = -Math.ceil((edge - y) / 6);
    else if (y > innerHeight - edge - 60) dy = Math.ceil((y - (innerHeight - edge - 60)) / 6);
    if (dy) { scrollBy(0, dy); update(); }
    raf = requestAnimationFrame(autoScroll);
  };
  raf = requestAnimationFrame(autoScroll);

  const onMove = (ev) => { y = ev.clientY; update(); };
  const onEnd = () => {
    cancelAnimationFrame(raf);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
    li.classList.remove('dragging');
    li.style.transform = '';
    // DOMの順番を状態に反映
    const order = [...listEl.children].map((el) => Number(el.dataset.id));
    items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    render();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onEnd);
  handle.addEventListener('pointercancel', onEnd);
}

function renumber() {
  [...listEl.children].forEach((el, i) => { el.querySelector('.num').textContent = i + 1; });
}

addEventListener('scroll', () => {
  $('#header').classList.toggle('scrolled', scrollY > 4);
}, { passive: true });

// ===== ファイル名 → PDF化 → 保存 =====
const dialog = $('#nameDialog');
const nameInput = $('#nameInput');

$('#nextBtn').addEventListener('click', () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  nameInput.value = `PDF_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  $('#dialogInfo').textContent = `${items.length}ページのPDFを作って、ダウンロードフォルダに保存します。`;
  dialog.showModal();
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 50);
});
$('#cancelBtn').addEventListener('click', () => dialog.close());

$('#nameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = cleanName(nameInput.value);
  dialog.close();
  try {
    const blob = await createPdf(name);
    download(blob, name + '.pdf');
    toast(`「${name}.pdf」を保存しました（${formatSize(blob.size)}）`);
  } catch (err) {
    console.error(err);
    toast('PDFを作れませんでした：' + (err && err.message ? err.message : err));
  } finally {
    hideProgress();
  }
});

function cleanName(s) {
  s = (s || '').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return s || 'PDF';
}

async function createPdf(title) {
  const pages = [];
  for (let i = 0; i < items.length; i++) {
    showProgress(`PDFを作っています… ${i + 1} / ${items.length}`, i / items.length);
    pages.push(await renderPage(items[i]));
  }
  showProgress('仕上げています…', 1);
  return buildPdf(pages, title);
}

async function renderPage(it) {
  const bmp = await decode(it.file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const sw = Math.max(1, Math.round(bmp.width * scale));
  const sh = Math.max(1, Math.round(bmp.height * scale));
  const r = ((it.rot % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  const c = document.createElement('canvas');
  c.width = swap ? sh : sw;
  c.height = swap ? sw : sh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';             // 透過PNG対策で白背景
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(bmp, -sw / 2, -sh / 2, sw, sh);
  bmp.close && bmp.close();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', JPEG_QUALITY));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const w = c.width, h = c.height;
  c.width = c.height = 1; // メモリ解放
  return { jpeg, w, h };
}

// ===== 最小限のPDF書き出し (JPEGをそのまま埋め込み) =====
function buildPdf(pages, title) {
  const enc = new TextEncoder();
  const parts = [];
  let len = 0;
  const offsets = [];
  const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const num = (v) => (Math.round(v * 100) / 100).toString();

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const n = pages.length;
  const pageNo = (i) => 4 + i * 3;
  const kids = pages.map((_, i) => `${pageNo(i)} 0 R`).join(' ');

  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  obj(3, () => push(`<< /Title ${utf16hex(title)} /Producer (MatomePDF) /CreationDate (${pdfDate(new Date())}) >>`));

  pages.forEach((p, i) => {
    const pn = pageNo(i), cn = pn + 1, im = pn + 2;
    const W = num(p.w * PX_TO_PT), H = num(p.h * PX_TO_PT);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`));
    obj(cn, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(im, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });

  const size = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

function utf16hex(s) {
  let h = '<FEFF';
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return h + '>';
}

function pdfDate(d) {
  const p = (v) => String(v).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${sign}${p(Math.floor(a / 60))}'${p(a % 60)}'`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ===== 表示まわり =====
function showProgress(text, ratio) {
  $('#progress').classList.add('show');
  $('#progressText').textContent = text;
  $('#progressFill').style.width = Math.round(ratio * 100) + '%';
}
function hideProgress() { $('#progress').classList.remove('show'); }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function formatSize(b) {
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + 'KB';
  return (b / 1024 / 1024).toFixed(1) + 'MB';
}

// ===== オフライン対応 =====
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.error));
}

render();

/* Body Scent — script.js (shared by every page) */

const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbxnYubAMKG_m1_PR89O4Hszps_uNw-dvSv5tSyBIVmwD9OjiFJCclDS_H4NoT35mxk/exec';
const ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz-jdhPP8MWHaEfunqGxMiy_5skUlU6pHiwjMQLC8d8qB3US_mdACM_V9l_In3SqS39E0N8pUiYUZF/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all',       label: 'ทั้งหมด' },
  { key: 'fresh',     label: 'Fresh' },
  { key: 'sweet',     label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance',   label: 'Romance' }
];

const TYPE_LABELS = { spray: 'สเปรย์', rollon: 'โรลออน' };

/* ---------- helpers ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(n) {
  return Number(n).toLocaleString('th-TH') + ' บาท';
}

/* ---------- 1) product.html ---------- */
function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const list = document.getElementById('product-list');
  if (!filterBar || !list) return;

  let products = [];
  const validMoods = MOODS.map(m => m.key);
  const paramMood = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
  let currentMood = validMoods.includes(paramMood) ? paramMood : 'all';

  function renderFilters() {
    filterBar.innerHTML = '';
    MOODS.forEach(m => {
      const btn = el('button', 'filter-btn' + (m.key === currentMood ? ' is-active' : ''), m.label);
      btn.type = 'button';
      btn.dataset.mood = m.key;
      btn.addEventListener('click', () => {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function buildCard(p) {
    const card = el('article', 'product-card');

    const imgWrap = el('div', 'product-card__image');
    const img = el('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    const body = el('div', 'product-card__body');

    const name = el('h3', 'product-card__name');
    name.appendChild(el('span', 'mood-dot mood-dot--' + p.mood));
    name.appendChild(document.createTextNode(p.name));

    const meta = el('div', 'product-card__meta', p.size || TYPE_LABELS[p.type] || '');
    const price = el('div', 'product-card__price', formatPrice(p.price));

    const itemName = p.size ? p.name + ' ' + p.size : p.name;
    const buy = el('a', 'btn btn--accent btn--small', 'สั่งซื้อ');
    buy.href = 'order.html?item=' + encodeURIComponent(itemName) + '&price=' + encodeURIComponent(p.price);

    body.append(name, meta, price, buy);
    card.append(imgWrap, body);
    return card;
  }

  function renderProducts() {
    list.innerHTML = '';
    const shown = currentMood === 'all' ? products : products.filter(p => p.mood === currentMood);
    if (!shown.length) {
      list.appendChild(el('p', '', 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(p => list.appendChild(buildCard(p)));
  }

  renderFilters();
  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(err => {
      console.error(err);
      list.innerHTML = '';
      list.appendChild(el('p', '', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองรีเฟรชหน้า'));
    });
}

/* ---------- 2) order.html ---------- */
function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // เติมทั้งชื่อสินค้าและราคาลงฟอร์มทันที
  if (itemsInput) itemsInput.value = params.get('item') || '';
  if (totalInput) totalInput.value = params.get('price') || '';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: itemsInput.value.trim(),
      total: totalInput.value.trim(),
      note: document.getElementById('note').value.trim()
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ---------- 3) admin.html ---------- */
// CSV parser (รองรับเครื่องหมายคำพูด, comma และขึ้นบรรทัดใหม่ในช่อง)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function showMessage(msg) {
    tbody.innerHTML = '';
    const tr = el('tr');
    const td = el('td', '', msg);
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      // แถวแรกเป็นหัวตาราง; คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, ยอดรวม, หมายเหตุ
      const data = rows.slice(1).reverse(); // ล่าสุดขึ้นก่อน
      if (!data.length) { showMessage('ยังไม่มีรายการสั่งซื้อ'); return; }

      tbody.innerHTML = '';
      data.forEach(r => {
        const tr = el('tr');
        for (let i = 0; i < 6; i++) {
          tr.appendChild(el('td', '', (r[i] || '').trim()));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error(err);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณาลองรีเฟรชหน้า');
    });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});

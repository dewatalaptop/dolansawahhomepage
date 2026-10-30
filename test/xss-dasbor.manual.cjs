// Uji manual XSS dasbor (butuh playwright + server statis di port 4803: python -m http.server 4803). Semua jaringan Firestore diblokir; tidak menyentuh produksi.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  await p.route(/firestore\.googleapis\.com|identitytoolkit|securetoken/, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await p.goto('http://localhost:4803/5672231.html'); await p.waitForTimeout(1500);
  const out = await p.evaluate(async () => {
    document.getElementById('login-overlay').style.display = 'none'; document.getElementById('main-content').style.display = 'block';
    window.__pwn = 0;
    const X = (n) => `<img src=x onerror="window.__pwn=${n}">`;
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    globalMenuPrices = { 'Paket A': 50000 };
    reservationsCache = [{ id: 'a"b\'c', nama: X(1), date: today, jam: X(2), tempat: X(3), jumlah: X(4), tipeDp: X(5), nomorHp: '0811', dp: 1, approvedAt: { seconds: 5 } }];
    renderDashboardStats();
    const res = {};
    res.recent = document.getElementById('recent-list').querySelectorAll('img').length;
    res.recentBtn = document.querySelector('#recent-list .btn-edit-sm').dataset.id;
    showDateDetail(today);
    res.detail = document.getElementById('day-detail-list').querySelectorAll('img').length;
    // dialog persetujuan
    showApproveDpDialog('q', { nama: X(6), date: today, tempat: X(7) }, []).catch(() => {});
    await new Promise(r => setTimeout(r, 400));
    res.swalTitleImgs = document.querySelectorAll('.swal2-title img').length;
    Swal.close();
    // pencarian
    requestsCache = []; const si = document.getElementById('inbox-search'); si.value = X(8); renderInbox();
    res.search = document.getElementById('inbox-empty').querySelectorAll('img').length;
    // baris menu modal edit
    const host = document.getElementById('edit-menu-rows') || (() => { const d = document.createElement('div'); d.id = 'edit-menu-rows'; document.body.appendChild(d); return d; })();
    globalMenuPrices = {}; addMenuRow(X(9), X(10));
    globalMenuPrices = { [X(11)]: 1 }; addMenuRow(X(12), '1');
    addCustomMenuRow(X(13), X(14), X(15));
    res.rows = host.querySelectorAll('img').length;
    await new Promise(r => setTimeout(r, 600));
    res.pwn = window.__pwn;
    return res;
  });
  console.log(JSON.stringify(out), JSON.stringify(errs));
  await b.close();
})();

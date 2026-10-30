/* Aturan bisnis reservasi Dolan Sawah -- SATU sumber kebenaran untuk perhitungan uang.
 *
 * Dipakai di browser (<script src="assets/reservasi-core.js">, objek global ReservasiCore)
 * dan di Node (require) untuk tes. Murni: tanpa Firebase, tanpa DOM.
 *
 * Aturan (jangan diubah tanpa konfirmasi pemilik):
 *  - orderTotal & harga menu tersimpan SEBELUM PPN. PPN 10% dihitung saat ditampilkan; jangan simpan total setelah PPN.
 *  - DP normal = 50% dari (menu + PPN).
 *  - Menu penanda "OTS" / "Custom" berharga Rp 0 (BUKAN item sungguhan). Dikenali dari NAMA, bukan dari harga nol.
 *    Reservasi OTS/Custom/tanpa menu -> DP minimal Rp 200.000 (naik ke 50% bila 50%-nya lebih besar; bukan selalu 200rb).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ReservasiCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var PPN_RATE = 0.10;
  var DP_RATE = 0.5;
  var DP_MINIMUM_OTS = 200000;

  function namaUpper(m) { return String((m && m.name) || "").trim().toUpperCase(); }
  function isOtsMenu(m) { return namaUpper(m) === "OTS"; }
  // Custom = menu master "Custom" ATAU item bebas yang membawa harga sendiri (dari Asisten AI/admin).
  function isCustomMenu(m) { return namaUpper(m) === "CUSTOM" || typeof (m && m.price) === "number"; }

  function hargaItem(m, menuPrices) {
    if (typeof m.price === "number") return m.price;
    return (menuPrices && menuPrices[m.name]) || 0;
  }

  // Total sebelum PPN. Urutan: orderTotal tersimpan -> jumlah item menus -> field lama `menu` (satu nama).
  function hitungSubtotal(r, menuPrices) {
    r = r || {};
    if (typeof r.orderTotal === "number") return r.orderTotal;
    if (Array.isArray(r.menus) && r.menus.length > 0) {
      return r.menus.reduce(function (s, m) { return s + hargaItem(m, menuPrices) * (parseInt(m.quantity, 10) || 0); }, 0);
    }
    if (r.menu) return (menuPrices && menuPrices[r.menu]) || 0;
    return 0;
  }

  function hitungPpn(subtotal) { return Math.round(subtotal * PPN_RATE); }
  function hitungGrandTotal(subtotal) { return subtotal + hitungPpn(subtotal); }

  // menus: [{name, quantity, price?}]. Opsi: { ots: true } memaksa aturan OTS (mis. tempat/via mengandung "OTS").
  function estimasiDp(menus, menuPrices, opsi) {
    menus = Array.isArray(menus) ? menus : [];
    var subtotal = hitungSubtotal({ menus: menus }, menuPrices);
    var total = hitungGrandTotal(subtotal);
    var minimal = !!(opsi && opsi.ots) || menus.length === 0 || menus.some(isOtsMenu) || menus.some(isCustomMenu);
    var normal = Math.round(total * DP_RATE);
    return { subtotal: subtotal, ppn: hitungPpn(subtotal), total: total, dpNormal: normal, dp: minimal ? Math.max(DP_MINIMUM_OTS, normal) : normal, minimal: minimal };
  }

  // Status pembayaran terhadap total SETELAH PPN.
  function statusBayar(r, total) {
    var dp = Math.max(0, +(r && r.dp) || 0);
    if ((r && r.lunas === true) || (total > 0 && dp >= total)) return { kode: "lunas", label: "LUNAS", dibayar: total > 0 ? Math.max(total, dp) : dp, sisa: 0 };
    if (dp > 0) return { kode: "dp", label: "DP DIBAYAR", dibayar: dp, sisa: total > 0 ? Math.max(0, total - dp) : null };
    return { kode: "belum", label: "BELUM ADA PEMBAYARAN", dibayar: 0, sisa: total > 0 ? total : null };
  }

  return {
    PPN_RATE: PPN_RATE, DP_RATE: DP_RATE, DP_MINIMUM_OTS: DP_MINIMUM_OTS,
    isOtsMenu: isOtsMenu, isCustomMenu: isCustomMenu,
    hitungSubtotal: hitungSubtotal, hitungPpn: hitungPpn, hitungGrandTotal: hitungGrandTotal,
    estimasiDp: estimasiDp, statusBayar: statusBayar
  };
});

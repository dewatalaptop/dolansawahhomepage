// Jalankan: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/reservasi-core.js");

const harga = { "Paket A": 50000, "Paket B": 25000, OTS: 0, Custom: 0 };

test("subtotal: orderTotal tersimpan menang, lalu item menus, lalu field menu lama", () => {
  assert.equal(C.hitungSubtotal({ orderTotal: 123, menus: [{ name: "Paket A", quantity: 9 }] }, harga), 123);
  assert.equal(C.hitungSubtotal({ menus: [{ name: "Paket A", quantity: 2 }, { name: "Paket B", quantity: "4" }] }, harga), 200000);
  assert.equal(C.hitungSubtotal({ menus: [{ name: "Entah", quantity: 3, price: 1000 }] }, harga), 3000); // harga menempel menang
  assert.equal(C.hitungSubtotal({ menu: "Paket B" }, harga), 25000);
  assert.equal(C.hitungSubtotal({}, harga), 0);
  assert.equal(C.hitungSubtotal(null, harga), 0);
});

test("PPN 10% dibulatkan; grand total = subtotal + PPN", () => {
  assert.equal(C.hitungPpn(500000), 50000);
  assert.equal(C.hitungPpn(12345), 1235); // 1234.5 -> 1235
  assert.equal(C.hitungGrandTotal(500000), 550000);
});

test("DP: 50% dari menu+PPN (kasus dasbor admin: 10 x 50.000 -> 275.000)", () => {
  const e = C.estimasiDp([{ name: "Paket A", quantity: 10 }], harga);
  assert.deepEqual([e.subtotal, e.ppn, e.total, e.dp, e.minimal], [500000, 50000, 550000, 275000, false]);
});

test("DP OTS/Custom/tanpa menu: minimal 200.000, tapi naik ke 50% bila lebih besar", () => {
  const ots = C.estimasiDp([{ name: "Paket A", quantity: 2 }, { name: "OTS", quantity: 1 }], harga);
  assert.deepEqual([ots.subtotal, ots.dp, ots.minimal], [100000, 200000, true]);
  const besar = C.estimasiDp([{ name: "Paket A", quantity: 100 }, { name: " ots ", quantity: 1 }], harga);
  assert.equal(besar.dp, 2750000); // bukan flat 200rb
  assert.equal(C.estimasiDp([], harga).dp, 200000);
  assert.equal(C.estimasiDp([{ name: "Paket A", quantity: 10 }], harga, { ots: true }).dp, 275000);
  assert.equal(C.estimasiDp([{ name: "Paket A", quantity: 1 }], harga, { ots: true }).dp, 200000);
});

test("penanda OTS/Custom dikenali dari NAMA, bukan harga nol", () => {
  // Menu sungguhan yang kebetulan gratis (harga 0) BUKAN penanda -> DP normal.
  const gratis = C.estimasiDp([{ name: "Air Mineral", quantity: 5 }], { "Air Mineral": 0 });
  assert.equal(gratis.minimal, false);
  assert.equal(gratis.dp, 0);
  // Item bebas dengan harga menempel = custom -> minimal 200rb.
  assert.equal(C.estimasiDp([{ name: "Request tamu", quantity: 1, price: 30000 }], harga).minimal, true);
  assert.equal(C.isCustomMenu({ name: "custom" }), true);
});

test("status bayar terhadap total setelah PPN", () => {
  assert.equal(C.statusBayar({ dp: 0 }, 550000).kode, "belum");
  const dp = C.statusBayar({ dp: 275000 }, 550000);
  assert.deepEqual([dp.kode, dp.dibayar, dp.sisa], ["dp", 275000, 275000]);
  assert.equal(C.statusBayar({ dp: 550000 }, 550000).kode, "lunas");
  assert.equal(C.statusBayar({ dp: 100, lunas: true }, 550000).kode, "lunas");
  assert.equal(C.statusBayar({ dp: 0 }, 0).sisa, null);
  assert.equal(C.statusBayar({ dp: -5 }, 100).kode, "belum");
});

// Paritas dengan rumus lama yang tersebar (dihafal di sini sebagai regresi).
test("paritas dengan rumus lama dasbor admin", () => {
  for (const [food, minimal] of [[0, true], [123456, false], [999999, true], [1000000, false]]) {
    const ppn = Math.round(food * 0.1);
    const normalDp = Math.round((food + ppn) * 0.5);
    const lama = minimal ? Math.max(200000, normalDp) : normalDp;
    const menus = food === 0 ? [] : [{ name: minimal ? "OTS" : "X", quantity: 1, }, ...(food ? [{ name: "Y", quantity: 1 }] : [])];
    const prices = { OTS: 0, X: 0, Y: food };
    assert.equal(C.estimasiDp(menus, prices).dp, lama, `food=${food}`);
  }
});

// ---------- pengingat ----------
const NOW = Date.parse("2026-11-02T03:00:00Z"); // 10:00 WIB, Senin 2 Nov 2026
const hp = "6281234567890";
const R = (id, date, extra = {}) => ({ id, date, jam: "10:00", nama: id, nomorHp: hp, tempat: "P", jumlah: 5, ...extra });

test("pengingat H-3 (jendela H-3..H-2), H-1 (H-1..hari H), sudah dikirim tidak muncul", () => {
  const out = C.daftarPengingat([
    R("a", "2026-11-05"), R("b", "2026-11-04"), R("c", "2026-11-06"),           // +3, +2, +4
    R("d", "2026-11-03"), R("e", "2026-11-02"), R("f", "2026-11-03", { reminders: { h1: 1 } }),
    R("g", "2026-11-05", { reminders: { h3: 1 } })
  ], [], NOW);
  assert.deepEqual(out.h3.map((r) => r.id), ["b", "a"]);
  assert.deepEqual(out.h1.map((r) => r.id), ["e", "d"]); // urut tanggal terdekat
});

test("pengingat: batal, tanpa nomor HP, atau tanpa tanggal diabaikan", () => {
  const out = C.daftarPengingat([
    R("a", "2026-11-05", { status: "batal" }), R("b", "2026-11-05", { nomorHp: "" }), R("c", ""), R("d", "2026-11-05", { status: "approved" })
  ], [], NOW);
  assert.deepEqual(out.h3.map((r) => r.id), ["d"]);
});

test("terima kasih: 3 jam setelah jam reservasi, maks 7 hari, belum terkirim", () => {
  const out = C.daftarPengingat([
    R("a", "2026-11-02", { jam: "06:00" }),                 // hari ini 06:00, sudah > 3 jam (sekarang 10:00)
    R("b", "2026-11-02", { jam: "08:30" }),                 // baru 1,5 jam -> belum
    R("c", "2026-10-30"),                                   // 3 hari lalu
    R("d", "2026-10-20"),                                   // terlalu lama
    R("e", "2026-10-31", { thankYouSent: true })            // sudah
  ], [], NOW);
  assert.deepEqual(out.terimaKasih.map((r) => r.id), ["c", "a"]);
});

test("permintaan hampir kedaluwarsa: sisa <= 12 jam, urut paling mendesak; lama tanpa expiresAt diabaikan", () => {
  const jam = (n) => NOW + n * 3600000;
  const out = C.daftarPengingat([], [
    { id: "x", status: "pending", expiresAt: { toMillis: () => jam(5) } },
    { id: "y", status: "pending", expiresAt: { seconds: (jam(1)) / 1000 } },
    { id: "z", status: "pending", expiresAt: { toMillis: () => jam(30) } },
    { id: "lama", status: "pending" },
    { id: "w", status: "ditolak", expiresAt: { toMillis: () => jam(1) } },
    { id: "habis", status: "pending", expiresAt: { toMillis: () => jam(-2) } }
  ], NOW);
  assert.deepEqual(out.kedaluwarsa.map((k) => k.req.id), ["habis", "y", "x"]);
  assert.equal(out.kedaluwarsa[0].sisaJam, 0);
});

test("nomorWa dan pesan pengingat memuat tautan halaman tamu", () => {
  assert.equal(C.nomorWa("0812-3456 7890"), "6281234567890");
  assert.equal(C.nomorWa("6281234567890"), "6281234567890");
  for (const jenis of ["h3", "h1", "thanks"]) {
    const t = C.pesanPengingat(jenis, R("abcdefghijklmnopqrst", "2026-11-05"));
    assert.ok(t.includes("Dolan Sawah"));
    if (jenis !== "thanks") assert.ok(t.includes("reservasi.html?id=abcdefghijklmnopqrst"));
  }
});

test("tanggal WIB: pukul 00:30 WIB sudah dianggap hari berikutnya", () => {
  assert.equal(C.ymdWib(Date.parse("2026-11-01T17:30:00Z")), "2026-11-02");
  assert.equal(C.tambahHari("2026-12-31", 1), "2027-01-01");
  assert.equal(C.selisihHari("2026-11-05", "2026-11-02"), 3);
});

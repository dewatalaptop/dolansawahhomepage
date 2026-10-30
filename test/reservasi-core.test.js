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
    R("d", "2026-11-03"), R("e", "2026-11-02", { jam: "15:00" }), R("f", "2026-11-03", { reminders: { h1: 1 } }),
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

test("H-1 pada hari H hanya bila jam reservasi belum lewat (regresi penguji)", () => {
  // NOW = 10:00 WIB 2 Nov. Hari H jam 06:00 sudah lewat -> bukan H-1; jam 15:00 masih -> H-1; besok selalu H-1.
  const out = C.daftarPengingat([
    R("lewat", "2026-11-02", { jam: "06:00" }),
    R("nanti", "2026-11-02", { jam: "15:00" }),
    R("besok", "2026-11-03", { jam: "06:00" }),
    R("tanpaJam", "2026-11-02", { jam: "" })
  ], [], NOW);
  assert.deepEqual(out.h1.map((r) => r.id).sort(), ["besok", "nanti", "tanpaJam"]);
  assert.deepEqual(out.terimaKasih.map((r) => r.id), ["lewat"]);
});

test("sisaKapasitas klien: durasi 2,5 jam + jeda 2 jam = jendela 270 menit", () => {
  assert.equal(C.JENDELA_BENTROK_MENIT, 270);
  const items = [{ tempat: "A", jumlah: 30, jam: "10:00" }, { tempat: "A", jumlah: 20, jam: "14:30" }, { tempat: "A", jumlah: 9, jam: "11:00", status: "ditolak" }];
  assert.equal(C.sisaKapasitas(items, "A", "10:00", 100).terpakai, 30);   // 14:30 tepat 270 -> tidak ikut
  assert.equal(C.sisaKapasitas(items, "A", "13:00", 100).terpakai, 50);
  assert.equal(C.sisaKapasitas(items, "A", "22:00", 100).sisa, 100);
  assert.equal(C.sisaKapasitas(items, "A", "17:00", 100, 1440).terpakai, 50);
});


// ---------- audit log ----------
test("audit: perubahan field operasional dicatat dari/ke; data pribadi hanya 'diubah' tanpa nilai", () => {
  const sebelum = { nama: "Budi", nomorHp: "0811111", date: "2026-12-05", jam: "10:00", tempat: "Pondok 1", jumlah: 10, dp: 100000, tipeDp: "QRIS", tambahan: "a", menus: [{ name: "Paket A", quantity: 10 }] };
  const sesudah = { ...sebelum, nama: "Budi S", nomorHp: "0822222", jam: "11:00", dp: 150000, tambahan: "b", menus: [{ name: "Paket A", quantity: 12 }] };
  const c = C.buatCatatanAudit("ubah", "reservations", "abc", sebelum, sesudah, "admin@x.id");
  assert.deepEqual(c.perubahan.jam, { dari: "10:00", ke: "11:00" });
  assert.deepEqual(c.perubahan.dp, { dari: 100000, ke: 150000 });
  assert.equal(c.perubahan.nama, "diubah");
  assert.equal(c.perubahan.nomorHp, "diubah");
  assert.equal(c.perubahan.tambahan, "diubah");
  assert.deepEqual(c.perubahan.menus, { dari: "Paket A x10", ke: "Paket A x12" });
  assert.equal(c.perubahan.tempat, undefined);                                   // tidak berubah -> tidak dicatat
  const json = JSON.stringify(c);
  assert.equal(json.includes("0811111") || json.includes("0822222"), false);     // nomor HP tidak pernah ada di log
  assert.deepEqual([c.aksi, c.koleksi, c.dokId, c.nama, c.tanggal, c.oleh], ["ubah", "reservations", "abc", "Budi S", "2026-12-05", "admin@x.id"]);
});

test("audit: tambah, hapus, setujui, tolak", () => {
  const r = { nama: "Siti", nomorHp: "0833", date: "2026-12-06", jam: "09:00", tempat: "Lantai 2", jumlah: 20, status: "pending" };
  const tambah = C.buatCatatanAudit("tambah", "reservations", "n1", null, r, "a@x");
  assert.deepEqual(tambah.perubahan.jumlah, { dari: null, ke: 20 });
  assert.equal(tambah.perubahan.nama, undefined);                                // tak ada 'sebelum' -> bukan 'diubah'
  const hapus = C.buatCatatanAudit("hapus", "reservations", "n1", r, null, "a@x");
  assert.deepEqual(hapus.perubahan.jumlah, { dari: 20, ke: null });
  assert.equal(hapus.nama, "Siti");
  const setujui = C.buatCatatanAudit("setujui", "reservations", "n2", r, { ...r, status: "approved", dp: 200000, tipeDp: "QRIS" }, "a@x");
  assert.deepEqual(setujui.perubahan.status, { dari: "pending", ke: "approved" });
  assert.deepEqual(setujui.perubahan.dp, { dari: null, ke: 200000 });
  const tolak = C.buatCatatanAudit("tolak", "reservation_requests", "q1", r, { ...r, status: "ditolak" }, "a@x");
  assert.deepEqual(tolak.perubahan.status, { dari: "pending", ke: "ditolak" });
  assert.equal(C.buatCatatanAudit("ubah", "reservations", "z", r, r, "a@x").perubahan.jumlah, undefined); // tanpa perubahan
});


// ---------- laporan ----------
test("laporan okupansi: per tempat untuk satu bulan, abaikan batal/bulan lain, jam tersibuk", () => {
  const kap = { "Pondok 1": 30, "Lantai 2": 65 };
  const rs = [
    { tempat: "Pondok 1", jumlah: 20, jam: "10:00", date: "2026-11-02" },
    { tempat: "Pondok 1", jumlah: "10", jam: "10:00", date: "2026-11-09" },
    { tempat: "Lantai 2", jumlah: 65, jam: "12:00", date: "2026-11-03" },
    { tempat: "Lantai 2", jumlah: 50, jam: "12:00", date: "2026-11-04", status: "batal" },
    { tempat: "Lantai 2", jumlah: 99, jam: "08:00", date: "2026-12-01" },
    { tempat: "Aula", jumlah: 7, jam: "10:00", date: "2026-11-20" }
  ];
  const o = C.laporanOkupansi(rs, kap, "2026-11");
  assert.equal(o.totalReservasi, 4);
  assert.equal(o.totalTamu, 102);
  assert.deepEqual(o.baris.map((b) => b.tempat), ["Lantai 2", "Pondok 1", "Aula"]);        // urut total tamu
  const p1 = o.baris.find((b) => b.tempat === "Pondok 1");
  assert.deepEqual([p1.reservasi, p1.tamu, p1.rataTamu, p1.kapasitas, p1.okupansiPersen], [2, 30, 15, 30, 50]);
  assert.equal(o.baris.find((b) => b.tempat === "Aula").okupansiPersen, null);              // kapasitas tak diketahui
  assert.deepEqual(o.jamTersibuk[0], { jam: "10:00", jumlah: 3 });
  assert.equal(C.laporanOkupansi([], {}, "2026-11").baris.length, 0);
});

test("laporan konversi: disetujui dikenali dari requestId; permintaan lama tanpa jejak tidak dihitung", () => {
  const reqs = [{ status: "pending" }, { status: "ditolak" }, { status: "kedaluwarsa" }, {}, { status: "Pending" }];
  const res = [{ requestId: "a" }, { requestId: "b" }, { nama: "reservasi lama tanpa requestId" }];
  const k = C.laporanKonversi(reqs, res);
  assert.deepEqual([k.menunggu, k.ditolak, k.kedaluwarsa, k.disetujui, k.total, k.persenDisetujui], [3, 1, 1, 2, 7, 29]);
  assert.equal(C.laporanKonversi([], []).persenDisetujui, null);
});

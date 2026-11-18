// Jalankan: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/reservasi-core.js");

const MENU = ["Custom", "OTS", "Paket A", "Paket B", "Paket Ingkung", "Sego Tumpeng", "Kids meal (Ayam asam manis)", "Paket Rantang", "Paket Kembulan 1", "Paket Kembulan 2"];
const det = (note, menus) => C.deteksiItemCatatan(note, MENU, menus || []);
const ringkas = (note, menus) => det(note, menus).map((i) => [i.possibleMatch || C.intiNama(i.mentionedText), i.suggestedQuantity]);

test("kasus nyata: 'sate ayam 30' terdeteksi sebagai item berharga custom", () => {
  assert.deepEqual(ringkas("sate ayam 30"), [["sate ayam", 30]]);
  assert.deepEqual(ringkas("Tambah sate ayam 30 tusuk ya"), [["sate ayam", 30]]);
  assert.deepEqual(ringkas("30 tusuk sate ayam"), [["sate ayam", 30]]);
});

test("beberapa item dalam satu catatan, berbagai pemisah dan satuan", () => {
  assert.deepEqual(ringkas("es teh x5, kerupuk 20pcs\nkopi 3 gelas dan jus jeruk 4 botol"),
    [["es teh", 5], ["kerupuk", 20], ["kopi", 3], ["jus jeruk", 4]]);
});

test("nama menu master dikenali walau ditulis sebagian", () => {
  assert.deepEqual(ringkas("tumpeng 2"), [["Sego Tumpeng", 2]]);
  assert.deepEqual(ringkas("tambah paket a 10 porsi"), [["Paket A", 10]]);
  assert.deepEqual(ringkas("paket 5"), [["paket", 5]]); // ambigu: tidak ditebak ke salah satu paket
});

test("bukan item: orang, jam, uang, tanggal, meja, ulang tahun, nomor HP", () => {
  for (const n of ["30 orang", "datang jam 10.30", "dp 200rb", "DP Rp 500.000", "tgl 12", "meja 3", "ulang tahun ke 17",
    "hp 08123456789", "rombongan 40 pax", "tolong tidak pedas", "dekat pintu masuk", "pukul 9 pagi", "anak 5"]) {
    assert.deepEqual(det(n), [], n);
  }
});

test("item yang sudah ada di pesanan tidak ditanyakan lagi", () => {
  assert.deepEqual(det("sate ayam 30", [{ name: "sate ayam 30", quantity: 30, price: 3000 }]), []);
  assert.deepEqual(det("sate ayam 30", [{ name: "Sate Ayam", quantity: 30, price: 3000 }]), []);
  assert.deepEqual(det("tumpeng 2", [{ name: "Sego Tumpeng", quantity: 2 }]), []);
  assert.equal(det("sate ayam 30, es teh 5", [{ name: "Sate Ayam", quantity: 30, price: 3000 }]).length, 1);
});

test("nama rapi untuk item custom", () => {
  assert.equal(C.namaItemCatatan("Tambah sate ayam 30 tusuk ya"), "Sate ayam");
  assert.equal(C.namaItemCatatan("kerupuk 20pcs"), "Kerupuk");
  assert.equal(C.namaItemCatatan("20"), "20");
});

test("gabung hasil AI + aturan tanpa dobel; data AI diutamakan, jumlah diisi dari aturan", () => {
  const ai = [{ mentionedText: "sate ayam", possibleMatch: null, suggestedQuantity: null, note: "AI" },
    { mentionedText: "kerupuk", possibleMatch: null, suggestedQuantity: null, note: "AI" }];
  const g = C.gabungItemCatatan(ai, det("sate ayam 30, es teh 5"));
  assert.equal(g.length, 3);
  assert.equal(g[0].note, "AI");
  assert.equal(g[0].suggestedQuantity, 30);
  assert.equal(C.intiNama(g[2].mentionedText), "es teh");
  assert.deepEqual(C.gabungItemCatatan(det("tumpeng 2"), [{ mentionedText: "tumpeng", possibleMatch: "Sego Tumpeng", suggestedQuantity: 2 }]).length, 1);
});

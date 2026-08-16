/**
 * Code.gs
 * -----------------------------------------------------
 * Google Apps Script ini berfungsi sebagai WEBHOOK penerima
 * data xAPI dari H5P (dikirim oleh h5p-xapi-tracker.js)
 * dan menyimpannya sebagai baris baru di Google Sheets.
 *
 * CARA DEPLOY:
 * 1. Buka Google Sheets tujuan -> Extensions/Ekstensi > Apps Script.
 * 2. Hapus isi default, tempel (paste) seluruh kode ini.
 * 3. Klik Deploy > New deployment (Deploy Baru).
 *    - Pilih tipe: "Web app" / "Aplikasi web"
 *    - Execute as: "Me" (akun Anda)
 *    - Who has access: "Anyone" (Siapa saja)
 * 4. Klik Deploy, salin URL Web App yang muncul
 *    (bentuknya: https://script.google.com/macros/s/XXXX/exec)
 * 5. Tempelkan URL tersebut ke variabel WEBHOOK_URL
 *    di file h5p-xapi-tracker.js.
 * 6. Jika Anda mengubah kode ini nanti, buat "New deployment"
 *    lagi (atau Manage deployments > Edit > New version) agar
 *    perubahan berlaku pada URL Web App.
 * -----------------------------------------------------
 */
 
var SHEET_NAME = "xAPI_Log";
 
function doPost(e) {
  try {
    // >>> LOG DEBUG: catat apa yang sebenarnya diterima <<<
    Logger.log("e ada: " + (e !== undefined));
    Logger.log("e.postData ada: " + (e && e.postData !== undefined));
    Logger.log("Isi mentah: " + (e && e.postData && e.postData.contents));
 
    var sheet = getOrCreateSheet_();
    var data = JSON.parse(e.postData.contents);
 
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.actorName || "",
      data.actorClass || "",
      data.actorEmail || "",
      data.verb || "",
      data.objectName || "",
      data.score || "",
      data.maxScore || "",
      data.scaled || "",
      data.success !== undefined ? data.success : "",
      data.completion !== undefined ? data.completion : "",
      data.duration || "",
      data.rawStatement || "",
    ]);
 
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // >>> LOG DEBUG: catat pesan error persis di sini <<<
    Logger.log("ERROR TERJADI: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
 
function doGet(e) {
  return ContentService.createTextOutput(
    "Webhook xAPI H5P aktif. Gunakan metode POST untuk mengirim data."
  );
}
 
function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
 
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
 
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Nama Peserta",
      "Kelas",
      "Email",
      "Verb (Aksi)",
      "Objek/Aktivitas",
      "Skor",
      "Skor Maksimal",
      "Scaled (0-1)",
      "Sukses",
      "Selesai",
      "Durasi",
      "Raw Statement (JSON)",
    ]);
    sheet.setFrozenRows(1);
  }
 
  return sheet;
}
 

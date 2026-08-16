/**
 * h5p-xapi-tracker.js
 * -----------------------------------------------------
 * Script ini:
 * 1. Menampilkan form "Nama Peserta" sebelum konten H5P bisa diakses.
 * 2. Menangkap event xAPI dari H5P (H5P.externalDispatcher).
 * 3. Mengirim data (termasuk nama peserta) ke Google Apps Script
 *    Web App (webhook) yang menyimpannya ke Google Sheets.
 *
 * CARA PAKAI:
 * 1. Ganti WEBHOOK_URL di bawah dengan URL Web App Apps Script Anda
 *    (lihat file Code.gs untuk cara deploy-nya).
 * 2. Sisipkan file ini ke halaman HTML tempat H5P di-embed, contoh:
 *    <script src="h5p-xapi-tracker.js"></script>
 *    Taruh SETELAH tag <script> yang memuat H5P Standalone / library H5P.
 * -----------------------------------------------------
 */

(function () {
  // >>> GANTI dengan URL Web App Google Apps Script Anda <<<
  const WEBHOOK_URL = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec";

  // Key penyimpanan nama & kelas peserta di browser (per tab/sesi)
  const STORAGE_KEY_NAME = "h5p_participant_name";
  const STORAGE_KEY_CLASS = "h5p_participant_class";

  // ============ 1. GATE / FORM NAMA & KELAS PESERTA ============

  function getParticipantName() {
    return sessionStorage.getItem(STORAGE_KEY_NAME) || "";
  }

  function getParticipantClass() {
    return sessionStorage.getItem(STORAGE_KEY_CLASS) || "";
  }

  function setParticipantData(name, className) {
    sessionStorage.setItem(STORAGE_KEY_NAME, name);
    sessionStorage.setItem(STORAGE_KEY_CLASS, className);
  }

  function showNameGate(onSubmit) {
    // Cegah H5P berinteraksi sebelum nama diisi
    const overlay = document.createElement("div");
    overlay.id = "xapi-name-gate";
    overlay.style.cssText = [
      "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
      "background:rgba(15,23,42,0.92)", "display:flex",
      "align-items:center", "justify-content:center",
      "z-index:999999", "font-family:sans-serif", "padding:16px",
      "box-sizing:border-box",
    ].join(";");

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px 24px;
                  max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.3);
                  text-align:center;">
        <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">
          Sebelum mulai belajar
        </h2>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          Masukkan nama lengkap Anda agar hasil belajar bisa direkam.
        </p>
        <input id="xapi-name-input" type="text" placeholder="Nama lengkap"
               style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;
                      border-radius:8px;font-size:14px;box-sizing:border-box;
                      margin-bottom:10px;" />
        <input id="xapi-class-input" type="text" placeholder="Kelas (contoh: XI IPA 2)"
               style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;
                      border-radius:8px;font-size:14px;box-sizing:border-box;
                      margin-bottom:12px;" />
        <button id="xapi-name-submit"
                style="width:100%;padding:10px 12px;border:none;border-radius:8px;
                       background:#2563eb;color:#fff;font-size:14px;
                       font-weight:600;cursor:pointer;">
          Mulai Belajar
        </button>
        <p id="xapi-name-error" style="color:#dc2626;font-size:12px;
                    margin:8px 0 0;display:none;">
          Nama dan kelas tidak boleh kosong.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector("#xapi-name-input");
    const classInput = overlay.querySelector("#xapi-class-input");
    const btn = overlay.querySelector("#xapi-name-submit");
    const error = overlay.querySelector("#xapi-name-error");

    function submit() {
      const name = nameInput.value.trim();
      const className = classInput.value.trim();
      if (!name || !className) {
        error.style.display = "block";
        return;
      }
      setParticipantData(name, className);
      overlay.remove();
      onSubmit(name, className);
    }

    btn.addEventListener("click", submit);
    [nameInput, classInput].forEach(function (el) {
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submit();
      });
    });
    nameInput.focus();
  }

  // ============ 2. KIRIM DATA KE GOOGLE SHEETS ============

  function sendToSheet(payload) {
    fetch(WEBHOOK_URL, {
      method: "POST",
      // Apps Script tidak mendukung preflight CORS standar,
      // jadi mode "no-cors" dipakai agar request tidak diblokir browser.
      // Konsekuensinya: kita tidak bisa membaca response-nya di sisi client.
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(function (err) {
      console.error("[xAPI Tracker] Gagal mengirim data:", err);
    });
  }

  // Ambil field penting dari xAPI statement, gabungkan dengan nama & kelas peserta
  function extractXApiData(statement, participantName, participantClass) {
    const actor = statement.actor || {};
    const verb = statement.verb || {};
    const object = statement.object || {};
    const result = statement.result || {};
    const objDef = object.definition || {};

    return {
      timestamp: new Date().toISOString(),
      // Nama & kelas peserta yang diisi manual di form JADI SUMBER UTAMA,
      // fallback ke actor.name dari statement xAPI jika ada.
      actorName: participantName || actor.name || "",
      actorClass: participantClass || "",
      actorEmail: (actor.mbox || "").replace("mailto:", ""),
      verb:
        (verb.display && (verb.display["en-US"] || verb.display["en"])) ||
        verb.id ||
        "",
      objectName:
        (objDef.name && (objDef.name["en-US"] || objDef.name["en"])) ||
        object.id ||
        "",
      score: result.score ? result.score.raw : "",
      maxScore: result.score ? result.score.max : "",
      scaled: result.score ? result.score.scaled : "",
      success: result.success !== undefined ? result.success : "",
      completion: result.completion !== undefined ? result.completion : "",
      duration: result.duration || "",
      rawStatement: JSON.stringify(statement),
    };
  }

  // ============ 3. TANGKAP EVENT xAPI DARI H5P ============

  function initTracker(participantName, participantClass) {
    if (typeof H5P === "undefined" || !H5P.externalDispatcher) {
      // H5P mungkin belum termuat, coba lagi sebentar
      setTimeout(function () { initTracker(participantName, participantClass); }, 500);
      return;
    }

    H5P.externalDispatcher.on("xAPI", function (event) {
      const statement = event.data && event.data.statement;
      if (!statement) return;

      // Opsional: hanya kirim statement penting.
      // Kosongkan array ini (importantVerbs = []) jika ingin
      // menangkap SEMUA event xAPI (termasuk "interacted", "attempted", dll).
      const verbId = statement.verb && statement.verb.id;
      const importantVerbs = [
        "http://adlnet.gov/expapi/verbs/answered",
        "http://adlnet.gov/expapi/verbs/completed",
        "http://adlnet.gov/expapi/verbs/mastered",
        "http://adlnet.gov/expapi/verbs/passed",
        "http://adlnet.gov/expapi/verbs/failed",
      ];
      if (importantVerbs.length && !importantVerbs.includes(verbId)) {
        return;
      }

      const payload = extractXApiData(statement, getParticipantName(), getParticipantClass());
      console.log("[xAPI Tracker] Statement ditangkap:", payload);
      sendToSheet(payload);
    });

    console.log("[xAPI Tracker] Aktif untuk peserta:", participantName, "kelas:", participantClass);
  }

  // ============ 4. START ============

  function start() {
    const existingName = getParticipantName();
    const existingClass = getParticipantClass();
    if (existingName && existingClass) {
      initTracker(existingName, existingClass);
    } else {
      showNameGate(function (name, className) {
        initTracker(name, className);
      });
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();

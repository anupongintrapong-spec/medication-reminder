/* ===== CONFIG ===== */
const ONESIGNAL_APP_ID = "66881c4f-6152-4f6a-8c99-ffc73b8e8978"; 
const APPS_SCRIPT_WEBAPP_URL = "https://project.anupongintrapong.workers.dev/";

/* ===== OneSignal init ===== */
window.OneSignal = window.OneSignal || [];
OneSignal.push(function () {
  OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: true },
  });
});

/* ===== Helper ===== */
function getOrCreateUserId() {
  const key = "med_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

async function tagExternalUserId() {
  const userId = getOrCreateUserId();
  OneSignal.push(function () {
    OneSignal.setExternalUserId(userId);
    console.log("🔗 ExternalUserId ถูกตั้งค่า:", userId);
  });
}

function resetExternalUserId() {
  OneSignal.push(function () {
    OneSignal.removeExternalUserId(function() {
      console.log("🧹 ExternalUserId ถูกลบออกแล้ว");
      alert("ExternalUserId ถูกรีเซ็ตเรียบร้อยแล้ว");
    });
  });
}

function toLocalDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localDatetimeToISO(datetimeLocal) {
  const d = new Date(datetimeLocal);
  return d.toISOString();
}

/* ===== UI elements ===== */
const enableBtn = document.getElementById("enablePushBtn");
const resetBtn = document.getElementById("resetPushBtn"); // เพิ่มปุ่ม reset
const statusSpan = document.getElementById("notifStatus");
const saveMsg = document.getElementById("saveMsg");
const timesWrap = document.getElementById("timesWrap");
const addTimeBtn = document.getElementById("addTimeBtn");

/* ===== Status ===== */
function setStatus(text) {
  statusSpan.textContent = text;
}

OneSignal.push(function () {
  OneSignal.isPushNotificationsEnabled(function (enabled) {
    if (enabled) {
      setStatus("เปิดใช้งานแล้ว");
    } else {
      setStatus("ยังไม่เปิดใช้งาน");
      console.warn("❌ Push ยังไม่ได้เปิดใช้งาน");
    }
  });
});

enableBtn.addEventListener("click", async () => {
  try {
    await OneSignal.registerForPushNotifications();
    await tagExternalUserId();
    setStatus("เปิดใช้งานแล้ว");
  } catch (e) {
    console.error("⚠️ เปิด Push ไม่สำเร็จ:", e);
    setStatus("อนุญาตไม่สำเร็จ/ถูกบล็อก");
  }
});

resetBtn.addEventListener("click", resetExternalUserId);

/* ===== Render time row ===== */
function renderTimeRow(defaultMinutesFromNow = 1) {
  const wrap = document.createElement("div");
  wrap.className = "flex items-center gap-2";

  const input = document.createElement("input");
  input.type = "datetime-local";
  input.required = true;
  input.className = "border rounded-lg px-3 py-2";

  const dt = new Date(Date.now() + defaultMinutesFromNow * 60 * 1000);
  input.value = toLocalDatetimeValue(dt);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "ลบ";
  removeBtn.className = "text-sm text-red-600 underline";
  removeBtn.addEventListener("click", () => wrap.remove());

  wrap.appendChild(input);
  wrap.appendChild(removeBtn);
  timesWrap.appendChild(wrap);
}

renderTimeRow(1);
addTimeBtn.addEventListener("click", () => renderTimeRow(60));

/* ===== Form submit ===== */
const form = document.getElementById("medForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveMsg.textContent = "กำลังบันทึก…";

  const drugName = document.getElementById("drugName").value.trim();
  const dosage = document.getElementById("dosage").value.trim();
  const userId = getOrCreateUserId();

  const times = Array.from(timesWrap.querySelectorAll('input[type="datetime-local"]'))
    .map((el) => el.value)
    .filter(Boolean);

  if (!times.length) {
    saveMsg.textContent = "กรุณาเพิ่มเวลาอย่างน้อย 1 รายการ";
    return;
  }

  const payloads = times.map((t) => {
    const iso = localDatetimeToISO(t);
    const title = "ถึงเวลาทานยาแล้ว";
    const body = dosage ? `${drugName} — ${dosage}` : drugName;
    return { userId, drugName, dosage, timeISO: iso, title, body };
  });

  try {
    const res = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: payloads }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data?.ok) {
      saveMsg.textContent = `บันทึกสำเร็จ ${payloads.length} รายการ (แจ้งเตือนถูกตั้งเวลาแล้ว)`;
      await tagExternalUserId();
      form.reset();
      timesWrap.innerHTML = "";
      renderTimeRow(60);
    } else {
      saveMsg.textContent = "บันทึกไม่สำเร็จ (เซิร์ฟเวอร์ไม่ตอบ ok)";
    }
  } catch (err) {
    console.error("❌ Error fetch:", err);
    saveMsg.textContent = "บันทึกไม่สำเร็จ (เครือข่าย/CORS)";
  }
});

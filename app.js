/* ===== CONFIG ===== */
const APPS_SCRIPT_WEBAPP_URL = "https://medication-reminder.anupongintrapong.workers.dev/";

/* ===== Helper ===== */
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
const saveMsg = document.getElementById("saveMsg");
const timesWrap = document.getElementById("timesWrap");
const addTimeBtn = document.getElementById("addTimeBtn");

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

// เริ่มต้นด้วยแถวเวลาเริ่มต้น
renderTimeRow(1);
addTimeBtn.addEventListener("click", () => renderTimeRow(60));

/* ===== Form submit ===== */
const form = document.getElementById("medForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveMsg.textContent = "กำลังบันทึก…";

  const drugName = document.getElementById("drugName").value.trim();
  const dosage = document.getElementById("dosage").value.trim();

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
    return { drugName, dosage, timeISO: iso, title, body };
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
      saveMsg.textContent = `✅ บันทึกสำเร็จ ${payloads.length} รายการ (LINE แจ้งเตือนถูกตั้งเวลาแล้ว)`;
      form.reset();
      timesWrap.innerHTML = "";
      renderTimeRow(60);
    } else {
      saveMsg.textContent = "❌ บันทึกไม่สำเร็จ (เซิร์ฟเวอร์ไม่ตอบ ok)";
    }
  } catch (err) {
    console.error("❌ Error fetch:", err);
    saveMsg.textContent = "❌ บันทึกไม่สำเร็จ (เครือข่าย/CORS)";
  }
});

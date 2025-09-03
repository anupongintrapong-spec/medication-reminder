/* ===== CONFIG ===== */
const APPS_SCRIPT_WEBAPP_URL = "https://medication-reminder.anupongintrapong.workers.dev/form";

/* ===== Helper ===== */
function toLocalDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDatetimeToISO(datetimeLocal) {
  return new Date(datetimeLocal).toISOString();
}

/* ===== UI ===== */
const saveMsg = document.getElementById("saveMsg");
const timesWrap = document.getElementById("timesWrap");
const addTimeBtn = document.getElementById("addTimeBtn");

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

/* ===== Submit ===== */
document.getElementById("medForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  saveMsg.textContent = "กำลังบันทึก…";

  const drugName = document.getElementById("drugName").value.trim();
  const dosage = document.getElementById("dosage").value.trim();
  const email = document.getElementById("email").value.trim();
  const days = parseInt(document.getElementById("days").value, 10);

  const times = Array.from(timesWrap.querySelectorAll('input[type="datetime-local"]'))
    .map((el) => el.value)
    .filter(Boolean);

  if (!times.length) {
    saveMsg.textContent = "กรุณาเพิ่มเวลาอย่างน้อย 1 รายการ";
    return;
  }

  const payloads = [];
  times.forEach((t) => {
    const baseDate = new Date(t);
    for (let i = 0; i < days; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + i);
      payloads.push({
        drugName,
        dosage,
        timeISO: nextDate.toISOString(),
        title: "ถึงเวลาทานยาแล้ว",
        body: dosage ? `${drugName} — ${dosage}` : drugName,
        email,
      });
    }
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
      saveMsg.textContent = `✅ บันทึกสำเร็จ ${payloads.length} รายการ (แจ้งเตือนถูกตั้งเวลาแล้ว)`;
      e.target.reset();
      timesWrap.innerHTML = "";
      renderTimeRow(60);
    } else {
      saveMsg.textContent = "❌ บันทึกไม่สำเร็จ (server error)";
    }
  } catch (err) {
    console.error(err);
    saveMsg.textContent = "❌ บันทึกไม่สำเร็จ (network error)";
  }
});

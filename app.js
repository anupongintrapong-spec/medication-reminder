/* ===== CONFIG ===== */
const APPS_SCRIPT_WEBAPP_URL =
  "https://medication-reminder.anupongintrapong.workers.dev/form";

document.addEventListener("DOMContentLoaded", () => {
  /* ===== Helpers ===== */
  const $ = (sel) => document.querySelector(sel);

  // แปลง Date -> ค่า value ของ input type="datetime-local" (คำนวณ timezone ให้ตรง)
  function toLocalDatetimeValue(d) {
    const offMin = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offMin * 60000);
    return local.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
  }

  // รับค่า datetime-local -> ISO string
  function localDatetimeToISO(datetimeLocal) {
    const d = new Date(datetimeLocal);
    // ตัดวินาที/มิลลิวินาทีให้สวย (ถ้าอยาก)
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  function setMsg(msg, ok = true) {
    const el = $("#saveMsg");
    if (!el) return;
    el.textContent = msg;
    el.className =
      "text-sm " + (ok ? "text-emerald-700" : "text-rose-700");
  }

  /* ===== UI refs ===== */
  const form = $("#medForm");
  const timesWrap = $("#timesWrap");
  const addTimeBtn = $("#addTimeBtn");

  /* ===== Render time row ===== */
  function renderTimeRow(defaultMinutesFromNow = 1) {
    if (!timesWrap) return;

    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2";

    const input = document.createElement("input");
    input.type = "datetime-local";
    input.required = true;
    input.className =
      "border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500";

    const dt = new Date(Date.now() + defaultMinutesFromNow * 60 * 1000);
    input.value = toLocalDatetimeValue(dt);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "ลบ";
    removeBtn.className = "text-sm text-rose-600 underline";
    removeBtn.addEventListener("click", () => wrap.remove());

    wrap.append(input, removeBtn);
    timesWrap.appendChild(wrap);
  }

  // แถวเริ่มต้น
  if (timesWrap && !timesWrap.querySelector('input[type="datetime-local"]')) {
    renderTimeRow(1);
  }

  // ปุ่ม + เพิ่มเวลา
  if (addTimeBtn) {
    addTimeBtn.addEventListener("click", () => renderTimeRow(60));
  }

  /* ===== Submit ===== */
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = form.querySelector('button[type="submit"]');
      btn && (btn.disabled = true);

      setMsg("กำลังบันทึก…", true);

      const drugName = $("#drugName")?.value.trim() || "";
      const dosage = $("#dosage")?.value.trim() || "";
      const email = $("#email")?.value.trim() || "";
      let days = parseInt($("#days")?.value, 10);

      if (!drugName) {
        setMsg("กรุณากรอกชื่อยา", false);
        btn && (btn.disabled = false);
        return;
      }
      if (!email) {
        setMsg("กรุณากรอกอีเมลผู้รับการแจ้งเตือน", false);
        btn && (btn.disabled = false);
        return;
      }
      if (isNaN(days) || days < 1) days = 1;
      if (days > 365) days = 365; // กันค่ามากผิดปกติ

      const times = Array.from(
        timesWrap.querySelectorAll('input[type="datetime-local"]')
      )
        .map((el) => el.value)
        .filter(Boolean);

      if (!times.length) {
        setMsg("กรุณาเพิ่มเวลาอย่างน้อย 1 รายการ", false);
        btn && (btn.disabled = false);
        return;
      }

      // สร้าง payload (คูณตามจำนวนวัน)
      const payloads = [];
      times.forEach((t) => {
        // ตรวจว่าค่าเป็นอนาคต
        const baseLocal = new Date(t);
        if (isNaN(baseLocal.getTime())) return;

        for (let i = 0; i < days; i++) {
          const next = new Date(baseLocal);
          next.setDate(next.getDate() + i);
          payloads.push({
            drugName,
            dosage,
            timeISO: next.toISOString(),
            title: "ถึงเวลาทานยาแล้ว",
            body:
              dosage && dosage.trim().length
                ? `${drugName} — ${dosage}`
                : drugName,
            email,
          });
        }
      });

      if (!payloads.length) {
        setMsg("เวลาไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", false);
        btn && (btn.disabled = false);
        return;
      }

      try {
        const res = await fetch(APPS_SCRIPT_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: payloads }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data?.ok) {
          setMsg(
            `✅ บันทึกสำเร็จ ${payloads.length} รายการ (แจ้งเตือนถูกตั้งเวลาแล้ว)`,
            true
          );
          form.reset();
          timesWrap.innerHTML = "";
          renderTimeRow(60);
        } else {
          setMsg("❌ บันทึกไม่สำเร็จ (server error)", false);
        }
      } catch (err) {
        console.error(err);
        setMsg("❌ บันทึกไม่สำเร็จ (network/CORS)", false);
      } finally {
        btn && (btn.disabled = false);
      }
    });
  }
});

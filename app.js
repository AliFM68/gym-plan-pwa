const $ = sel => document.querySelector(sel);
const views = {
  today: $("#view-today"),
  sessions: $("#view-sessions"),
  progress: $("#view-progress"),
  warmup: $("#view-warmup"),
  settings: $("#view-settings"),
};
const tabs = document.querySelectorAll(".tab");
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  const tab = t.dataset.tab;
  Object.keys(views).forEach(k => views[k].style.display = (k===tab?"block":"none"));
  if (tab === "progress") renderProgress();
  if (tab === "settings") renderSettings();
  if (tab === "warmup") renderWarmupList();
}));

let data = { sessions: [], warmup: [] };
let done = JSON.parse(localStorage.getItem("done") || "{}");
let points = parseInt(localStorage.getItem("points") || "0", 10);
let streak = parseInt(localStorage.getItem("streak") || "0", 10);
let lastDay = localStorage.getItem("lastDay") || "";
let notes = JSON.parse(localStorage.getItem("notes") || "{}");
let theme = localStorage.getItem("theme") || "dark";
let history = JSON.parse(localStorage.getItem("history") || "{}");
let dayMap = JSON.parse(localStorage.getItem("dayMap") || "{}");
let wuSeconds = parseInt(localStorage.getItem("wuSeconds") || "30", 10);

if (Object.keys(dayMap).length === 0) {
  // Mon/Tue -> S1, Wed/Thu -> S2, Fri–Sun -> Home
  dayMap = {"1":0,"2":0,"3":1,"4":1,"5":2,"6":2,"0":2}; // 0=Sun..6=Sat
}

function save() {
  localStorage.setItem("done", JSON.stringify(done));
  localStorage.setItem("points", points);
  localStorage.setItem("streak", streak);
  localStorage.setItem("lastDay", lastDay);
  localStorage.setItem("notes", JSON.stringify(notes));
  localStorage.setItem("theme", theme);
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.setItem("dayMap", JSON.stringify(dayMap));
  localStorage.setItem("wuSeconds", String(wuSeconds));
}

function applyTheme() {
  if (theme === "light") { document.documentElement.classList.add("light"); $("#themeToggle").checked = true; }
  else { document.documentElement.classList.remove("light"); $("#themeToggle").checked = false; }
}
$("#themeToggle").addEventListener("change", e => { theme = e.target.checked ? "light" : "dark"; applyTheme(); save(); });
applyTheme();

function uid() { return Math.random().toString(36).slice(2); }

async function load() {
  const res = await fetch("plan.json");
  data = await res.json();
  data.sessions.forEach(s => s.items.forEach(ex => { ex.id = ex.id || uid(); }));
  renderToday(); renderSessions(); renderProgress(); renderWarmupList();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }
}
load();

function sessionIndexForDay(d) {
  const idx = dayMap[String(d)];
  return idx === undefined ? 2 : idx;
}
function daySessionIndex() {
  const d = new Date().getDay();
  return sessionIndexForDay(d);
}

function renderToday() {
  const i = daySessionIndex(); const s = data.sessions[i];
  $("#todaySub").textContent = `${s.title} • ${s.location}`;
  views.today.innerHTML = sessionHTML(s, true); attachHandlers();
}

function renderSessions() {
  views.sessions.innerHTML = data.sessions.map(s => `
    <div class="card">
      <div class="row"><div class="title">${s.title}</div><div class="badge">${s.location}</div></div>
      ${sessionTable(s)}
    </div>`).join("");
  attachHandlers();
}

function sessionHTML(s, showStart) {
  return `<div class="card">
    <div class="row"><div class="title">${s.title}</div><div class="badge">${s.location}</div></div>
    ${sessionTable(s)}
    ${showStart ? `<div class="footer"><a class="button" href="#" data-complete="${s.title}">Mark Session Complete (+50)</a></div>` : ""}
  </div>`;
}

function sessionTable(s) {
  return s.items.map(ex => `
    <div>
      <div class="row">
        <div class="ex-title">${ex.block} • ${ex.name}</div>
        <div class="check"><input type="checkbox" ${done[ex.id]?"checked":""} data-ex="${ex.id}"></div>
      </div>
      <div class="grid">
        <div><b>${ex.setsReps}</b></div>
        <div class="ex-tips">${ex.tips}</div>
        <div><a href="${ex.video}" target="_blank">Guide Video</a></div>
      </div>
      <div class="ex-desc">${ex.desc}</div>
      <div class="label">Notes</div>
      <textarea class="notes" data-notes="${ex.id}" rows="2" placeholder="Weight, reps, pain-free range, cues..."></textarea>

      <div class="label">Add set to history (kg × reps)</div>
      <div class="inputs">
        <input type="number" inputmode="decimal" placeholder="kg" step="0.5" min="0" data-kg="${ex.id}">
        <input type="number" inputmode="numeric" placeholder="reps" step="1" min="1" data-reps="${ex.id}">
        <a href="#" class="button" data-addset="${ex.id}">Add Set</a>
      </div>

      <table class="table" data-table="${ex.id}"><thead><tr><th>Date</th><th>kg</th><th>Reps</th></tr></thead><tbody></tbody></table>
      <hr>
    </div>`).join("");
}

function attachHandlers() {
  document.querySelectorAll("textarea[data-notes]").forEach(t => {
    const id = t.dataset.notes; t.value = notes[id] || "";
    t.addEventListener("input", e => { notes[id] = e.target.value; save(); });
  });
  document.querySelectorAll("input[type=checkbox][data-ex]").forEach(cb => {
    cb.addEventListener("change", e => {
      const id = e.target.dataset.ex;
      if (e.target.checked) { if (!done[id]) { points += 10; } done[id] = true; }
      else { delete done[id]; }
      save(); renderProgress();
    });
  });
  document.querySelectorAll("[data-addset]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const id = btn.dataset.addset;
      const kgEl = document.querySelector(`[data-kg="${id}"]`);
      const repsEl = document.querySelector(`[data-reps="${id}"]`);
      const kg = parseFloat(kgEl.value); const reps = parseInt(repsEl.value || "0", 10);
      if (isNaN(kg) || isNaN(reps) || reps <= 0) { alert("Enter kg and reps."); return; }
      const entry = { date: new Date().toLocaleDateString(), kg, reps };
      if (!history[id]) history[id] = [];
      history[id].unshift(entry);
      history[id] = history[id].slice(0, 10);
      save();
      renderHistoryTable(id);
      kgEl.value = ""; repsEl.value = "";
    });
  });
  document.querySelectorAll("table[data-table]").forEach(tbl => {
    renderHistoryTable(tbl.dataset.table);
  });
  document.querySelectorAll("[data-complete]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault(); points += 50;
      const today = new Date().toDateString();
      if (!lastDay) { streak = 1; }
      else {
        const diff = Math.round((new Date(today) - new Date(lastDay)) / 86400000);
        if (diff === 1) { streak += 1; } else if (diff > 1) { streak = 1; }
      }
      lastDay = today; save(); renderProgress(); alert("Session completed! +50 points, streak updated.");
    });
  });
}

function renderHistoryTable(exId) {
  const tbody = document.querySelector(`table[data-table="${exId}"] tbody`);
  if (!tbody) return;
  const rows = (history[exId] || []).map(r => `<tr><td>${r.date}</td><td>${r.kg}</td><td>${r.reps}</td></tr>`).join("");
  tbody.innerHTML = rows || `<tr><td colspan="3" style="color:var(--muted)">No sets yet</td></tr>`;
}

function renderProgress() {
  const ach = [];
  if (points >= 100) ach.push("Getting Started (100 pts)");
  if (points >= 300) ach.push("Consistency (300 pts)");
  if (streak >= 3) ach.push("3-Day Streak");
  if (streak >= 7) ach.push("7-Day Streak");
  views.progress.innerHTML = `
    <div class="points">
      <div class="card"><div class="title">${points}</div><div class="small">Points</div></div>
      <div class="card"><div class="title">${streak}d</div><div class="small">Streak</div></div>
    </div>
    <div class="card">
      <div class="title">Achievements</div>
      <div class="small">${ach.length?ach.map(a=>`• ${a}`).join('<br>'):'No achievements yet. Complete a session to start earning badges!'}</div>
    </div>`;
}

/* ---------- Warm-Up Tab ---------- */
function renderWarmupList() {
  const wu = data.warmup || [];
  views.warmup.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="title">Warm-Up (no band)</div>
        <div class="small">Timer: ${wuSeconds}s • <a href="#" id="wuStart" class="button">Start Warm-Up</a></div>
      </div>
      <div class="wu-grid">
        ${wu.map(x => `
          <div class="wu-card">
            <div class="wu-thumb">${x.emoji||"🧍"}</div>
            <div class="wu-body">
              <div class="wu-name">${x.name} ${x.time?`• ${x.time}`:x.reps?`• ${x.reps}`:''}</div>
              <div class="wu-desc">${x.desc}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>`;
  $("#wuStart").addEventListener("click", e => { e.preventDefault(); startWarmupFlow(); });
}

let flowIdx = 0, flowTimer = null, flowRemain = 0;
function startWarmupFlow() {
  const wu = data.warmup || [];
  flowIdx = 0;
  showFlowStep(wu[flowIdx]);
}
function showFlowStep(step) {
  const wu = data.warmup || [];
  if (!step) {
    views.warmup.innerHTML = `
      <div class="card flow">
        <div class="success">✅</div>
        <div class="title">Warm-Up Complete</div>
        <a href="#" class="big-btn" id="wuBack">Back to Warm-Up</a>
      </div>`;
    $("#wuBack").addEventListener("click", e => { e.preventDefault(); renderWarmupList(); });
    return;
  }
  const secs = step.time && parseInt(step.time) ? parseInt(step.time) : wuSeconds;
  flowRemain = secs;
  views.warmup.innerHTML = `
    <div class="card flow">
      <div class="wu-thumb" style="width:100%;max-width:420px;border-radius:12px;border:1px solid var(--line);height:220px;font-size:56px">${step.emoji||"🧍"}</div>
      <div class="title">${step.name}</div>
      <div class="small">${step.desc}</div>
      <div class="timer" id="timer">${flowRemain}</div>
      <div style="display:flex;gap:10px">
        <a href="#" class="big-btn" id="skip">Skip</a>
        <a href="#" class="big-btn" id="next">Next</a>
      </div>
    </div>`;
  tickTimer(() => { flowIdx += 1; showFlowStep(wu[flowIdx]); });
  $("#skip").addEventListener("click", e => { e.preventDefault(); clearInterval(flowTimer); flowIdx += 1; showFlowStep(wu[flowIdx]); });
  $("#next").addEventListener("click", e => { e.preventDefault(); clearInterval(flowTimer); flowIdx += 1; showFlowStep(wu[flowIdx]); });
}
function tickTimer(done) {
  clearInterval(flowTimer);
  flowTimer = setInterval(() => {
    flowRemain -= 1;
    if ($("#timer")) $("#timer").textContent = flowRemain;
    if (flowRemain <= 0) { clearInterval(flowTimer); done(); }
  }, 1000);
}

/* ---------- Settings ---------- */
function renderSettings() {
  const names = ["Session 1 – Gym Push", "Session 2 – Gym Pull", "Session 3 – Home Back"];
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const options = names.map((n,i)=>`<option value="${i}">${n}</option>`).join("");
  const rows = days.map((d,idx)=>{
    const val = dayMap[String(idx)] ?? 2;
    return `<div class="row">
      <div class="day-pill">${d}</div>
      <select class="select" data-day="${idx}">${options}</select>
    </div>`;
  }).join("");

  views.settings.innerHTML = `
    <div class="card">
      <div class="title">Custom Days</div>
      <div class="small">Choose which session appears on each weekday.</div>
      <div class="settings">${rows}</div>
      <div style="margin-top:10px"><a href="#" class="button" id="saveDays">Save</a></div>
    </div>
    <div class="card">
      <div class="title">Warm-Up Timer</div>
      <div class="small">Choose step duration (seconds)</div>
      <div class="inputs">
        <input type="number" id="wuSecs" min="10" max="120" step="5" value="${wuSeconds}">
        <a href="#" class="button" id="saveWU">Save</a>
      </div>
    </div>`;

  document.querySelectorAll("select[data-day]").forEach(sel => {
    const d = sel.dataset.day; sel.value = String(dayMap[d] ?? 2);
  });
  $("#saveDays").addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll("select[data-day]").forEach(sel => {
      dayMap[sel.dataset.day] = parseInt(sel.value, 10);
    });
    save(); alert("Saved! Today view will use your mapping."); renderToday();
  });
  $("#saveWU").addEventListener("click", e => {
    e.preventDefault();
    const v = parseInt($("#wuSecs").value || "30", 10);
    wuSeconds = Math.max(10, Math.min(120, v));
    save(); alert("Warm-Up timer updated.");
  });
}

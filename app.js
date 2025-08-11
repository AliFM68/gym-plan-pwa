// Basic SPA/PWA
const $ = sel => document.querySelector(sel);
const views = {
  today: $("#view-today"),
  sessions: $("#view-sessions"),
  progress: $("#view-progress"),
};
const tabs = document.querySelectorAll(".tab");
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  const tab = t.dataset.tab;
  Object.keys(views).forEach(k => views[k].style.display = (k===tab?"block":"none"));
  if (tab === "progress") renderProgress();
}));

let data = { sessions: [] };
let done = JSON.parse(localStorage.getItem("done") || "{}"); // {exerciseId:true}
let points = parseInt(localStorage.getItem("points") || "0", 10);
let streak = parseInt(localStorage.getItem("streak") || "0", 10);
let lastDay = localStorage.getItem("lastDay") || "";

function save() {
  localStorage.setItem("done", JSON.stringify(done));
  localStorage.setItem("points", points);
  localStorage.setItem("streak", streak);
  localStorage.setItem("lastDay", lastDay);
}

function uid() { return Math.random().toString(36).slice(2); }

async function load() {
  const res = await fetch("plan.json");
  data = await res.json();
  // add ids
  data.sessions.forEach(s => s.items.forEach(ex => {
    ex.id = ex.id || uid();
  }));
  renderToday();
  renderSessions();
  renderProgress(); // initial
  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}
load();

function daySessionIndex() {
  const d = new Date().getDay(); // 0 Sun ... 6 Sat
  if (d===1 || d===2) return 0;   // Mon/Tue
  if (d===3 || d===4) return 1;   // Wed/Thu
  return 2;                       // Fri-Sun
}

function renderToday() {
  const i = daySessionIndex();
  const s = data.sessions[i];
  $("#todaySub").textContent = `${s.title} • ${s.location}`;
  views.today.innerHTML = sessionHTML(s, true);
  attachHandlers();
}

function renderSessions() {
  views.sessions.innerHTML = data.sessions.map(s => `
    <div class="card">
      <div class="row"><div class="title">${s.title}</div><div class="badge">${s.location}</div></div>
      ${sessionTable(s)}
    </div>
  `).join("");
  attachHandlers();
}

function sessionHTML(s, showStart) {
  return `
  <div class="card">
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
      <hr>
    </div>
  `).join("");
}

function attachHandlers() {
  // checkbox toggle
  document.querySelectorAll("input[type=checkbox][data-ex]").forEach(cb => {
    cb.addEventListener("change", e => {
      const id = e.target.dataset.ex;
      if (e.target.checked) {
        if (!done[id]) { points += 10; }
        done[id] = true;
      } else {
        delete done[id];
      }
      save();
      renderProgress();
    });
  });
  // session complete
  document.querySelectorAll("[data-complete]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      points += 50;
      const today = new Date().toDateString();
      if (!lastDay) {
        streak = 1;
      } else {
        const diff = Math.round((new Date(today) - new Date(lastDay)) / 86400000);
        if (diff === 0) {
          // same day: keep streak
        } else if (diff === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
      }
      lastDay = today;
      save();
      renderProgress();
      alert("Session completed! +50 points, streak updated.");
    });
  });
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
    </div>
  `;
}

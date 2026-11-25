// Batel's private dashboard. The publishable key below is public by design; every number comes from admin_* SQL
// functions (SQL 024) that refuse anyone who is not the admin (auth user id pinned in launch_admins). Nothing secret is in this page.
const sb = supabase.createClient("https://tmtvblceqfaocjnhrzdb.supabase.co", "sb_publishable_vDuUS05HLXcFN3XwokCw5w_tjOEeV0a", { auth: { persistSession: true, detectSessionInUrl: true } });
const $ = id => document.getElementById(id);
const TZ = "Asia/Jerusalem";
const fmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dayKey = d => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // yyyy-mm-dd in Israel
const n = x => Number(x || 0).toLocaleString("he-IL");
let rows = [], timer = null, ticker = null, lastOk = 0, started = false;

function show(which) { for (const id of ["login", "denied", "app"]) $(id).hidden = id !== which; }

$("lf").addEventListener("submit", async e => {
  e.preventDefault(); $("lb").disabled = true; $("lm").className = "msg"; $("lm").textContent = "שולחת…";
  const { error } = await sb.auth.signInWithOtp({ email: $("le").value.trim(), options: { emailRedirectTo: "https://noodlepaws.com/admin/", shouldCreateUser: false } });
  $("lb").disabled = false;
  if (error) { $("lm").className = "msg bad"; $("lm").textContent = "לא נשלח. נסי שוב בעוד כמה דקות."; console.warn(error.message); }
  else { $("lm").className = "msg ok"; $("lm").textContent = "נשלח! פתחי את המייל ולחצי על הקישור (באותו דפדפן)."; }
});
document.querySelectorAll("[data-out]").forEach(b => b.onclick = async () => { await sb.auth.signOut(); clearInterval(timer); clearInterval(ticker); started = false; lastOk = 0; show("login"); });

async function start() {
  if (started) return; started = true;
  const { data: { session } } = await sb.auth.getSession();
  if (!session || session.user.is_anonymous) { started = false; show("login"); return; }
  const { data: ok, error } = await sb.rpc("is_launch_admin");
  if (error || ok !== true) { started = false; show("denied"); return; }
  show("app"); await refresh();
  clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  clearInterval(ticker); ticker = setInterval(tick, 1000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("app").hidden) refresh(); });

function tick() { if (!lastOk) return; const s = Math.round((Date.now() - lastOk) / 1000); $("upd").textContent = "מתעדכן לבד כל 30 שניות · עודכן לפני " + s + " שניות"; }

async function refresh() {
  const [sum, list] = await Promise.all([sb.rpc("admin_launch_summary"), sb.rpc("admin_launch_list")]);
  if (sum.error || list.error) { $("upd").textContent = "שגיאה בטעינה – מנסה שוב בעוד 30 שניות"; return; }
  const d = sum.data; lastOk = Date.now(); tick();
  $("vt").textContent = n(d.visits_today); $("vh").textContent = n(d.visits_hour); $("v5").textContent = n(d.visits_5min); $("v7").textContent = n(d.visits_7d); $("va").textContent = n(d.visits_total);
  $("st").textContent = n(d.signups_today); $("sh").textContent = n(d.signups_hour); $("s7").textContent = n(d.signups_7d); $("sa").textContent = n(d.signups_total);
  $("conv").textContent = d.visits_today > 0 ? "היום נרשמו " + Math.round(100 * d.signups_today / d.visits_today) + "% מהנכנסים" : "";
  drawChart(d.daily);
  $("srcs").innerHTML = d.sources.length ? d.sources.map(s => `<tr><td>${esc(s.source)}</td><td>${n(s.visits)}</td><td>${n(s.signups)}</td><td>${s.visits ? Math.round(100 * s.signups / s.visits) + "%" : "–"}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">עוד אין נתונים</td></tr>`;
  rows = list.data || [];
  const cur = $("sf").value, srcs = [...new Set(rows.map(r => r.source))].sort();
  $("sf").innerHTML = `<option value="">הכל</option>` + srcs.map(s => `<option${s === cur ? " selected" : ""}>${esc(s)}</option>`).join("");
  renderRows();
}

function drawChart(days) {
  const max = Math.max(1, ...days.map(x => Math.max(x.visits, x.signups)));
  $("chart").innerHTML = days.map(x => `<div class="day" title="${x.day}: ${x.visits} כניסות, ${x.signups} נרשמו"><div class="bar v" style="height:${100 * x.visits / max}%"></div><div class="bar s" style="height:${100 * x.signups / max}%"></div></div>`).join("");
  const dm = s => s.slice(8, 10) + "." + s.slice(5, 7);
  $("ax0").textContent = days.length ? dm(days[0].day) : ""; $("ax1").textContent = days.length ? dm(days[days.length - 1].day) : "";
}

function filtered() {
  const q = $("q").value.trim().toLowerCase(), d0 = $("d0").value, d1 = $("d1").value, s = $("sf").value;
  return rows.filter(r => { const k = dayKey(new Date(r.created_at)); return (!q || r.email.includes(q)) && (!d0 || k >= d0) && (!d1 || k <= d1) && (!s || r.source === s); });
}
function renderRows() {
  const f = filtered(), shown = f.slice(0, 500);
  $("cnt").textContent = "(" + n(f.length) + (f.length !== rows.length ? " מתוך " + n(rows.length) : "") + ")";
  $("rows").innerHTML = shown.length ? shown.map(r => `<tr><td class="e">${esc(r.email)}</td><td>${fmt.format(new Date(r.created_at))}</td><td class="src">${esc(r.source)}</td><td><button class="x" data-rm="${esc(r.email)}">הסרה</button></td></tr>`).join("") : `<tr><td colspan="4" class="muted">אין נרשמים${rows.length ? " בסינון הזה" : " עדיין"}</td></tr>`;
  $("more").textContent = f.length > shown.length ? "מוצגים 500 הראשונים. הייצוא כולל את כולם." : "";
}
["q", "d0", "d1", "sf"].forEach(id => $(id).addEventListener("input", renderRows));
$("clr").onclick = () => { $("q").value = $("d0").value = $("d1").value = $("sf").value = ""; renderRows(); };

$("rows").addEventListener("click", async e => {
  const em = e.target.dataset && e.target.dataset.rm; if (!em) return;
  if (!confirm("להסיר את " + em + " מהרשימה לצמיתות?\nאי אפשר לבטל.")) return;
  const { error } = await sb.rpc("admin_launch_remove", { p_email: em });
  if (error) alert("ההסרה נכשלה. נסי שוב."); else refresh();
});

$("csv").onclick = () => {
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const lines = [["email", "signed_up_israel_time", "source"].join(",")].concat(filtered().map(r => [cell(r.email), cell(fmt.format(new Date(r.created_at))), cell(r.source)].join(",")));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "noodlepaws-launch-list-" + dayKey(new Date()) + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" && $("app").hidden) start(); });
start();

const $ = (id) => document.getElementById(id);

function qp(name){
  return new URLSearchParams(location.search).get(name);
}

function applySettings(s){
  if(!s) return;
  document.documentElement.style.setProperty("--primary", s.primary_color || "#2563eb");
  document.documentElement.style.setProperty("--topbar-bg", s.topbar_bg || "#1f2a44");
  document.documentElement.style.setProperty("--page-bg", s.page_bg || "#f5f7fa");
  document.documentElement.style.setProperty("--card-bg", s.card_bg || "#ffffff");
  document.documentElement.style.setProperty("--text", s.text_color || "#111827");
  document.documentElement.style.setProperty("--muted", s.muted_color || "#334155");

  $("companyName").textContent = s.company_name || "Company";
  if (s.company_logo_url) $("companyLogo").src = s.company_logo_url;
}

async function doLogin(){
  $("status").textContent = "Logging in...";

  const usr = $("usr").value.trim();
  const pwd = $("pwd").value;

  if(!usr || !pwd){
    $("status").textContent = "Enter user & password";
    return;
  }

  const body = new URLSearchParams();
  body.append("usr", usr);
  body.append("pwd", pwd);

  const res = await fetch("/api/method/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json"
    },
    body
  });

  const data = await res.json().catch(()=> ({}));

  if(!res.ok || data.message !== "Logged In"){
    $("status").textContent = "Login failed";
    return;
  }

  // Verify employee
  const r2 = await fetch("/attendance/context", {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" }
  });

  const ctx = (await r2.json()).message;

  if(!ctx.employee){
    // not employee => logout then stay on login with message
    location.href = "/emp_attendance/account/logout?next=/emp_attendance/account/login?redirect-to=/emp_attendance";
    return;
  }

  const next = qp("redirect-to") || "/emp_attendance";
  location.href = next;
}

window.addEventListener("DOMContentLoaded", () => {
  applySettings(window.__EMP_SETTINGS__ || {});
  $("btnLogin").addEventListener("click", doLogin);
  $("pwd").addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });
});

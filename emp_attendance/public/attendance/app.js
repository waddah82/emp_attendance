const $ = (id) => document.getElementById(id);

const AUTH_CACHE = "emp-attendance-auth-v1";
const SESSION_KEY = "/attendance/session.json";

const state = {
  user: null,
};

// Map globals
let map = null;
let marker = null;
let accuracyCircle = null;
let tileLayer = null;
let isSatellite = false;
function ensureMap(){
  if (!window.L) return; // Leaflet not loaded
  const el = $("map");
  if (!el) return;

  if (map) return;

  map = L.map("map", { zoomControl: true });
  tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // Default view until we get real GPS
  map.setView([24.7136, 46.6753], 13);
}

function updateMap(loc){
  if (!loc) return;
  ensureMap();
  if (!map) return;

  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const acc = Number(loc.accuracy) || 0;

  map.setView([lat, lng], Math.max(16, map.getZoom() || 16));

  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng]).addTo(map);

  // accuracy circle
  if (accuracyCircle) map.removeLayer(accuracyCircle);
  if (acc > 0 && acc < 2000){
    accuracyCircle = L.circle([lat, lng], { radius: acc }).addTo(map);
  }
}


function setStatus(el, msg){ el.textContent = msg || ""; }

function show(id){
  ["bootScreen","loginScreen","attendanceScreen"].forEach(s => $(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function setTopbar(user){
  // وسط: اسم الموظف
  $("topTitle").textContent = (user && (user.employee_name || user.full_name || user.user)) || "EMP Attendance";

  // يمين: صورة المستخدم إن وجدت
  const img = $("userAvatar");
  const fb = $("userAvatarFallback");
  const url = user && user.user_image;

  if (url) {
    img.src = url;
    img.style.display = "block";
    fb.classList.add("hidden");
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    const name = ((user && (user.employee_name || user.full_name || user.user)) || "U").trim();
    fb.textContent = name ? name.charAt(0).toUpperCase() : "U";
    fb.classList.remove("hidden");
  }
}

function showSuccess(kind){
  const modal = $("successModal");
  const icon = $("modalIcon");
  const title = $("modalTitle");
  const msg = $("modalMsg");

  const isIn = kind === "IN";
  icon.textContent = isIn ? "✅" : "🚪";
  title.textContent = isIn ? "تم تسجيل الدخول" : "تم تسجيل الخروج";
  msg.textContent = isIn ? "تم عمل Check-in بنجاح" : "تم عمل Check-out بنجاح";

  modal.classList.remove("hidden");
}

function closeSuccess(){
  $("successModal").classList.add("hidden");
}

async function cacheGetSession(){
  try{
    const cache = await caches.open(AUTH_CACHE);
    const res = await cache.match(SESSION_KEY);
    if (!res) return null;
    return await res.json();
  } catch(e){
    return null;
  }
}

async function cacheSetSession(obj){
  const cache = await caches.open(AUTH_CACHE);
  const body = JSON.stringify({
    ...obj,
    cached_at: new Date().toISOString()
  });
  await cache.put(SESSION_KEY, new Response(body, { headers: { "Content-Type": "application/json" } }));
}

async function cacheClearSession(){
  try{
    const cache = await caches.open(AUTH_CACHE);
    await cache.delete(SESSION_KEY);
  }catch(e){}
}

async function post(method, payload){
  const url = `/api/method/${method}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify(payload || {})
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // frappe sometimes returns {message: "..."} or {exc: "..."}
    const msg = (data && (data.message || data._server_messages)) ? JSON.stringify(data.message || data._server_messages) : "";
    throw new Error(`${res.status} ${msg}`);
  }
  return data;
}

async function getLocation(){
  if (!navigator.geolocation) throw new Error("Geolocation not supported");

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        resolve(loc);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function initMap(){
  if (!window.L) return; // Leaflet not loaded
  if (map) { map.remove(); map = null; tileLayer = null; userMarker = null; accuracyCircle = null; }
  map = L.map("map", { zoomControl: true });
  // default: OSM
  tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);
  // Default view (will be updated on location)
  map.setView([24.7136, 46.6753], 13);
}

function setTileLayerSatellite(enable){
  if (!map) return;
  isSatellite = !!enable;
  if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
  if (isSatellite) {
    // Esri World Imagery
    tileLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "© Esri"
    }).addTo(map);
  } else {
    tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);
  }
}

function updateMapWithLocation(loc){
  if (!map || !loc) return;
  const lat = loc.latitude, lng = loc.longitude, acc = Number(loc.accuracy || 0);

  map.setView([lat, lng], Math.max(15, map.getZoom() || 15));

  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat, lng]).addTo(map);

  if (accuracyCircle) map.removeLayer(accuracyCircle);
  if (acc && acc < 1000) {
    accuracyCircle = L.circle([lat, lng], { radius: acc }).addTo(map);
  }
}

function toggleSatellite(){
  setTileLayerSatellite(!isSatellite);
}

function centerMap(){
  if (!state.location) return;
  updateMapWithLocation(state.location);
}

function updateLocationUI(loc){
  if(!loc) return;
  $("lat").textContent = Number(loc.latitude).toFixed(6);
  $("lng").textContent = Number(loc.longitude).toFixed(6);
  $("acc").textContent = Math.round(Number(loc.accuracy) || 0);
  updateMap(loc);
}

async function boot(){
  show("bootScreen");

  // 1) إذا في كاش جلسة، جرّب اعادة تفعيلها
  const cached = await cacheGetSession();

  try{
    // 2) تحقق من السيرفر: هل المستخدم مسجل دخول فعلاً؟
    const me = await post("emp_attendance.api.me", {});
    state.user = me.message;
    setTopbar(state.user);

    // حدّث الكاش بمعلومات أحدث
    await cacheSetSession(state.user);

    show("attendanceScreen");
    ensureMap();
    // حاول تحديث الموقع
    try{
      const loc = await getLocation();
      updateLocationUI(loc);
    }catch(e){}
    return;
  }catch(e){
    // ليس مسجل دخول أو انتهت الجلسة
    await cacheClearSession();
  }

  // 3) ما فيه جلسة فعالة: اعرض صفحة تسجيل الدخول فقط
  show("loginScreen");
}

async function doLogin(){
  const status = $("loginStatus");
  setStatus(status, "Logging in...");

  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    setStatus(status, "اكتب اسم المستخدم وكلمة المرور");
    return;
  }

  try {
    const r = await post("emp_attendance.api.login", { username, password });
    state.user = r.message;

    // إذا المستخدم ليس موظف: endpoint بيرجع خطأ
    setTopbar(state.user);
    await cacheSetSession(state.user);

    show("attendanceScreen");
    ensureMap();
    setStatus(status, "");

    // جهّز موقع
    try{
      const loc = await getLocation();
      updateLocationUI(loc);
    }catch(e){}

  } catch (e) {
    // رسائل واضحة
    if ((e.message || "").includes("المستخدم ليس موظف")) {
      setStatus(status, "المستخدم ليس موظف");
    } else {
      setStatus(status, "Login failed: " + e.message);
    }
  }
}

async function doCheck(kind){
  const status = $("appStatus");
  setStatus(status, "Getting location...");

  try{
    const loc = await getLocation();
    updateLocationUI(loc);

    setStatus(status, "Saving...");
    const method = kind === "IN" ? "emp_attendance.api.checkin" : "emp_attendance.api.checkout";
    await post(method, { location: loc });

    setStatus(status, "");
    showSuccess(kind);

  }catch(e){
    setStatus(status, "Failed: " + e.message);
  }
}

async function doLogout(){
  try { await post("logout", {}); } catch(e){}
  await cacheClearSession();
  state.user = null;
  $("password").value = "";
  setTopbar(null);
  show("loginScreen");
}

window.addEventListener("DOMContentLoaded", () => {
  $("btnLogin").addEventListener("click", doLogin);
  $("btnCheckin").addEventListener("click", () => doCheck("IN"));
  $("btnCheckout").addEventListener("click", () => doCheck("OUT"));
  $("btnLogout").addEventListener("click", doLogout);
  const t = $("btnToggleSatellite");
  if (t) t.addEventListener("click", toggleSatellite);
  const c = $("btnCenterMap");
  if (c) c.addEventListener("click", async () => {
    try { state.location = await getLocation();
      $("lat").textContent = state.location.latitude.toFixed(6);
      $("lng").textContent = state.location.longitude.toFixed(6);
      $("acc").textContent = Math.round(state.location.accuracy);
      updateMapWithLocation(state.location);
    } catch(e) {}
  });
 

  $("btnModalOk").addEventListener("click", closeSuccess);
  $("successModal").addEventListener("click", (e) => {
    if (e.target && e.target.id === "successModal") closeSuccess();
  });

  boot();
});

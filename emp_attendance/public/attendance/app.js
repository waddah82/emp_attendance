const $ = (id) => document.getElementById(id);

const AUTH_CACHE = "emp-attendance-auth-v1";
const SESSION_KEY = "/attendance/session.json";

let csrfToken = null;
const state = { user: null, location: null };

// Map globals
let map = null;
let userMarker = null;
let accuracyCircle = null;
let isSatellite = false;
let tileLayer = null;

async function getCsrfToken() {
  try {
    // Explicit GET to avoid 417 on token fetch itself
    const res = await fetch("/api/method/emp_attendance.api.csrf_token", { method: "GET" });
    const data = await res.json();
    return data.message || null;
  } catch (e) {
    return null;
  }
}

async function post(method, payload) {
  const url = `/api/method/${method}`;
  const headers = { 
    "Content-Type": "application/json", 
    "Accept": "application/json" 
  };
  
  if (csrfToken) {
    headers["X-Frappe-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: headers,
    body: JSON.stringify(payload || {})
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data && data.message) ? JSON.stringify(data.message) : "Network Error";
    throw new Error(err);
  }
  return data;
}

// UI Helpers
function setStatus(el, msg){ el.textContent = msg || ""; }
function show(id){
  ["bootScreen","loginScreen","attendanceScreen"].forEach(s => $(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function setTopbar(user){
  $("topTitle").textContent = (user && (user.employee_name || user.full_name)) || "Attendance";
  const img = $("userAvatar");
  const fb = $("userAvatarFallback");
  if (user && user.user_image) {
    img.src = user.user_image;
    img.style.display = "block";
    fb.classList.add("hidden");
  } else {
    img.style.display = "none";
    fb.textContent = user ? user.full_name.charAt(0).toUpperCase() : "U";
    fb.classList.remove("hidden");
  }
}
// ... (Keep existing variables and Map functions)
async function boot(){
  show("bootScreen");
  
  try {
    csrfToken = await getCsrfToken();
    const res = await post("emp_attendance.api.me", {}); 
    
    state.user = res.message;
    setTopbar(state.user);
    show("attendanceScreen");
    initMap();
  } catch(e) {
    console.error("Auth error:", e.message);
    show("loginScreen");
    
    // Clear any old data
    state.user = null;
    setTopbar(null);

    // Display the specific error from frappe.throw
    if (e.message.toLowerCase().includes("employee") || e.message.toLowerCase().includes("denied")) {
        setStatus($("loginStatus"), e.message);
    }
  }
}
async function boot22(){
  show("bootScreen");
  
  try {
    csrfToken = await getCsrfToken();
    
    // The 'me' call now strictly validates employee status on the server
    const res = await post("emp_attendance.api.me", {}); 
    
    state.user = res.message;
    setTopbar(state.user);
    show("attendanceScreen");
    initMap();
    
    try {
      const loc = await getLocation();
      updateLocationUI(loc);
    } catch(e) { console.log("Location skipped"); }

  } catch(e) {
    // If 'me' fails or user is not an employee, redirect to login
    console.error("Auth Failed:", e.message);
    csrfToken = await getCsrfToken(); // Ensure we have a fresh token for login
    show("loginScreen");
    
    // Optional: Show error message if it's an 'Employee' related error
    if(e.message.includes("Employee")) {
      setStatus($("loginStatus"), e.message);
    }
  }
}

async function doLogin(){
  const status = $("loginStatus");
  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    setStatus(status, "Credentials required");
    return;
  }

  try {
    setStatus(status, "Authenticating...");
    // This call will now fail on the server if user is not an employee
    await post("emp_attendance.api.login", { username, password });
    
    csrfToken = await getCsrfToken(); 
    await boot();
  } catch (e) {
    setStatus(status, "Access Denied: " + e.message);
  }
}

async function doLogout(){
  try {
    await post("logout", {});
    csrfToken = await getCsrfToken();
    state.user = null;
    show("loginScreen");
  } catch(e) {
    location.reload(); // Force reload as fallback
  }
}

// ... (Keep the rest of the functions like post, getLocation, initMap)
// Logic
async function boot1(){
  show("bootScreen");
  const status = document.querySelector("#bootScreen .status"); // Use status div if exists
  
  try {
    csrfToken = await getCsrfToken();
    if (!csrfToken) throw new Error("Security token missing");

    const res = await post("emp_attendance.api.me", {}); 
    state.user = res.message;
    setTopbar(state.user);
    
    show("attendanceScreen");
    initMap();
  } catch(e) {
    console.error("Boot error:", e.message);
    // Only show login if it's truly a session/auth error
    show("loginScreen");
    if(e.message.includes("Employee")) {
       alert(e.message); // Inform user why they are blocked
    }
  }
}

async function doLogin1(){
  const status = $("loginStatus");
  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    setStatus(status, "Enter credentials");
    return;
  }

  try {
    setStatus(status, "Logging in...");
    await post("emp_attendance.api.login", { username, password });
    csrfToken = await getCsrfToken(); // Refresh token after login
    await boot();
  } catch (e) {
    setStatus(status, "Login failed: " + e.message);
  }
}

async function doCheck(kind){
  const status = $("appStatus");
  try {
    setStatus(status, "Getting location...");
    const loc = await getLocation();
    state.location = loc;
    updateLocationUI(loc);

    setStatus(status, "Saving...");
    const method = kind === "IN" ? "emp_attendance.api.checkin" : "emp_attendance.api.checkout";
    await post(method, { location: loc });
    
    setStatus(status, "");
    showSuccess(kind);
  } catch(e) {
    setStatus(status, "Error: " + e.message);
  }
}

// Map Functions (simplified for stability)
function initMap(){
  if (map) return;
  map = L.map("map").setView([24.7136, 46.6753], 13);
  tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

function updateLocationUI(loc){
  if(!loc) return;
  $("lat").textContent = loc.latitude.toFixed(6);
  $("lng").textContent = loc.longitude.toFixed(6);
  $("acc").textContent = Math.round(loc.accuracy);
  
  if (map) {
    map.setView([loc.latitude, loc.longitude], 16);
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);
  }
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
async function getLocation(){
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      (err) => reject(new Error("GPS Access Denied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function showSuccess(kind){
  const modal = $("successModal");
  $("modalTitle").textContent = kind === "IN" ? "Check-in Success" : "Check-out Success";
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


async function doLogout1(){
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
  $("btnRecenter").addEventListener("click", async () => {
    try{
      const loc = await getLocation();
      updateLocationUI(loc);
    }catch(e){}
  });
  $("successModal").addEventListener("click", (e) => {
    if (e.target && e.target.id === "successModal") closeSuccess();
  });

  boot();
});


// Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Path should be relative to your PWA root
    navigator.serviceWorker
      .register("/attendance/sw.js") 
      .then((reg) => {
        console.log("Service Worker registered successfully.", reg.scope);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  });
}

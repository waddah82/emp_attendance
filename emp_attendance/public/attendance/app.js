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
    
    showFrappeError(data);
    throw new Error(err);
  }
  return data;
}



async function postch(method, payload) {
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
    // استخراج رسالة الخطأ من Frappe
    const errorMessage = extractFrappeMessage(data);
    
    // عرض الرسالة في واجهة المستخدم
    showError(errorMessage, data);
    
    // تسجيل في الكونسول للتصحيح
    console.error("API Error:", {
      status: res.status,
      url: url,
      error: errorMessage,
      data: data
    });
    
    throw new Error(errorMessage);
  }
  
  // إذا كان هناك رسالة نجاح من السيرفر
  if (data._server_messages) {
    const successMessage = extractFrappeMessage(data, true);
    if (successMessage) {
      showServerMessage(successMessage, data);
    }
  }
  
  return data;
}

// دالة لاستخراج الرسالة من Frappe
function extractFrappeMessage(data, isSuccess = false) {
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages);
      if (Array.isArray(messages) && messages[0]) {
        const msg = JSON.parse(messages[0]);
        
        // استخراج النص من HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = msg.message || '';
        
        // إما استخراج النص أو استخدام HTML
        if (msg.message && msg.message.includes('<div')) {
          return msg.message; // إرجاع HTML
        }
        return tempDiv.textContent || tempDiv.innerText || msg.message;
      }
    } catch (e) {
      console.error("Failed to parse server message:", e);
    }
  }
  
  if (data.message) {
    return data.message;
  }
  
  return isSuccess ? "" : "An error occurred";
}

// دالة لعرض رسالة الخطأ
function showError(message, data) {
  const modal = $("errorModal");
  const modalTitle = $("errorModalTitle");
  const modalContent = $("errorModalMsg");
  
  if (!modal || !modalTitle || !modalContent) {
    console.error("Error modal elements not found!");
    

    if (typeof message === 'string' && !message.includes('<div')) {
      alert("Error: " + message);
    }
    return;
  }
  

  modalTitle.textContent = "Check Failed";
  

  if (typeof message === 'string' && message.includes('<div')) {

    modalContent.innerHTML = message;
  } else {

   modalContent.textContent = message;
  }
  

  modal.classList.remove("hidden");
}


function showServerMessage(message, data) {

  const successModal = $("successModal");
  if (successModal) {
    successModal.classList.add("hidden");
  }
  

  let serverModal = $("serverMessageModal");
  

  if (!serverModal) {
    serverModal = document.createElement('div');
    serverModal.id = "serverMessageModal";
    serverModal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
    serverModal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          <div id="serverMessageTitle" class="text-xl font-semibold mb-4"></div>
          <div id="serverMessageContent" class="mb-6"></div>
          <div class="flex justify-end">
            <button onclick="$('serverMessageModal').classList.add('hidden')" 
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              OK
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(serverModal);
  }
  

  const title = $("#serverMessageTitle");
  const content = $("#serverMessageContent");
  
  if (title && content) {
    title.textContent = "Check-in Status";
    

    if (typeof message === 'string' && message.includes('<div')) {
      content.innerHTML = message;
    } else {
      content.innerHTML = `
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 40px; color: #4caf50; margin-bottom: 10px;">✅</div>
          <p style="color: #666; font-size: 16px;">${message}</p>
        </div>
      `;
    }
    

    serverModal.classList.remove("hidden");
  }
}











function displayFrappeError(data, status) {
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages);
      if (Array.isArray(messages) && messages[0]) {
        const msg = JSON.parse(messages[0]);
        

        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = msg.message;
        const textContent = errorDiv.textContent || errorDiv.innerText;
        

        console.error(`%cFrappe Error (${status}): ${textContent}`, 
          "background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); " +
          "color: white; padding: 15px; border-radius: 10px; " +
          "font-size: 14px; font-weight: bold;");
        
        console.log("Full HTML message:", msg.message);
      }
    } catch (e) {
      console.error("Raw server messages:", data._server_messages);
    }
  }
}

// دالة مساعدة لاستخراج النص من الرسالة
function extractErrorMessage(data) {
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages);
      if (Array.isArray(messages) && messages[0]) {
        const msg = JSON.parse(messages[0]);
        if (msg.message) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = msg.message;
          return tempDiv.textContent || tempDiv.innerText || msg.message;
        }
      }
    } catch (e) {
      return data._server_messages || "Unknown error";
    }
  }
  return data.message || `HTTP Error ${data.status}`;
}
function showFrappeError(data) {
  if (data._server_messages) {
    try {
      const messages = JSON.parse(data._server_messages);
      if (Array.isArray(messages) && messages[0]) {
        const msg = JSON.parse(messages[0]);
        
        // إنشاء نافذة عائمة لعرض HTML
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
          background: white;
          padding: 20px;
          border-radius: 10px;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
        `;
        content.innerHTML = msg.message;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // إغلاق النافذة عند النقر خارجها
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            document.body.removeChild(modal);
          }
        });
      }
    } catch (e) {
      console.error("Failed to display error:", e);
    }
  }
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
    await postch(method, { location: loc });
    
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
      attribution: "آ© Esri"
    }).addTo(map);
  } else {
    tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "آ© OpenStreetMap contributors"
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
function closeerror(){
  $("errorModal").classList.add("hidden");
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
  $("errorModalOk").addEventListener("click", closeerror);
  //$("btnRecenter").addEventListener("click", async () => {
//    try{
//      const loc = await getLocation();
//      updateLocationUI(loc);
//    }catch(e){}
//  });
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

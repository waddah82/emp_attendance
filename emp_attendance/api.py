import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def csrf_token():
    # Fixed: Standard way to get token in Frappe
    return frappe.sessions.get_csrf_token()

@frappe.whitelist(allow_guest=True)
def session_user():
    return frappe.session.user or "Guest"

def _get_employee_for_user1(user: str) -> str:
    emp = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not emp:
        frappe.throw("This user is not linked to an Employee")
    return emp

@frappe.whitelist(allow_guest=True)
def login(username: str, password: str):
    # 1. Temporary authentication to check user type
    frappe.local.login_manager.authenticate(username, password)
    
    # 2. Pre-login check: Ensure the user is an employee
    _get_employee_for_user(username)
    
    # 3. If check passes, finalize login
    frappe.local.login_manager.post_login()
    return me()
def _get_employee_for_user(user: str) -> str:
    emp = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not emp:
        # Use simple response for PWA
        frappe.throw("Not an Employee account", frappe.PermissionError)
    return emp

@frappe.whitelist()
def me():
    if frappe.session.user == "Guest":
        frappe.throw("Login Required", frappe.PermissionError)
    
    # This will now trigger the error properly in app.js catch block
    employee_name = _get_employee_for_user(frappe.session.user)
    
    user = frappe.get_doc("User", frappe.session.user)
    return {
        "user": user.name,
        "full_name": user.full_name,
        "employee_name": frappe.db.get_value("Employee", employee_name, "employee_name")
    }
@frappe.whitelist()
def me221():
    if frappe.session.user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
    
    # Strict Check: Ensure session user is an employee
    employee_name = _get_employee_for_user(frappe.session.user)
    
    user = frappe.get_doc("User", frappe.session.user)
    return {
        "user": user.name,
        "full_name": user.full_name,
        "user_image": user.user_image,
        "employee_name": frappe.db.get_value("Employee", employee_name, "employee_name")
    }

@frappe.whitelist(allow_guest=True)
def login1(username: str, password: str):
    if frappe.session.user and frappe.session.user != "Guest":
        if frappe.session.user == username:
            return me()
        frappe.throw("Another user is logged in. Please logout first.", frappe.PermissionError)

    frappe.local.login_manager.authenticate(username, password)
    frappe.local.login_manager.post_login()
    _get_employee_for_user(frappe.session.user)
    return me()

@frappe.whitelist()
def me1():
    if frappe.session.user == "Guest":
        frappe.throw("Not logged in", frappe.PermissionError)
        
    # Check if user is linked to an Employee
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        # This will trigger the 'catch' block in JS and show login screen
        frappe.throw("Access denied: You are not registered as an Employee", frappe.PermissionError)
        
    user = frappe.get_doc("User", frappe.session.user)
    return {
        "user": user.name,
        "full_name": user.full_name,
        "user_image": user.user_image,
        "employee_name": frappe.db.get_value("Employee", {"user_id": user.name}, "employee_name")
    }

@frappe.whitelist()
def checkin(location: dict | None = None):
    return _save_check("IN", location or {})

@frappe.whitelist()
def checkout(location: dict | None = None):
    return _save_check("OUT", location or {})

def _save_check(log_type: str, location: dict):
    user = frappe.session.user
    if user == "Guest":
        frappe.throw("Not logged in")

    employee = _get_employee_for_user(user)
    ua = frappe.get_request_header("User-Agent") or "PWA"
    
    doc = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee,
        "log_type": log_type,
        "time": frappe.utils.now_datetime(),
        "device_id": ua[:140],
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "location_accuracy": location.get("accuracy"),
        "skip_auto_attendance": 0,
    })
    doc.insert(ignore_permissions=False)
    frappe.db.commit()
    return {"name": doc.name, "log_type": log_type}

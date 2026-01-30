import frappe
from frappe import _

def _get_employee_for_user(user: str) -> str:
    emp = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not emp:
        frappe.throw(_("This user is not linked to an Employee"))
    return emp

@frappe.whitelist(allow_guest=True)
def login(username: str, password: str):
    # authenticate & create session
    frappe.local.login_manager.authenticate(username, password)
    frappe.local.login_manager.post_login()

    user = frappe.session.user
    user_row = frappe.db.get_value("User", user, ["full_name", "user_image"], as_dict=True) or {}
    emp_row = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["name", "employee_name"],
        as_dict=True,
    )

    # إذا المستخدم ليس موظف: امنع الدخول (مثل ما طلبت)
    if not emp_row:
        try:
            frappe.local.login_manager.logout()
        except Exception:
            pass
        frappe.throw(_("المستخدم ليس موظف"))

    return {
        "user": user,
        "full_name": user_row.get("full_name") or user,
        "user_image": user_row.get("user_image"),
        "employee": emp_row.get("name"),
        "employee_name": emp_row.get("employee_name") or (user_row.get("full_name") or user),
    }


@frappe.whitelist()
def me():
    """Return current logged-in user's employee info. Raises if not logged in or not an employee."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Not logged in"))

    user_row = frappe.db.get_value("User", user, ["full_name", "user_image"], as_dict=True) or {}
    emp_row = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["name", "employee_name"],
        as_dict=True,
    )
    if not emp_row:
        frappe.throw(_("المستخدم ليس موظف"))

    return {
        "user": user,
        "full_name": user_row.get("full_name") or user,
        "user_image": user_row.get("user_image"),
        "employee": emp_row.get("name"),
        "employee_name": emp_row.get("employee_name") or (user_row.get("full_name") or user),
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
        frappe.throw(_("Not logged in"))

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

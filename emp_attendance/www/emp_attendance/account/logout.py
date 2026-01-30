import frappe

def get_context(context):
    next_url = frappe.form_dict.get("next") or "/emp_attendance/account/login?redirect-to=/emp_attendance"
    try:
        frappe.local.login_manager.logout()
    except Exception:
        pass
    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = next_url
    return context

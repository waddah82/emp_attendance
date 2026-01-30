import frappe

def get_context(context):
    # Redirect Guest to custom login page (ProjectIT style)
    if frappe.session.user == "Guest":
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/emp_attendance/account/login?redirect-to=/emp_attendance"
        return context
    context.no_cache = 1
    return context

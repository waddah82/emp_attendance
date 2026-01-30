import frappe
from emp_attendance.api import get_session_context

def get_context(context):
    frappe.local.response["type"] = "json"
    frappe.local.response["message"] = get_session_context()
    return context

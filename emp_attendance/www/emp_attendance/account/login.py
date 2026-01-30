import frappe
from emp_attendance.api import _load_settings

def get_context(context):
    context.no_cache = 1
    context.settings = _load_settings()
    return context

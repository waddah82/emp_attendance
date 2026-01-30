import frappe

def after_install():
    # Create singleton settings doc with sensible defaults
    if not frappe.db.exists("DocType", "Emp Attendance Settings"):
        # In case migrations haven't run yet
        return
    try:
        doc = frappe.get_single("Emp Attendance Settings")
    except Exception:
        doc = frappe.new_doc("Emp Attendance Settings")
    if not getattr(doc, "company_name", None):
        doc.company_name = "Company"
    doc.save(ignore_permissions=True)
    frappe.db.commit()

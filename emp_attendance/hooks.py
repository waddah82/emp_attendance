app_name = "emp_attendance"
app_title = "EMP Attendance"
app_publisher = "Shams Solutions"
app_description = "Employee Attendance PWA"
app_email = "it@example.com"
app_license = "MIT"

# SPA routing: /emp_attendance and any subpath -> /attendance page
website_route_rules = [
    {"from_route": "/emp_attendance", "to_route": "attendance"},
    {"from_route": "/emp_attendance/<path:app_path>", "to_route": "attendance"},
]

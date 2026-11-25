"""Roles and permissions (Module 10)."""
PERMISSIONS = {
    "dashboard.view": "View dashboard and analytics",
    "feedback.view": "View feedback",
    "feedback.manage": "Change feedback status, re-run analysis, add manual feedback",
    "feedback.review": "Correct AI classifications (human validation)",
    "insights.generate": "Generate AI insights",
    "reports.view": "View approved reports",
    "reports.generate": "Generate and export reports",
    "integrations.manage": "Configure platform integrations and run syncs",
    "users.manage": "Create, edit and deactivate users",
    "settings.manage": "Configure AI settings, thresholds and alerts",
    "audit.view": "View audit logs",
}

ROLES = {
    "SUPER_ADMIN": ("Full system access", list(PERMISSIONS)),
    "ADMIN": ("Manage feedback, reports and reviews", ["dashboard.view", "feedback.view", "feedback.manage", "feedback.review",
                                                      "insights.generate", "reports.view", "reports.generate", "audit.view"]),
    "ANALYST": ("Analyze feedback and validate classifications", ["dashboard.view", "feedback.view", "feedback.review",
                                                                 "insights.generate", "reports.view", "reports.generate"]),
    "VIEWER": ("Read-only dashboard and approved reports", ["dashboard.view", "reports.view"]),
}

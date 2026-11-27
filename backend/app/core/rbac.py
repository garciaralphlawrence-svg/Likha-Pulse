"""Roles and permissions. The workflow itself (who may approve, draft, etc.) is checked again in app/quotes/workflow.py."""
PERMISSIONS = {
    "dashboard.view": "See the dashboard",
    "requests.view": "See travel requests and their AI recommendation",
    "requests.sell": "Draft offers and send them for approval (salesperson)",
    "requests.approve": "Approve, ask for changes or decline offers (agent)",
    "catalog.view": "See the sample rates",
    "users.manage": "Add, edit and turn off staff accounts",
    "settings.manage": "Change service fee, minimum margin, validity and payment terms",
    "audit.view": "See the activity log",
    "owner.view": "Owner dashboards: customer sentiment, team performance, revenue and margin",
}

ROLES = {
    "ADMIN": ("Owner: sees and does everything", list(PERMISSIONS)),
    "AGENT": ("Travel agent: approves, asks for changes or declines offers",
              ["dashboard.view", "requests.view", "requests.approve", "audit.view", "catalog.view"]),
    "SALES": ("Salesperson: prepares offers from the AI recommendation", ["requests.view", "requests.sell", "catalog.view"]),
}

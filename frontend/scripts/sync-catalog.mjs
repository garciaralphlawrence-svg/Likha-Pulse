// Copies the shared rate catalog, workflow rules and test cases from the backend (the source of truth)
// so the browser and the server price trips and apply the rules identically.
import { copyFileSync } from "node:fs";
copyFileSync("../backend/app/quotes/catalog.json", "src/quote/catalog.json");
copyFileSync("../backend/app/quotes/workflow.json", "src/quote/workflow.json");
console.log("catalog.json and workflow.json synced from backend/app/quotes (tests read backend/tests/quote_cases.json directly)");

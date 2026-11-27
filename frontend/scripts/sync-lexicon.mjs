// Copies the shared lexicon and test cases from the backend so both engines use identical data.
import { copyFileSync } from "node:fs";
copyFileSync("../backend/app/nlp/lexicon.json", "src/demo/lexicon.json");
copyFileSync("../backend/tests/engine_cases.json", "scripts/engine_cases.json");
copyFileSync("../backend/app/integrations/sample_templates.json", "src/demo/sample_templates.json");
copyFileSync("../backend/app/services/playbooks.json", "src/demo/playbooks.json");
copyFileSync("../backend/app/services/reply_templates.json", "src/demo/reply_templates.json");
copyFileSync("../backend/app/services/import_template.csv", "src/demo/import_template.csv");
console.log("lexicon, engine cases, sample data, playbooks, reply templates and import template synced from backend");

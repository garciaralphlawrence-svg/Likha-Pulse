// Copies the shared lexicon and test cases from the backend so both engines use identical data.
import { copyFileSync } from "node:fs";
copyFileSync("../backend/app/nlp/lexicon.json", "src/demo/lexicon.json");
copyFileSync("../backend/tests/engine_cases.json", "scripts/engine_cases.json");
console.log("lexicon + engine cases synced from backend");

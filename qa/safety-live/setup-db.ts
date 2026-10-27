import { fileURLToPath } from "node:url";
import setup from "../../apps/api/test/support/db-global-setup.js";

// Reuse the local-only DB guard and Supabase roles required by migrations.
process.chdir(fileURLToPath(new URL("../../apps/api", import.meta.url)));
await setup();

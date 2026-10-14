import { createApp } from "./app.js";
import { pool } from "./config/database.js";
import { env } from "./config/env.js";

try {
  await pool.query("SELECT 1");
} catch (error) {
  console.error("Não foi possível conectar ao MariaDB. Confira o .env e rode `npm run db:setup`.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

createApp().listen(env.PORT, () => {
  console.log(`DeskHelp API ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

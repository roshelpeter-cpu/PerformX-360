import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}
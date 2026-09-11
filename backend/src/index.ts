import "dotenv/config";
import app from "./app.js";

export default app;

if (process.env.NODE_ENV !== "production") {
  const { env } = require("./config/env");
  
  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}
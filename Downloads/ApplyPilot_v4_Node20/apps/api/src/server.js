import "dotenv/config";
import { connectDB } from "./db.js";
import { createApp } from "./app.js";
import { startDailyDiscovery } from "./services/scheduler.js";
const port = Number(process.env.PORT || 5050);
await connectDB();
startDailyDiscovery();
createApp().listen(port, () => console.log(`ApplyPilot AI v2 API running on http://localhost:${port}`));

import dotenv from "dotenv";
import mongoose from "mongoose";

// Load the repository-level .env regardless of whether npm executes from the
// workspace root or from apps/api.
dotenv.config({ path: new URL("../../../.env", import.meta.url) });
dotenv.config();

export async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/applypilot";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

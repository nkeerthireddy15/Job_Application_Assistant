require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const storeRoutes = require("./src/routes/storeRoutes");
const reservationRoutes = require("./src/routes/reservationRoutes");
const zomatoRoutes = require("./src/routes/zomatoRoutes");
const easyDinerRoutes = require("./src/routes/easyDinerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/zomato", zomatoRoutes);
app.use("/api/easydiner", easyDinerRoutes);
console.log("kiki");
const startServer = async () => {
  try {
    await connectDB();

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer();

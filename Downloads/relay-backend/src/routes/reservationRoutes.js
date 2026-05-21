const express = require("express");
const Reservation = require("../models/Reservation");
const Store = require("../models/Store");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const { storeId, platform, status } = req.query;
    const query = {};

    if (storeId) query.store = storeId;
    if (platform) query.platform = platform;
    if (status) query.status = status;

    const reservations = await Reservation.find(query)
      .populate("store", "name code city")
      .sort({ reservationTime: -1 });

    return res.json({ reservations });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reservations" });
  }
});

// Seed sample data — admin only
router.post("/seed", authorize("admin"), async (req, res) => {
  try {
    const { storeId } = req.body;
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const now = Date.now();
    const docs = [
      {
        store: store._id,
        platform: "zomato",
        externalReservationId: `Z-${now}`,
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        guests: 2,
        reservationTime: new Date(now + 1000 * 60 * 90),
      },
      {
        store: store._id,
        platform: "swiggy",
        externalReservationId: `S-${now}`,
        customerName: "Aisha Khan",
        customerPhone: "9988776655",
        guests: 4,
        reservationTime: new Date(now + 1000 * 60 * 120),
      },
      {
        store: store._id,
        platform: "easyDiner",
        externalReservationId: `E-${now}`,
        customerName: "Vikram Patel",
        customerPhone: "9123456780",
        guests: 3,
        reservationTime: new Date(now + 1000 * 60 * 150),
      },
    ];

    const created = await Reservation.insertMany(docs, { ordered: false });
    return res
      .status(201)
      .json({ message: "Sample reservations inserted", count: created.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to seed reservations" });
  }
});

// Accept / Reject — admin or manager
router.patch(
  "/:reservationId/status",
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const { reservationId } = req.params;
      const { status } = req.body;

      if (!["accepted", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Status must be accepted or rejected" });
      }

      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      reservation.status = status;
      await reservation.save();

      return res.json({ message: "Reservation status updated", reservation });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to update reservation status" });
    }
  },
);

module.exports = router;

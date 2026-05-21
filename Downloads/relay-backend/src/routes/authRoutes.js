const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");

const router = express.Router();

const createToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );

// Only admins can create new users
router.post("/register", auth, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    return res.status(201).json({
      message: "User created",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password || "", user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = createToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });

    if (!user) {
      return res.json({
        message: "If the email exists, a reset token has been generated",
      });
    }

    const rawToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();

    return res.json({
      message:
        "Reset token generated. Integrate with email/sms provider for production use.",
      resetToken: rawToken,
      expiresAt: user.resetPasswordExpiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate reset token" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.tokenVersion += 1;
    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/me", auth, async (req, res) => {
  return res.json({ user: req.user });
});

router.put("/profile", auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    await user.save();

    return res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(
      currentPassword || "",
      user.passwordHash,
    );
    if (!match) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.tokenVersion += 1;
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password" });
  }
});

router.post("/logout", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to logout" });
  }
});

// ── Admin-only: User management ──────────────────────────────────────────────

/** GET /api/auth/users — list all users (admin) */
router.get("/users", auth, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash -resetPasswordTokenHash")
      .sort({ createdAt: -1 });
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

/** PUT /api/auth/users/:userId/role — change a user's role (admin) */
router.put(
  "/users/:userId/role",
  auth,
  authorize("admin"),
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!["admin", "manager"].includes(role)) {
        return res
          .status(400)
          .json({ message: "Role must be admin or manager" });
      }
      if (req.params.userId === req.user._id.toString()) {
        return res
          .status(400)
          .json({ message: "You cannot change your own role" });
      }
      const user = await User.findByIdAndUpdate(
        req.params.userId,
        { role },
        { new: true, select: "-passwordHash -resetPasswordTokenHash" },
      );
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ message: "Role updated", user });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update role" });
    }
  },
);

module.exports = router;

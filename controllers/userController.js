import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/User.js";
import { deleteImage } from "../utils/cloudinary.js";

// ── Admin: Get All Users ───────────────────────────────────
// GET /api/users
export const getAllUsers = asyncHandler(async (req, res) => {
  const query = {};

  // Search by name or email
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }

  // Filter by role
  if (req.query.role) {
    query.role = req.query.role;
  }

  const users = await User.find(query).sort({ createdAt: -1 });

  res.json({ success: true, count: users.length, users });
});

// ── Admin: Get Single User ─────────────────────────────────
// GET /api/users/:id
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({ success: true, user });
});

// ── Admin: Update User ─────────────────────────────────────
// PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, email, role } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;

  await user.save();

  res.json({ success: true, user });
});

// ── Admin: Delete User ─────────────────────────────────────
// DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Delete avatar from Cloudinary if exists
  if (user.avatar?.public_id) {
    await deleteImage(user.avatar.public_id);
  }

  await user.deleteOne();

  res.json({ success: true, message: "User deleted successfully" });
});

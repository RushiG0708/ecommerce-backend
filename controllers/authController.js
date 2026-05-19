import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { sendPasswordResetEmail } from "../utils/sendEmail.js";
import { deleteImage } from "../utils/cloudinary.js";

// ── Register ───────────────────────────────────────────────
// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  const user = await User.create({ name, email, password });

  generateToken(res, user._id);

  res.status(201).json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// ── Login ──────────────────────────────────────────────────
// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  generateToken(res, user._id);

  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// ── Logout ─────────────────────────────────────────────────
// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.json({ success: true, message: "Logged out successfully" });
});

// ── Get My Profile ─────────────────────────────────────────
// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    user,
  });
});

// ── Update Profile ─────────────────────────────────────────
// PUT /api/auth/me/update
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  const user = await User.findById(req.user._id);

  // If new avatar uploaded
  if (req.file) {
    // Delete old avatar from Cloudinary
    if (user.avatar?.public_id) {
      await deleteImage(user.avatar.public_id);
    }
    user.avatar = {
      public_id: req.file.filename,
      url: req.file.path,
    };
  }

  if (name) user.name = name;
  if (email) user.email = email;

  await user.save();

  res.json({
    success: true,
    user,
  });
});

// ── Change Password ────────────────────────────────────────
// PUT /api/auth/me/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  generateToken(res, user._id);

  res.json({ success: true, message: "Password updated successfully" });
});

// ── Forgot Password ────────────────────────────────────────
// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    res.status(404);
    throw new Error("No user found with this email");
  }

  // Generate raw token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash and store in DB
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes

  await user.save({ validateBeforeSave: false });

  // Send raw token in URL (not the hashed one)
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
    res.json({
      success: true,
      message: `Password reset email sent to ${user.email}`,
    });
  } catch (error) {
    // If email fails, clear the token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error("Email could not be sent. Please try again.");
  }
});

// ── Reset Password ─────────────────────────────────────────
// PUT /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  // Hash the token from URL to compare with DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired reset token");
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  generateToken(res, user._id);

  res.json({ success: true, message: "Password reset successful" });
});

import asyncHandler from "../middleware/asyncHandler.js";
import Coupon from "../models/Coupon.js";

// ── Admin: Get All Coupons ─────────────────────────────────
// GET /api/coupons
export const getAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json({ success: true, coupons });
});

// ── Admin: Create Coupon ───────────────────────────────────
// POST /api/coupons
export const createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxUses,
    expiresAt,
  } = req.body;

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    res.status(400);
    throw new Error("Coupon code already exists");
  }

  const coupon = await Coupon.create({
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxUses,
    expiresAt,
  });

  res.status(201).json({ success: true, coupon });
});

// ── Admin: Update Coupon ───────────────────────────────────
// PUT /api/coupons/:id
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }

  const {
    discountType,
    discountValue,
    minOrderAmount,
    maxUses,
    expiresAt,
    isActive,
  } = req.body;

  if (discountType) coupon.discountType = discountType;
  if (discountValue) coupon.discountValue = discountValue;
  if (minOrderAmount !== undefined) coupon.minOrderAmount = minOrderAmount;
  if (maxUses) coupon.maxUses = maxUses;
  if (expiresAt) coupon.expiresAt = expiresAt;
  if (isActive !== undefined) coupon.isActive = isActive;

  await coupon.save();

  res.json({ success: true, coupon });
});

// ── Admin: Delete Coupon ───────────────────────────────────
// DELETE /api/coupons/:id
export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }

  await coupon.deleteOne();

  res.json({ success: true, message: "Coupon deleted successfully" });
});

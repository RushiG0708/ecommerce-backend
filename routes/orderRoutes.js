import express from "express";
import {
  createRazorpayOrder,
  placeOrder,
  validateCoupon,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orderController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Protected routes
router.post("/razorpay", protect, createRazorpayOrder);
router.post("/", protect, placeOrder);
router.post("/validate-coupon", protect, validateCoupon);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getOrderById);

// Admin routes
router.get("/admin/all", protect, adminOnly, getAllOrders);
router.put("/admin/:id", protect, adminOnly, updateOrderStatus);
router.delete("/admin/:id", protect, adminOnly, deleteOrder);

export default router;

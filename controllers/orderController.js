import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { sendOrderConfirmationEmail } from "../utils/sendEmail.js";
import Razorpay from "razorpay";

const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// ── Create Razorpay Order ──────────────────────────────────
// POST /api/orders/razorpay
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;

  // Get user cart
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name price discountPrice stock images",
  );

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // Check stock availability
  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(
        `Only ${item.product.stock} units of "${item.product.name}" available`,
      );
    }
  }

  // Calculate items total
  let itemsPrice = cart.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  // Shipping: free above ₹500
  const shippingPrice = itemsPrice > 500 ? 0 : 50;

  // Apply coupon if provided
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: Date.now() },
    });

    if (!coupon) {
      res.status(400);
      throw new Error("Invalid or expired coupon code");
    }

    if (itemsPrice < coupon.minOrderAmount) {
      res.status(400);
      throw new Error(
        `Minimum order amount for this coupon is ₹${coupon.minOrderAmount}`,
      );
    }

    if (coupon.usedCount >= coupon.maxUses) {
      res.status(400);
      throw new Error("Coupon usage limit reached");
    }

    // Calculate discount
    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((itemsPrice * coupon.discountValue) / 100);
    } else {
      discountAmount = coupon.discountValue;
    }

    appliedCoupon = {
      code: coupon.code,
      discount: discountAmount,
    };
  }

  const totalPrice = itemsPrice + shippingPrice - discountAmount;

  // Create Razorpay order (amount in paise)
  const razorpay = getRazorpayInstance();
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalPrice * 100),
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  res.json({
    success: true,
    razorpayOrder,
    orderSummary: {
      itemsPrice,
      shippingPrice,
      discountAmount,
      totalPrice,
      appliedCoupon,
    },
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  });
});

// ── Verify Payment + Place Order ───────────────────────────
// POST /api/orders
export const placeOrder = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    shippingInfo,
    couponCode,
  } = req.body;

  // 1. Verify Razorpay signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    res.status(400);
    throw new Error("Payment verification failed — invalid signature");
  }

  // 2. Get user cart
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name price discountPrice stock images",
  );

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // 3. Build order items
  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    image: item.product.images[0]?.url || "",
    price: item.price,
    quantity: item.quantity,
  }));

  // 4. Calculate prices
  let itemsPrice = cart.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );
  const shippingPrice = itemsPrice > 500 ? 0 : 50;

  // 5. Apply coupon
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: Date.now() },
    });

    if (coupon) {
      if (coupon.discountType === "percentage") {
        discountAmount = Math.round((itemsPrice * coupon.discountValue) / 100);
      } else {
        discountAmount = coupon.discountValue;
      }

      appliedCoupon = { code: coupon.code, discount: discountAmount };

      // Increment coupon usage
      coupon.usedCount += 1;
      await coupon.save();
    }
  }

  const totalPrice = itemsPrice + shippingPrice - discountAmount;

  // 6. Create order in DB
  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingInfo,
    paymentInfo: {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      status: "paid",
    },
    coupon: appliedCoupon,
    itemsPrice,
    shippingPrice,
    discountAmount,
    totalPrice,
  });

  // 7. Decrease stock for each product
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity },
    });
  }

  // 8. Clear cart
  await Cart.findOneAndDelete({ user: req.user._id });

  // 9. Send order confirmation email
  try {
    await sendOrderConfirmationEmail(req.user.email, order, req.user.name);
  } catch (err) {
    console.error("Order email failed:", err.message);
    // Don't throw — order is already placed
  }

  res.status(201).json({ success: true, order });
});

// ── Validate Coupon ────────────────────────────────────────
// POST /api/orders/validate-coupon
export const validateCoupon = asyncHandler(async (req, res) => {
  const { couponCode, orderAmount } = req.body;

  const coupon = await Coupon.findOne({
    code: couponCode.toUpperCase(),
    isActive: true,
    expiresAt: { $gt: Date.now() },
  });

  if (!coupon) {
    res.status(400);
    throw new Error("Invalid or expired coupon code");
  }

  if (orderAmount < coupon.minOrderAmount) {
    res.status(400);
    throw new Error(
      `Minimum order amount for this coupon is ₹${coupon.minOrderAmount}`,
    );
  }

  if (coupon.usedCount >= coupon.maxUses) {
    res.status(400);
    throw new Error("Coupon usage limit reached");
  }

  const discountAmount =
    coupon.discountType === "percentage"
      ? Math.round((orderAmount * coupon.discountValue) / 100)
      : coupon.discountValue;

  res.json({
    success: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
    },
  });
});

// ── Get My Orders ──────────────────────────────────────────
// GET /api/orders/my
export const getMyOrders = asyncHandler(async (req, res) => {
  const query = { user: req.user._id };

  // Filter by status
  if (req.query.status) {
    query.orderStatus = req.query.status;
  }

  // Filter by date range
  if (req.query.from || req.query.to) {
    query.createdAt = {};
    if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });

  res.json({ success: true, orders });
});

// ── Get Single Order ───────────────────────────────────────
// GET /api/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email",
  );

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Users can only see their own orders
  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to view this order");
  }

  res.json({ success: true, order });
});

// ── Admin: Get All Orders ──────────────────────────────────
// GET /api/orders/admin/all
export const getAllOrders = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.status) query.orderStatus = req.query.status;

  const orders = await Order.find(query)
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  // Total revenue
  const totalRevenue = orders
    .filter((o) => o.paymentInfo.status === "paid")
    .reduce((acc, o) => acc + o.totalPrice, 0);

  res.json({ success: true, orders, totalRevenue });
});

// ── Admin: Update Order Status ─────────────────────────────
// PUT /api/orders/admin/:id
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.orderStatus === "Delivered") {
    res.status(400);
    throw new Error("Order already delivered");
  }

  order.orderStatus = req.body.status;

  if (req.body.status === "Delivered") {
    order.deliveredAt = Date.now();
  }

  await order.save();

  res.json({ success: true, order });
});

// ── Admin: Delete Order ────────────────────────────────────
// DELETE /api/orders/admin/:id
export const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  await order.deleteOne();

  res.json({ success: true, message: "Order deleted successfully" });
});

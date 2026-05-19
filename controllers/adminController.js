import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Review from "../models/Review.js";

// ── Admin: Dashboard Analytics ─────────────────────────────
// GET /api/admin/analytics
export const getDashboardAnalytics = asyncHandler(async (req, res) => {
  // ── 1. Summary Cards ──────────────────────────────────────
  const totalUsers = await User.countDocuments({ role: "user" });
  const totalProducts = await Product.countDocuments();
  const totalOrders = await Order.countDocuments();

  const revenueResult = await Order.aggregate([
    { $match: { "paymentInfo.status": "paid" } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  // ── 2. Orders Per Day (Last 7 Days) ───────────────────────
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const ordersPerDay = await Order.aggregate([
    { $match: { createdAt: { $gte: last7Days } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        orders: { $sum: 1 },
        revenue: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // ── 3. Revenue Per Month (Last 6 Months) ──────────────────
  const last6Months = new Date();
  last6Months.setMonth(last6Months.getMonth() - 6);

  const revenuePerMonth = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: last6Months },
        "paymentInfo.status": "paid",
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        revenue: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // ── 4. Top 5 Selling Products ──────────────────────────────
  const topProducts = await Order.aggregate([
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.product",
        name: { $first: "$orderItems.name" },
        totalSold: { $sum: "$orderItems.quantity" },
        totalRevenue: {
          $sum: {
            $multiply: ["$orderItems.price", "$orderItems.quantity"],
          },
        },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
  ]);

  // ── 5. Order Status Breakdown ──────────────────────────────
  const orderStatusBreakdown = await Order.aggregate([
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  // ── 6. Low Stock Alerts (stock < 10) ──────────────────────
  const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
    .select("name stock category images")
    .sort({ stock: 1 });

  // ── 7. Recent Orders (Last 5) ──────────────────────────────
  const recentOrders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(5)
    .select("user totalPrice orderStatus createdAt paymentInfo");

  // ── 8. New Users (Last 7 Days) ─────────────────────────────
  const newUsers = await User.countDocuments({
    createdAt: { $gte: last7Days },
  });

  res.json({
    success: true,
    summary: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      newUsers,
    },
    ordersPerDay,
    revenuePerMonth,
    topProducts,
    orderStatusBreakdown,
    lowStockProducts,
    recentOrders,
  });
});

// ── Admin: Get All Reviews ─────────────────────────────────
// GET /api/admin/reviews
export const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate("user", "name email avatar")
    .populate("product", "name images")
    .sort({ createdAt: -1 });

  res.json({ success: true, count: reviews.length, reviews });
});

// ── Admin: Delete Any Review ───────────────────────────────
// DELETE /api/admin/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  await review.deleteOne();

  // Recalculate product rating
  const reviews = await Review.find({ product: review.product });
  const product = await Product.findById(review.product);

  if (product) {
    product.ratings =
      reviews.length > 0
        ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
        : 0;
    product.numReviews = reviews.length;
    await product.save();
  }

  res.json({ success: true, message: "Review deleted" });
});

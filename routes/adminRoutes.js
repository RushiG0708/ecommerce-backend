import express from "express";
import {
  getDashboardAnalytics,
  getAllReviews,
  deleteReview,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/analytics", getDashboardAnalytics);
router.get("/reviews", getAllReviews);
router.delete("/reviews/:id", deleteReview);

export default router;

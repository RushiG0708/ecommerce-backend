import express from "express";
import {
  getProducts,
  getProduct,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  createReview,
  getProductReviews,
  deleteReview,
} from "../controllers/productController.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { uploadProductImages } from "../utils/cloudinary.js";

const router = express.Router();

// Multer error handler wrapper
const handleUpload = (req, res, next) => {
  uploadProductImages(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary Upload Error:", err);
      return res.status(400).json({
        message: err.message || "File upload failed",
        error: err,
      });
    }
    next();
  });
};

// Public routes
router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/:id", getProduct);
router.get("/:id/reviews", getProductReviews);

// Protected routes
router.post("/:id/reviews", protect, createReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);

// Admin routes
router.post("/", protect, adminOnly, handleUpload, createProduct);
router.put("/:id", protect, adminOnly, handleUpload, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;

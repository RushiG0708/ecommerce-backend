import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist,
} from "../controllers/wishlistController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect); // All wishlist routes are protected

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/clear", clearWishlist);
router.delete("/:productId", removeFromWishlist);
router.post("/:productId/move-to-cart", moveToCart);

export default router;

import asyncHandler from "../middleware/asyncHandler.js";
import Wishlist from "../models/Wishlist.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// ── Get My Wishlist ────────────────────────────────────────
// GET /api/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock ratings numReviews",
  );

  if (!wishlist) {
    return res.json({ success: true, wishlist: { items: [] } });
  }

  res.json({ success: true, wishlist });
});

// ── Add Item to Wishlist ───────────────────────────────────
// POST /api/wishlist
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: req.user._id,
      items: [{ product: productId }],
    });
  } else {
    // Check if already in wishlist
    const exists = wishlist.items.some(
      (item) => item.product.toString() === productId,
    );

    if (exists) {
      return res.json({ success: true, message: "Already in wishlist" });
    }

    wishlist.items.push({ product: productId });
    await wishlist.save();
  }

  wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock ratings numReviews",
  );

  res.json({ success: true, wishlist });
});

// ── Remove Item from Wishlist ──────────────────────────────
// DELETE /api/wishlist/:productId
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }

  wishlist.items = wishlist.items.filter(
    (item) => item.product.toString() !== req.params.productId,
  );

  await wishlist.save();

  const updatedWishlist = await Wishlist.findOne({
    user: req.user._id,
  }).populate(
    "items.product",
    "name images price discountPrice stock ratings numReviews",
  );

  res.json({ success: true, wishlist: updatedWishlist });
});

// ── Move Item from Wishlist to Cart ────────────────────────
// POST /api/wishlist/:productId/move-to-cart
export const moveToCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.stock < 1) {
    res.status(400);
    throw new Error("Product is out of stock");
  }

  // Add to cart
  let cart = await Cart.findOne({ user: req.user._id });
  const itemPrice =
    product.discountPrice > 0 ? product.discountPrice : product.price;

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [{ product: productId, quantity: 1, price: itemPrice }],
    });
  } else {
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += 1;
    } else {
      cart.items.push({ product: productId, quantity: 1, price: itemPrice });
    }

    await cart.save();
  }

  // Remove from wishlist
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (wishlist) {
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId,
    );
    await wishlist.save();
  }

  res.json({ success: true, message: "Item moved to cart" });
});

// ── Clear Wishlist ─────────────────────────────────────────
// DELETE /api/wishlist
export const clearWishlist = asyncHandler(async (req, res) => {
  await Wishlist.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: "Wishlist cleared" });
});

import asyncHandler from "../middleware/asyncHandler.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// ── Get My Cart ────────────────────────────────────────────
// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock",
  );

  if (!cart) {
    return res.json({ success: true, cart: { items: [], totalPrice: 0 } });
  }

  res.json({ success: true, cart });
});

// ── Add Item to Cart ───────────────────────────────────────
// POST /api/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.stock < quantity) {
    res.status(400);
    throw new Error(`Only ${product.stock} units available in stock`);
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    // Create new cart
    cart = await Cart.create({
      user: req.user._id,
      items: [
        {
          product: productId,
          quantity,
          price:
            product.discountPrice > 0 ? product.discountPrice : product.price,
        },
      ],
    });
  } else {
    // Check if product already in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex > -1) {
      // Update quantity
      const newQty = cart.items[itemIndex].quantity + quantity;

      if (newQty > product.stock) {
        res.status(400);
        throw new Error(`Only ${product.stock} units available in stock`);
      }

      cart.items[itemIndex].quantity = newQty;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price:
          product.discountPrice > 0 ? product.discountPrice : product.price,
      });
    }

    await cart.save();
  }

  // Return populated cart
  cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock",
  );

  res.json({ success: true, cart });
});

// ── Update Item Quantity ───────────────────────────────────
// PUT /api/cart/:productId
export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const { productId } = req.params;

  if (quantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (quantity > product.stock) {
    res.status(400);
    throw new Error(`Only ${product.stock} units available in stock`);
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId,
  );

  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  const updatedCart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock",
  );

  res.json({ success: true, cart: updatedCart });
});

// ── Remove Item from Cart ──────────────────────────────────
// DELETE /api/cart/:productId
export const removeFromCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== req.params.productId,
  );

  await cart.save();

  const updatedCart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product",
    "name images price discountPrice stock",
  );

  res.json({ success: true, cart: updatedCart });
});

// ── Clear Entire Cart ──────────────────────────────────────
// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: "Cart cleared" });
});

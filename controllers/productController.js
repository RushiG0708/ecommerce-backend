import asyncHandler from "../middleware/asyncHandler.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { deleteImage } from "../utils/cloudinary.js";

// ── Get All Products (Search + Filter + Pagination) ────────
// GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const resultsPerPage = 12;
  const page = Number(req.query.page) || 1;

  const query = {};

  // 1. Search by name
  if (req.query.search) {
    query.name = { $regex: req.query.search, $options: "i" };
  }

  // 2. Filter by category
  if (req.query.category) {
    query.category = req.query.category;
  }

  // 3. Filter by gender
  if (req.query.gender) {
    query.gender = req.query.gender;
  }

  // 4. Filter by price range
  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
  }

  // 5. Filter by rating
  if (req.query.rating) {
    query.ratings = { $gte: Number(req.query.rating) };
  }

  // 6. Filter by stock
  if (req.query.inStock === "true") {
    query.stock = { $gt: 0 };
  }

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / resultsPerPage);

  const products = await Product.find(query)
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .skip(resultsPerPage * (page - 1))
    .limit(resultsPerPage);

  res.json({
    success: true,
    totalProducts,
    totalPages,
    currentPage: page,
    resultsPerPage,
    products,
  });
});

// ── Get Single Product ─────────────────────────────────────
// GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    "createdBy",
    "name",
  );

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({ success: true, product });
});

// ── Get All Categories ─────────────────────────────────────
// GET /api/products/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct("category");
  res.json({ success: true, categories });
});

// ── Create Product (Admin) ─────────────────────────────────
// POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, discountPrice, category, stock, gender } =
    req.body;

  const images =
    req.files && req.files.length > 0
      ? req.files.map((file) => ({
          public_id: file.filename,
          url: file.path,
        }))
      : [
          {
            public_id: "placeholder",
            url: "https://placehold.co/400x400?text=Product",
          },
        ];

  const product = await Product.create({
    name,
    description,
    price,
    discountPrice,
    category,
    stock,
    gender: gender || "N/A",
    images,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, product });
});

// ── Update Product (Admin) ─────────────────────────────────
// PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const { name, description, price, discountPrice, category, stock, gender } =
    req.body;

  // If new images uploaded — delete old ones and replace
  if (req.files && req.files.length > 0) {
    for (const img of product.images) {
      if (img.public_id !== "placeholder") {
        await deleteImage(img.public_id);
      }
    }
    product.images = req.files.map((file) => ({
      public_id: file.filename,
      url: file.path,
    }));
  }

  if (name) product.name = name;
  if (description) product.description = description;
  if (price) product.price = price;
  if (discountPrice !== undefined) product.discountPrice = discountPrice;
  if (category) product.category = category;
  if (stock !== undefined) product.stock = stock;
  if (gender) product.gender = gender;

  await product.save();

  res.json({ success: true, product });
});

// ── Delete Product (Admin) ─────────────────────────────────
// DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  for (const img of product.images) {
    if (img.public_id !== "placeholder") {
      await deleteImage(img.public_id);
    }
  }

  await Review.deleteMany({ product: product._id });
  await product.deleteOne();

  res.json({ success: true, message: "Product deleted successfully" });
});

// ── Create / Update Review ─────────────────────────────────
// POST /api/products/:id/reviews
export const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.id;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const existingReview = await Review.findOne({
    user: req.user._id,
    product: productId,
  });

  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
    await existingReview.save();
  } else {
    await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      comment,
    });
  }

  const reviews = await Review.find({ product: productId });
  const avgRating =
    reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

  product.ratings = avgRating;
  product.numReviews = reviews.length;
  await product.save();

  res.status(201).json({ success: true, message: "Review submitted" });
});

// ── Get Product Reviews ────────────────────────────────────
// GET /api/products/:id/reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.id }).populate(
    "user",
    "name avatar",
  );
  res.json({ success: true, reviews });
});

// ── Delete Review ──────────────────────────────────────────
// DELETE /api/products/:id/reviews/:reviewId
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.reviewId);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to delete this review");
  }

  await review.deleteOne();

  const product = await Product.findById(req.params.id);
  const reviews = await Review.find({ product: req.params.id });

  product.ratings =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;
  product.numReviews = reviews.length;
  await product.save();

  res.json({ success: true, message: "Review deleted" });
});

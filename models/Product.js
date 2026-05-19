import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter product name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please enter product description"],
    },
    price: {
      type: Number,
      required: [true, "Please enter product price"],
    },
    discountPrice: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      required: [true, "Please enter product category"],
      enum: [
        "Electronics",
        "Clothing",
        "Footwear",
        "Books",
        "Home & Kitchen",
        "Beauty",
        "Sports",
        "Toys",
        "Other",
      ],
    },
    gender: {
      type: String,
      enum: ["Men", "Women", "Unisex", "N/A"],
      default: "N/A",
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    ratings: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Product", productSchema);

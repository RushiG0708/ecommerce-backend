import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY?.startsWith("SG.")) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendEmail = async ({ to, subject, html }) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject,
    html,
  };

  await sgMail.send(msg);
};

// ── Email Templates ────────────────────────────────────────

// 1. Password Reset Email
export const sendPasswordResetEmail = async (email, resetUrl) => {
  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset. Click the button below to reset your password.</p>
        <p>This link is valid for <strong>15 minutes</strong> only.</p>
        <a href="${resetUrl}"
           style="display:inline-block; padding:12px 24px; background:#4F46E5;
                  color:#fff; text-decoration:none; border-radius:6px; margin:16px 0;">
          Reset Password
        </a>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
};

// 2. Order Confirmation Email
export const sendOrderConfirmationEmail = async (email, order, userName) => {
  const itemsHtml = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.name}</td>
        <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.quantity}</td>
        <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">₹${item.price}</td>
      </tr>
    `,
    )
    .join("");

  await sendEmail({
    to: email,
    subject: `Order Confirmed — #${order._id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Order Confirmed! 🎉</h2>
        <p>Hi <strong>${userName}</strong>, thank you for your order.</p>

        <h3 style="color:#333;">Order Summary</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px; text-align:left;">Product</th>
              <th style="padding:8px; text-align:center;">Qty</th>
              <th style="padding:8px; text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="margin-top:16px; text-align:right;">
          <p>Items Total: <strong>₹${order.itemsPrice}</strong></p>
          <p>Shipping: <strong>₹${order.shippingPrice}</strong></p>
          ${
            order.discountAmount > 0
              ? `<p>Discount: <strong style="color:green;">-₹${order.discountAmount}</strong></p>`
              : ""
          }
          <h3>Total: ₹${order.totalPrice}</h3>
        </div>

        <h3 style="color:#333;">Shipping Address</h3>
        <p>
          ${order.shippingInfo.address}, ${order.shippingInfo.city},<br/>
          ${order.shippingInfo.state} - ${order.shippingInfo.pinCode}<br/>
          ${order.shippingInfo.country}<br/>
          Phone: ${order.shippingInfo.phone}
        </p>

        <p style="color:#888; font-size:12px; margin-top:32px;">
          Order ID: #${order._id} | Placed on: ${new Date(order.createdAt).toDateString()}
        </p>
      </div>
    `,
  });
};

export default sendEmail;

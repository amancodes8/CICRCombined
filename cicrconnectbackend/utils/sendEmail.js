const sendEmail = async (options) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const payload = {
    from: process.env.RESEND_FROM_EMAIL,
    to: [options.email],
    subject: options.subject,
    html: options.message,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.message || "Failed to send email via Resend";
    throw new Error(message);
  }

  console.log("✅ Email sent via Resend:", data?.id || "unknown-id");
  return data;
};

module.exports = sendEmail;

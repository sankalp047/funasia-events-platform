const formData = require("form-data");
const Mailgun = require("mailgun.js");
const bwipjs = require("bwip-js");
const { generateTicketPDF } = require("./ticket-pdf.service");

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

/**
 * Generate a barcode PNG buffer for a ticket
 */
async function generateBarcode(barcodeData) {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: barcodeData,
    scale: 3,
    height: 15,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });
  return png;
}

/**
 * Send order confirmation with individual ticket barcodes
 */
async function sendOrderConfirmation({ order, event, tickets, userEmail, userName }) {
  // Generate PDF with QR codes for all tickets
  const pdfBuffer = await generateTicketPDF({ event, tickets, order, userName });

  const eventDate = new Date(event.event_start).toLocaleDateString("en-US", {
    timeZone: "America/Chicago", weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = new Date(event.event_start).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago", hour: "numeric", minute: "2-digit",
  });
  const endTime = new Date(event.event_end).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago", hour: "numeric", minute: "2-digit",
  });

  // Build simple ticket summary rows for the email body
  const ticketRows = tickets.map((ticket, idx) => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #f0f0f0;">
        <strong style="color:#1C1917;">Ticket #${idx + 1}</strong>
        &nbsp;·&nbsp;
        <span style="color:#57534E;">${ticket.ticket_tiers?.name || "General Admission"}</span>
        ${ticket.seats?.label ? `&nbsp;·&nbsp;<span style="color:#DC3545;">Seat ${ticket.seats.label}</span>` : ""}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #f0f0f0; color:#A8A29E; font-family:monospace; font-size:12px;">
        ${ticket.barcode}
      </td>
    </tr>`).join("");

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family:'Helvetica Neue',Arial,sans-serif; background:#f5f5f5; padding:40px 0; margin:0;">
    <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#DC3545,#D4920B); padding:36px 32px; text-align:center;">
        <div style="font-size:32px; margin-bottom:8px;">🎪</div>
        <h1 style="color:#fff; margin:0; font-size:26px; font-weight:800; letter-spacing:-0.5px;">FunAsia Events</h1>
        <p style="color:rgba(255,255,255,0.88); margin:8px 0 0; font-size:15px;">Your tickets are confirmed!</p>
      </div>

      <!-- Body -->
      <div style="padding:32px;">
        <p style="font-size:16px; color:#1C1917; margin:0 0 8px;">Hi <strong>${userName || "there"}</strong>,</p>
        <p style="color:#57534E; line-height:1.65; margin:0 0 24px;">
          Your order for <strong>${event.title}</strong> is confirmed.
          Your tickets are attached as a PDF — open it, print it, or show it on your phone at the door.
          Each ticket has a unique QR code that will be scanned at entry.
        </p>

        <!-- Event card -->
        <div style="background:#FDFAF6; border:1px solid #E7E5E4; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
          <h2 style="margin:0 0 14px; color:#1C1917; font-size:18px;">${event.title}</h2>
          <p style="margin:5px 0; color:#57534E; font-size:14px;">📅 &nbsp;${eventDate}</p>
          <p style="margin:5px 0; color:#57534E; font-size:14px;">⏰ &nbsp;${startTime} – ${endTime} CT</p>
          <p style="margin:5px 0; color:#57534E; font-size:14px;">📍 &nbsp;${event.is_online ? "Online Event" : `${event.venue_name}, ${event.city}, ${event.state}`}</p>
        </div>

        <!-- Ticket list -->
        <h3 style="margin:0 0 12px; color:#1C1917; font-size:15px;">${tickets.length} Ticket${tickets.length !== 1 ? "s" : ""} in this order</h3>
        <table style="width:100%; border-collapse:collapse; border:1px solid #f0f0f0; border-radius:8px; overflow:hidden;">
          <thead>
            <tr style="background:#f7f3ed;">
              <th style="padding:10px 16px; text-align:left; font-size:12px; color:#A8A29E; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Ticket</th>
              <th style="padding:10px 16px; text-align:left; font-size:12px; color:#A8A29E; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Code</th>
            </tr>
          </thead>
          <tbody>${ticketRows}</tbody>
        </table>

        <!-- Order total -->
        <div style="margin-top:20px; padding:16px 20px; background:#f7f3ed; border-radius:10px; display:flex; justify-content:space-between;">
          <span style="color:#A8A29E; font-size:13px;">Order #${order.order_number || order.id?.slice(0,8).toUpperCase()}</span>
          <span style="color:#1C1917; font-size:15px; font-weight:700;">Total: $${Number(order.total).toFixed(2)}</span>
        </div>

        <!-- CTA note -->
        <div style="margin-top:24px; padding:16px 20px; border-left:3px solid #DC3545; background:#fff5f6; border-radius:0 8px 8px 0;">
          <p style="margin:0; color:#57534E; font-size:13px; line-height:1.6;">
            📎 <strong>Your ticket PDF is attached.</strong> Each page is one ticket with a QR code.
            You can print them individually or show the PDF on your phone.
            Make sure your screen brightness is up when scanning.
          </p>
        </div>

        <p style="color:#A8A29E; font-size:12px; margin-top:24px; line-height:1.6;">
          Questions? Email us at <a href="mailto:support@funasia.events" style="color:#DC3545;">support@funasia.events</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#1C1917; padding:20px 32px; text-align:center;">
        <p style="color:#57534E; font-size:12px; margin:0;">© ${new Date().getFullYear()} FunAsia Events, LLC • Arlington, TX</p>
      </div>
    </div>
  </body>
  </html>`;

  const eventSlug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const pdfFilename = `funasia-tickets-${eventSlug}-order-${(order.order_number || order.id?.slice(0,8)).toUpperCase()}.pdf`;

  const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: `FunAsia Events <${process.env.MAILGUN_FROM || "event-tickets@funasia.net"}>`,
    to: userEmail,
    subject: `🎟 Your Tickets for ${event.title} — Order #${order.order_number || order.id?.slice(0,8).toUpperCase()}`,
    html,
    attachment: [
      {
        filename: pdfFilename,
        data: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return result;
}

/**
 * Send registration email OTP
 */
async function sendRegistrationOtpEmail({ email, otp }) {
  const year = new Date().getFullYear();

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family:'Helvetica Neue',Arial,sans-serif; background:#f5f5f5; padding:40px 0; margin:0;">
    <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#DC3545,#D4920B); padding:32px; text-align:center;">
        <div style="font-size:28px; margin-bottom:6px;">🎪</div>
        <h1 style="color:#fff; margin:0; font-size:22px; font-weight:800; letter-spacing:-0.5px;">FunAsia Events</h1>
        <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Verify your email address</p>
      </div>

      <!-- Body -->
      <div style="padding:36px 32px; text-align:center;">
        <h2 style="color:#1C1917; font-size:20px; font-weight:700; margin:0 0 10px;">Your verification code</h2>
        <p style="color:#57534E; font-size:14px; line-height:1.65; margin:0 0 28px;">
          Enter this code to complete your FunAsia account registration.
        </p>

        <!-- OTP Box -->
        <div style="background:#FDFAF6; border:2px solid #E7E5E4; border-radius:16px; padding:28px 24px; margin:0 auto 28px; display:inline-block; min-width:220px;">
          <div style="font-size:44px; font-weight:900; letter-spacing:0.2em; color:#1C1917; font-family:'Courier New',monospace; line-height:1;">${otp}</div>
          <p style="color:#A8A29E; font-size:12px; margin:10px 0 0;">Expires in 10 minutes</p>
        </div>

        <div style="background:#fff5f6; border-left:3px solid #DC3545; border-radius:0 8px 8px 0; padding:12px 16px; text-align:left; margin-bottom:20px;">
          <p style="margin:0; color:#57534E; font-size:13px; line-height:1.6;">
            If you didn't create a FunAsia account, you can safely ignore this email.
          </p>
        </div>

        <p style="color:#A8A29E; font-size:12px; margin:0; line-height:1.6;">
          Questions? Email us at <a href="mailto:support@funasia.events" style="color:#DC3545;">support@funasia.events</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#1C1917; padding:18px 32px; text-align:center;">
        <p style="color:#57534E; font-size:12px; margin:0;">© ${year} FunAsia Events, LLC • Arlington, TX</p>
      </div>
    </div>
  </body>
  </html>`;

  return mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: `FunAsia Events <${process.env.MAILGUN_FROM || "event-tickets@funasia.net"}>`,
    to: email,
    subject: `${otp} — Your FunAsia verification code`,
    html,
  });
}

module.exports = { sendOrderConfirmation, generateBarcode, sendRegistrationOtpEmail };

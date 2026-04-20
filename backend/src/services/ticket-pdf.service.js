const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const TZ = "America/Chicago";

function fmtDate(utcStr) {
  return new Date(utcStr).toLocaleDateString("en-US", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtTime(utcStr) {
  return new Date(utcStr).toLocaleTimeString("en-US", {
    timeZone: TZ, hour: "numeric", minute: "2-digit",
  });
}

/**
 * Generate a PDF buffer containing one ticket card per page.
 * Each ticket has a QR code that encodes the barcode ID for scanning.
 *
 * @param {object} params
 * @param {object} params.event
 * @param {object[]} params.tickets  - order_items rows
 * @param {object} params.order
 * @param {string} params.userName
 * @returns {Promise<Buffer>}
 */
async function generateTicketPDF({ event, tickets, order, userName }) {
  return new Promise(async (resolve, reject) => {
    try {
      // Pre-generate all QR code PNG buffers
      const qrBuffers = await Promise.all(
        tickets.map((t) =>
          QRCode.toBuffer(t.barcode, {
            errorCorrectionLevel: "H",
            width: 300,
            margin: 1,
            color: { dark: "#1C1917", light: "#FFFFFF" },
          })
        )
      );

      // ── PDF setup ──
      // US Letter, portrait
      const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: false });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const PW = 612; // page width  (pts)
      const PH = 792; // page height (pts)

      // ── Brand colours ──
      const RED    = "#DC3545";
      const DARK   = "#1C1917";
      const MID    = "#57534E";
      const LIGHT  = "#A8A29E";
      const CREAM  = "#FDFAF6";
      const BORDER = "#E7E5E4";

      // ── Shared helpers ──
      const cardX  = 50;
      const cardW  = PW - 100;

      function drawTicketCard(ticket, idx, qrBuf) {
        doc.addPage();

        // Page background
        doc.rect(0, 0, PW, PH).fill(CREAM);

        // ─ Card shadow (fake) ─
        doc.roundedRect(cardX + 3, 90 + 3, cardW, 480, 16).fill("#E7E5E4");

        // ─ Card body ─
        doc.roundedRect(cardX, 90, cardW, 480, 16).fill("#FFFFFF");

        // ─ Red header band ─
        doc.save();
        doc.roundedRect(cardX, 90, cardW, 90, 16).fill(RED);
        // Square off bottom corners of the header
        doc.rect(cardX, 148, cardW, 32).fill(RED);
        doc.restore();

        // FunAsia logo text in header
        doc
          .font("Helvetica-Bold")
          .fontSize(22)
          .fillColor("#FFFFFF")
          .text("🎪 FunAsia Events", cardX + 28, 112, { width: cardW - 200, align: "left" });

        // Ticket count badge in header (top-right)
        const badgeLabel = `Ticket ${idx + 1} of ${tickets.length}`;
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("rgba(255,255,255,0.85)")
          .text(badgeLabel, cardX + cardW - 160, 118, { width: 140, align: "right" });

        // ─ Event title ─
        doc
          .font("Helvetica-Bold")
          .fontSize(19)
          .fillColor(DARK)
          .text(event.title, cardX + 28, 208, { width: cardW - 200, lineBreak: true });

        // ─ Event details ─
        const detailY = 248;
        const detailLineH = 20;

        const details = [
          { icon: "📅", text: fmtDate(event.event_start) },
          { icon: "⏰", text: `${fmtTime(event.event_start)} – ${fmtTime(event.event_end)} CT` },
          { icon: "📍", text: event.is_online
              ? "Online Event"
              : `${event.venue_name}, ${event.city}, ${event.state}` },
        ];

        details.forEach((d, i) => {
          doc
            .font("Helvetica")
            .fontSize(11)
            .fillColor(MID)
            .text(`${d.icon}  ${d.text}`, cardX + 28, detailY + i * detailLineH, {
              width: cardW - 200,
            });
        });

        // ─ Divider (dashed) ─
        const divY = 330;
        doc
          .dash(6, { space: 4 })
          .moveTo(cardX + 20, divY)
          .lineTo(cardX + cardW - 20, divY)
          .strokeColor(BORDER)
          .lineWidth(1)
          .stroke()
          .undash();
        // Semicircle cutouts on sides
        doc.circle(cardX, divY, 14).fill(CREAM);
        doc.circle(cardX + cardW, divY, 14).fill(CREAM);

        // ─ Bottom half: ticket info + QR ─
        const bottomY = 350;

        // Ticket tier
        const tierName = ticket.ticket_tiers?.name || "General Admission";
        doc
          .font("Helvetica-Bold")
          .fontSize(15)
          .fillColor(DARK)
          .text(tierName, cardX + 28, bottomY);

        // Attendee name
        const attendeeName = ticket.attendee_name || userName || "Attendee";
        doc
          .font("Helvetica")
          .fontSize(12)
          .fillColor(MID)
          .text(attendeeName, cardX + 28, bottomY + 24);

        // Seat (if applicable)
        if (ticket.seats?.label) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(RED)
            .text(`Seat: ${ticket.seats.label}`, cardX + 28, bottomY + 46);
        }

        // Order number
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(LIGHT)
          .text(`Order #${order.order_number || order.id.slice(0, 8).toUpperCase()}`, cardX + 28, bottomY + 74);

        // ─ QR code ─
        const qrSize = 160;
        const qrX = cardX + cardW - qrSize - 28;
        const qrY = bottomY - 8;

        // QR border box
        doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 8).fill("#F7F3ED");
        doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

        // Barcode text under QR
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(LIGHT)
          .text(ticket.barcode, qrX - 8, qrY + qrSize + 10, {
            width: qrSize + 16,
            align: "center",
          });

        // ─ Footer strip ─
        const footerY = 528;
        doc.roundedRect(cardX, footerY, cardW, 42, 16).fill(CREAM);
        doc.rect(cardX, footerY, cardW, 20).fill(CREAM); // square top corners

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(LIGHT)
          .text(
            "Present this QR code at the venue entrance • Each code is unique and valid for one entry",
            cardX + 28,
            footerY + 12,
            { width: cardW - 56, align: "center" }
          );

        // ─ Page number ─
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(LIGHT)
          .text(`${idx + 1} / ${tickets.length}`, 0, PH - 30, {
            width: PW,
            align: "center",
          });
      }

      // ── Render one page per ticket ──
      tickets.forEach((ticket, idx) => {
        drawTicketCard(ticket, idx, qrBuffers[idx]);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTicketPDF };

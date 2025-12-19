const nodemailer = require("nodemailer");

(async () => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "automation.enschede@gmail.com",
      pass: "erguxuclwgwsqtaw",
    },
  });

  await transporter.verify();
  console.log("VERIFY OK");

  const info = await transporter.sendMail({
    from: "GSM Team <automation.enschede@gmail.com>",
    to: "automation.enschede@gmail.com",
    subject: "SMTP test",
    text: "Test mail",
  });

  console.log("SENT", info.messageId, info.accepted, info.rejected);
})();

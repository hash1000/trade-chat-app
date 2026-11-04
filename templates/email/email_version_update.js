// "New version available" email (services/VersionEmailService.js).
// The date is computed per send, not at server start.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.qrm.naskochina";
const SUPPORT_EMAIL = "naskochina@gmail.com";

function formattedDate() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

module.exports = {
  message: (version) => `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>NaskoChina ${version}</title>
      </head>
      <body style="margin: 0; font-family: Arial, Helvetica, sans-serif; background: #ffffff; font-size: 14px;">
        <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px 40px; background: #f4f7ff; color: #434343;">
          <table style="width: 100%;">
            <tr>
              <td style="font-size: 16px; font-weight: bold; color: #1f1f1f;">NaskoChina</td>
              <td style="text-align: right; font-size: 12px; color: #8c8c8c;">${formattedDate()}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; padding: 40px 24px; background: #ffffff; border-radius: 16px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f1f1f;">New version ${version} is available</h1>
            <p style="margin-top: 16px; line-height: 1.6;">
              NaskoChina has moved to a new, faster server. Please update the app to version
              <strong>${version}</strong> to keep using chats, payments and orders.
              Older versions can no longer connect.
            </p>
            <a href="${PLAY_STORE_URL}" style="display: inline-block; margin-top: 24px; padding: 12px 28px; background-color: #3e9f3e; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 6px;">Update on Google Play</a>
            <p style="margin-top: 24px; font-size: 13px; color: #8c8c8c;">You can also use NaskoChina in your browser at <a href="https://chatqrm.com" style="color: #3e9f3e;">chatqrm.com</a>.</p>
          </div>
          <p style="margin-top: 24px; text-align: center; font-size: 12px; color: #8c8c8c;">
            Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color: #3e9f3e;">${SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </body>
    </html>`,
  subject_mail: "Please update NaskoChina",
};

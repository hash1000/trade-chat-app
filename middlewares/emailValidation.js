const crypto = require("crypto");

// Retrieve password from environment variable
const password = process.env["CRYPT_PASSWORD"];
const EXPIRY_TIME = 2 * 60 * 1000;

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest();
}

function password_derive_bytes(password, salt, iterations, len) {
  var key = Buffer.from(password + salt);
  for (var i = 0; i < iterations; i++) {
    key = sha1(key);
  }
  if (key.length < len) {
    var hx = password_derive_bytes(password, salt, iterations - 1, 20);
    for (var counter = 1; key.length < len; ++counter) {
      key = Buffer.concat([
        key,
        sha1(Buffer.concat([Buffer.from(counter.toString()), hx])),
      ]);
    }
  }
  return Buffer.alloc(len, key);
}

async function encode(string) {
  const timestamp = Date.now();
  const data = JSON.stringify({ data: string, timestamp });

  // Generate new IV each time
  const iv = crypto.randomBytes(16);

  const key = password_derive_bytes(password, "", 100, 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);

  // Store iv + encrypted together (base64)
  return Buffer.concat([iv, encrypted]).toString("base64");
}

async function decode(string) {
  const input = Buffer.from(string, "base64");

  // Extract iv (first 16 bytes)
  const iv = input.subarray(0, 16);
  const encrypted = input.subarray(16);

  const key = password_derive_bytes(password, "", 100, 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  const parsedData = JSON.parse(decrypted);

  if (!parsedData.timestamp) {
    throw new Error("Invalid token format");
  }

  const currentTime = Date.now();
  if (currentTime - parsedData.timestamp > EXPIRY_TIME) {
    throw new Error("Token has expired");
  }

  return parsedData.data;
}

module.exports = { encode, decode };

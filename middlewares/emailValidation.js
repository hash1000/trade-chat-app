const crypto = require("crypto");

// Retrieve password from environment variable
const password = process.env["CRYPT_PASSWORD"];

// Use a secure random value for IV
const iv = crypto.randomBytes(16);

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
  const data = JSON.stringify({ data: string, timestamp: timestamp });
  var key = password_derive_bytes(password, "", 100, 32);
  var cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  var part1 = cipher.update(data, "utf8");
  var part2 = cipher.final();
  const encrypted = Buffer.concat([part1, part2]).toString("base64");
  return encrypted;
}

async function decode(string) {
  var key = password_derive_bytes(password, "", 100, 32);
  var decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  var decrypted = decipher.update(string, "base64", "utf8");
  decrypted += decipher.final();
  const parsedData = JSON.parse(decrypted);
  // Check if the token is still valid (1 minute = 60,000 milliseconds)
  const currentTime = Date.now();
  if (currentTime - parsedData.timestamp > 80000) {
    throw new Error("Token has expired");
  }

  return parsedData.data;
}

module.exports = { encode, decode };

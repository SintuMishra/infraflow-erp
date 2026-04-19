const crypto = require("crypto");

const buildUsernameFromEmployeeCode = (employeeCode) => {
  const year = new Date().getFullYear();
  return `${employeeCode}${year}`;
};

const generateTemporaryPassword = () => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const allChars = `${uppercase}${lowercase}${digits}${symbols}`;

  const requiredChars = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  while (requiredChars.length < 12) {
    requiredChars.push(allChars[crypto.randomInt(allChars.length)]);
  }

  for (let index = requiredChars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [requiredChars[index], requiredChars[swapIndex]] = [
      requiredChars[swapIndex],
      requiredChars[index],
    ];
  }

  return requiredChars.join("");
};

const generatePasswordResetOtp = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const generateSessionToken = () => crypto.randomBytes(48).toString("hex");

const hashSensitiveToken = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

module.exports = {
  buildUsernameFromEmployeeCode,
  generateTemporaryPassword,
  generatePasswordResetOtp,
  generateSessionToken,
  hashSensitiveToken,
};

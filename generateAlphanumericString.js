const crypto = require('crypto');

function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

const generateAlphanumericString = async function () {
  // Limit the length to 128 characters
  const maxLength = Math.min(20, 128);
  return generateRandomString(maxLength);
}
module.exports = generateAlphanumericString;

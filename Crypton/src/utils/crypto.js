// src/utils/crypto.js

const bufferToBase64 = (buffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

const base64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const encodeText = (text) => new TextEncoder().encode(text);
const decodeText = (buffer) => new TextDecoder().decode(buffer);

function generateRandomString(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return bufferToBase64(array);
}

// NEW: PBKDF2 Derivation Function
async function deriveKey(urlKey, userPassword, saltBuffer) {
  const combinedMaterial = urlKey + (userPassword || "");
  
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encodeText(combinedMaterial),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000, // 100k rounds to defeat brute-force attacks
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPaste(plainText, userPassword = "") {
  const urlKey = generateRandomString(16); // The random part for the URL
  const saltBuffer = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBuffer = window.crypto.getRandomValues(new Uint8Array(12));

  // Derive the AES key using PBKDF2
  const aesKey = await deriveKey(urlKey, userPassword, saltBuffer);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    aesKey,
    encodeText(plainText)
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(ivBuffer),
    salt: bufferToBase64(saltBuffer), // NEW: We must send this to the server
    keyToShare: urlKey 
  };
}

export async function decryptPaste(ciphertextB64, ivB64, saltB64, urlKey, userPassword = "") {
  try {
    const aesKey = await deriveKey(urlKey, userPassword, base64ToBuffer(saltB64));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(ivB64) },
      aesKey,
      base64ToBuffer(ciphertextB64)
    );

    return decodeText(decryptedBuffer);
  } catch (error) {
    // If decryption fails, it means the key derived from the password was wrong
    throw new Error("WRONG_PASSWORD");
  }
}
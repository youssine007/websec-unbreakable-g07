// One-time pad in modulo 37
const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"  
const MOD = ALFABET.length                               

function transform(tekst: string, key: string, richting: 1 | -1): string {
  if (key.length < tekst.length) {
    throw new Error("Sleutel is korter dan het bericht")
  }
  let out = ""
  for (let i = 0; i < tekst.length; i++) {
    const ti = ALFABET.indexOf(tekst.charAt(i))
    const ki = ALFABET.indexOf(key.charAt(i))
    if (ti === -1 || ki === -1) { //AI
      throw new Error(`Ongeldig teken op positie ${i}`)
    }
    const idx = (ti + richting * ki + MOD) % MOD
    out += ALFABET.charAt(idx)
  }
  return out
}

export function encrypt(bericht: string, key: string): string {
  return transform(bericht, key, 1)
}

export function decrypt(cipher: string, key: string): string {
  return transform(cipher, key, -1)
}

// HMAC-SHA256 AI 
function utf8(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

function fromHex(hex: string): ArrayBuffer {
  const buffer = new ArrayBuffer(hex.length / 2)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return buffer
}

async function importHmacKey(hmacKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

export async function signMac(ciphertext: string, hmacKey: string): Promise<string> {
  const key = await importHmacKey(hmacKey)
  const sig = await crypto.subtle.sign("HMAC", key, utf8(ciphertext))
  return toHex(sig)
}

export async function verifyMac(ciphertext: string, hmacKey: string, mac: string): Promise<boolean> {
  const key = await importHmacKey(hmacKey)
  return crypto.subtle.verify("HMAC", key, fromHex(mac), utf8(ciphertext))
}
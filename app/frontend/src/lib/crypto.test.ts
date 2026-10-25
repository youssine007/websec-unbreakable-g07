import { describe, it, expect } from "vitest"
import { encrypt, decrypt, signMac, verifyMac } from "./crypto"


// Test is ook geschreven met AI
describe("otp mod 37 + hmac", () => {
  const k = "LW23XTF6P5H2TOZRJE6D2QGU28LSGPAP6QXA4LHP"

  it("encrypt → decrypt geeft het origineel terug", () => {
    const c = encrypt("DIT_IS_EEN_TEST", k)
    expect(decrypt(c, k)).toBe("DIT_IS_EEN_TEST")
  })

  it("weigert een te korte sleutel", () => {
    expect(() => encrypt("DIT_IS_EEN_TEST", "ABC")).toThrow()
  })

  it("MAC klopt en detecteert knoeien", async () => {
    const ct = encrypt("DIT_IS_EEN_TEST", k)
    const mac = await signMac(ct, "HMAC_SLEUTEL_1")
    expect(await verifyMac(ct, "HMAC_SLEUTEL_1", mac)).toBe(true)

    const geknoeid = (ct[0] === "A" ? "B" : "A") + ct.slice(1)
    expect(await verifyMac(geknoeid, "HMAC_SLEUTEL_1", mac)).toBe(false)
  })
})
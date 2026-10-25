import { useEffect, useRef, useState } from "react"
import { FullMessenger } from "@/components/ui/chat"
import type { ChatMessageData } from "@/components/ui/chat"
import { connectChannelSocket, listMessages, sendMessage, type ApiMessage } from "@/lib/api"
import { encrypt, decrypt, signMac, verifyMac } from "@/lib/crypto"

function toChatMessage(msg: ApiMessage): ChatMessageData {
  return {
    id: msg.id,
    senderId: msg.sender,
    senderName: msg.sender,
    text: msg.text,
    timestamp: new Date(msg.created_at),
    status: "sent",
  }
}

// Alleen A-Z, 0-9 en _ zijn geldig. Kleine letters -> hoofdletters, spatie -> _.
function normaliseer(tekst: string): string {
  const out = tekst.toUpperCase().replace(/ /g, "_")
  if (!/^[A-Z0-9_]*$/.test(out)) {
    throw new Error("Alleen letters, cijfers en spaties zijn toegestaan")
  }
  return out
}

export function ChatScreen({
  currentUser,
  targetUser,
  onSwitchTarget,
}: {
  currentUser: string
  targetUser: string
  onSwitchTarget: () => void
}) {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const seenIds = useRef(new Set<string>())

  // Verzenden
  const [key, setKey] = useState("")
  const [line, setLine] = useState("")
  const [hmacKey, setHmacKey] = useState("")

  // Ontvangen / ontsleutelen
  const [lastIncoming, setLastIncoming] = useState<ApiMessage | null>(null)
  const [dKey, setDKey] = useState("")
  const [dHmac, setDHmac] = useState("")
  const [plain, setPlain] = useState("")
  const [macOk, setMacOk] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    listMessages(currentUser, targetUser).then((history) => {
      if (cancelled) return
      const newHistory = history.filter((m) => !seenIds.current.has(m.id))
      for (const m of newHistory) seenIds.current.add(m.id)
      const incoming = newHistory.filter((m) => m.sender !== currentUser)
      if (incoming.length > 0) setLastIncoming(incoming[incoming.length - 1])
      if (newHistory.length === 0) return
      setMessages((prev) =>
        [...prev, ...newHistory.map(toChatMessage)].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      )
    })

    const ws = connectChannelSocket(currentUser, targetUser, (msg) => {
      if (seenIds.current.has(msg.id)) return
      seenIds.current.add(msg.id)
      if (msg.sender !== currentUser) setLastIncoming(msg)
      setMessages((prev) => [...prev, toChatMessage(msg)])
    })

    return () => {
      cancelled = true
      ws.close()
    }
  }, [currentUser, targetUser])

  async function handleSend(text: string) {
    try {
      const bericht = normaliseer(text)
      const ciphertext = encrypt(bericht, key)
      const mac = await signMac(ciphertext, hmacKey)
      await sendMessage(currentUser, targetUser, currentUser, ciphertext, Number(line), mac)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function ontsleutel() {
    if (!lastIncoming) return
    // Eerst integriteit: klopt de MAC niet, dan tonen we niets.
    const ok = await verifyMac(lastIncoming.text, dHmac, lastIncoming.mac)
    setMacOk(ok)
    if (!ok) {
      setPlain("")
      return
    }
    try {
      setPlain(decrypt(lastIncoming.text, dKey))
    } catch (e) {
      setPlain("(fout: " + (e as Error).message + ")")
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Verzenden */}
      <div className="flex flex-wrap items-center gap-2 border-b p-2 text-sm">
        <span className="font-medium">Verzenden:</span>
        <input className="rounded border px-2 py-1" placeholder="Sleutel (codeboekregel)"
          value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="w-24 rounded border px-2 py-1" placeholder="Regelnr"
          value={line} onChange={(e) => setLine(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="HMAC-sleutel"
          value={hmacKey} onChange={(e) => setHmacKey(e.target.value)} />
      </div>

      {/* Ontsleutelen */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-neutral-50 p-2 text-sm">
        <span className="font-medium">Ontsleutel laatste bericht:</span>
        <span className="text-neutral-500">
          {lastIncoming ? `regel ${lastIncoming.line}` : "(nog geen bericht)"}
        </span>
        <input className="rounded border px-2 py-1" placeholder="Sleutel"
          value={dKey} onChange={(e) => setDKey(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="HMAC-sleutel"
          value={dHmac} onChange={(e) => setDHmac(e.target.value)} />
        <button className="rounded border bg-white px-3 py-1" onClick={ontsleutel}>
          Ontsleutel
        </button>
        {macOk !== null && (
          <span className={macOk ? "text-green-600" : "text-red-600"}>
            MAC {macOk ? "OK" : "ONGELDIG"}
          </span>
        )}
        {plain && <span className="font-mono">→ {plain}</span>}
      </div>

      <div className="min-h-0 flex-1">
        <FullMessenger
          currentUser={{ id: currentUser, name: currentUser }}
          conversations={[{ id: targetUser, title: targetUser, presence: "online" }]}
          activeConversationId={targetUser}
          onSelectConversation={onSwitchTarget}
          messages={messages}
          onSend={handleSend}
          title="Chats"
          features={{ reactions: false, replies: false, editDelete: false, pin: false }}
          enableAttachments={false}
          showHeaderActions={false}
          showSidebarSearch={false}
          showNewConversation={false}
        />
      </div>
    </div>
  )
}

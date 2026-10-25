import { useEffect, useRef, useState } from "react"
import { FullMessenger } from "@/components/ui/chat"
import type { ChatMessageData } from "@/components/ui/chat"
import { connectChannelSocket, listMessages, sendMessage, type ApiMessage } from "@/lib/api"

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

  useEffect(() => {
    let cancelled = false

    listMessages(currentUser, targetUser).then((history) => {
      if (cancelled) return
      // Merge rather than replace: a live message can arrive over the
      // websocket before this history fetch resolves, and overwriting
      // state wholesale here would silently drop it.
      const newHistory = history.filter((m) => !seenIds.current.has(m.id))
      for (const m of newHistory) seenIds.current.add(m.id)
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
      setMessages((prev) => [...prev, toChatMessage(msg)])
    })

    return () => {
      cancelled = true
      ws.close()
    }
  }, [currentUser, targetUser])

  async function handleSend(text: string) {
    await sendMessage(currentUser, targetUser, currentUser, text)
  }

  return (
    <FullMessenger
      currentUser={{ id: currentUser, name: currentUser }}
      conversations={[{ id: targetUser, title: targetUser, presence: "online" }]}
      activeConversationId={targetUser}
      onSelectConversation={onSwitchTarget}
      messages={messages}
      onSend={handleSend}
      title="Chats"
      // Not implemented yet: no reactions, replies, edit/delete, pin, attachments,
      // or search/call on the backend. Flip these on when those features land.
      features={{ reactions: false, replies: false, editDelete: false, pin: false }}
      enableAttachments={false}
      showHeaderActions={false}
      showSidebarSearch={false}
      showNewConversation={false}
    />
  )
}

import { useState } from "react"
import { ChatScreen } from "@/components/ChatScreen"
import { TargetUserPrompt } from "@/components/TargetUserPrompt"
import { UsernamePrompt } from "@/components/UsernamePrompt"

const USERNAME_KEY = "securechat.username"

function App() {
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY)
  )
  const [targetUser, setTargetUser] = useState<string | null>(null)

  function handleSetUsername(name: string) {
    localStorage.setItem(USERNAME_KEY, name)
    setUsername(name)
  }

  if (!username) {
    return <UsernamePrompt onSubmit={handleSetUsername} />
  }

  if (!targetUser) {
    return <TargetUserPrompt currentUser={username} onSubmit={setTargetUser} />
  }

  return (
    <div className="h-screen w-screen">
      <ChatScreen
        key={targetUser}
        currentUser={username}
        targetUser={targetUser}
        onSwitchTarget={() => setTargetUser(null)}
      />
    </div>
  )
}

export default App

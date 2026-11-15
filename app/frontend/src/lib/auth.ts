import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts"

// Eén centrale UserManager voor de hele app.
// De library regelt PKCE (verifier + challenge), state en nonce zelf.
export const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  // Moet exact overeenkomen met "Valid redirect URIs" in Keycloak.
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: "code",
  scope: "openid profile",
  // Tokens in sessionStorage: verdwijnen als het tabblad sluit.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  // Vernieuwt het access token vlak voor het verloopt, met het refresh token.
  automaticSilentRenew: true,
})

let startupPromise: Promise<User | null> | null = null

function cleanUrl() {
  window.history.replaceState({}, document.title, window.location.pathname)
}

/**
 * Wordt één keer opgeroepen bij het laden van de app.
 * - Komen we terug van Keycloak met ?code=..., dan wisselen we die code in.
 * - Komen we terug met ?error=..., dan geven we die fout door.
 * - Anders kijken we of er al een (geldige) sessie in sessionStorage zit.
 * De promise wordt hergebruikt, zodat React's StrictMode de code niet twee keer inwisselt.
 */
export function initAuth(): Promise<User | null> {
  if (startupPromise) return startupPromise

  const params = new URLSearchParams(window.location.search)

  if (params.has("code") && params.has("state")) {
    startupPromise = userManager.signinRedirectCallback().finally(cleanUrl)
  } else if (params.has("error")) {
    const message = params.get("error_description") ?? params.get("error") ?? "login failed"
    cleanUrl()
    startupPromise = Promise.reject(new Error(message))
  } else {
    startupPromise = userManager.getUser().then(async (user) => {
      if (!user) return null
      if (!user.expired) return user
      // Access token verlopen: probeer te vernieuwen met het refresh token.
      return userManager.signinSilent().catch(() => null)
    })
  }

  return startupPromise
}

export function login() {
  return userManager.signinRedirect()
}

export function logout() {
  return userManager.signoutRedirect()
}

/** Geeft een geldig access token terug, of stuurt de gebruiker naar de loginpagina. */
export async function getAccessToken(): Promise<string> {
  let user = await userManager.getUser()
  if (user?.expired) {
    user = await userManager.signinSilent().catch(() => null)
  }
  if (!user) {
    await userManager.signinRedirect()
    throw new Error("Not logged in, redirecting to login")
  }
  return user.access_token
}

/**
 * renderSnippet — substitute {{vars}} into a quick-reply body.
 *
 * An unknown token stays visible verbatim (never blank, never an exception):
 * a rep must see that a placeholder did not resolve, mid-conversation.
 */
export type SnippetVars = Record<string, unknown>

const TOKEN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

function stringify(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

export function renderSnippet(body: string, vars: SnippetVars): string {
  return body.replace(TOKEN, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return token
    return stringify(vars[key])
  })
}

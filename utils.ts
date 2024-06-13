export const HTTP_OK = 200
export const HTTP_BAD_REQUEST = 400
export const HTTP_INTERNAL_SERVER_ERROR = 500

export const linkRegex = /<a (.+?)>/g
export const hrefRegex = /href=(["'])(.*?)\1/

export function haveSameOrigin(url1: string, url2: string): boolean {
  if (!URL.canParse(url1) || !URL.canParse(url2)) {
    return false
  }

  const origin1 = new URL(url1).origin
  const origin2 = new URL(url2).origin
  return origin1 === origin2
}

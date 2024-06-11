import express, { type Request } from "express"
import { hrefRegex, linkRegex } from "./utils"

const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_INTERNAL_SERVER_ERROR = 500
const RETRY_COUNT_LIMIT = 2

type CrawlRequest = { url: string }
type CrawlResponse =
  // Bad Request
  | { message: string }
  // Internal Server Error
  | { error: string }
  // Ok
  | string[]

type UrlInfo = {
  status: number
  retryCount: number
}

export const router = express.Router()

router.post(
  "/",
  async (req: Request<{}, CrawlResponse, CrawlRequest>, res, next) => {
    try {
      const { url } = req.body
      if (!url) {
        res.status(HTTP_BAD_REQUEST).send({
          message: "Empty request",
        })
        return
      }

      const urls = await crawl(url)
      res.status(HTTP_OK).send(urls)
    } catch (error) {
      res.status(HTTP_INTERNAL_SERVER_ERROR).send({
        error: (error as Error).message,
      })
      next()
    }
  }
)

async function crawl(startUrl: string): Promise<string[]> {
  const queue: string[] = []
  const visited: Record<string, UrlInfo> = {}
  queue.push(startUrl)

  // NOTE: Modify this to control when do you want to stop "crawling".
  const STOP_AFTER = 20

  for (let i = 0; i < Math.min(queue.length, STOP_AFTER); i++) {
    const currentUrl = queue[i]
    const response = await fetch(currentUrl)
    const isSuccess = response.status === HTTP_OK
    const isServerError = response.status >= HTTP_INTERNAL_SERVER_ERROR
    const retryCount =
      currentUrl in visited ? visited[currentUrl].retryCount : 0
    const retryLimitExceeded = retryCount >= RETRY_COUNT_LIMIT

    if (isSuccess) {
      visited[currentUrl] = {
        status: HTTP_OK,
        retryCount: 0,
      }
    } else if (isServerError && !retryLimitExceeded) {
      visited[currentUrl] = {
        status: HTTP_INTERNAL_SERVER_ERROR,
        retryCount: retryCount + 1,
      }
      // Send the current url back to the end of the queue
      // until the retry limit hasn't been exceeded.
      queue.push(currentUrl)
    }

    const html = await response.text()
    const urls = await getUrlsFrom(html, currentUrl)

    urls.forEach((url) => {
      if (url in visited) {
        return
      }
      queue.push(url)
    })
  }

  return Object.keys(visited).filter((url) => visited[url].status === HTTP_OK)
}

async function getUrlsFrom(html: string, url: string): Promise<string[]> {
  const urls = new Set(
    html
      // Matches all <a> elements.
      .match(linkRegex)
      ?.map(
        (link) =>
          // The first group matches the quotes of the href attribute.
          // The second group contains the actual url.
          link.match(hrefRegex)?.at(2) ?? ""
      )
      .map((innerUrl) =>
        innerUrl.startsWith("www") ? "http://" + innerUrl : innerUrl
      )
      .map(
        (innerUrl) =>
          // As the url can be relative, we provide the domain of the
          // current url as the 2nd parameter.
          new URL(innerUrl, url)
      )
      .map((innerUrl) => innerUrl.origin + innerUrl.pathname)
  )
  return Array.from(urls)
}

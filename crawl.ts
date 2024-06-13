import express, { type Request } from "express"
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  haveSameOrigin,
  hrefRegex,
  linkRegex,
} from "./utils"

const RETRY_COUNT_LIMIT = 2
const NOT_ASKED = -1

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
      next(error)
    }
  }
)

async function crawl(startUrl: string): Promise<string[]> {
  const queue: string[] = []
  const visited: Record<string, UrlInfo> = {}
  queue.push(startUrl)
  visited[startUrl] = {
    status: NOT_ASKED,
    retryCount: 0,
  }

  // NOTE: Modify this to control when to stop "crawling".
  const STOP_AFTER = 25

  for (let i = 0; i < Math.min(queue.length, STOP_AFTER); i++) {
    const currentUrl = queue[i]

    // Skip if the url is not valid.
    if (!URL.canParse(currentUrl)) {
      continue
    }

    const response = await fetch(currentUrl)
    const isSuccess = response.status === HTTP_OK
    const isServerError = response.status >= HTTP_INTERNAL_SERVER_ERROR
    const retryCount =
      currentUrl in visited ? visited[currentUrl].retryCount : 0
    const retryLimitExceeded = retryCount >= RETRY_COUNT_LIMIT

    if (isSuccess) {
      visited[currentUrl].status = HTTP_OK
    } else if (isServerError && !retryLimitExceeded) {
      visited[currentUrl].status = HTTP_INTERNAL_SERVER_ERROR
      visited[currentUrl].retryCount += 1
      // Send the current url back to the end of the queue
      // until the retry limit hasn't been exceeded.
      queue.push(currentUrl)
    }

    const html = await response.text()
    const urls = await getUrlsFrom(html, currentUrl)

    urls.forEach((url) => {
      // Skip urls that we've already processed.
      if (url in visited) {
        return
      }

      // Skip urls that takes us to a different origin.
      if (!haveSameOrigin(url, startUrl)) {
        return
      }

      // Add the rest to the queue.
      queue.push(url)
      visited[url] = {
        status: NOT_ASKED,
        retryCount: 0,
      }
    })
  }

  // We only care about the "good" urls.
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

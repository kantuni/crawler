import express, { type Request, type Response } from "express"
import { router as crawlRouter } from "./crawl"
import { HTTP_INTERNAL_SERVER_ERROR } from "./utils"

const PORT = 3030
const app = express()

// Middleware
app.use(express.json())

// Routes
app.use("/parse", crawlRouter)

// Error handling
app.use((error: Error, req: Request, res: Response) => {
  res.status(HTTP_INTERNAL_SERVER_ERROR)
  res.send({
    error: error.message,
  })
})

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`)
})

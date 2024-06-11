import express from "express"
import { router as crawlRouter } from "./crawl"

const port = 3030
const app = express()

// Middleware
app.use(express.json())

// Routes
app.use("/crawl", crawlRouter)

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})

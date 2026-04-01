/**
 * Process supervisor — auto-restarts the proxy on crash.
 *
 * Spawns the proxy as a child process for isolation (crashes don't kill the
 * supervisor). Matches the behavior of the former shell-based supervisor:
 * restart on crash/signal with 1s delay, bail after 50 rapid restarts in 60s.
 */

const MAX_RAPID_RESTARTS = 50
const RAPID_WINDOW_MS = 60_000

export async function supervise(command: string[]): Promise<never> {
  let restartCount = 0
  let windowStart = Date.now()
  let shuttingDown = false

  const forward = () => {
    shuttingDown = true
  }
  process.on("SIGTERM", forward)
  process.on("SIGINT", forward)

  while (true) {
    const now = Date.now()
    if (now - windowStart > RAPID_WINDOW_MS) {
      restartCount = 0
      windowStart = now
    }

    restartCount++
    if (restartCount > MAX_RAPID_RESTARTS) {
      console.error(`[supervisor] Too many restarts (${restartCount} in ${RAPID_WINDOW_MS / 1000}s). Stopping.`)
      process.exit(1)
    }

    if (restartCount > 1) {
      console.log(`[supervisor] Restarting proxy (restart #${restartCount})...`)
    } else {
      console.log("[supervisor] Starting proxy...")
    }

    const child = Bun.spawn(command, {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    })

    // Forward signals to child
    const signalHandler = () => {
      child.kill("SIGTERM")
    }
    process.on("SIGTERM", signalHandler)
    process.on("SIGINT", signalHandler)

    const exitCode = await child.exited

    process.off("SIGTERM", signalHandler)
    process.off("SIGINT", signalHandler)

    if (shuttingDown || exitCode === 0) {
      console.log("[supervisor] Proxy exited cleanly.")
      process.exit(0)
    }

    if (exitCode > 128) {
      const sig = exitCode - 128
      console.log(`[supervisor] Proxy killed by signal ${sig}. Restarting in 1s...`)
    } else {
      console.log(`[supervisor] Proxy exited (code ${exitCode}). Restarting in 1s...`)
    }

    await Bun.sleep(1000)
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startGradingWorker } = await import('./lib/grading-worker')
    startGradingWorker()
  }
}
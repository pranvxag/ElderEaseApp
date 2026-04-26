const killPort = require('kill-port');

const rawPort = process.env.PORT || '3000';
const port = Number(rawPort);

if (!Number.isFinite(port) || port <= 0) {
  console.warn(`[proxy:prestart] Invalid PORT value "${rawPort}". Skipping port cleanup.`);
  process.exit(0);
}

async function run() {
  try {
    await killPort(port, 'tcp');
    console.log(`[proxy:prestart] Released port ${port}.`);
  } catch (error) {
    const message = String(error?.message || error);

    // If nothing is listening on the port, startup can continue safely.
    if (/no process|couldn't find|not running|process is not running/i.test(message)) {
      console.log(`[proxy:prestart] Port ${port} already free.`);
      return;
    }

    console.warn(`[proxy:prestart] Could not clean port ${port}: ${message}`);
  }
}

run().finally(() => process.exit(0));

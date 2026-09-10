const http = require('http');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/db');
const app = require('./src/app');
const { initSocket } = require('./src/sockets');
const meetingService = require('./src/services/meetingService');

const MEETING_SWEEP_INTERVAL = 60 * 1000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  // Flips meeting statuses, sends "starting soon" / "live now" pushes,
  // and finalizes attendance once a class ends.
  const sweep = setInterval(
    () => meetingService.runMeetingScheduler(env.TEACHER_NAME),
    MEETING_SWEEP_INTERVAL
  );
  meetingService.runMeetingScheduler(env.TEACHER_NAME);

  server.listen(env.PORT, () => {
    logger.info(`${env.PLATFORM_NAME} API listening on http://localhost:${env.PORT}`);
    logger.info(`Allowed client origin: ${env.CLIENT_URL}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(sweep);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});

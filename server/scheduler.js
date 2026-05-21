import cron from 'node-cron';

let currentTask = null;

export function startScheduler(cronExpression, onTick) {
  stopScheduler();
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
  currentTask = cron.schedule(cronExpression, onTick, { timezone: 'Asia/Seoul' });
}

export function stopScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
}

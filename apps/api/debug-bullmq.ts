process.env['REDIS_URL'] = 'redis://127.0.0.1:6380';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

async function main(): Promise<void> {
  const connection = new IORedis('redis://127.0.0.1:6380', { maxRetriesPerRequest: null });
  const queue = new Queue('probe2', { connection: connection.duplicate() });
  await queue.obliterate({ force: true });
  const events = new QueueEvents('probe2', { connection: connection.duplicate() });
  events.on('failed', ({ jobId, failedReason }) => console.log('EVENT failed', jobId, failedReason));
  events.on('delayed', ({ jobId }) => console.log('EVENT delayed', jobId));
  events.on('completed', ({ jobId }) => console.log('EVENT completed', jobId));
  events.on('error', (e: unknown) => console.log('EVENT error', e));
  const worker = new Worker(
    'probe2',
    async (job) => {
      console.log('ENTRY attemptsMade=', job.attemptsMade, 'id=', job.id);
      throw new Error('boom-transient');
    },
    { connection: connection.duplicate(), concurrency: 2 }
  );
  await worker.waitUntilReady();
  await queue.add('t', { x: 1 }, { jobId: 'probe2-1', attempts: 2, backoff: { type: 'exponential', delay: 100 } });
  await new Promise((r) => setTimeout(r, 8000));
  const j = await queue.getJob('probe2-1');
  console.log('final state:', await j?.getState(), 'attemptsMade:', j?.attemptsMade);
  await events.close();
  await worker.close();
  await queue.close();
  connection.disconnect();
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

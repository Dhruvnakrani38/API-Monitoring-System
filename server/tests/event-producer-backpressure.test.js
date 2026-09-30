import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { EventProducer } from '../src/shared/events/producer/eventProducer.js';

class FakeConfirmChannel extends EventEmitter {
  publish(exchange, queue, content, options, callback) {
    process.nextTick(() => callback(null));
    return true;
  }
}

class BackpressuredConfirmChannel extends EventEmitter {
  constructor() {
    super();
    this.publishCalls = 0;
  }

  publish(exchange, queue, content, options, callback) {
    this.publishCalls += 1;
    process.nextTick(() => callback(null));
    return this.publishCalls > 1;
  }
}

const buildProducer = (channel) => new EventProducer({
  channelManager: { getChannel: async () => channel },
  circuitBreaker: { allowRequest: () => true, onSuccess() {}, onFailure() {} },
  retryStrategy: { shouldRetry: () => false },
  logger: { info() {}, error() {}, debug() {} },
  queueName: 'hits',
});

test('confirmed publishes do not retain drain listeners without back-pressure', async () => {
  const channel = new FakeConfirmChannel();
  const producer = buildProducer(channel);

  for (let index = 0; index < 100; index += 1) {
    await producer.publishApiHit({ eventId: `event-${index}`, endpoint: '/demo' });
  }

  assert.equal(channel.listenerCount('drain'), 0);
});

test('confirmed publish responds before drain and later publishes wait on one shared drain', async () => {
  const channel = new BackpressuredConfirmChannel();
  const producer = buildProducer(channel);
  let firstResolved = false;
  const first = producer.publishApiHit({ eventId: 'pressured-first', endpoint: '/demo' });
  first.then(() => { firstResolved = true; });
  const second = producer.publishApiHit({ eventId: 'pressured-second', endpoint: '/demo' });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(channel.listenerCount('drain'), 1);
  const resolvedBeforeDrain = firstResolved;
  channel.emit('drain');
  await Promise.all([first, second]);
  assert.equal(resolvedBeforeDrain, true);
  assert.equal(channel.publishCalls, 2);
  assert.equal(channel.listenerCount('drain'), 0);
});

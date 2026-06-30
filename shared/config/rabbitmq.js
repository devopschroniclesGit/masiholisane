const amqplib = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'masiholisane.events';
const RECONNECT_DELAY = 5000;

let connection = null;
let channel = null;

async function connect() {
  try {
    connection = await amqplib.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    logger.info('RabbitMQ connected exchange: ' + EXCHANGE);

    connection.on('close', () => {
      logger.warn('RabbitMQ closed reconnecting in 5s...');
      channel = null;
      connection = null;
      setTimeout(connect, RECONNECT_DELAY);
    });

    return channel;
  } catch (err) {
    logger.error('RabbitMQ connect failed: ' + err.message);
    setTimeout(connect, RECONNECT_DELAY);
  }
}

async function publish(routingKey, payload) {
  if (!channel) {
    logger.warn('RabbitMQ not ready skipping event: ' + routingKey);
    return false;
  }
  try {
    const msg = Buffer.from(JSON.stringify({
      ...payload,
      routingKey,
      publishedAt: new Date().toISOString(),
    }));
    channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
    logger.info('RabbitMQ published: ' + routingKey);
    return true;
  } catch (err) {
    logger.error('RabbitMQ publish failed: ' + err.message);
    return false;
  }
}

module.exports = { connect, publish, EXCHANGE };

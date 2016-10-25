const amqp = require('amqplib');
const events = require('events');

var open = (host) => amqp.connect(`amqp://${host}`);

function makeConnectionPromise(amqpHost) {
  return function () {
    if (this._connectionPromise) {
      return this._connectionPromise;
    }
    this._connectionPromise = open(amqpHost);
    return this._connectionPromise;
  }
}

class Publisher {
  constructor(opts) {
    opts = opts || {};
    let amqpHost = opts.amqpHost || 'localhost';
    this.connectionPromise = makeConnectionPromise(amqpHost).bind(this);
    return this;
  }

  publish(exchange, message) {
    return this.connectionPromise()
      .then(conn => conn.createChannel())
      .then(ch => {
        this.ch = ch;
        return ch.assertExchange(exchange, 'fanout', {durable: false})
      })
      .then(ok => {
        this.ch.publish(exchange, '', Buffer.from(message));
      })
  }
}

class Subscriber extends events.EventEmitter {
  constructor(opts) {
    super();
    opts = opts || {};
    let amqpHost = opts.amqpHost || 'localhost';
    this.connectionPromise = makeConnectionPromise(amqpHost).bind(this);
    this.emitter = new events.EventEmitter();
    this.subscriptions = new Map();
  }

  subscribe(exchange) {
    return this.connectionPromise()
      .then(conn => conn.createChannel())
      .then(ch => {
        this.ch = ch;
        return ch.assertExchange(exchange, 'fanout', {durable: false})
      })
      .then(ok => this.ch.assertQueue('', {exclusive: true}))
      .then(q => {
        this.q = q;

        let handler = (message) => {
          this.emit('message', exchange, message.content.toString());
        }

        this.subscriptions.set(exchange, handler);
        this.ch.bindQueue(q.queue, exchange, '');
        this.ch.consume(q.queue, handler, {noAck: true});
      })
      .catch((err) => {
        console.warn(err);
        throw err;
      });
  }

  unsubscribe(exchange) {
    if (!this.subscriptions.has(exchange)) {
      return;
    }

    this.emitter.removeListener(exchange, this.subscriptions.get(exchange));
    this.subscriptions.delete(exchange);
    this.ch.unbindQueue(this.q.queue, exchange, '');
  }
}

let AMQPPubSub = {
  createPublisher: (opts) => new Publisher(opts),
  createSubscriber: (opts) => new Subscriber(opts)
}

module.exports = AMQPPubSub;

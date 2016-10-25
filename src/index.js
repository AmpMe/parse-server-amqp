const amqp = require('amqplib');
const events = require('events');

var open = (host) => amqp.connect(`amqp://${host}`);

function makeConnectionPromise(amqpHost: string) {
  return function () {
    if (this._connectionPromise) {
      return this._connectionPromise;
    }
    this._connectionPromise = open(amqpHost);
    return this._connectionPromise;
  }
}

class Publisher {
  ch: any;
  connectionPromise: () => any;
  _connectionPromise: any;

  constructor(opts: any) {
    opts = opts || {};
    let amqpHost = opts.amqpHost || 'localhost';
    this.connectionPromise = makeConnectionPromise(amqpHost);
    return this;
  }

  publish(exchange: string, message: string): void {
    this.connectionPromise()
      .then(conn => conn.createChannel())
      .then(ch => {
        return ch.assertExchange(exchange, 'fanout', {durable: false})
          .then(ok => this.ch.publish(exchange, '', Buffer.from(message)))
      })
      .catch(console.warn);
  }
}

class Subscriber extends events.EventEmitter {
  ch: any;
  q: any;
  emitter: any;
  subscriptions: any;
  connectionPromise: () => any;
  _connectionPromise: any;

  constructor(opts: any) {
    super();
    opts = opts || {};
    let amqpHost = opts.amqpHost || 'localhost';
    this.connectionPromise = makeConnectionPromise(amqpHost);
    this.emitter = new events.EventEmitter();
    this.subscriptions = new Map();
  }

  subscribe(exchange: string): void {
    this.connectionPromise()
      .then(conn => conn.createChannel())
      .then(ch => {
        this.ch = ch;
        return ch.assertExchange(exchange, 'fanout', {durable: false})
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
      })
      .catch(console.warn);
  }

  unsubscribe(exchange: string): void {
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

export default AMQPPubSub

const amqp = require('amqplib');
const events = require('events');

var open = (host) => amqp.connect(`amqp://${host}`);

class Publisher {
  ch: any;

  constructor(opts: any) {
    if (!opts.amqpHost) throw "no amqpHost set";
    open(opts.amqpHost)
      .then(conn => conn.createChannel())
      .then(ch => this.ch = ch)
      .catch(console.warn);
  }

  publish(exchange: string, message: string): void {
    this.ch.assertExchange(exchange, 'fanout', {durable: false})
      .then(ok => this.ch.publish(exchange, '', Buffer.from(message)))
      .catch(console.warn);
  }
}

class Subscriber extends events.EventEmitter {
  ch: any;
  q: any;
  emitter: any;
  subscriptions: any;

  constructor(opts: any) {
    super();
    if (!opts.amqpHost) throw "no amqpHost set";
    this.emitter = new events.EventEmitter();
    this.subscriptions = new Map();
    open(opts.amqpHost)
      .then(conn => conn.createChannel())
      .then(ch => this.ch = ch)
      .catch(console.warn);
  }

  subscribe(exchange: string): void {
    this.ch.assertExchange(exchange, 'fanout', {durable: false})
      .then(ok => this.ch.assertQueue('', {exclusive: true}))
      .then(q => {
        let handler = (message) => {
          this.emit('message', exchange, message.content.toString());
        }

        this.subscriptions.set(exchange, handler);
        this.ch.bindQueue(q.queue, exchange, '');
        this.ch.consume(q.queue, handler, { noAck: true });
        this.q = q;
      });
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

export {
  AMQPPubSub
}

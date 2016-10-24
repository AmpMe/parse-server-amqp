const amqp = require('amqplib/callback_api');
const events = require('events');

class Publisher {
  ch: any;

  constructor(opts: any) {
    super();
    if (!opts.amqpHost) throw "no amqpHost set";
    amqp.connect(`amqp://${opts.amqpHost}`, function (err, conn) {
      if (err) {
        throw new Error("cannot connect to AMQP server: " + err);
      }

      conn.createChannel(function (err, ch) {
        this.ch = ch;
      })
    })
  }

  publish(exchange: string, message: string): void {
    this.ch.assertExchange(exchange, 'fanout', { durable: false });
    this.ch.publish(exchange, '', new Buffer(message));
  }
}

class Subscriber extends events.EventEmitter {
  connection: any;
  ch: any;
  q: any;
  emitter: any;
  subscriptions: any;

  constructor(opts: any) {
    super();
    if (!opts.amqpHost) throw "no amqpHost set";
    this.emitter = new events.EventEmitter();
    this.subscriptions = new Map();
    amqp.connect(`amqp://${opts.amqpHost}`, function (err, conn) {
      if (err) {
        throw new Error("cannot connect to AMQP server: " + err);
      }

      this.connection = conn;
    })
  }

  subscribe(exchange: string): void {
    this.connection.createChannel(function (err, ch) {
      if (err) {
        throw new Error("cannot create AMQP channel: " + err);
      }

      this.ch = ch;
      ch.assertExchange(exchange, 'fanout', { durable: false });
      ch.assertQueue('', { exclusive: true }, function (err, q) {
        if (err) {
          throw new Error("failed to assert queue: " + err)
        }

        this.q = q;

        let handler = (message) => {
          this.emit('message', exchange, message.content.toString());
        }

        this.subscriptions.set(exchange, handler);
        ch.bindQueue(q.queue, exchange, '');
        ch.consume(q.queue, handler, { noAck: true })
      })
    })
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

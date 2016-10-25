const AMQPPubSub = require('../src/index');
// noinspection Eslint
const should = require('chai').should();

const testExchange = 'test_ex';
const testMessage = 'test_msg';

describe('parse-server-amqp', function () {
  it('should export \'createPublisher\' function', function () {
    AMQPPubSub.createPublisher.should.be.a.function;
  });

  it('should export \'createSubscriber\' function', function () {
    AMQPPubSub.createSubscriber.should.be.a.function;
  });

  describe('Subscriber', function () {
    let pub;

    beforeEach(function () {
      pub = AMQPPubSub.createPublisher();
    });

    it('should receive messages from subscribed exchange', function (done) {
      let subscriber = AMQPPubSub.createSubscriber();
      subscriber.on('message', (ex, msg) => {
        ex.should.be.equal(testExchange);
        msg.should.be.equal(testMessage);
        subscriber.unsubscribe(testExchange);
        done();
      });
      subscriber.subscribe(testExchange)
        .then(() => pub.publish(testExchange, testMessage))
    });
  });

  describe('Publisher', function () {
    let sub;

    beforeEach(function (done) {
      sub = AMQPPubSub.createSubscriber();
      sub.subscribe(testExchange).then(done);
    });

    it('should publish messages to an exchange', function (done) {
      sub.on('message', (ex, msg) => {
        ex.should.be.equal(testExchange);
        msg.should.be.equal(testMessage);
        done();
      });
      let publisher = AMQPPubSub.createPublisher();
      publisher.publish(testExchange, testMessage);
    });
  });
});

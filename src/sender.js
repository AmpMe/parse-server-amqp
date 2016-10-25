import AMQPPubSub from './index';

let p = AMQPPubSub.createPublisher();

p.publish('lq', 'test');

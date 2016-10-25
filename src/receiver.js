import AMQPPubSub from './index';

let s = AMQPPubSub.createSubscriber();

s.on('message', (ex, msg) => console.log('got msg ' + msg + ' ' + ex))
s.subscribe('lq');

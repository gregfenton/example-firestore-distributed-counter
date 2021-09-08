import { PubSub } from '@google-cloud/pubsub';
const functions = require('firebase-functions');

const topicName = 'merpy';

export default functions.https.onRequest(async (req, res) => {
  const pubSub = new PubSub();
  const topic = pubSub.topic(topicName);

  for (let i = 0; i < 100; i++) {
    topic.publishJSON({ hello: 'world #(' + i + ')' });
  }

  return topic
    .publishJSON({ hello: 'goodbye!!!' })
    .then(() => {
      console.log('publishJSON(): SUCCESS!');
      res.sendStatus(200);
    })
    .catch((ex) => {
      console.error(`publishJSON(): ERROR! ${ex.message}`);
      res.sendStatus(555);
      throw ex; // be sure to fail the function
    });
});

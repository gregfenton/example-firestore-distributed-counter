const functions = require('firebase-functions');

export default functions.pubsub
  .topic('distPubSub_topic')
  .onPublish((message, context) => {
    console.log(
      `PUBSUB - got new message!!! ${JSON.stringify(message, null, 2)}`
    );

    return true;
  });

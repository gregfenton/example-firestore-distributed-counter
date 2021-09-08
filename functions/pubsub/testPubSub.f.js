const functions = require('firebase-functions');

export default functions.pubsub.topic('merpy').onPublish((message, context) => {
  console.log(
    'PUBSUB - got new message!!!\n------------------\n' +
      `${JSON.stringify(message.json, null, 2)}\n------------------`
  );

  return true;
});

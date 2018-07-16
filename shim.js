/**
 * Copyright 2018, Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const httpShim = (PORT, timeout) => {
  // [START functions_testing_shim_http]
  // Import dependencies
  const gcfCode = require('./index.js');
  const express = require('express');
  const bodyParser = require('body-parser');

  // TODO(developer): specify the port to use
  // const PORT = 3000;

  // TODO(developer): optionally specify a timeout in ms
  // const timeout; // = 60000

  // Start local HTTP server
  const app = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  const server = require(`http`).createServer(app);
  server.on('connection', socket => socket.unref());
  server.listen(PORT);

  // Register HTTP handlers
  Object.keys(gcfCode).forEach(gcfFn => {
    // Handle a single HTTP request
    const handler = (req, res) => {
      gcfCode[gcfFn](req, res);
      server.close();
    };

    app.get(`/${gcfFn}`, handler);
    app.post(`/${gcfFn}`, handler);
  });

  // Handle timeout
  if (timeout) {
    setTimeout(() => {
      server.close();
    }, timeout);
  }
  // [END functions_testing_shim_http]
};

const pubsubShim = (gcfFn, topicName, subscriptionName, timeout) => {
  // [START functions_testing_shim_pubsub]
  // Import dependencies
  const Pubsub = require('@google-cloud/pubsub');
  const pubsub = Pubsub();

  // TODO(developer): specify a function to test
  // const gcfCode = require('./index.js');
  // const gcfFn = gcfCode.YOUR_FUNCTION;

  // TODO(developer): specify an existing topic and subscription to use
  // const topicName = process.env.TOPIC || 'YOUR_TOPIC';
  // const subscriptionName = process.env.SUBSCRIPTION || 'YOUR_SUBSCRIPTION';

  // TODO(developer): optionally specify a timeout in ms
  // const timeout; // = 60000

  // Subscribe to Pub/Sub topic
  const subscription = pubsub.topic(topicName).subscription(subscriptionName);

  // Handle a single Pub/Sub message
  const messageHandler = (msg) => {
    const cb = () => {
      msg.ack();
      subscription.removeListener(`message`, messageHandler);
    };
    if (process.version.includes('v6.')) {
      gcfFn({ data: msg }, cb);
    } else {
      Promise.resolve(gcfFn({ data: msg }, {})).then(cb);
    }
  };
  subscription.on(`message`, messageHandler);

  // Handle timeout
  if (timeout) {
    setTimeout(() => {
      subscription.removeListener(`message`, messageHandler);
    }, timeout);
  }
  // [END functions_testing_shim_pubsub]
};

const storageShim = (gcfFn, bucketName, topicName, subscriptionName, timeout) => {
  // [START functions_testing_shim_storage]
  // Import dependencies
  const Pubsub = require('@google-cloud/pubsub');
  const Storage = require(`@google-cloud/storage`);
  const pubsub = Pubsub();
  const storage = Storage();

  // TODO(developer): specify a function to test
  // const gcfCode = require('./index.js');
  // const gcfFn = gcfCode.YOUR_FUNCTION;

  // TODO(developer): specify a Cloud Storage bucket to monitor
  // const bucketName = 'YOUR_GCS_BUCKET'

  // TODO(developer): specify an existing topic and subscription to use
  // const topicName = process.env.TOPIC || 'YOUR_TOPIC';
  // const subscriptionName = process.env.SUBSCRIPTION || 'YOUR_SUBSCRIPTION';

  // TODO(developer): optionally specify a timeout in ms
  // const timeout; // = 60000

  // Create notification on target bucket
  // Further info: https://cloud.google.com/storage/docs/reporting-changes
  const bucket = storage.bucket(bucketName);
  return bucket.createNotification(topicName)
    .then(data => data[0])
    .then((notification) => new Promise(resolve => {
      // Subscribe to Pub/Sub topic
      const subscription = pubsub
        .topic(topicName)
        .subscription(subscriptionName);

      // Handle a single Pub/Sub message
      const messageHandler = (msg) => {
        const data = JSON.parse(Buffer.from(msg.data, 'base64').toString());
        const cb = () => {
          msg.ack();
          subscription.removeListener(`message`, messageHandler);
          resolve(notification);
        };
        if (process.version.includes('v6.')) {
          gcfFn(data, cb);
        } else {
          Promise.resolve(gcfFn(data, {})).then(cb);
        }
      };
      subscription.on(`message`, messageHandler);

      // Handle timeout
      if (timeout) {
        setTimeout(() => {
          subscription.removeListener(`message`, messageHandler);
          resolve(notification);
        }, timeout);
      }
    }))
    .then(notification => notification.delete()); // Delete notification
  // [END functions_testing_shim_storage]
};

const gcfCodeGlobal = require('./index.js');
require(`yargs`) // eslint-disable-line
  .demandCommand(1)
  .command(
    'http <port>',
    'HTTP-triggered-function shim',
    {},
    opts => httpShim(opts.port, opts.timeout)
  )
  .command(
    'pubsub <functionName> <topic> <subscription>',
    'PubSub-triggered-function shim',
    {},
    opts => pubsubShim(
      gcfCodeGlobal[opts.functionName],
      opts.topic,
      opts.subscription,
      opts.timeout
    )
  )
  .command(
    'storage <functionName> <bucket> <topic> <subscription>',
    'Storage-triggered-function shim',
    {},
    opts => storageShim(
      gcfCodeGlobal[opts.functionName],
      opts.bucket,
      opts.topic,
      opts.subscription,
      opts.timeout
    )
  )
  .option('t', {
    alias: 'timeout',
    requiresArg: true,
    type: 'number'
  })
  .wrap(120)
  .help()
  .strict()
  .argv;

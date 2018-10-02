/**
 * Copyright 2018, Google LLC
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

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const uuid = require('uuid');
const ava = require('ava');

// {proxyquire, sinon, uuid, ava} are libraries - imports omitted
const getMocks = (req, res) => {
  const storageMock = { createBucket: sinon.stub().resolves() };
  const appMock = { listen: sinon.stub(), get: sinon.stub().yields(req, res) };
  return {
    program: proxyquire('..', {
      '@google-cloud/storage': sinon.stub().returns(storageMock),
      'express': sinon.stub().returns(appMock)
    }),
    app: appMock,
    storage: storageMock
  };
};

ava('should attempt to create a bucket', t => {
  const name = `app-test-${uuid.v4()}`; // Make test runs unique
  const req = { body: { name: name } }; // Fake 'req' object
  const res = { send: sinon.stub() }; // Fake 'res' object
  const mocks = getMocks(req, res); // Calls all Express routes

  t.deepEqual(mocks.storage.createBucket.firstCall.args, [name]);
});

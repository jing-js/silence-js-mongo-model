'use strict';

const ObjectID = require('mongodb').ObjectID;
const Long = require('mongodb').Long;
const util = require('silence-js-util');
const Base = require('silence-js-base-model');
const { create, store } = require('./create');

util.registerValidators({
  objectID: validateObjectId,
  objectId: validateObjectId
});

function validateObjectId(val) {
  return (typeof val === 'string' && val.length === 24) || val instanceof ObjectID || (val instanceof Buffer && val.length === 12);
}
function convertObjectId(val) {
  return validateObjectId(val) ? ObjectID(val) : undefined;
}
function convertTimestamp(val) {
  return val instanceof Long ? val : (typeof val === 'number' ? Long.fromNumber(val) : undefined);
}

util.registerConverters({
  objectId: convertObjectId,
  objectID: convertObjectId,
  timestamp: convertTimestamp
});

module.exports = {
  __init(db, logger) {
    if (store.db) {
      throw new Error('BaseMongoModel.db already exists. __init can be called only once.');
    }
    store.db = db;
    store.logger = logger;
    Base.__init(logger);
  },
  __store: store,
  create
};

'use strict';

const mongodb = require('silence-js-db-mongo').LIB_MONGODB;
const Long = mongodb.Long;
const ObjectID = mongodb.ObjectID;
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
  return validateObjectId(val) ? new ObjectID(val) : undefined;
}
function convertTimestamp(val) {
  return val instanceof Long ? val : (typeof val === 'number' ? Long.fromNumber(val) : undefined);
}
function convertLong(val) {
  return val instanceof Long ? val : (typeof val === 'number' ? Long.fromNumber(val) : undefined);
}

util.registerConverters({
  objectId: convertObjectId,
  objectID: convertObjectId,
  timestamp: convertTimestamp,
  long: convertLong
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
  Long,
  objectId: ObjectID,
  ObjectID: ObjectID,
  create
};

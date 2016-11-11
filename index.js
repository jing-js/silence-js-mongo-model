'use strict';

const BaseMongoModel = require('./BaseMongoModel');
const { BaseModel } = require('silence-js-base-model');

const MongoModel = {
  BaseMongoModel,
  __init(db, logger) {
    if (BaseMongoModel.__db) {
      throw new Error('BaseMongoModel.__db already exists. __init can be called only once.');
    }
    BaseMongoModel.__db = db;
    BaseMongoModel.__logger = logger;
    BaseModel.__logger = logger;
  },
  create: require('./create'),
  isMongoModel(ModelClass) {
    return Object.getPrototypeOf(ModelClass) === BaseMongoModel;
  }
};


module.exports = MongoModel;

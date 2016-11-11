const { BaseModel } = require('silence-js-base-model');
const ObjectID = require('mongodb').ObjectID;
const EMPTY = {};
const util = require('silence-js-util');

util.registerValidators({
  objectID: ObjectID.isValid,
  objectId: ObjectID.isValid
});

util.registerConverters({
  objectId: ObjectID,
  objectID: ObjectID
});

class BaseMongoModel extends BaseModel {
  constructor() {
    super();
  }
  static get db() {
    return BaseMongoModel.__db;
  }
  static get logger() {
    return BaseMongoModel.__logger;
  }
  static dropTable() {
    this.logger.debug('Drop collection ', this.table);
    return new Promise((resolve, reject) => {
      this.collection.drop().then(resolve, err => {
        if (err.message === 'ns not found') {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
  static createTable(adminDB) {
    this.logger.debug('Create collection ', this.table);
    return this.db.createCollection(this.table).then(() => {
      return Promise.all(this.fields.map(field => {
        if (field.index) {
          this.logger.debug('Create', field.isUnique ? 'UNIQUE' : '', 'index', field.name);
          return this.collection.createIndex({
            [field.name]: typeof field.index === 'number' ? field.index : 1
          }, field.isUnique ? {
            unique: true
          }: undefined);
        } else {
          return Promise.resolve();
        }
      }));
    });
  }
  static get collection() {
    return this.db.collection(this.table);
  }

  static remove(filters, deleteMany = false) {
    return deleteMany ? this.collection.deleteMany(filters) : this.collection.deleteOne(filters);
  }

  static update(filters, doc, options) {
    return (options && options.multi)
      ? this.collection.updateMany(filters, doc, options)
      : this.collection.updateOne(filters, doc, options);
  }

  static all(query, options = EMPTY) {

    let $q = this.collection.find(query || {});

    if (options.offset || options.skip) {
      $q = $q.skip(options.offset || options.skip);
    }
    if (options.limit) {
      $q = $q.limit(options.limit);
    }
    if (options.fields || options.projection) {
      $q = $q.project(options.fields || options.projection);
    }
    if (options.sort) {
      $q = $q.sort(options.sort);
    }

    return $q.toArray().then(docs => {
      return docs.map(doc => {
        return doc ? new this(doc, true) : null;
      });
    });

  }
  static one(query, options) {

    function wrap(r) {
      return r.then(doc => {
        return doc ? new this(doc, true) : null;
      });
    }

    if (!options) {
      return wrap(this.collection.findOne(query));
    }
    if (options.update) {
      return wrap(this.collection.findOneAndUpdate(query, options.update, {
        sort: options.sort,
        projection: options.fields,
        upsert: !!options.upsert,
        returnNewDocument: !!options.returnNewDocument
      }));
    } else if (options.remove) {
      return wrap(this.collection.findOneAndDelete(query, options.update, {
        sort: options.sort,
        projection: options.fields
      }));
    } else if (options.replace) {
      return wrap(this.collection.findOneAndReplace(query, options.update, {
        sort: options.sort,
        projection: options.fields,
        upsert: !!options.upsert,
        returnNewDocument: !!options.returnNewDocument
      }));
    } else {
      return wrap(this.collection.findOne(query, options.fields));
    }
  }
  static touch(filters) {
    return this.one(filters, {
      fields: {
        _id: 1
      }
    });
  }
  static count() {
    return Promise.reject('not implement as shard concern, see: https://docs.mongodb.com/v3.2/reference/method/db.collection.count/');
  }
  get id() {
    return this._id;
  }
  set id(val) {
    this._id = ObjectID(val);
  }
  save(validate = false, includeId = false) {
    if (validate && !this.validate()) {
      return Promise.resolve(false);
    }
    let doc = {};
    let fields = this.constructor.fields;
    for(let i = 0; i < fields.length; i++) {
      let fn = fields[i].name;
      if (!includeId && fn === '_id') {
        continue;
      }
      if (this[fn] !== undefined) {
        doc[fn] = this[fn];
      }
    }
    return new Promise((resolve, reject) => {
      this.constructor.collection.insertOne(doc).then(r => {
        if (r.insertedCount === 1) {
          if (r.insertedId) {
            this._id = r.insertedId;
          }
          resolve(true);
        } else {
          resolve(false);
        }
      }, err => {
        this.constructor.logger.error(err);
        resolve(false);
      });
    });
  }
  update(validate = false, includeId = true) {
    if (!this._id) {
      return Promise.reject('update need _id');
    }
    if (validate && !this.validate()) {
      return Promise.resolve(false);
    }
    let doc = {};
    let fields = this.constructor.fields;
    for(let i = 0; i < fields.length; i++) {
      let fn = fields[i].name;
      if (fn !== '_id' && this[fn] !== undefined) {
        doc[fn] = this[fn];
      }
    }
    return new Promise((resolve, reject) => {
      this.constructor.collection.updateOne({
        _id: this._id
      }, {
        $set: doc
      }).then(r => {
        if (r.modifiedCount === 1) {
          resolve(true);
        } else {
          resolve(false);
        }
      }, err => {
        this.constructor.logger.error(err);
        resolve(false);
      });
    });
  }
  remove() {
    if (!this._id) {
      return Promise.reject('remove need _id');
    }
    return new Promise((resolve, reject) => {
      this.constructor.collection.deleteOne({
        _id: this._id
      }).then(r => {
        if (r.deletedCount === 1) {
          resolve(true);
        } else {
          resolve(false);
        }
      }, err => {
        this.constructor.logger.error(err);
        resolve(false);
      });
    });
  }
}

BaseMongoModel.__db = null;
BaseMongoModel.__logger = null;

module.exports = BaseMongoModel;

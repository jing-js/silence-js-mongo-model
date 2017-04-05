const mongodb = require('silence-js-db-mongo').LIB_MONGODB;
const Long = mongodb.Long;
const ObjectID = mongodb.ObjectID;

const {
  ModelField,
  createHelper
} = require('silence-js-base-model');

const {
  createFieldsConstructorCode,
  createDeclareCode,
  createValidateFunctionCode,
  createFieldsPropertiesCode,
  PREFIX
} = createHelper;

const util = require('silence-js-util');
const __store = {
  logger: null,
  db: null,
  Long,
  ObjectID
};

function create(proto) {
  if (!__store.db) {
    throw new Error('You must call MongoModel.__init first.');
  }
  let name = proto.name;
  if (!name) {
    throw new Error('MongoModel.create need name');
  }
  let table = proto.table || name.replace(/(.)([A-Z])/g, (m, m0, m1) => `${m0}_${m1.toLowerCase()}`).toLowerCase();
  if (!proto.fields || !Array.isArray(proto.fields)) {
    throw new Error('MongoModel.create need fields');
  }
  let fields = new Array(proto.fields.length);
  let foundId = false;
  let shardField = null;
  let hasIndex = false;

  for(let i = 0; i < proto.fields.length; i++) {
    let field = new ModelField(proto.fields[i]);
    if (!field.name) {
      throw new Error(`Field must have 'name', please check fields of ${field.name}`);
    } else if(['constructor'].indexOf(field.name) >= 0) {
      throw new Error(`Field name can not be ${field.name}, it's reserved words`);
    } else if (!field.type) {
      throw new Error(`Field ${field.name} must have 'type', please check fields of ${field.name}`);
    }
    if (field.name === 'id') {
      field.name = '_id';
    }
    if (field.name === '_id') {
      field.type = 'objectId';
      foundId = true;
    }

    field.type = field.type.toLowerCase();
    if (field.type === 'objectid') {
      field.type = 'any';
      field.convert = 'objectId';
      field.rules = [ 'objectId' ];
    }
    if (field.type === 'binary') {
      field.type = 'any';
    }
    if (field.type === 'binary') {}
    if (['int', 'integer', 'long'].indexOf(field.type) >= 0) {
      field.type = 'number';
    } else if (field.type === 'timestamp') {
      field.type = 'number';
      field.convert = 'timestamp';
      if (field._defaultValue === 'now') {
        field._defaultValue = function() {
          return Long.fromNumber(Date.now());
        }
      }
    } else if (['string', 'boolean', 'any'].indexOf(field.type) < 0) {
      throw new Error(`Unsupport field type ${field.type} of ${field.name}`);
    }
    if (field.isShard && !shardField) {
      if (shardField) {
        throw new Error(`Collection ${name} can have only one shard field.`);
      }
      shardField = field;
    }
    if (field.index) {
      hasIndex = true;
    }
    fields[i] = field;
  }

  if (!foundId) {
    fields.unshift(new ModelField({
      name: '_id',
      type: 'any',
      rules: [ 'objectId' ],
      convert: 'objectId'
    }));
  }

  let _wc = typeof proto.writeConcern === 'object' && proto.writeConcern !== null && ('w' in proto.writeConcern || 'wtimeout' in proto.writeConcern || 'j' in proto.writeConcern) ? `{
  ${typeof proto.writeConcern.w !== 'undefined' ? `w: ${JSON.stringify(proto.writeConcern.w)},` : ''}
  ${typeof proto.writeConcern.wtimeout !== 'undefined' ? `w: ${JSON.stringify(proto.writeConcern.wtimeout)},`: ''}
  ${typeof proto.writeConcern.j !== 'undefined' ? `w: ${JSON.stringify(proto.writeConcern.j)},` : ''}
}` : '';

  let _fc = fields.map((field, idx) => {

  })

  let __foundV2 = false;

  let funcStr = `const EMPTY = Object.create(null);
${_wc ? `let writeConcern = ${_wc};` : ''}
${_wc ? `let writeConcernOptions = {
  writeConcern 
};` : ''}
let db = STORE.db;
let logger = STORE.logger;
let Long = STORE.Long;
let ObjectID = STORE.ObjectID;
let collection = null;

db._onInit(function(_db) {
  collection = _db.collection('${table}');
});

${createDeclareCode(fields)}

function extract(doc) {${fields.map(field => {
  switch(field.dbType) {
    case 'BINARY':
      return `
  if (typeof doc.${field.name} === 'object' && doc.${field.name} !== null && doc.${field.name}._bsontype === 'Binary') {
    doc.${field.name} = doc.${field.name}.buffer;
  }`;
    case 'LONG':
      return `
  if (typeof doc.${field.name} === 'number') {
    doc.${field.name} = fc.${prefix}${field.name}(doc.${field.name});
  }`;
    default:
      return '';
  }
  }).filter(c => !!c).join('')}
  return doc;
}

class ${name} {
  static get shardField() {
    return ${shardField ? `{ name: '${shardField.name}', isUnique: ${shardField.isUnique} }` : 'null'};
  }
  static get table() {
    return '${table}';
  }
  static get logger() {
    return logger;
  }
  static get db() {
    return db;
  }
  static get ObjectID() {
    return ObjectID;
  }
  static get ObjectId() {
    return ObjectID;
  }
  static get Long() {
    return Long;
  }
  static createTable(adminDB) {
    logger.debug('Create collection ${table}');
    return db.createCollection('${table}')${hasIndex ? `.then(() => {${fields.map(field => {
      if (field.index) {
        return `
      logger.debug('Create ${field.isUnique ? 'UNIQUE' : ''} index ${field.name}');`;
      } else {
        return '';
      }
    }).filter(p => !!p).join('\n')}
      return Promise.all([${fields.map(field => {
      if (field.index) {
        return `
        db.collection('${table}').createIndex({ 
          ${field.name}: ${typeof field.index === 'number' ? field.index : 1}
        }${field.isUnique ? `, { 
          unique: true 
        }` : ''})`
      } else {
        return '';
      }
    }).filter(p => !!p).join(',')}
      ]);
    })` : ''};
  }
  static dropTable() {
    logger.debug('Drop collection ${table}');
    return new Promise((resolve, reject) => {
      db.collection('${table}').drop().then(resolve, err => {
        if (err.message === 'ns not found') {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
  static get collection() {
    return collection;
  }
  static _dealUpdateDoc(doc) {
    for(let op in doc) {  // $set, $max, etc...
      if (typeof doc[op] === 'object') {
        this._dealInsertDoc(doc[op]);
      }
    }
  }
  static _dealInsertDoc(doc) {
    for(let fieldName in doc) {
      let v = doc[fieldName];
      if (v === undefined || v === null) {
        continue;
      }
      let v2 = this._dealFieldV(v, fieldName);
      if (v2 === undefined) {
        delete doc[fieldName];
      } else if (v2 !== v) {
        doc[fieldName] = v2;
      }
    }
  }
  static _dealFieldV(v, fieldName) {
    switch (fieldName) {${fields.map((field, idx) => {
  let v2 = '';
  let code = `
      case '${field.name}':`;
  if (field.convert) {
    if (typeof field.convert === 'function') {
      v2 = `return fc.${PREFIX}${field.name}(v);`
    } else if (typeof field.convert === 'string' && util.converters.hasOwnProperty(field.convert)) {
      v2 = `return fc.${PREFIX}${field.name}(v);`
    }
  } else if (field.type !== 'any' && util.converters.hasOwnProperty(field.type)) {
    v2 = `if (typeof v !== '${field.type}') return fc.${PREFIX}${field.name}(v);`
  }
  code += `
        ${v2}
        break;`;
  return code;
}).join('')}
      default:
        return undefined;
        break;
    }
    return v;
  }
  /**
   *
   * @param query
   * @param options
   * @returns {cursor}
   */
  static _find(query, options) {
    
    let $q = this.collection.find(query);

    if (options && options.skip) {
      $q = $q.skip(options.skip);
    }
    if (options && options.limit) {
      $q = $q.limit(options.limit);
    }
    if (options && options.projection) {
      $q = $q.project(options.projection);
    }
    if (options && options.sort) {
      $q = $q.sort(options.sort);
    }

    return $q;
  }
  static all(query, options) {
    return this._find(query, options).toArray().then(docs => {
      for(let i = 0; i < docs.length; i++) {
        extract(docs[i]);
      }
      if (options && options.__json) {
        return docs;
      } else {
        return docs.map(doc => doc ? new this(doc, true) : null)
      }
    });
  }
  static exists(query) {
    if (!query) {
      return Promise.reject('exists need query');
    }
    return collection.find(query).project({
      _id: 1
    }).limit(1).next().then(doc => {
      return !!doc;
    });
  }
  static one(query, options) {
    return this._find(query, options).next().then(doc => {
      if (!doc) return null;
      extract(doc);
      return options && options.__json ? doc : new this(doc, true);
    });
  }
  static oneUpdate(query, doc, options) {
    this._dealUpdateDoc(doc);
    return collection.findOneAndUpdate(query, doc, ${_wc ? `options ? Object.assign(options, writeConcern) : writeConcern` : 'options'}).then(result => {
      if (!result || !result.value) return null;
      extract(result.value);
      return options && options.__json ? result.value : new this(result.value, true);
    });
  }
  static oneReplace(query, doc, options) {
    this._dealUpdateDoc(doc);
    return collection.findOneAndReplace(query, doc, ${_wc ? `options ? Object.assign(options, writeConcern) : writeConcern` : 'options'}).then(result => {
      if (!result || !result.value) return null;
      extract(result.value);
      return options && options.__json ? result.value : new this(result.value, true);    });
  }
  static oneDelete(query, options) {
    return collection.findOneAndDelete(query, ${_wc ? `options ? Object.assign(options, writeConcern) : writeConcern` : 'options'}).then(result => {
      if (!result || !result.value) return null;
      extract(result.value);
      return options && options.__json ? result.value : new this(result.value, true);    });
  }
  static touch(query, options) {
    return collection.find(query).limit(1).project({
      _id: 1
    }).next().then(doc => {
      if (!doc) return null;
      extract(doc);
      return options && options.__json ? doc : new this(doc, true);
    });
  }
  static count() {
    return Promise.reject('not implement as shard concern, see: https://docs.mongodb.com/v3.2/reference/method/db.collection.count/');
  }
  static updateOne(query, doc, options) {
    this._dealUpdateDoc(doc);
    return collection.updateOne(query, doc, ${_wc ? `options ? Object.assign(options, writeConcern) : writeConcern` : 'options'}).then(result => {
      return result && result.modifiedCount === 1;
    });
  }
${createFieldsConstructorCode(fields)}
${createValidateFunctionCode(fields)}
  save(validate = false) {
    if (this.${PREFIX}_id !== undefined) {
      return this.update(validate);
    }
    if (validate && !this.validate()) {
      return Promise.resolve(false);
    }
    return new Promise((resolve, reject) => {
      let doc = {${fields.map((field, idx) => {
        let fn = field.name;
        return fn === '_id' ? '' : `
        ${fn}: this.${PREFIX}${fn}`;
      }).filter(f => !!f).join(',')}
      };
      collection.insertOne(doc${_wc ? `, writeConcernOptions` : ''}).then(r => {
        if (r.insertedCount === 1) {
          if (r.insertedId) {
            this.${PREFIX}_id = r.insertedId;
          }
          resolve(true);
        } else {
          logger.error('insertCount not match!');
          logger.error(r);
          resolve(false);
        }
      }, err => {
        err.code !== 11000 && logger.error(err);
        resolve(err.code === 11000 ? 'duplicate_key' : false);
      });
    });
  }
  update(validate = false) {
    if (!this.${PREFIX}_id) {
      logger.warn('update need _id');
      return Promise.resolve(false);
    }
    if (validate && !this.validate()) {
      return Promise.resolve(false);
    }
    let doc = {};
  ${fields.map((field, idx) => {
    let fn = field.name;
    return fn === '_id' ? '' : `
    if (this.${PREFIX}${fn} !== undefined) doc.${fn} = this.${PREFIX}${fn}`;
  }).filter(f => !!f).join('')}
    return new Promise((resolve, reject) => {
      collection.updateOne({
        _id: this.${PREFIX}_id
      }, {
        $set: doc
      }${_wc ? `, writeConcernOptions` : ''}).then(r => {
        if (r.modifiedCount === 1) {
          resolve(true);
        } else {
          resolve(false);
        }
      }, err => {
        err.code !== 11000 && logger.error(err);
        resolve(err.code === 11000 ? 'duplicate_key' : false);
      });
    });
  }
  remove() {
    if (!this.${PREFIX}_id) {
      logger.warn('remove need _id');
      return Promise.resolve(false);
    }
    return new Promise((resolve, reject) => {
      collection.deleteOne({
        _id: this.${PREFIX}_id
      }).then(r => {
        if (r.deletedCount === 1) {
          resolve(true);
        } else {
          resolve(false);
        }
      }, err => {
        logger.error(err);
        resolve(false);
      });
    });
  }
${createFieldsPropertiesCode(fields)}
  toJSON() {
    return {
${fields.map((field, idx) => {
    let fn = field.name;
    return fn + ': ' + (field.dbType === 'TIMESTAMP' ? `this.${PREFIX}${fn}.toNumber()` : `this.${PREFIX}${fn}`);
}).join(',\n')}
    };
  }
}


return ${name};

`;

  // console.log(funcStr.split('\n').map((line, idx) => `${idx + 1}:\t ${line}`).join('\n'));
  let Class = (new Function('FIELDS', 'CONVERTERS', 'VALIDATORS', 'STORE', funcStr))(
    fields,
    util.converters,
    util.validators,
    __store
  );
  return Class;
}

module.exports = {
  create,
  store: __store
};
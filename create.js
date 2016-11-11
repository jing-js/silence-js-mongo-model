const BaseMongoModel = require('./BaseMongoModel');
const { ModelField, createFieldsConstructorCode } = require('silence-js-base-model');
const util = require('silence-js-util');

function create(proto) {
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

  for(let i = 0; i < proto.fields.length; i++) {
    let field = new ModelField(proto.fields[i]);
    if (!field.name) {
      throw new Error(`Field must have 'name', please check fields of ${field.name}`);
    } else if(['constructor'].indexOf(field.name) >= 0) {
      throw new Error(`Field name can not be ${field.name}, it's reserved words`);
    } else if (!field.type) {
      throw new Error(`Field ${field.name} must have 'type', please check fields of ${field.name}`);
    } else {
      let result = BaseMongoModel.__db.initField(field);
      if (result === -1) {
        throw new Error(`Unknown field type ${field.dbType || field.type}, please check fields of ${field.name}`);
      } else if (result === -2) {
        throw new Error(`Unsupported defaultValue of field ${field.name}, please check fields of ${field.name}`);
      }
    }
    if (field.name === 'id') {
      field.name = '_id';
    }
    if (field.name === '_id') {
      field.type = 'string';
      field.rules = [{
        type: 'length',
        argv: 24
      }, 'objectId'];
      foundId = true;
    }
    if (field.isShard && !shardField) {
      if (shardField) {
        throw new Error(`Collection ${name} can have only one shard field.`);
      }
      shardField = field;
    }

    fields[i] = field;
  }

  if (!foundId) {
    fields.unshift(new ModelField({
      name: '_id',
      type: 'string',
      rules: [{
        type: 'length',
        argv: 24
      }, 'objectId']
    }));
  }
  let funcStr = `
class ${name} extends BaseMongoModel {
  constructor(values, direct = false) {
  super();
${createFieldsConstructorCode(fields)}
  }
}

${name}.table = '${table}';
${name}.fields = fields;

return ${name};

`;

  let Class = (new Function('BaseMongoModel', 'fields', 'CONVERTERS', funcStr))(
    BaseMongoModel,
    fields,
    util.converters
  );

  return Class;
}

module.exports = create;
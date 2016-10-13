const BaseMongoModel = require('./BaseMongoModel');
const { ModelField } = require('silence-js-base-model');

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

  for(let i = 0; i < proto.fields.length; i++) {
    let field = new ModelField(proto.fields[i]);
    if (!field.name) {
      throw new Error(`Field must have 'name', please check fields of ${this.name}`);
    } else if(['constructor'].indexOf(field.name) >= 0) {
      throw new Error(`Field name can not be ${field.name}, it's reserved words`);
    } else if (!field.type) {
      throw new Error(`Field ${field.name} must have 'type', please check fields of ${this.name}`);
    } else {
      let result = BaseMongoModel.__db.initField(field);
      if (result === -1) {
        throw new Error(`Unknown field type ${field.dbType || field.type}, please check fields of ${this.name}`);
      } else if (result === -2) {
        throw new Error(`Unsupported defaultValue of field ${field.name}, please check fields of ${this.name}`);
      } else if (result === -3) {
        throw new Error(`autoUpdate can only been applied to TIMESTAMP field with defaultValue 'now'`);
      }
    }
    if (field.name === 'id') {
      field.name = '_id';
    }
    if (field.name === '_id') {
      foundId = true;
    }
    fields[i] = field;
  }

  if (!foundId) {
    fields.unshift({
      name: '_id',
      type: 'string',
      rules: [{
        type: 'length',
        argv: 24
      }, 'objectId']
    });
  }
  let funcStr = `
class ${name} extends BaseSQLModel {
  constructor(values, assignDefaultValue = true) {
  super();
  const fields = this.constructor.fields;
  ${fields.map((field, idx) => {
    return`
  this.${field.name} = values && values.hasOwnProperty('${field.name}') 
      ? values.${field.name} : (assignDefaultValue ? fields[${idx}].defaultValue : undefined);
`;    
  }).join('\n')}
  }
}

${name}.table = '${table}';
${name}.fields = fields;
${name}.fieldsTypeMap = new Map();

return ${name};

`;

  let Class = (new Function('BaseMongoModel', 'fields', funcStr))(
    BaseSQLModel,
    fields
  );

  fields.forEach(field => {
    Class.fieldsTypeMap.set(field.name, field.type);
  });

  return Class;
}

module.exports = 
const PRIMITIVE_TYPE_MAP_REQUIRED = {
  string: 'string',
  int32: 'int32',
  float64: 'double',
  bool: 'bool',
};

const PRIMITIVE_TYPE_MAP_NOT_REQUIRED = {
  string: 'google.protobuf.StringValue',
  int32: 'google.protobuf.Int32Value',
  float64: 'google.protobuf.DoubleValue',
  bool: 'google.protobuf.BoolValue',
};

const INDENT_TAB = '  ';


function primitiveFVToProtobuf(fieldValidator, fieldName) {
  const isFVRequired = fieldValidator.settings.required;
  const fvType = fieldValidator.settings.type;
  if (isFVRequired) {
    if (PRIMITIVE_TYPE_MAP_REQUIRED.hasOwnProperty(fvType)) {
      return `${PRIMITIVE_TYPE_MAP_REQUIRED[fvType]} ${fieldName}`;
    }
  } else if (PRIMITIVE_TYPE_MAP_NOT_REQUIRED.hasOwnProperty(fvType)) {
    return `${PRIMITIVE_TYPE_MAP_NOT_REQUIRED[fvType]} ${fieldName}`;
  }
  throw new Error(`Unsupported primitive type ${fieldValidator.settings.type}!`);
}

function fvObjectToProtobuf(fieldValidator, objectTypeName, indentAmount) {
  const outerIndent = indentAmount || '';

  if (fieldValidator.settings.type !== 'object') {
    throw new Error('Must be object to be schema!');
  }
  const defs = [];
  const { schema } = fieldValidator.settings;
  const innerIndent = outerIndent + INDENT_TAB;
  Object.keys(schema).forEach((k, ind) => {
    const fld = schema[k];
    if (fld.settings.type === 'object') {
      const nObjName = `${objectTypeName}_${k}`;
      defs.push(fvObjectToProtobuf(fld, nObjName, outerIndent + INDENT_TAB));
      defs.push(`${innerIndent}${nObjName} ${k} = ${ind + 1};`);
    } else if (fld.settings.type === 'array') {
      if (!fld.settings.required) {
        throw new Error("Array fields must be 'required()' in order to convert them into protobufs!");
      }
      if (fld.settings.arrayOf.settings.type === 'object') {
        const arrObjName = `${objectTypeName}_${k}`;
        defs.push(fvObjectToProtobuf(fld.settings.arrayOf, arrObjName, outerIndent + INDENT_TAB));
        defs.push(`${innerIndent}repeated ${arrObjName} ${k} = ${ind + 1};`);
      } else if (fld.settings.arrayOf.settings.type === 'array') {
        throw new Error('Arrays of arrays are not allowed in protobufs!');
      } else {
        defs.push(`${innerIndent}repeated ${primitiveFVToProtobuf(fld.settings.arrayOf, k)} = ${ind + 1};`);
      }
    } else {
      defs.push(`${innerIndent}${primitiveFVToProtobuf(fld, k)} = ${ind + 1};`);
    }
  });
  return `${indentAmount}message ${objectTypeName} {\n${defs.join('\n')}\n${indentAmount}}`;
}


function fvSchemaToProtobuf(fieldValidator, objectTypeName) {
  const fvType = fieldValidator.settings.type;
  if (fvType === 'object') {
    return {
      definitions: fvObjectToProtobuf(fieldValidator, objectTypeName, ''),
      typeString: objectTypeName,
    };
  } if (fvType === 'array') {
    const childType = fieldValidator.settings.arrayOf.settings.type;
    if (childType === 'array') {
      throw new Error('Arrays of arrays are not allowed in protobufs!');
    } else if (childType === 'object') {
      const childPbResult = fvSchemaToProtobuf(fieldValidator.settings.arrayOf, objectTypeName);
      return {
        definitions: childPbResult.definitions,
        typeString: `repeated ${objectTypeName}`,
      };
    } else {
      return {
        definitions: '',
        typeString: `repeated ${primitiveFVToProtobuf(fieldValidator.settings.arrayOf, '').trim()}`,
      };
    }
  } else {
    return {
      definitions: '',
      typeString: primitiveFVToProtobuf(fieldValidator.settings.arrayOf, '').trim(),
    };
  }
}

export function generateProtobuf(fieldValidator, objectTypeName) {
  return fvSchemaToProtobuf(fieldValidator, objectTypeName);
}

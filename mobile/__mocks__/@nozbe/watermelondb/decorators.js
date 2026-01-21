/**
 * WatermelonDB Decorators Mock for Jest
 *
 * Functional decorators that create getters/setters for WatermelonDB models
 * in test environment.
 *
 * These decorators simulate the real WatermelonDB behavior:
 * - Getters read from _raw[columnName]
 * - Setters write to _raw[columnName] using _setRaw()
 *
 * Source: https://github.com/Nozbe/WatermelonDB/issues/155
 * Blog: https://craigmulligan.com/posts/testing-with-watermelon/
 */

// Field decorator - creates getter/setter for string/number fields
function field(columnName) {
  return function (target, key, descriptor) {
    Object.defineProperty(target, key, {
      get() {
        return this._raw[columnName];
      },
      set(value) {
        this._setRaw(columnName, value);
      },
      enumerable: true,
      configurable: true,
    });
  };
}

// Date decorator - creates getter/setter that converts timestamp to/from Date
function date(columnName) {
  return function (target, key, descriptor) {
    Object.defineProperty(target, key, {
      get() {
        const timestamp = this._raw[columnName];
        return timestamp ? new Date(timestamp) : null;
      },
      set(value) {
        const timestamp = value instanceof Date ? value.getTime() : value;
        this._setRaw(columnName, timestamp);
      },
      enumerable: true,
      configurable: true,
    });
  };
}

// Readonly decorator - mark field as readonly (created_at, updated_at)
function readonly(target, key, descriptor) {
  return descriptor;
}

// Passthrough for other decorators
const passthrough = () => () => undefined;

module.exports = {
  field,
  text: field, // text is same as field
  date,
  readonly,
  children: passthrough,
  relation: passthrough,
  immutableRelation: passthrough,
  json: passthrough,
  writer: passthrough,
  lazy: passthrough,
  nochange: passthrough,
};

/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};
// 验证 prop ，并返回 值
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)// propsData 是否不包含这个属性
  let value = propsData[key]
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {//如果是布尔类型
    if (absent && !hasOwn(prop, 'default')) {//如果 propsData 不包含，并且没有提供默认值，就把value 设置为 false
      value = false
    } else if (value === '' || value === hyphenate(key)) {//否则如果value=''或 value = 转小写连字符的key
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  // 检查默认值。
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)//设置为 prop 的 default默认值
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)//递归观察
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 * 获取一个 prop 的 默认值
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {//没有 default 属性，返回 undefined
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array // 如果 default 的值是数组或对象，报错
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 如果 propsData 对象上不存在，而 _props 存在 key属性，返回vm._props[key]值
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // 返回调用工厂函数返回的默认值
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 * 断言prop是否有效
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {//必传但是没传，报错提示
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }//非必传，没有给值，退出函数
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true //没设置 type属性或者 type===true,校验值设置为true
  const expectedTypes = []
  if (type) {//如果设置了type属性，遍历进行断言
    if (!Array.isArray(type)) {
      type = [type]
    }// valid为false，会遍历下去，当valid 被设置为 true 时退出循环,相当于 [].some 的操作
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])//断言操作
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
// 断言失败，报错提示
  if (!valid) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }//验证器操作
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/
// 类型断言，检查 value的类型是否是 type类型，返回一个对象，valid是断言结果，expectedType字符串是期望类型的字符串名
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)//期望类型
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
// 使用函数名，检查内置类型
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}
// 是否相同类型
function isSameType (a, b) {
  return getType(a) === getType(b)
}
// 检查期望类型数组，是否包含检查类型，包含返回 0 不包含返回 -1
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}
// 获取无效类型消息
function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)//值得原始类型
  const expectedValue = styleValue(value, expectedType)//期望类型值
  const receivedValue = styleValue(value, receivedType)//原值类型值
  // check if we need to specify expected value
  if (expectedTypes.length === 1 &&
      isExplicable(expectedType) &&
      !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}
// value 转字符串
function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}
// value字符串转小写包含  'string' | 'number' ｜'boolean' 之一
function isExplicable (value) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => value.toLowerCase() === elem)
}
// 参数数组 字符串转小写 包含 'boolean'
function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}

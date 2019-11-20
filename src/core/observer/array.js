/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'
//数组原型对象
const arrayProto = Array.prototype
//创建一个空对象，原型指向数组的原型 ，这个对象
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 作用：拦截数组的变异方法
 *  空对象 arrayMethods  代理数组的变异方法  
 * 会先在里面调用原生的数组方法，如果是插入操作，给新增的项做数据劫持
 * 最后通知更新
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }//数组如果是添加项的操作，对添加的项做数据劫持
    if (inserted) ob.observeArray(inserted)  
    // notify change
    ob.dep.notify()
    return result
  })
})

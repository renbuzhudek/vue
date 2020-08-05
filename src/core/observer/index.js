/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 *    是否观察开关,默认  true
 */
export let shouldObserve: boolean = true 

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      /**如果 value 是数组,  
       * 判断{}没有__ob__属性，手动设置并劫持变异方法
       *   对变异方法做劫持 pop push shift unshift splice short reverse
       * 跳过了 defineReactive 操作 （没有做数据劫持）
       */
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys) 
      }
      this.observeArray(value)//遍历数组成员，调用observe，
    } else {
      //如果不是数组并且是对象（先调用的observe方法判断只能是数组或者对象，所以这里是对象），给对象所有的key设置为响应式属性
      this.walk(value) 
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果value上有__ob__对象赋值给ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (//如果需要观察，并且不是服务端，并且是数组或对象，并且可扩展，并且不是vue实例，new一个Observer
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value) //为value创建 Observer对象并赋值到属性 '__ob__'上
  }//判断如果是组件根data对象，vmCount计数器加1
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/** 定义响应式属性， 为obj对象的key属性设置get和set函数，做数据劫持
 * Define a reactive property on an Object.
 */
// window.$deps=[]
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()
  // window.$deps.push({dep,key,obj})
// 获取obj对象的key属性的描述符对象
  const property = Object.getOwnPropertyDescriptor(obj, key) 
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  // 如果没有设置getter函数 并且参数是2个的情况下，赋值 val = obj[key]
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
// 如果val是数组或者对象并且可扩展，会递归调用observe,childOb=val.__ob__ 否则undefined
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {  //依赖收集的时候，会生成watcher,然后Dep.target=watcher，然后触发get函数，最后dep.subs.push(watcher)完成依赖收集
        dep.depend()//等价于 dep.subs.push(watcher)
        if (childOb) { //如果val是数组或对象并且可扩展，那么childOb就存在，val.__ob__.dep.subs收集watcher
          childOb.dep.depend()
          if (Array.isArray(value)) {//如果value是数组，递归对数组元素上拥有 __ob__.dep的收集这个 watcher
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.   
 * Vue.set  vm.$set方法
 * TODO:  这里也是__ob__对象的作用之处，增删响应式属性时，通知watcher更新视图，进而触发新一轮收集watcher观察者
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //如果是数组，用splice设置val ，退出函数
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  //如果key属性已存在target中并且不是Object原型中的属性，赋值后退出函数
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  // 避免向vue实例或者根$data添加响应式属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  //没有ob说明target不是响应式属性，赋值后退出函数
  if (!ob) {
    target[key] = val
    return val
  }
  //给 target.__ob__.value 对象（其实就是target对象）上设置响应式属性 key
  defineReactive(ob.value, key, val)
  // 通知更新
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 *  Vue.delete vm.$delete 删除响应式属性 ,并通知更新
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}

/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    // 把当前 watcher实例赋值到 vm._watcher属性,组件实例化时才有这一步，代码在 vue\src\core\instance\lifecycle.js
    if (isRenderWatcher) {
      vm._watcher = this
    }
    // 把 watcher实例存入数组 vm._watchers
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    // 表达式，非生产模式值是getter函数转的字符串，否则是空字符串
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    //  expOrFn 转成函数赋值给 getter属性
    if (typeof expOrFn === 'function') { // renderWatcher和computed的watcher走这里，此时传入的expOrFn函数作为getter函数
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn) //用于watch侦听器，返回一个函数作为getter函数，以 . 分割expOrFn字符串，例如 a.b ,那么函数返回 vm.a.b
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 如果 选项 lazy 为true， value初始值设置为undefined，否则为调用get方法返回值
    // 只有computed设置了lazy为true
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 计算getter,重新收集依赖
   */
  get () {
    pushTarget(this)  //实例化watcher时 首先设置target
    let value
    const vm = this.vm
    try {
      /**
       * 1.作为组件实例独有的watcher时，getter函数是 updateComponent ，返回值为 undefined
       *  实际调用 ：vm._update(vm._render(), hydrating)  lifecycle.js 197行
       * 它会先执行 vm._render() 方法，因为这个方法会生成 渲染 VNode，
       * 并且在这个过程中会对 vm 上的数据访问，这个时候就触发了数据对象的 getter,
       * 从而watcher观察者被收集到 响应式属性持有的dep.subs里面
       * vm._update方法的执行，会触发视图更新流程
       * 
       * 2. 作为计算属性的watcher时，getter函数是计算属性的get函数，返回值作为计算属性的值
       * 
       * 3. 作为 watch侦听器的watcer时，getter函数是 parsePath(expOrFn)，返回监听属性的值
       */
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 深度监听选项为true时，traverse方法会递归遍历value对象的属性，
      // 触发value对象所有的属性的get方法，从而收集到当前watcher,达到深度监听的目的
      if (this.deep) {
        traverse(value)
      }
      popTarget()//置空target
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 向该指令添加依赖项
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {//如果newDepIds数组里面没有这个dep.id，就添加到数组，并把dep对象推入数组 newDeps ，这样watcher反过来也收集了dep
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {//如果depIds数组没有这个dep.id,说明当前watcher没有被这个dep收集，调用dep.addSub(this)，让dep收集到当前watcher
        dep.addSub(this)//添加订阅
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理依赖集合
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {//遍历 deps
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {//如果 newDepIds数组里面没有这个dep.id，就从dep.subs中移除当前的watcher
        dep.removeSub(this)//取消订阅
      }
    }
    //  赋值 this.depIds = this.newDepIds   this.deps = this.newDeps ，然后清空 newDepIds，newDeps
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear() //清空 newDepIds
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0 //清空 newDeps
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // watcher更新
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {//如果是同步更新，直接调用 run
      this.run()
    } else {
      queueWatcher(this) //异步更新试图，里面还是会调用run方法
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   *调度程序作业接口，将由调度程序调用。
   */
  run () {
    if (this.active) {
      const value = this.get()//运行get函数得到新值
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 将新值设置给value属性
        const oldValue = this.value
        this.value = value
        if (this.user) {// watch选项走这里，回调函数被传入新值和旧值
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 只有惰性观察者会执行这个函数，获取观察者的value值
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 依赖于此观察者的所有dep,调用depend收集依赖
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 从所有依赖项的订阅服务器列表中删除自己
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false //删掉之后，active状态变为false
    }
  }
}

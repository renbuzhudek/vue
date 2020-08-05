/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,//是否保留字符串开头 $ 或 _
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'
// 这个对象只是一个模板对象，被使用的时候，都会被重写 get和 set属性
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
// 架设一层访问代理
// 例如参数： vm ,_data ,key
// 访问数据状态 vm[key],实际上是访问 vm._data[key]
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
// 初始化状态
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)//初始化 props选项
  if (opts.methods) initMethods(vm, opts.methods) //初始化 methods选项
  if (opts.data) {//初始化data选项
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)//初始化 computed选项
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch) //初始化 watch 选项
  }
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}//初始化 vm._props 属性值为一个空对象
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }//遍历 propsOptions的key,定义为响应式属性，这里是直接调用defineReactive，因此 vm._props根对象上没有属性__ob__(props用不上这个属性)
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
// 初始化 data数据对象，做数据劫持
function initData (vm: Component) {
  let data = vm.$options.data
  // 调用data函数，将返回的对象赋值给 vm._data属性
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)   //生成data数据对象，同时并不触发依赖收集
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data  数据劫持为响应式属性
  observe(data, true /* asRootData */)
}
//获取data数据对象, 调用数据获取程序时禁用dep收集
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  /**可以看到 pushTarget参数是undefined,也就是说data函数被调用时，是禁止依赖收集的，
   * 考虑这种情况，data依赖一个props属性msg,如果不禁止依赖收集，那么父组件实例化时，
   * new Watcher的get函数调用了pushTarget(this),设置Dep.target=父renderWatcher,
   * 父组件依赖收集完毕，开始子组件流程，子组件初始化props状态定义为响应式属性，
   * 接着初始化子组件的data状态，由于没有禁止依赖收集，此时,因为data函数访问了props.msg，
   * 触发了props.msg进行依赖收集，因此在子组件该props.msg也收集到父renderWatcher，
   * 这就导致首次修改msg,父组件调用2次update钩子
   * 再次修改msg就正常了，原因是父组件的renderWatcher重新执行get函数进行依赖收集，
   * newDeps数组只有一个成员是当前vm.msg持有的,而watcher.deps里面有2个deps,
   * 因此删除了子组件props.msg持有的那个dep订阅
   *   data: function() {
  	return {
    	localMsg: this.msg
    }
  },
  props: {
  	msg: String
  },
   */

  //  pushTarget 参数为空，那么就设置了 Dep.target=undefined,所以下面调用data函数时，就禁止了响应式属性进行依赖收集
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()//恢复到上一个Dep.target
  }
}
// 观察选项，懒观察
const computedWatcherOptions = { lazy: true }
/**初始化computed选项
* 核心在于 Watcher类
*/
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    // 计算属性的核心部分，就是这个 Watcher类
// 观察每个计算属性，实例化 Watcher类，计算属性的getter函数作为getter属性传给Watcher
// 参数依次为 组件实例，计算属性的getter函数，空函数，选项
    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,//传空函数，什么也不做
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 如果 key不在实例上，就定义为计算属性，否则给出警告
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
// 定义计算属性 
// get函数：用闭包包装一个getter函数，返回vm._computedWatchers[key].value 也就是 Watcher.value属性值
// set函数：如果userDef是函数，设置为空函数，如果是对象就赋值为userDef.set
// 最后用defineProperty方法把computed选项的key定义为vm[key]属性
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()//不是服务端渲染，就可以缓存
  if (typeof userDef === 'function') {  //如果userDef是一个函数，就只定义get属性，set属性是一个空函数,此时就无法手动设置这个计算属性
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {//否则的话就是 userDef肯定是传的一个对象进来，就分别包装get和set函数
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
// 可缓存的计算属性get方法
// 创建计算属性的get函数，返回一个函数，返回值为 watcher.value，也就是说watcher的value属性改变了，返回值才会变化，这就起到了缓存的作用
function createComputedGetter (key) { 
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {//lazy=true这个属性值首次是true,
        watcher.evaluate() //调用这个办法，执行watcher的 get方法，进行依赖收集，获取value值，因为计算属性是惰性执行的
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
//不可缓存的计算属性get方法，用于服务端渲染
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}
// 初始化 watch 选项
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}
// 创建 Watcher
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 设置 vm['$data'] vm['$props'] 属性代理 vm._data vm._props 对象，禁止直接修改
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      try {//如果是立即执行的watch,调用回调函数，传入  watcher.value
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 返回一个函数，调用后可以解除监听
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}

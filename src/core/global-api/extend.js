/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 组件构造器：Vue全局组件注册内部也会调用Vue.extend方法继承Vue构造函数，并返回这个构造器
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {} //要继承的组件选项
    const Super = this//超类，一般情况下就是Vue，除非多次继承，这种情况几乎不会出现
    const SuperId = Super.cid//超类的cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 如果extendOptions._Ctor[SuperId]存在，直接返回此 ，防止重复产生构造器 ，最后2行会把 cachedCtors[SuperId]属性值设为 Sub
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }
    //创建子类构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 继承父类
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    // 合并父类的组件选项和当前传入的组件选项
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 绑定父类构造函数
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    //对于props和computed属性，我们在
    //在扩展时，扩展原型上的Vue实例。这个
    //避免为创建的每个实例调用Object.defineProperty。
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    //允许进一步扩展子类，比如A extend Vue, B可以继续extend A
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    //创建资源注册器，所以被扩展的类也可以有自己私有的资源  （component、directive、filter）
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup 
    // 启用递归自查找
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 保持对超类选项的引用，稍后在实例化的时候可以检查超类的选项是否有更新
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 缓存当前创建的构造函数
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}

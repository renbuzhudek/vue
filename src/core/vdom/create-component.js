/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
//  patch期间在组件 vnode上调用的内联钩子，进行实例化，挂载，销毁 等操作
//这里的参数 vnode  都是 组件占位vnode  
const componentVNodeHooks = {
  //初始化组件实例，并挂载 ,参数是组件占位节点
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance && //这个占位节点上存在组件实例
      !vnode.componentInstance._isDestroyed && //没有被销毁
      vnode.data.keepAlive  //被keepAlive缓存的组件的标记
    ) {
      // kept-alive components, treat as a patch
      // 如果是keep-alive组件缓存的组件，那么打补丁，传入的新旧节点一样，复用
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      //创建子组件实例，并挂到 componentInstance 字段
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,//占位节点，用于创建实例
        activeInstance//活动实例，也是即将创建的实例的父组件实例 $parent
      )
      //调用vm.$mount方法触发子组件的生命周期,创建流程，子组件的mounted事件会在父组件完成patch的最后一行触发
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },
// 这个insert hook作用只是调用组件的mounted钩子，标志组件挂载完成
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {//如果是keep-alive包裹的组件
      // 上下文如果标记为已挂载（那么对于上下文这是一个patch update过程），组件实例推入activatedQueue数组，patch结束后统一调用activateChildComponent方法
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {//否则直接激活子组件activated钩子
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },
// 调用 vm.$destroy()销毁组件
  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {//非keep-alive包裹的组件直接调用销毁钩子
        componentInstance.$destroy()
      } else {//否则调用 deactivated 钩子
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)
// 创建组件占位vnode,此时只是在占位vnode上设置好组件实例化需要的方法和属性，还并未创建组件实例
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 如果是选项对象，创建成构造函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 如果到这一步了， Ctor不是构造函数或异步组件工厂，报错并返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  // 如果构造函数没有定义cid属性，说明是异步组件
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    // 获取异步组件的构造函数
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor)
    if (Ctor === undefined) {//如果拿不到异步组件的构造函数
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      // 返回异步组件的占位符节点，作为注释节点呈现
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  //TODO:  解析构造函数上的组件选项，处理mixins这种情况
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 转换v-mode指令为 props和事件监听
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 摘取 props选项
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  // 创建函数式组件
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn
// 抽象组件不保除了 props 监听器 slot之外的任何东西
  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  //安装组件管理钩子到这个占位节点的data属性上
  installComponentHooks(data)

  // return a placeholder vnode   
  // 为组件创建占位vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}
//创建组件实例
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,//标识是组件
    _parentVnode: vnode,//占位节点
    parent//父组件实例
  }
  // check inline-template render functions,检查内联模板的渲染函数
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {//如果存在内联模板，标识为静态渲染函数
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  //用占位vnode上存放的组件构造函数实例化组件
  return new vnode.componentOptions.Ctor(options)
}
// 安装组件钩子到占位vnode的data属性上
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.attrs || (data.attrs = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}

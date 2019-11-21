/* @flow */

export default class VNode {
  tag: string | void;//标签名
  data: VNodeData | void;//虚拟dom的数据对象
  children: ?Array<VNode>;//子节点
  text: string | void;//文本节点的内容
  elm: Node | void;//当前节点对应的真实DOM
  ns: string | void;//当前节点命名空间
  context: Component | void; // rendered in this component's scope 上下文
  key: string | number | void;// 节点的key属性
  componentOptions: VNodeComponentOptions | void;//组件选项
  componentInstance: Component | void; // component instance 组件实例
  parent: VNode | void; // component placeholder node TODO:父节点还是当前节点的占位节点？

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)  // 是否为原生HTML或只是普通文本
  isStatic: boolean; // hoisted static node  // 静态节点标志 keep-alive
  isRootInsert: boolean; // necessary for enter transition check   // 是否作为根节点插入
  isComment: boolean; // empty comment placeholder? // 是否为注释节点
  isCloned: boolean; // is a cloned node?  是否为克隆节点
  isOnce: boolean; // is a v-once node?  是否为v-once节点
  asyncFactory: Function | void; // async component factory function  异步工厂方法 
  asyncMeta: Object | void;  //异步Meta
  isAsyncPlaceholder: boolean; // 是否为异步占位
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes  函数化组件上下文
  fnOptions: ?ComponentOptions; // for SSR caching  函数化组件配置项
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support  函数化组件ScopeId

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }
// 容器实例向后兼容的别名
  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}
// 创建一个空的vnode
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}
// 创建一个文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference. 浅克隆vnode
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}

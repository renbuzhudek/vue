/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 * 用于渲染的运行时帮助函数<slot>
 */
export function renderSlot (
  name: string,//插槽名
  fallback: ?Array<VNode>,//插槽的默认vnode
  props: ?Object,//作用域插槽上绑定的属性，形如 <slot  :q="123">默认</slot>
  bindObject: ?Object//也是作用域插槽上绑定的属性形如 <slot  v-bind="{q:223}">默认</slot>
): ?Array<VNode> {
  const scopedSlotFn = this.$scopedSlots[name]//取作用域插槽函数
  let nodes
  if (scopedSlotFn) { // scoped slot 如果是作用于插槽
    props = props || {}
    if (bindObject) {//如果 bindObject存在，判断一下如果不是对象就报错
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)//合并插槽上传递的属性
    }
    nodes = scopedSlotFn(props) || fallback//调用作用域插槽函数，拿到vnode
  } else {
    nodes = this.$slots[name] || fallback//否则就是普通插槽，直接取vnode
  }

  const target = props && props.slot//如果传入 slot属性，下面会创建一个template元素，在浏览器上不会显示出来
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}

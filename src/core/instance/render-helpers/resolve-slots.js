/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * 运行时帮助函数，把子vnode节点转换成一个 slot对象，如：{defalut:[VNode]}
 * 遍历 children，如果子vnode的data.slot属性存在，设置为slots对象的属性；
 */
export function resolveSlots (
  children: ?Array<VNode>,//一个元素的子元素数组
  context: ?Component//上下文实例
): { [key: string]: Array<VNode> } {
  if (!children || !children.length) {
    return {}
  }
  const slots = {}
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      const name = data.slot
      const slot = (slots[name] || (slots[name] = []))
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        slot.push(child)
      }
    } else {
      (slots.default || (slots.default = [])).push(child)
    }
  }
  // ignore slots that contains only whitespace
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}
// 是否白名单
function isWhitespace (node: VNode): boolean {
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}

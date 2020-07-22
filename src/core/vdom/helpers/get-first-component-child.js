/* @flow */

import { isDef } from 'shared/util'
import { isAsyncPlaceholder } from './is-async-placeholder'
// 获取数组的第一个是组件的成员，通过判断 vnode上的 componentOptions 属性是否定义。因为只有组件实例的vnode才会设置该属性，用于缓存组件选项
export function getFirstComponentChild (children: ?Array<VNode>): ?VNode {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
        return c
      }
    }
  }
}

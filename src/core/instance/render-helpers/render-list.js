/* @flow */

import { isObject, isDef, hasSymbol } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 * 帮助渲染v-for指令列表
 */
export function renderList (
  val: any,//数据对象
  render: (//v-for指令渲染vnode的函数
    val: any,//数据对象
    keyOrIndex: string | number,//如果数据对象是普通对象，那么这个参数就是key，否则就是 index 下标
    index?: number //  如果val是普通对象，这里才会传入迭代的 index下标
  ) => VNode
): ?Array<VNode> {
  let ret: ?Array<VNode>, i, l, keys, key
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  } else if (typeof val === 'number') {
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  } else if (isObject(val)) {//如果 val是个对象
    if (hasSymbol && val[Symbol.iterator]) {//如果是个可迭代对象，就是类数组之类的
      ret = []
      const iterator: Iterator<any> = val[Symbol.iterator]()
      let result = iterator.next()
      while (!result.done) {
        ret.push(render(result.value, ret.length))
        result = iterator.next()
      }
    } else {//否则就是普通对象
      keys = Object.keys(val)
      ret = new Array(keys.length)
      for (i = 0, l = keys.length; i < l; i++) {
        key = keys[i]
        ret[i] = render(val[key], key, i)
      }
    }
  }
  if (!isDef(ret)) {
    ret = []
  }
  (ret: any)._isVList = true//标记
  return ret
}

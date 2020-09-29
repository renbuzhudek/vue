/* @flow */
//  拉取作用域插槽  ,返回的对象形如：
/**
 * {
 * $key: xxxxx,
 * $stable: true,
 * default:f(scope){.....}  default作用域插槽函数
 *  } 
 * 
 */
export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object,//返回的对象
  // the following are added in 2.6
  hasDynamicKeys?: boolean,//是否有动态key
  contentHashKey?: number // 内容哈希key
): { [key: string]: Function, $stable: boolean } {
  res = res || { $stable: !hasDynamicKeys }
  for (let i = 0; i < fns.length; i++) {
    const slot = fns[i]
    if (Array.isArray(slot)) {
      resolveScopedSlots(slot, res, hasDynamicKeys)
    } else if (slot) {
      // marker for reverse proxying v-slot without scope on this.$slots
      if (slot.proxy) {
        slot.fn.proxy = true
      }
      res[slot.key] = slot.fn
    }
  }
  if (contentHashKey) {
    (res: any).$key = contentHashKey
  }
  console.log(res);
  return res
}

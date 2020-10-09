/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

export function installRenderHelpers (target: any) {
  target._o = markOnce// v-once的运行时帮助程序
  target._n = toNumber//将参数转换为数字
  target._s = toString //将参数转换为实际呈现的字符串
  target._l = renderList //帮助渲染v-for指令列表
  target._t = renderSlot//编译`<slot>`标签
  target._q = looseEqual//检查两个值得形状是否相等 looseEqual([{a:1}],[{a:1}])===true
  target._i = looseIndexOf//在 arr中找出跟val形状相同的成员，返回index
  target._m = renderStatic// 用于被v-once指令绑定的节点，标记为静态节点
  target._f = resolveFilter //运行时帮助函数拉取 filters 资源
  target._k = checkKeyCodes//用于从配置检查 keyCodes 键位别名 的运行时帮助函数
  target._b = bindObjectProps//运行时帮助函数， 把 v-bind="object" 指令的值，解构属性 合并到 vnode节点的data属性上
  target._v = createTextVNode// 创建文本vnode
  target._e = createEmptyVNode // 创建空vnode
  target._u = resolveScopedSlots// 转换作用域插槽对象
  target._g = bindObjectListeners// 绑定事件监听对象
  target._d = bindDynamicKeys// 处理v-bind和v-on中动态参数的动态键的帮助函数。
  target._p = prependModifier// 其实就是把内置的几个修饰符替换成标记! ~ &
}

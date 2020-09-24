/* @flow */

/**
 * Runtime helper for rendering static trees.
 * 用于呈现静态树的运行时帮助函数
 */
export function renderStatic (
  index: number,
  isInFor: boolean
): VNode | Array<VNode> {
  const cached = this._staticTrees || (this._staticTrees = []) 
  let tree = cached[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree.
  // 如果静态渲染树存在并且不是再 v-for里面，直接返回这个 tree
  if (tree && !isInFor) {
    return tree
  }
  // otherwise, render a fresh tree. 否则渲染一颗新树
  tree = cached[index] = this.$options.staticRenderFns[index].call(
    this._renderProxy,
    null,
    this // for render fns generated for functional component templates
  )
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 * v-once的运行时帮助程序，这意味着用唯一的键将节点标记为静态
 */
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}
// 标记 tree为静态节点，如果是数组就循环标记
function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}
// 标记为静态节点
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}

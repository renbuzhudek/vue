/* @flow */
// 是否是异步占位节点，通过判断 isComment 和 asyncFactory 属性
export function isAsyncPlaceholder (node: VNode): boolean {
  return node.isComment && node.asyncFactory
}

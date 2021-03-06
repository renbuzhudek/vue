/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }
// 收集watcher
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
// 删除watcher
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
// 添加依赖
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
// 通知watcher调用 update进行更新操作
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
window.Dep=Dep
Dep.target = null
// target 栈
const targetStack = []
// window.targetStack=targetStack
//设置 Dep.target，并压入栈，方便恢复上一个target
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}
// Dep.target 恢复到上一个 target
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}

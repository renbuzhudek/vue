/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'
// 一次性更新的计数器最大值， 100 
export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 * 重置调度器状态
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**同时刷新队列和运行观察者
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()//获取当前的刷新时的时间戳
  flushing = true// 刷新中状态改为 true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
//刷新前对队列排序,这样可以确保：
//1。组件从父级更新到子级。（因为父母总是在孩子之前创建）
//2。组件的用户观察器在其渲染观察器之前运行（因为用户观察程序在渲染观察程序之前创建）
//3。如果某个组件在父组件的观察程序运行期间被销毁，它的观察者可以跳过
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 不要缓存队列长度，因为当运行现有的观察者时可能会有更多的观察者被推送进来
  // 取出队列中的watcher,调用 before ，run 方法，从 has对象中置空对应id
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {//before方法是 创建 renderWatcher 时传入的，用于调用 beforeUpdate 钩子 
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run() //更新
    // in dev build, check and stop circular updates. 
    // 在dev构建中，检查并停止死循环更新
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
// 重置调度程序的所有状态
  resetSchedulerState()

  // call component updated and activated hooks  调用所有组件的 updated 和 activated 钩子
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook   通知devtool插件刷新事件
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
// 队列里面的每个watcher对应的vm实例调用 updated钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}
// 队列里面的每个watcher对应的vm实例调用 active 钩子
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 将观察者推入观察者队列，具有重复ID的作业将被跳过，除非在刷新队列时推送
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {//如果没有开始刷新，推入到队列最后
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // flushing 为true 说明 flushSchedulerQueue 在执行中且并未执行完成(完成时状态会重置为false)，
      // 此时还有watcher被推送进来，说明 watcher 调用get时又有状态发生改变,比如在render函数，watch选项里面修改状态
      //如果已经开始刷新，则根据其id拼接观察程序
//如果已经超过了它的id，它将立即运行。
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush 
    // waiting是一个flag,同一个tick只会在 nextTick里面推入一个 flushSchedulerQueue 任务
    if (!waiting) {
      waiting = true
// 如果不是异步执行，就直接调用
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }//推入微任务队列异步执行
      nextTick(flushSchedulerQueue)
    }
  }
}

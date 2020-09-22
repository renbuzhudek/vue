/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };
// 获取组件名 :参数是 this._vnode.componentOptions
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}
// 根据pattern（组件属性include或exclude） 进行匹配查询返回boolean值
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
// 根据filter函数修剪缓存
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}
// 销毁缓存 键名key
function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key] //取出要销毁的组件
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  abstract: true,//抽象组件
//接收的props
  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created () {
    this.cache = Object.create(null) //对象，用于缓存组件的vnode
    this.keys = []
  },
//keep-alive组件销毁时，清除缓存
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },
// 默认只渲染一个直属子节点
  render () {
    const slot = this.$slots.default  //default插槽，值是一个数组，成员是 vnode
    const vnode: VNode = getFirstComponentChild(slot)   //拿到插槽的第一个直属组件占位节点
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {//如果组件选项存在
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // 无需缓存的vnode直接返回
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      // 构造 key字符串，如果vnode.key属性没有设置，就构造一个，有的话就直接用
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        // 同一个构造函数可以注册不同的本地组件，所以仅靠一个cid（详见:vue\src\core\global-api\extend.js）是不够的
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {
        // 如果该vnode已经被缓存了，修正一下 componentInstance属性
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 下面2句作用是 使用 LRU 最近最少缓存策略（最近使用的追加到数组末尾，溢出删除的时候从数组的头部删除），把命中的key放到数组末尾
        remove(keys, key)
        keys.push(key)
      } else {
        // 进行缓存操作
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry // 超出组件缓存最大数的限制时，从组件头部删除一个
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
        // 组件标记为缓存组建
      vnode.data.keepAlive = true
    }
    // 返回第一个直属组件节点或 插槽的第一个子节点vnode
    return vnode || (slot && slot[0])
  }
}

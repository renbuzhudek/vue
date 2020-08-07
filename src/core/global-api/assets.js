/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'
// 初始化资源注册方法
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   * 创建全局的资源注册方法， component  directive filter，这些都是直接挂到Vue上的类方法
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {//如果只传入id,就返回资源
        return this.options[type + 's'][id]
      } else {//否则就是注册资源
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)//校验id
        }//这一步其实就是调用Vue.extend(),创建得到子类构造函数，打印可以发现Vue.options._base === Vue
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }//将加工后的资源，注册到属性 options 上
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}

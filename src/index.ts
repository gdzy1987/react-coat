import { ComponentType } from "react";
import { Middleware } from "redux";
import { ERROR_ACTION_NAME, INIT_LOCATION_ACTION_NAME, INIT_MODULE_ACTION_NAME, initModuleAction, LOADING_ACTION_NAME, LOCATION_CHANGE_ACTION_NAME, NSP } from "./actions";
import buildApp from "./Application";
import { asyncComponent } from "./asyncImport";
import { injectActions } from "./inject";
import { LoadingState, setLoading, setLoadingDepthTime } from "./loading";
import { buildStore, getStore, storeHistory } from "./storeProxy";
import { Model } from "./types";
import { delayPromise, setGenerator } from "./utils";

const injectedModules: { type: string }[] = [];
const hasInjected: { [moduleName: string]: boolean } = {};
const actionsProxy: { [action: string]: Function } = {};

export function buildModule<T>(namespace: string) {
  const actions: T = actionsProxy as any;
  // if (window["Proxy"]) {
  //   actions = new window["Proxy"](
  //     {},
  //     {
  //       get: (target: {}, key: string) => {
  //         return (data: any) => ({ type: key, data });
  //       }
  //     }
  //   );
  // } else {
  //   actions = actionsProxy as any;
  // }
  return {
    namespace,
    actions
  };
}

export interface BaseModuleState {
  loading: {
    global: string;
  };
}

export function buildActionByReducer<T, S>(reducer: (data: T, moduleState: S, rootState: any) => S) {
  const fun = reducer as any;
  return fun as (data: T) => { type: string; data: T };
}
export function buildActionByEffect<T, S>(effect: (data: T, moduleState: S, rootState: any) => IterableIterator<any>) {
  const fun = setGenerator(effect);
  return fun as (data: T) => { type: string; data: T };
}

export function buildLoading(moduleName: string = "app", group: string = "global") {
  return (target: any, key: string) => {
    const before = () => {
      let loadingCallback: Function | null = null;
      setLoading(
        new Promise<any>((resolve, reject) => {
          loadingCallback = resolve;
        }),
        moduleName,
        group
      );
      return loadingCallback;
    };
    const after = (resolve, error?) => {
      resolve(error);
    };
    if (!target[key]) {
      target[key] = [];
    }
    target[key].push([before, after]);
  };
}
export function buildlogger(before: (actionName: string, moduleName: string) => void, after: (beforeData: any, data: any) => void) {
  return (target: any, key: string) => {
    if (!target[key]) {
      target[key] = [];
    }
    target[key].push([before, after]);
  };
}
function translateMap(cls: any) {
  const ins = new cls();
  const map = {};
  Object.keys(ins).reduce((pre, key) => {
    pre[key] = ins[key];
    return pre;
  }, map);
  const poto = cls.prototype;
  for (const key in poto) {
    if (map[key]) {
      map[key].__decorators__ = poto[key];
    }
  }
  return map as any;
}
export function buildModel<S, A, H>(state: S, actionClass: new () => A, handlerClass: new () => H) {
  const actions: A = translateMap(actionClass);
  const handlers: H = translateMap(handlerClass);
  return { state, actions, handlers };
}

export function buildViews<T>(namespace: string, views: T, model: Model) {
  if (!hasInjected[namespace]) {
    model.actions[namespace + NSP + INIT_MODULE_ACTION_NAME] = buildActionByReducer(function(data: any, moduleState: any, rootState: any) {
      return data;
    });
    model.actions[namespace + NSP + LOADING_ACTION_NAME] = buildActionByReducer(function(loading: { [group: string]: string }, moduleState: any, rootState: any) {
      return {
        ...moduleState,
        loading: { ...moduleState.loading, ...loading }
      };
    });
    const locationChangeHandler = model.handlers[LOCATION_CHANGE_ACTION_NAME];
    if (locationChangeHandler) {
      model.handlers[namespace + NSP + INIT_LOCATION_ACTION_NAME] = locationChangeHandler;
    }
    injectActions(namespace, model.actions);
    injectActions(namespace, model.handlers);
    Object.keys(model.actions).forEach(key => {
      actionsProxy[key] = (data: any) => ({ type: key, data });
    });
    hasInjected[namespace] = true;
    const action = initModuleAction(namespace, model.state);
    const store = getStore();
    if (store) {
      store.dispatch(action);
    } else {
      injectedModules.push(action);
    }
  }
  return views;
}

export interface StoreState<P> {
  router: {
    location: {
      pathname: string;
      search: {};
      hash: string;
      key: string;
    };
  };
  project: P;
}

export function createApp(view: ComponentType<any>, container: string, storeMiddlewares: Middleware[] = [], storeEnhancers: Function[] = []) {
  const store = buildStore(storeMiddlewares, storeEnhancers, injectedModules);
  buildApp(view, container, storeMiddlewares, storeEnhancers, store);
}
export { storeHistory, getStore, asyncComponent, setLoadingDepthTime, setLoading, LoadingState, delayPromise };
export { ERROR_ACTION_NAME, LOCATION_CHANGE_ACTION_NAME };

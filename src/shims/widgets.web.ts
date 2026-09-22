// A WEB STAND-IN FOR expo-widgets.
//
// createLiveActivity() reaches for a native module at import, so on web it took the app down
// before the first screen rendered — a blank page and one console error. Live Activities are
// an iOS Lock Screen and Dynamic Island feature; there is nothing for them to render in a
// browser, and nothing about them for a reviewer to review there.
//
// So the factory returns an object with the same shape and no effect. Nothing pretends an
// activity started: getInstances() is empty, and start() hands back a handle whose methods
// resolve and do nothing.
export type LiveActivityLayout = Record<string, unknown>;

class NoopActivity {
  getId() {
    return '';
  }
  async update() {}
  async end() {}
  async getPushToken() {
    return null;
  }
  addPushTokenListener() {
    return { remove() {} };
  }
}

export function createLiveActivity<T extends object = object>() {
  return {
    start: (_props: T) => new NoopActivity(),
    getInstances: () => [] as NoopActivity[],
  };
}

export function createWidget() {
  return { reload() {}, updateTimeline() {}, updateSnapshot() {}, async getTimeline() { return []; } };
}

export function addUserInteractionListener() {
  return { remove() {} };
}
export function addPushToStartTokenListener() {
  return { remove() {} };
}
export const widgetsDirectory = '';

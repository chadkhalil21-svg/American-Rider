// THE WEB STAND-IN FOR THE LIVE ACTIVITY.
//
// Metro prefers a `.web` file over its neighbour automatically, so this replaces
// TravelActivity.tsx in the web bundle and nothing else has to know.
//
// WHY IT HAS TO EXIST. The real file calls createLiveActivity() at import, which reaches for
// a native module. In a browser that throws before the first screen paints — the whole app
// rendered as a blank page with one console error, which is exactly the state the web build
// was made to escape.
//
// A Live Activity is an iOS Lock Screen and Dynamic Island surface. There is nothing for it
// to draw on the web and nothing about it for a reviewer to review there, so this does
// nothing and says so. It never reports an activity as started: getInstances() is empty and
// start() hands back a handle whose methods resolve without effect. A stub that claimed
// success would put a lie in the one place this codebase keeps having to take them out of.
export type TravelActivityProps = {
  stage: string;
  operator: string;
  destination: string;
  minutes?: number;
  tripNo: string;
};

class NoActivity {
  getId() {
    return '';
  }
  async update() {}
  async end() {}
  async getPushToken(): Promise<string | null> {
    return null;
  }
  addPushTokenListener() {
    return { remove() {} };
  }
}

export const TravelActivity = {
  start: (_props: TravelActivityProps) => new NoActivity(),
  getInstances: () => [] as NoActivity[],
};

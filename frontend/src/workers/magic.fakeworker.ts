// Just like magic.worker, but fake
import * as magic from "../magic/magic";

export default class FakeMagicWorker {
  onmessage: (e: { data: any }) => void;
  postMessage(message) {
    if (this.onmessage) {
      switch (message["cmd"]) {
        case "make":
          var reply = {
            cmd: "schedule",
            val: magic.makeSchedule.apply(null, message["args"])
          };
          this.onmessage({ data: reply });
          break;

        case "next":
          var reply = {
            cmd: "schedule",
            val: magic.nextSchedule()
          };
          this.onmessage({ data: reply });
          break;
      }
    }
  }
  terminate() {
    magic.reset();
  }
}

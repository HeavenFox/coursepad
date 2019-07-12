import * as magic from "../magic/magic";

onmessage = function(e) {
  var message = e.data;
  switch (message["cmd"]) {
    case "make":
      var reply = {
        cmd: "schedule",
        val: magic.makeSchedule.apply(null, message["args"])
      };
      postMessage(reply, "*");
      break;

    case "next":
      var reply = {
        cmd: "schedule",
        val: magic.nextSchedule()
      };
      postMessage(reply, "*");
      break;
  }
};

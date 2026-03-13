import React from "react";

import SplashScreen from "../components/pagelets/SplashScreen.tsx";
import * as campaign from "../store/campaign.js";
import * as modal from "./modal";

export default function welcome() {
  if (process.env.REACT_APP_ALLOW_LOGIN && !campaign.hasRun("welcome_v2")) {
    modal.show(<SplashScreen />);
  }
}

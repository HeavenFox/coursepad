import React from "react";
import BasicInfo from "./sidebar/BasicInfo";
import Basket from "./sidebar/Basket";
import Tools from "./sidebar/Tools";
import Magic from "./sidebar/Magic";
import Sharing from "./sidebar/Sharing";
import IfLoginStatus from "./meta/IfLoginStatus";
import Sync from "./sidebar/Sync";

const Sidebar: React.FC<{}> = props => {
  return (
    <div>
      <BasicInfo />
      <Basket />
      <IfLoginStatus>
        <Sharing />
      </IfLoginStatus>
      <Magic />
      <Sync />
      <Tools />
    </div>
  );
};

export default Sidebar;

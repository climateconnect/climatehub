import { useContext, useState } from "react";
import Cookies from "universal-cookie";
import { apiRequest } from "../../../public/lib/apiOperations";
import UserContext from "../context/UserContext";
import { SHARE_OPTIONS } from "./shareOptions";

//Posts a share-record to the backend whenever content is shared.
//Only one record per session is created for copying the link.
export default function useCreateShareRecord(apiEndpoint: string) {
  const { locale } = useContext(UserContext);
  const cookies = new Cookies();
  const token = cookies.get("token");
  const [linkShared, setLinkShared] = useState(false);

  const createShareRecord = (sharedVia: number) => {
    if (sharedVia === SHARE_OPTIONS.link && linkShared) return; //only create a share-record for the link once per session
    apiRequest({
      method: "post",
      url: apiEndpoint,
      payload: { shared_via: sharedVia },
      token: token,
      locale: locale,
    })
      .then(() => {
        if (sharedVia === SHARE_OPTIONS.link) {
          setLinkShared(true);
        }
      })
      .catch(function (error) {
        console.log(error);
        if (error && error.reponse) console.log(error.response);
      });
  };

  return createShareRecord;
}

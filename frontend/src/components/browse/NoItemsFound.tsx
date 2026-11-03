import { Typography } from "@mui/material";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

export default function NoItemsFound({ type, hubName, className, subHubName }: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "filter_and_search",
    locale: locale,
    filterType: type,
    hubName: hubName,
    subHubName: subHubName,
  });
  return (
    <Typography
      component="h4"
      variant="h5"
      className={className}
      sx={(theme) => ({ textAlign: "center", marginTop: theme.spacing(4) })}
    >
      {texts.could_not_find_any_items_of_type}
    </Typography>
  );
}

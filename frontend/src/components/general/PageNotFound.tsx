import { Link, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Root = styled("div")(({ theme }) => ({
  textAlign: "center",
  paddingTop: theme.spacing(5),
}));

export default function PageNotFound({
  itemName,
  returnText,
  returnLink,
}: {
  itemName?: string;
  returnText?: string;
  returnLink?: string;
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  return (
    <Root>
      <Typography variant="h1">
        {itemName ? `${itemName} ` : texts.page + " "} {texts.not_found_lowercase}
      </Typography>
      <p>
        <Link
          href={
            returnLink ? getLocalePrefix(locale) + returnLink : getLocalePrefix(locale) + "/browse"
          }
          underline="hover"
        >
          {returnText ? returnText : texts.return_to_home}
        </Link>
      </p>
    </Root>
  );
}

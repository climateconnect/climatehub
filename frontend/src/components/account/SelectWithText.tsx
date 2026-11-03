import React from "react";
import { styled } from "@mui/material/styles";
import InsertInvitationIcon from "@mui/icons-material/InsertInvitation";
import GroupIcon from "@mui/icons-material/Group";
import SubTitleWithContent from "../general/SubTitleWithContent";

const SelectContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

const GetInvolvedContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  marginRight: theme.spacing(10),
  [theme.breakpoints.down("md")]: {
    marginRight: theme.spacing(0),
  },
}));

const SizeContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  [theme.breakpoints.down("md")]: {
    marginRight: theme.spacing(0),
  },
}));

export default function SelectWithText({ types, info }) {
  const hideGetInvolvedField =
    types.map((type) => type.hide_get_involved).includes(true) || types.length === 0;

  const orgSizeValue = info.options.find((o) => o?.key === info.value?.organization_size)?.name;
  const orgSizeLabel = info?.organization_size?.name;

  const getInvolvedLabel = info?.get_involved.name;
  const getInvolvedValue = info?.value.get_involved;

  return (
    <SelectContainer>
      {!hideGetInvolvedField && getInvolvedValue && (
        <GetInvolvedContainer>
          <SubTitleWithContent
            subTitleIcon={{ icon: InsertInvitationIcon }}
            subtitle={getInvolvedLabel}
            content={getInvolvedValue}
          />
        </GetInvolvedContainer>
      )}

      {orgSizeValue && (
        <SizeContainer>
          <SubTitleWithContent
            subTitleIcon={{ icon: GroupIcon }}
            subtitle={orgSizeLabel}
            content={orgSizeValue}
          />
        </SizeContainer>
      )}
    </SelectContainer>
  );
}

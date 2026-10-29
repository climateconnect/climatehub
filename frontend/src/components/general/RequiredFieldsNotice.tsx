import { Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Notice = styled(Typography)({
  display: "block",
});

type Props = {
  className?: string;
  variant?: TypographyProps["variant"];
  color?: TypographyProps["color"];
};

/**
 * Small caption shown near form fields to inform users that fields marked
 * with "*" are required. Uses the shared `required_fields_general_notice`
 * translation key. Callers can override the variant, color and pass a
 * className for spacing tweaks.
 */
export default function RequiredFieldsNotice({
  className,
  variant = "caption",
  color = "textSecondary",
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });

  return (
    <Notice variant={variant} color={color} className={className}>
      {texts.required_fields_general_notice}
    </Notice>
  );
}

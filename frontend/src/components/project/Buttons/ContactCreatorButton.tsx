import { Avatar, Button, Collapse, Fade, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import SendIcon from "@mui/icons-material/Send";
import React, { useContext, useState } from "react";
import { getImageUrl } from "../../../../public/lib/imageOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import ContactCreatorButtonInfo from "../../communication/contactcreator/ContactCreatorButtonInfo";

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const Root = styled("div", { shouldForwardProp })<{
  $withInfoCard: boolean;
  $collapsable: boolean;
  $customCardWidth: number;
}>(({ $withInfoCard, $collapsable, $customCardWidth }) => ({
  ...($withInfoCard && {
    height: $collapsable ? 40 : "auto",
    position: "relative",
    width: $customCardWidth ? $customCardWidth : 220,
    zIndex: 1,
  }),
}));

const ButtonContainer = styled("div", { shouldForwardProp })<{ $collapsable: boolean }>(
  ({ $collapsable }) => ({
    ...($collapsable && {
      position: "absolute",
      bottom: 0,
      right: 0,
    }),
    width: "100%",
  })
);

const SmallAvatar = styled(Avatar)(({ theme }) => ({
  height: theme.spacing(3),
  width: theme.spacing(3),
}));

const HelperText = styled(Typography, { shouldForwardProp })<{ $explanationBackground: string }>(
  ({ $explanationBackground }) => ({
    position: "absolute",
    fontSize: 13,
    textAlign: "center",
    cursor: "pointer",
    background: $explanationBackground ? $explanationBackground : "auto",
  })
);

export default function ContactCreatorButton({
  className,
  style,
  creator,
  contactProjectCreatorButtonRef,
  handleClickContact,
  contentType,
  explanationBackground,
  withIcons,
  customCardWidth,
  withInfoCard,
  collapsable,
}: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, creator: creator });
  const [hoveringButton, setHoveringButton] = useState(false);

  const handleMouseEnter = () => {
    setHoveringButton(true);
  };
  const handleMouseLeave = () => {
    setHoveringButton(false);
  };

  const creatorImageURL = getImageUrl(creator?.thumbnail_image);
  const creatorName = creator?.name;
  const creatorsRoleInProject = texts.contact_person;
  const buttonText = texts.contact;

  return (
    <Root
      className={withInfoCard ? className : undefined}
      style={withInfoCard ? style : undefined}
      $withInfoCard={withInfoCard}
      $collapsable={collapsable}
      $customCardWidth={customCardWidth}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClickContact}
    >
      <ButtonContainer $collapsable={collapsable}>
        {withInfoCard &&
          (collapsable ? (
            <Collapse in={hoveringButton} timeout={550}>
              <ContactCreatorButtonInfo
                creatorName={creatorName}
                creatorImageURL={creatorImageURL}
                creatorsRoleInProject={creatorsRoleInProject}
              />
            </Collapse>
          ) : (
            <ContactCreatorButtonInfo
              creatorName={creatorName}
              creatorImageURL={creatorImageURL}
              creatorsRoleInProject={creatorsRoleInProject}
            />
          ))}
        <Button
          className={withInfoCard ? undefined : className}
          sx={withInfoCard ? { height: 40, width: "100%" } : undefined}
          variant="contained"
          color="primary"
          startIcon={withIcons ? <SendIcon /> : null}
          endIcon={withIcons ? <SmallAvatar src={creatorImageURL} /> : null}
          ref={contactProjectCreatorButtonRef}
        >
          {buttonText}
        </Button>
        {collapsable && (
          <Fade in={hoveringButton}>
            <HelperText $explanationBackground={explanationBackground}>
              {texts[`contact_creator_to_know_more_about_${contentType ? contentType : "project"}`]}
            </HelperText>
          </Fade>
        )}
      </ButtonContainer>
    </Root>
  );
}

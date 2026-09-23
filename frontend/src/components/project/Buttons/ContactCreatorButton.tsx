import { Avatar, Button, Collapse, Fade, Theme, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import SendIcon from "@mui/icons-material/Send";
import React, { useContext, useState } from "react";
import { getImageUrl } from "../../../../public/lib/imageOperations";
import getTexts from "../../../../public/texts/texts";
import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import ContactCreatorButtonInfo from "../../communication/contactcreator/ContactCreatorButtonInfo";

const useStyles = makeStyles<
  Theme,
  { collapsable: boolean; customCardWidth: number; explanationBackground: string }
>({
  root: (props) => ({
    height: props.collapsable ? 40 : "auto",
    position: "relative",
    width: props.customCardWidth ? props.customCardWidth : 220,
    zIndex: 1,
  }),
  smallAvatar: {
    height: theme.spacing(3),
    width: theme.spacing(3),
  },
  slideInCard: {
    display: "flex",
    justifyContent: "center",
    backgroundColor: "#F8F8F8",
    cursor: "pointer",
  },
  slideInRoot: {
    textAlign: "left",
    maxWidth: "100%",
  },
  textContainer: {
    // theme.spacing(2): the right margin of the card's avatar (mui default)
    // 50px: the width of the card's avatar (see class 'avatar')
    maxWidth: `calc(100% - (${theme.spacing(2)} + 50px))`,
  },
  slideInSubheader: {
    color: "black",
  },
  slideInTitle: {
    fontWeight: "bold",
  },
  preventTextOverflow: {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  collapsableContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  applyCustomCardWidth: {
    width: "100%",
  },
  contactButton: {
    height: 40,
    width: "100%",
  },
  helperText: (props) => ({
    position: "absolute",
    fontSize: 13,
    textAlign: "center",
    cursor: "pointer",
    background: props.explanationBackground ? props.explanationBackground : "auto",
  }),
  avatar: {
    height: 50,
    width: 50,
  },
});
export default function ContactCreatorButton({
  className,
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
  const classes = useStyles({
    explanationBackground: explanationBackground,
    customCardWidth: customCardWidth,
    collapsable: collapsable,
  });
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
    <div
      className={withInfoCard ? `${classes.root} ${className}` : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClickContact}
    >
      <div
        className={`${collapsable ? classes.collapsableContainer : ""} ${
          classes.applyCustomCardWidth
        }`}
      >
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
          className={withInfoCard ? classes.contactButton : className}
          variant="contained"
          color="primary"
          startIcon={withIcons ? <SendIcon /> : null}
          endIcon={
            withIcons ? <Avatar src={creatorImageURL} className={classes.smallAvatar} /> : null
          }
          ref={contactProjectCreatorButtonRef}
        >
          {buttonText}
        </Button>
        {collapsable && (
          <Fade in={hoveringButton}>
            <Typography className={classes.helperText}>
              {texts[`contact_creator_to_know_more_about_${contentType ? contentType : "project"}`]}
            </Typography>
          </Fade>
        )}
      </div>
    </div>
  );
}

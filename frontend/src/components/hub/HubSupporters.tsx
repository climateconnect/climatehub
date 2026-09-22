import React, { useContext, useState } from "react";
import makeStyles from "@mui/styles/makeStyles";
import Carousel from "react-multi-carousel";
import { Theme, useMediaQuery, Typography, Button } from "@mui/material";
import UserContext from "../context/UserContext";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import AppLink from "../general/AppLink";
import HubSupportersDialog from "../dialogs/HubSupportersDialog";
import { Supporter } from "../../types";

type HubSupporter = {
  supportersList: Supporter[];
  containerClass?: string;
  mobileVersion?: boolean;
  hubName: string;
  hubUrl?: string;
};

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.primary.main,
    borderRadius: 4,
    paddingRight: "5px",
    paddingLeft: "5px",
    paddingBottom: "20px",
    width: 320,
    [`@media (min-width: 900px) and (max-width: 1200px)`]: {
      alignSelf: "end",
    },
  },
  carouseltitle: {
    color: theme.palette?.primary?.contrastText,
    fontSize: "13px",
    margin: "2px",
    textAlign: "center",
  },
  carouselContainer: {
    backgroundColor: theme.palette.background.default,
    borderRadius: "4px",
    position: "relative",
  },
  customDot: {
    bottom: "-16px",
    // access the class name of the react-multi-carousel to change the dot color
    "& .react-multi-carousel-dot--active button": {
      background: "white",
    },
    "& li button": {
      width: "7px",
      height: "7px",
      border: "none",
      background: theme.palette.primary.light,
    },
  },
  itemContainer: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },
  supporterImg: {
    borderRadius: "50%",
  },
  supporterImgStandaloneContainer: {
    width: 310,
    height: 92,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  supporterImgStandalone: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  supporterName: {
    fontSize: "17px",
    fontWeight: "600",
    color: "black",
    margin: 0,
    wordBreak: "break-word",
  },
  supporterSubtitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: "normal",
    color: "#484848",
    overflow: "hidden",
    wordBreak: "break-word",
  },
  carouselEntry: {
    padding: " 8px",
    display: "flex",
    justifyContent: "left",
    [theme.breakpoints.down("md")]: {
      padding: 0,
    },
    height: "100%",
  },
  containerInSmallDevices: {
    display: "flex",
    gap: "20px",
    width: "100%",
    alignItems: "center",
    backgroundColor: "#EEEFEE",
    borderRadius: "4px",
    padding: "10px",
    marginBottom: theme.spacing(3),
  },
  supporterImgSmallDevice: {
    borderRadius: "50%",
  },
  textAlign: {
    marginLeft: "auto",
  },
  allSupporters: {
    display: "flex",
    alignItems: "center",
    color: "#484848",
    fontWeight: "600",
    fontSize: "17px",
    textTransform: "none",
    [theme.breakpoints.down("sm")]: {
      fontSize: "15px",
    },
  },
  arrowIcon: {
    color: theme.palette.background.default_contrastText,
  },
}));

const HubSupporters = ({
  supportersList,
  containerClass,
  mobileVersion,
  hubName,
  hubUrl,
}: HubSupporter) => {
  const classes = useStyles({ containerClass: containerClass });
  const isSmallOrMediumScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const [openSupportersDialog, setOpenSupportersDialog] = useState(false);
  const toggleOpenSupportersDialog = () => {
    setOpenSupportersDialog(!openSupportersDialog);
  };

  return (
    <>
      {!isSmallOrMediumScreen && !mobileVersion ? (
        <HubSupportersSlider
          classes={classes}
          texts={texts}
          containerClass={containerClass}
          supportersList={supportersList}
        />
      ) : (
        <>
          <HubSupportersInSmallDevice
            classes={classes}
            containerClass={containerClass}
            supportersList={supportersList}
            texts={texts}
            showAllSupporters={toggleOpenSupportersDialog}
          />
          <HubSupportersDialog
            supporters={supportersList}
            open={openSupportersDialog}
            onClose={toggleOpenSupportersDialog}
            hubName={hubName}
            hubUrl={hubUrl}
          />
        </>
      )}
    </>
  );
};

export default HubSupporters;

const CarouselItem = ({ supporter, classes }) => {
  const organizationHref = `/organizations/${supporter?.organization_url_slug}`;
  return (
    <div className={classes.carouselEntry} key={supporter.name}>
      {supporter?.standalone_image ? (
        <div className={classes.supporterImgStandaloneContainer}>
          <img
            src={getImageUrl(supporter?.standalone_image)}
            alt={supporter.name}
            className={classes.supporterImgStandalone}
          />
        </div>
      ) : (
        <div className={classes.itemContainer}>
          <img
            src={getImageUrl(supporter?.logo)}
            width={76}
            height={76}
            alt={supporter.name}
            className={classes.supporterImg}
          />
          <div>
            <p className={classes.supporterName}>
              {supporter?.organization_url_slug ? (
                <AppLink href={organizationHref} underline="none" className={classes.supporterName}>
                  {supporter?.name}
                </AppLink>
              ) : (
                supporter?.name
              )}
            </p>
            <p className={classes.supporterSubtitle}>{supporter.subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const HubSupportersSlider = ({ classes, texts, containerClass, supportersList }) => {
  const responsive = {
    all: {
      breakpoint: { max: 10000, min: 0 },
      items: 1,
    },
  };
  return (
    <div className={`${classes.root} ${containerClass}`}>
      <p className={classes.carouseltitle}>{texts.the_climatehub_is_supported_by + " :"}</p>
      <div className={classes.carouselContainer}>
        <Carousel
          responsive={responsive}
          infinite={supportersList?.length > 1}
          arrows={false}
          showDots={true}
          renderDotsOutside={true}
          dotListClass={classes.customDot}
          autoPlay={true}
          autoPlaySpeed={10000}
        >
          {supportersList?.length > 0 &&
            supportersList.map((supporter) => (
              <CarouselItem
                key={supporter?.organization_url_slug}
                supporter={supporter}
                classes={classes}
              />
            ))}
        </Carousel>
      </div>
    </div>
  );
};

const HubSupportersInSmallDevice = ({
  classes,
  containerClass,
  supportersList,
  texts,
  showAllSupporters,
}) => {
  const slicedSupporterForSmallDevice = supportersList.slice(0, 3);

  return (
    <Button
      onClick={showAllSupporters}
      className={`${classes.containerInSmallDevices} ${containerClass}`}
    >
      {supportersList?.length > 0 &&
        slicedSupporterForSmallDevice.map((supporter) => (
          <img
            src={getImageUrl(supporter?.logo)}
            width={45}
            height={45}
            alt={supporter.name}
            className={classes.supporterImgSmallDevice}
            key={supporter.name}
          />
        ))}
      <Typography className={classes.textAlign}>
        <div className={classes.allSupporters}>
          {texts.all_supporters} <ArrowRightIcon className={classes.arrowIcon} />{" "}
        </div>
      </Typography>
    </Button>
  );
};
